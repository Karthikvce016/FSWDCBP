import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import app, { Attendance, AuditLog, Course, Enrollment, Student, Tenant, User } from "../src/server.js";

let server;
let baseUrl;
let collegeA;
let collegeB;
let testTenant;
let testTenantId;
let studentA;
let studentB;
let adminA;
let adminB;
let studentUser;
let studentUserB;
let facultyUser;
let unique;

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI before running server tests");
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([Tenant.init(), User.init(), Student.init(), AuditLog.init(), Course.init(), Enrollment.init(), Attendance.init()]);

  unique = `test-${process.pid}-${Date.now()}`;
  collegeA = await Tenant.create({ name: "Test College A", slug: `${unique}-a` });
  collegeB = await Tenant.create({ name: "Test College B", slug: `${unique}-b` });
  const passwordHash = await bcrypt.hash("TestPassword123!", 4);
  [adminA, adminB, studentUser, studentUserB, facultyUser] = await User.create([
    { tenantId: collegeA._id, name: "Test Admin A", email: `${unique}-admin-a@example.test`, passwordHash, role: "college_admin" },
    { tenantId: collegeB._id, name: "Test Admin B", email: `${unique}-admin-b@example.test`, passwordHash, role: "college_admin" },
    { tenantId: collegeA._id, name: "Test Student A", email: `${unique}-student-a@example.test`, passwordHash, role: "student" },
    { tenantId: collegeB._id, name: "Test Student B", email: `${unique}-student-b@example.test`, passwordHash, role: "student" },
    { tenantId: collegeA._id, name: "Test Faculty", email: `${unique}-faculty@example.test`, passwordHash, role: "faculty" }
  ]);
  [studentA, studentB] = await Student.create([
    { tenantId: collegeA._id, userId: studentUser._id, studentNumber: "TA001", department: "CSE", year: 2 },
    { tenantId: collegeB._id, userId: studentUserB._id, studentNumber: "TB001", department: "ECE", year: 3 }
  ]);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (collegeA && collegeB) {
    const ids = [collegeA._id, collegeB._id];
    await Promise.all([
      AuditLog.deleteMany({ $or: [{ tenantId: { $in: ids } }, { entityId: { $in: [studentA?._id, studentB?._id, testTenantId].filter(Boolean) } }] }),
      Attendance.deleteMany({ tenantId: { $in: ids } }),
      Enrollment.deleteMany({ tenantId: { $in: ids } }),
      Course.deleteMany({ tenantId: { $in: ids } }),
      Student.deleteMany({ tenantId: { $in: ids } }),
      User.deleteMany({ tenantId: { $in: ids } }),
      Tenant.deleteMany({ _id: { $in: [...ids, ...(testTenantId ? [testTenantId] : [])] } })
    ]);
  }
  await mongoose.disconnect();
});

async function login(tenantSlug, email, password = "TestPassword123!") {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_URL || "http://localhost:5173" },
    body: JSON.stringify({ tenantSlug, email, password })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "login should set the HTTP-only session cookie");
  const body = await response.json();
  assert.equal("passwordHash" in body.user, false);
  return cookie;
}

async function api(path, cookie, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: process.env.CLIENT_URL || "http://localhost:5173",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
}

test("sessions, role checks, tenant isolation, CRUD and audit logs work", async () => {
  const invalidLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_URL || "http://localhost:5173" },
    body: JSON.stringify({ tenantSlug: collegeA.slug, email: adminA.email, password: "wrong-password" })
  });
  assert.equal(invalidLogin.status, 401);

  await Tenant.updateOne({ _id: collegeB._id }, { status: "suspended" });
  const suspendedLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_URL || "http://localhost:5173" },
    body: JSON.stringify({ tenantSlug: collegeB.slug, email: adminB.email, password: "TestPassword123!" })
  });
  assert.equal(suspendedLogin.status, 401);
  await Tenant.updateOne({ _id: collegeB._id }, { status: "active" });
  await User.updateOne({ _id: adminA._id }, { status: "disabled" });
  const disabledLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_URL || "http://localhost:5173" },
    body: JSON.stringify({ tenantSlug: collegeA.slug, email: adminA.email, password: "TestPassword123!" })
  });
  assert.equal(disabledLogin.status, 401);
  await User.updateOne({ _id: adminA._id }, { status: "active" });

  const cookieA = await login(collegeA.slug, adminA.email);
  const cookieB = await login(collegeB.slug, adminB.email);
  const cookieStudent = await login(collegeA.slug, studentUser.email);
  const cookieFaculty = await login(collegeA.slug, facultyUser.email);
  const platformCookie = await login("platform", "admin@platform.example", "ReviewDemo123!");

  const [listAResponse, listBResponse] = await Promise.all([
    api("/students", cookieA),
    api("/students", cookieB)
  ]);
  const [listA, listB] = await Promise.all([listAResponse.json(), listBResponse.json()]);
  assert.deepEqual(listA.data.map((student) => student.studentNumber), ["TA001"]);
  assert.deepEqual(listB.data.map((student) => student.studentNumber), ["TB001"]);
  assert.equal(listA.pagination.total, 1);
  assert.equal(listA.pagination.page, 1);
  assert.equal(listA.pagination.limit, 10);
  const facultyList = await api("/students", cookieFaculty).then((response) => response.json());
  assert.deepEqual(facultyList.data.map((student) => student.studentNumber), ["TA001"]);
  assert.equal((await api("/audit-logs", cookieFaculty)).status, 403);

  assert.equal((await api(`/students/${studentB.id}`, cookieA)).status, 404);
  assert.equal((await api(`/students/${studentB.id}`, cookieA, { method: "PATCH", body: JSON.stringify({ department: "CSE" }) })).status, 404);
  assert.equal((await api(`/students/${studentB.id}`, cookieA, { method: "DELETE" })).status, 404);
  assert.equal((await api("/students?tenantId=somewhere-else", cookieA)).status, 400);
  assert.equal((await api("/students?page=1.5", cookieA)).status, 400);
  assert.equal((await api("/students?limit=51", cookieA)).status, 400);
  assert.equal((await api("/students", null)).status, 401);
  const noOrigin = await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: { Cookie: cookieA } });
  assert.equal(noOrigin.status, 403, "state-changing requests must validate their Origin");

  const forbidden = await api("/students", cookieStudent, {
    method: "POST",
    body: JSON.stringify({ name: "No Access", email: `${unique}-no@example.test`, password: "TestPassword123!", studentNumber: "NO001", department: "CSE", year: 1 })
  });
  assert.equal(forbidden.status, 403);
  const facultyCreate = await api("/students", cookieFaculty, {
    method: "POST",
    body: JSON.stringify({ name: "No Access", email: `${unique}-faculty-create@example.test`, password: "TestPassword123!", studentNumber: "NO002", department: "CSE", year: 1 })
  });
  assert.equal(facultyCreate.status, 403);
  const ownProfile = await api(`/students/${studentA.id}`, cookieStudent);
  assert.equal((await ownProfile.json()).data.studentNumber, "TA001");
  assert.equal((await api(`/students/${studentB.id}`, cookieStudent)).status, 404);

  const createdResponse = await api("/students", cookieA, {
    method: "POST",
    body: JSON.stringify({ name: "Created Student", email: `${unique}-created@example.test`, password: "TestPassword123!", studentNumber: "TA002", department: "CSE", year: 1, tenantId: collegeB.id })
  });
  assert.equal(createdResponse.status, 400, "unknown tenant fields must be rejected");
  const roleInjection = await api("/students", cookieA, {
    method: "POST",
    body: JSON.stringify({ name: "Role Injection", email: `${unique}-role@example.test`, password: "TestPassword123!", studentNumber: "TA099", department: "CSE", year: 1, role: "college_admin" })
  });
  assert.equal(roleInjection.status, 400, "client-supplied roles must be rejected");

  const duplicateNumberResponse = await api("/students", cookieA, {
    method: "POST",
    body: JSON.stringify({ name: "Duplicate Number", email: `${unique}-duplicate@example.test`, password: "TestPassword123!", studentNumber: "TA001", department: "CSE", year: 1 })
  });
  assert.equal(duplicateNumberResponse.status, 409);

  const createResponse = await api("/students", cookieA, {
    method: "POST",
    body: JSON.stringify({ name: "Created Student", email: `${unique}-created@example.test`, password: "TestPassword123!", studentNumber: "TA002", department: "CSE", year: 1 })
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).data;
  assert.equal("passwordHash" in created, false);

  const updateResponse = await api(`/students/${created.id}`, cookieA, {
    method: "PATCH",
    body: JSON.stringify({ department: "IT", year: 2 })
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).data.department, "IT");
  assert.equal((await api(`/students/${created.id}`, cookieB)).status, 404);

  const originalAuditCreate = AuditLog.create;
  const originalConsoleError = console.error;
  AuditLog.create = async function (record, ...args) {
    if (record.action === "student.created" && record.after.studentNumber === "TA003") throw new Error("simulated audit failure");
    return originalAuditCreate.call(this, record, ...args);
  };
  console.error = () => {};
  try {
    const failedCreate = await api("/students", cookieA, {
      method: "POST",
      body: JSON.stringify({ name: "Audit Failure", email: `${unique}-audit-failure@example.test`, password: "FailurePassword123!", studentNumber: "TA003", department: "CSE", year: 1 })
    });
    assert.equal(failedCreate.status, 500);
    assert.equal(await User.countDocuments({ tenantId: collegeA._id, email: `${unique}-audit-failure@example.test` }), 0);
    assert.equal(await Student.countDocuments({ tenantId: collegeA._id, studentNumber: "TA003" }), 0);
  } finally {
    AuditLog.create = originalAuditCreate;
    console.error = originalConsoleError;
  }

  const auditResponse = await api("/audit-logs?page=1&limit=20", cookieA);
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json();
  assert.ok(audit.data.some((event) => event.action === "student.created"));
  assert.ok(audit.data.some((event) => event.action === "student.updated"));
  assert.equal(JSON.stringify(audit.data).includes("passwordHash"), false);
  assert.equal(JSON.stringify(audit.data).includes("TestPassword123!"), false);
  assert.equal((await api("/audit-logs", cookieStudent)).status, 403);
  const tenantAudits = await api("/audit-logs", cookieB).then((response) => response.json());
  assert.equal(tenantAudits.pagination.total, 0);

  const tenants = await api(`/tenants?page=1&limit=50`, platformCookie).then((response) => response.json());
  assert.ok(tenants.data.some((tenant) => tenant.slug === collegeA.slug));
  assert.equal((await api("/tenants", cookieA)).status, 403);
  const createdTenantResponse = await api("/tenants", platformCookie, {
    method: "POST",
    body: JSON.stringify({ name: "Temporary Test College", slug: `${unique}-new`, adminName: "New College Admin", adminEmail: `${unique}-new-admin@example.test`, adminPassword: "NewAdminPassword123!" })
  });
  assert.equal(createdTenantResponse.status, 201);
  testTenant = (await createdTenantResponse.json()).data;
  testTenantId = testTenant.id;
  assert.equal(testTenant.administrator.email, `${unique}-new-admin@example.test`);

  const deletedResponse = await api(`/students/${created.id}`, cookieA, { method: "DELETE" });
  assert.equal(deletedResponse.status, 200);
  assert.equal((await api(`/students/${created.id}`, cookieA)).status, 404);
  const deleteAudit = await api("/audit-logs?action=student.deleted", cookieA).then((response) => response.json());
  assert.ok(deleteAudit.data.some((event) => event.entityId === created.id));

  const logoutResponse = await api("/auth/logout", cookieA, { method: "POST" });
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
});
