import "dotenv/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z, ZodError } from "zod";

const app = express();
const frontendUrl = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = new Set([frontendUrl, "http://localhost:5173", "http://127.0.0.1:5173"]);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, enum: ["active", "suspended"], default: "active" }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["platform_admin", "college_admin", "faculty", "student"], required: true },
  status: { type: String, enum: ["active", "disabled"], default: "active" }
}, { timestamps: true });
userSchema.index({ tenantId: 1, email: 1 }, {
  unique: true,
  partialFilterExpression: { tenantId: { $type: "objectId" } }
});
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { tenantId: null } });

const studentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  studentNumber: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  year: { type: Number, required: true, min: 1, max: 4 }
}, { timestamps: true });
studentSchema.index({ tenantId: 1, studentNumber: 1 }, { unique: true });
studentSchema.index({ tenantId: 1, createdAt: -1, _id: -1 });

const auditSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true, versionKey: false });
 auditSchema.index({ tenantId: 1, createdAt: -1, _id: -1 });

const courseSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true }, code: { type: String, required: true, trim: true, uppercase: true },
  department: { type: String, required: true, trim: true }, description: { type: String, trim: true, default: "" },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });
courseSchema.index({ tenantId: 1, code: 1 }, { unique: true });
const enrollmentSchema = new mongoose.Schema({ tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true }, studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true }, courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true } }, { timestamps: true });
enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
const attendanceSchema = new mongoose.Schema({ tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true }, studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true }, courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true }, date: { type: Date, required: true }, status: { type: String, enum: ["Present", "Absent"], required: true }, recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: true });
attendanceSchema.index({ studentId: 1, courseId: 1, date: 1 }, { unique: true });

export const Tenant = mongoose.model("Tenant", tenantSchema);
export const User = mongoose.model("User", userSchema);
export const Student = mongoose.model("Student", studentSchema);
export const AuditLog = mongoose.model("AuditLog", auditSchema);
export const Course = mongoose.model("Course", courseSchema);
export const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
export const Attendance = mongoose.model("Attendance", attendanceSchema);

const loginInput = z.object({
  tenantSlug: z.string().trim().min(1).max(100).toLowerCase(),
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(1).max(128)
}).strict();
const studentCreateInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(8).max(128),
  studentNumber: z.string().trim().min(1).max(30),
  department: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(1).max(4)
}).strict();
const studentUpdateInput = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).toLowerCase().optional(),
  studentNumber: z.string().trim().min(1).max(30).optional(),
  department: z.string().trim().min(1).max(100).optional(),
  year: z.coerce.number().int().min(1).max(4).optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
const pageInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

// Unsafe browser requests must come from the configured frontend origin.
function checkRequestOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!allowedOrigins.has(req.get("origin"))) return res.status(403).json({ message: "Request origin is not allowed" });
  next();
}
app.use("/api", checkRequestOrigin);

function sendError(error, req, res, next) {
  if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.issues });
  if (error instanceof mongoose.Error.ValidationError) return res.status(400).json({ message: "Invalid data" });
  if (error instanceof mongoose.Error.CastError) return res.status(400).json({ message: "Invalid identifier" });
  if (error.code === 11000) return res.status(409).json({ message: "Record already exists" });
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId?.toString() ?? null };
}

function safeStudent(student) {
  const profile = student.userId;
  const tenant = student.tenantId?.name ? student.tenantId : null;
  return {
    id: student.id,
    studentNumber: student.studentNumber,
    department: student.department,
    year: student.year,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    name: profile?.name,
    email: profile?.email,
    college: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null
  };
}

function studentSnapshot(student, user) {
  return {
    name: user.name,
    email: user.email,
    studentNumber: student.studentNumber,
    department: student.department,
    year: student.year
  };
}

async function authenticate(req, res, next) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "Server configuration error" });
    if (!req.cookies.accessToken) return res.status(401).json({ message: "Authentication required" });
    const payload = jwt.verify(req.cookies.accessToken, secret);
    if (typeof payload === "string" || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ message: "Invalid session" });
    }
    const user = await User.findById(payload.sub);
    if (!user || user.status !== "active") return res.status(401).json({ message: "Invalid session" });
    if (user.tenantId) {
      const tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status !== "active") return res.status(403).json({ message: "College unavailable" });
    }
    req.auth = { userId: user.id, tenantId: user.tenantId, role: user.role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired session" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ message: "Permission denied" });
    next();
  };
}

function getTenantFilter(auth) {
  if (auth.role === "platform_admin") return {};
  return auth.tenantId ? { tenantId: auth.tenantId } : null;
}

app.get("/api/health", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "unavailable" });
});

app.get("/api/auth/colleges", async (req, res, next) => {
  try {
    const colleges = await Tenant.find({ status: "active" }).sort({ name: 1 }).select("name slug");
    res.json({ data: colleges.map((c) => ({ id: c.id, name: c.name, slug: c.slug })) });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const input = loginInput.parse(req.body);
    const tenant = input.tenantSlug === "platform"
      ? null
      : await Tenant.findOne({ slug: input.tenantSlug, status: "active" });
    if (input.tenantSlug !== "platform" && !tenant) return res.status(401).json({ message: "Invalid credentials" });
    const user = await User.findOne({ tenantId: tenant?._id ?? null, email: input.email }).select("+passwordHash");
    if (!user || user.status !== "active" || (input.tenantSlug === "platform" && user.role !== "platform_admin") || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing");
    const token = jwt.sign({}, process.env.JWT_SECRET, { subject: user.id, expiresIn: "2h" });
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000
    });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("accessToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  res.json({ message: "Logged out" });
});

app.get("/api/auth/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(401).json({ message: "Authentication required" });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.get("/api/tenants", authenticate, requireRole("platform_admin"), async (req, res, next) => {
  try {
    const query = pageInput.strict().safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: "Invalid pagination parameters" });
    const { page, limit } = query.data;
    const total = await Tenant.countDocuments();
    const data = await Tenant.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).select("name slug status createdAt");
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

app.get("/api/tenants/:id", authenticate, requireRole("platform_admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "College not found" });
    const tenant = await Tenant.findById(req.params.id).select("name slug status createdAt");
    if (!tenant) return res.status(404).json({ message: "College not found" });
    const [admin, faculty, students, courses] = await Promise.all([
      User.findOne({ tenantId: tenant._id, role: "college_admin" }).select("name email createdAt"),
      User.find({ tenantId: tenant._id, role: "faculty", status: "active" }).sort({ name: 1 }).select("name email createdAt"),
      Student.find({ tenantId: tenant._id }).sort({ studentNumber: 1 }).populate("userId", "name email").populate("tenantId", "name slug"),
      Course.find({ tenantId: tenant._id }).sort({ code: 1 }).populate("facultyId", "name")
    ]);
    res.json({
      data: {
        college: tenant,
        administrator: admin ? { id: admin.id, name: admin.name, email: admin.email, createdAt: admin.createdAt } : null,
        faculty: faculty.map((f) => ({ id: f.id, name: f.name, email: f.email, createdAt: f.createdAt })),
        students: students.map(safeStudent),
        courses: courses.map(courseView)
      }
    });
  } catch (error) { next(error); }
});

app.post("/api/tenants", authenticate, requireRole("platform_admin"), async (req, res, next) => {
  let tenant; let admin;
  try {
    const input = z.object({
      name: z.string().trim().min(1).max(100),
      slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).toLowerCase(),
      adminName: z.string().trim().min(1).max(100), adminEmail: z.string().trim().email().max(254).toLowerCase(), adminPassword: z.string().min(8).max(128)
    }).strict().parse(req.body);
    tenant = await Tenant.create({ name: input.name, slug: input.slug });
    admin = await User.create({ tenantId: tenant._id, name: input.adminName, email: input.adminEmail, passwordHash: await bcrypt.hash(input.adminPassword, 12), role: "college_admin" });
    try {
      await AuditLog.create({ tenantId: null, actorId: req.auth.userId, action: "tenant.created", entityType: "tenant", entityId: tenant._id, after: { name: tenant.name, slug: tenant.slug, status: tenant.status, administrator: admin.email } });
    } catch (error) {
      await User.deleteOne({ _id: admin._id }); await Tenant.deleteOne({ _id: tenant._id });
      throw error;
    }
    res.status(201).json({ data: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status, administrator: { name: admin.name, email: admin.email } } });
  } catch (error) { if (admin) await User.deleteOne({ _id: admin._id }).catch(() => {}); if (tenant) await Tenant.deleteOne({ _id: tenant._id }).catch(() => {}); next(error); }
});

app.get("/api/students", authenticate, async (req, res, next) => {
  try {
    const querySchema = pageInput.extend({
      department: z.string().trim().min(1).max(100).optional(),
      year: z.coerce.number().int().min(1).max(4).optional()
    }).strict();
    const query = querySchema.safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: "Invalid student filters or pagination" });
    const { page, limit, department, year } = query.data;
    const filter = getTenantFilter(req.auth);
    if (filter === null) return res.status(403).json({ message: "Permission denied" });
    if (req.auth.role === "student") filter.userId = new mongoose.Types.ObjectId(req.auth.userId);
    if (department) filter.department = department;
    if (year) filter.year = year;
    const total = await Student.countDocuments(filter);
    const rows = await Student.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "name email")
      .populate("tenantId", "name slug");
    res.json({ data: rows.map(safeStudent), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

app.post("/api/students", authenticate, requireRole("college_admin"), async (req, res, next) => {
  let user;
  try {
    const input = studentCreateInput.parse(req.body);
    if (!req.auth.tenantId) return res.status(403).json({ message: "College required" });
    user = await User.create({ tenantId: req.auth.tenantId, name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), role: "student" });
    const student = await Student.create({ tenantId: req.auth.tenantId, userId: user._id, studentNumber: input.studentNumber, department: input.department, year: input.year });
    try {
      await AuditLog.create({
        tenantId: req.auth.tenantId,
        actorId: req.auth.userId,
        action: "student.created",
        entityType: "student",
        entityId: student._id,
        after: studentSnapshot(student, user)
      });
    } catch (error) {
      await Student.deleteOne({ _id: student._id });
      await User.deleteOne({ _id: user._id });
      throw error;
    }
    res.status(201).json({ data: { id: student.id, studentNumber: student.studentNumber, department: student.department, year: student.year, name: user.name, email: user.email } });
  } catch (error) {
    if (user) {
      await Student.deleteOne({ userId: user._id }).catch(() => {});
      await User.deleteOne({ _id: user._id }).catch(() => {});
    }
    next(error);
  }
});

app.get("/api/students/:id", authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Student not found" });
    const filter = getTenantFilter(req.auth);
    if (filter === null) return res.status(403).json({ message: "Permission denied" });
    filter._id = req.params.id;
    if (req.auth.role === "student") filter.userId = req.auth.userId;
    const student = await Student.findOne(filter).populate("userId", "name email");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ data: safeStudent(student) });
  } catch (error) { next(error); }
});

app.patch("/api/students/:id", authenticate, requireRole("college_admin"), async (req, res, next) => {
  try {
    const input = studentUpdateInput.parse(req.body);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Student not found" });
    const student = await Student.findOne({ _id: req.params.id, tenantId: req.auth.tenantId });
    if (!student) return res.status(404).json({ message: "Student not found" });
    const user = await User.findOne({ _id: student.userId, tenantId: req.auth.tenantId });
    if (!user) return res.status(404).json({ message: "Student not found" });
    const before = studentSnapshot(student, user);
    const oldStudent = { studentNumber: student.studentNumber, department: student.department, year: student.year };
    const oldUser = { name: user.name, email: user.email };
    Object.assign(student, { studentNumber: input.studentNumber ?? student.studentNumber, department: input.department ?? student.department, year: input.year ?? student.year });
    Object.assign(user, { name: input.name ?? user.name, email: input.email ?? user.email });
    try {
      await student.save();
      await user.save();
      const after = studentSnapshot(student, user);
      await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "student.updated", entityType: "student", entityId: student._id, before, after });
      res.json({ data: { id: student.id, ...after } });
    } catch (error) {
      Object.assign(student, oldStudent);
      Object.assign(user, oldUser);
      await Promise.allSettled([student.save(), user.save()]);
      throw error;
    }
  } catch (error) { next(error); }
});

app.delete("/api/students/:id", authenticate, requireRole("college_admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Student not found" });
    const student = await Student.findOne({ _id: req.params.id, tenantId: req.auth.tenantId });
    if (!student) return res.status(404).json({ message: "Student not found" });
    const user = await User.findOne({ _id: student.userId, tenantId: req.auth.tenantId }).select("+passwordHash");
    if (!user) return res.status(404).json({ message: "Student not found" });
    const before = studentSnapshot(student, user);
    await Enrollment.deleteMany({ studentId: student._id });
    await Attendance.deleteMany({ studentId: student._id });
    await Student.deleteOne({ _id: student._id });
    await User.deleteOne({ _id: user._id });
    try {
      await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "student.deleted", entityType: "student", entityId: student._id, before });
    } catch (error) {
      await Promise.allSettled([Student.create(student.toObject()), User.create(user.toObject())]);
      throw error;
    }
    res.json({ message: "Student deleted" });
  } catch (error) { next(error); }
});

app.post("/api/students/:id/reset-password", authenticate, requireRole("platform_admin", "college_admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Student not found" });
    const filter = getTenantFilter(req.auth);
    if (filter === null) return res.status(403).json({ message: "Permission denied" });
    filter._id = req.params.id;
    const student = await Student.findOne(filter);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const user = await User.findById(student.userId);
    if (!user) return res.status(404).json({ message: "Student user account not found" });
    user.passwordHash = await bcrypt.hash("student123", 12);
    await user.save();
    await AuditLog.create({
      tenantId: student.tenantId,
      actorId: req.auth.userId,
      action: "student.password_reset",
      entityType: "student",
      entityId: student._id,
      after: { studentNumber: student.studentNumber, resetToDefault: true }
    }).catch(() => {});
    res.json({ message: "Student password reset to default (student123)" });
  } catch (error) { next(error); }
});

app.get("/api/faculty", authenticate, requireRole("college_admin"), async (req, res, next) => {
  try {
    if (!tenantRequired(req, res)) return;
    const data = await User.find({ tenantId: req.auth.tenantId, role: "faculty", status: "active" }).sort({ name: 1 }).select("name email createdAt");
    res.json({ data: data.map((person) => ({ id: person.id, name: person.name, email: person.email, createdAt: person.createdAt })) });
  } catch (error) { next(error); }
});

app.post("/api/faculty", authenticate, requireRole("college_admin"), async (req, res, next) => {
  let person;
  try {
    if (!tenantRequired(req, res)) return;
    const input = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(254).toLowerCase(), password: z.string().min(8).max(128) }).strict().parse(req.body);
    person = await User.create({ tenantId: req.auth.tenantId, name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), role: "faculty" });
    try {
      await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "faculty.created", entityType: "user", entityId: person._id, after: { name: person.name, email: person.email, role: person.role } });
    } catch (error) { await User.deleteOne({ _id: person._id }); throw error; }
    res.status(201).json({ data: { id: person.id, name: person.name, email: person.email } });
  } catch (error) { if (person) await User.deleteOne({ _id: person._id }).catch(() => {}); next(error); }
});

function tenantRequired(req, res) { if (!req.auth.tenantId) { res.status(403).json({ message: "College required" }); return false; } return true; }
function courseView(c) { const faculty = c.facultyId?.name ? c.facultyId : null; return { id: c.id, name: c.name, code: c.code, department: c.department, description: c.description, facultyId: faculty ? faculty.id : c.facultyId?.toString() ?? null, facultyName: faculty?.name ?? null, createdAt: c.createdAt }; }

app.get("/api/dashboard", authenticate, async (req, res, next) => { try {
  if (req.auth.role === "platform_admin") return res.json({ data: { colleges: await Tenant.countDocuments(), students: await Student.countDocuments(), courses: await Course.countDocuments(), activities: await AuditLog.find({ tenantId: null }).sort({ createdAt: -1 }).limit(6).populate("actorId", "name") } });
  if (!tenantRequired(req, res)) return;
  if (req.auth.role === "student") { const student = await Student.findOne({ tenantId: req.auth.tenantId, userId: req.auth.userId }); if (!student) return res.json({ data: { profile: null, courses: [], attendance: [], attendancePercentage: null, totalClasses: 0, presentClasses: 0, activities: [] } }); const [enrollments, records, total, presentTotal] = await Promise.all([Enrollment.find({ tenantId: req.auth.tenantId, studentId: student._id }).populate("courseId", "name code"), Attendance.find({ tenantId: req.auth.tenantId, studentId: student._id }).populate("courseId", "name code").sort({ date: -1 }).limit(10), Attendance.countDocuments({ tenantId: req.auth.tenantId, studentId: student._id }), Attendance.countDocuments({ tenantId: req.auth.tenantId, studentId: student._id, status: "Present" })]); return res.json({ data: { profile: { studentNumber: student.studentNumber, department: student.department, year: student.year }, courses: enrollments.map((e) => e.courseId), attendance: records.map((record) => ({ date: record.date, status: record.status, course: record.courseId })), attendancePercentage: total ? Math.round(presentTotal / total * 100) : null, totalClasses: total, presentClasses: presentTotal, activities: [] } }); }
  if (req.auth.role === "faculty") { const courses = await Course.find({ tenantId: req.auth.tenantId, facultyId: req.auth.userId }); const courseIds = courses.map((c) => c._id); return res.json({ data: { courses: courses.map(courseView), enrollments: await Enrollment.countDocuments({ tenantId: req.auth.tenantId, courseId: { $in: courseIds } }), activities: [] } }); }
  const t = req.auth.tenantId; const [students, faculty, courses, enrollments, activities, attendance, departments] = await Promise.all([User.countDocuments({ tenantId: t, role: "student" }), User.countDocuments({ tenantId: t, role: "faculty" }), Course.countDocuments({ tenantId: t }), Enrollment.countDocuments({ tenantId: t }), AuditLog.find({ tenantId: t }).sort({ createdAt: -1 }).limit(6).populate("actorId", "name"), Attendance.find({ tenantId: t }), Student.aggregate([{ $match: { tenantId: new mongoose.Types.ObjectId(t) } }, { $group: { _id: "$department", count: { $sum: 1 } } }, { $sort: { count: -1 } }])]);
  const present = attendance.filter((a) => a.status === "Present").length; res.json({ data: { students, faculty, courses, enrollments, attendancePercentage: attendance.length ? Math.round(present / attendance.length * 100) : null, activities, departments } });
} catch (error) { next(error); } });

app.get("/api/courses", authenticate, async (req, res, next) => { try { if (!tenantRequired(req, res)) return; const filter = { tenantId: req.auth.tenantId }; if (req.auth.role === "faculty") filter.facultyId = req.auth.userId; if (req.auth.role === "student") { const student = await Student.findOne({ tenantId: req.auth.tenantId, userId: req.auth.userId }); const enrollmentIds = await Enrollment.find({ tenantId: req.auth.tenantId, studentId: student?._id }).distinct("courseId"); filter._id = { $in: enrollmentIds }; } if (req.query.search) filter.$or = [{ name: new RegExp(req.query.search, "i") }, { code: new RegExp(req.query.search, "i") }, { department: new RegExp(req.query.search, "i") }]; const data = await Course.find(filter).populate("facultyId", "name").sort({ code: 1 }); const counts = await Enrollment.aggregate([{ $match: { tenantId: req.auth.tenantId } }, { $group: { _id: "$courseId", count: { $sum: 1 } } }]); const countMap = Object.fromEntries(counts.map((x) => [String(x._id), x.count])); res.json({ data: data.map((c) => ({ ...courseView(c), enrollmentCount: countMap[c.id] || 0 })) }); } catch (e) { next(e); } });
app.post("/api/courses", authenticate, requireRole("college_admin"), async (req, res, next) => { try { if (!tenantRequired(req, res)) return; const input = z.object({ name: z.string().trim().min(1).max(120), code: z.string().trim().min(2).max(20), department: z.string().trim().min(1).max(100), description: z.string().max(500).optional(), facultyId: z.string().optional().default("") }).strict().parse(req.body); if (input.facultyId && (!mongoose.isValidObjectId(input.facultyId) || !await User.exists({ _id: input.facultyId, tenantId: req.auth.tenantId, role: "faculty", status: "active" }))) return res.status(400).json({ message: "Choose an active faculty member from this college" }); const c = await Course.create({ ...input, facultyId: input.facultyId || null, tenantId: req.auth.tenantId }); await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "course.created", entityType: "course", entityId: c._id, after: courseView(c) }); res.status(201).json({ data: courseView(c) }); } catch (e) { next(e); } });
app.patch("/api/courses/:id", authenticate, requireRole("college_admin"), async (req, res, next) => { try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Course not found" }); const input = z.object({ name: z.string().trim().min(1).max(120), code: z.string().trim().min(2).max(20), department: z.string().trim().min(1).max(100), description: z.string().max(500).optional(), facultyId: z.string().optional().default("") }).strict().parse(req.body); if (input.facultyId && (!mongoose.isValidObjectId(input.facultyId) || !await User.exists({ _id: input.facultyId, tenantId: req.auth.tenantId, role: "faculty", status: "active" }))) return res.status(400).json({ message: "Choose an active faculty member from this college" }); const c = await Course.findOne({ _id: req.params.id, tenantId: req.auth.tenantId }); if (!c) return res.status(404).json({ message: "Course not found" }); const before = courseView(c); Object.assign(c, { ...input, facultyId: input.facultyId || null }); await c.save(); await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "course.updated", entityType: "course", entityId: c._id, before, after: courseView(c) }); await c.populate("facultyId", "name"); res.json({ data: courseView(c) }); } catch (e) { next(e); } });
app.delete("/api/courses/:id", authenticate, requireRole("college_admin"), async (req, res, next) => { try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Course not found" }); const c = await Course.findOne({ _id: req.params.id, tenantId: req.auth.tenantId }); if (!c) return res.status(404).json({ message: "Course not found" }); if (await Enrollment.exists({ courseId: c._id }) || await Attendance.exists({ courseId: c._id })) return res.status(409).json({ message: "Remove enrollments and attendance before deleting this course" }); const before = courseView(c); await c.deleteOne(); await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "course.deleted", entityType: "course", entityId: c._id, before }).catch(() => {}); res.json({ message: "Course deleted" }); } catch (e) { next(e); } });

app.get("/api/enrollments", authenticate, async (req, res, next) => { try { if (!tenantRequired(req, res)) return; const filter = { tenantId: req.auth.tenantId }; if (req.query.courseId) { if (!mongoose.isValidObjectId(req.query.courseId)) return res.status(400).json({ message: "Invalid course identifier" }); filter.courseId = req.query.courseId; } if (req.auth.role === "faculty") { const assigned = await Course.find({ tenantId: req.auth.tenantId, facultyId: req.auth.userId }).distinct("_id"); if (req.query.courseId && !assigned.some((id) => String(id) === req.query.courseId)) return res.status(403).json({ message: "You are not assigned to this course" }); if (!req.query.courseId) filter.courseId = { $in: assigned }; } if (req.auth.role === "student") { const s = await Student.findOne({ tenantId: req.auth.tenantId, userId: req.auth.userId }); filter.studentId = s?._id; } const data = await Enrollment.find(filter).populate({ path: "studentId", select: "studentNumber", populate: { path: "userId", select: "name" } }).populate("courseId", "name code"); res.json({ data: data.map((e) => ({ id: e.id, student: e.studentId ? { _id: e.studentId._id, studentNumber: e.studentId.studentNumber, name: e.studentId.userId?.name } : null, course: e.courseId })) }); } catch (e) { next(e); } });
app.post("/api/enrollments", authenticate, requireRole("college_admin"), async (req, res, next) => { try { if (!tenantRequired(req, res)) return; const input = z.object({ studentId: z.string(), courseId: z.string() }).strict().parse(req.body); if (!mongoose.isValidObjectId(input.studentId) || !mongoose.isValidObjectId(input.courseId)) return res.status(400).json({ message: "Invalid student or course identifier" }); const [student, course] = await Promise.all([Student.findOne({ _id: input.studentId, tenantId: req.auth.tenantId }), Course.findOne({ _id: input.courseId, tenantId: req.auth.tenantId })]); if (!student || !course) return res.status(400).json({ message: "Student and course must belong to this college" }); const e = await Enrollment.create({ tenantId: req.auth.tenantId, ...input }); await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "enrollment.created", entityType: "enrollment", entityId: e._id, after: { studentId: input.studentId, courseId: input.courseId } }).catch(() => {}); res.status(201).json({ data: e }); } catch (e) { next(e); } });
app.delete("/api/enrollments/:id", authenticate, requireRole("college_admin"), async (req, res, next) => { try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Enrollment not found" }); const e = await Enrollment.findOneAndDelete({ _id: req.params.id, tenantId: req.auth.tenantId }); if (!e) return res.status(404).json({ message: "Enrollment not found" }); await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "enrollment.removed", entityType: "enrollment", entityId: e._id, before: { studentId: e.studentId, courseId: e.courseId } }).catch(() => {}); res.json({ message: "Enrollment removed" }); } catch (e) { next(e); } });

app.get("/api/attendance", authenticate, async (req, res, next) => { try { if (!tenantRequired(req, res)) return; const filter = { tenantId: req.auth.tenantId }; if (req.query.courseId) { if (!mongoose.isValidObjectId(req.query.courseId)) return res.status(400).json({ message: "Invalid course identifier" }); filter.courseId = req.query.courseId; } if (req.query.date) filter.date = new Date(`${req.query.date}T00:00:00.000Z`); if (req.auth.role === "faculty") { const assigned = await Course.find({ tenantId: req.auth.tenantId, facultyId: req.auth.userId }).distinct("_id"); if (req.query.courseId && !assigned.some((id) => String(id) === req.query.courseId)) return res.status(403).json({ message: "You are not assigned to this course" }); if (!req.query.courseId) filter.courseId = { $in: assigned }; } if (req.auth.role === "student") { const s = await Student.findOne({ tenantId: req.auth.tenantId, userId: req.auth.userId }); filter.studentId = s?._id; } const data = await Attendance.find(filter).populate("studentId", "studentNumber").populate("courseId", "name code").sort({ date: -1 }); res.json({ data }); } catch (e) { next(e); } });
app.post("/api/attendance", authenticate, requireRole("college_admin", "faculty"), async (req, res, next) => { try { if (!tenantRequired(req, res)) return; const input = z.object({ courseId: z.string(), date: z.iso.date(), records: z.array(z.object({ studentId: z.string(), status: z.enum(["Present", "Absent"]) })).min(1) }).strict().parse(req.body); if (!mongoose.isValidObjectId(input.courseId) || input.records.some((r) => !mongoose.isValidObjectId(r.studentId))) return res.status(400).json({ message: "Invalid course or student identifier" }); const course = await Course.findOne({ _id: input.courseId, tenantId: req.auth.tenantId }); if (!course || (req.auth.role === "faculty" && String(course.facultyId) !== String(req.auth.userId))) return res.status(403).json({ message: "You are not assigned to this course" }); const ids = input.records.map((r) => r.studentId); const valid = await Enrollment.countDocuments({ tenantId: req.auth.tenantId, courseId: course._id, studentId: { $in: ids } }); if (valid !== ids.length) return res.status(400).json({ message: "Attendance is limited to enrolled students" }); const date = new Date(`${input.date}T00:00:00.000Z`); await Promise.all(input.records.map((r) => Attendance.findOneAndUpdate({ tenantId: req.auth.tenantId, courseId: course._id, studentId: r.studentId, date }, { ...r, recordedBy: req.auth.userId }, { upsert: true, new: true, setDefaultsOnInsert: true }))); await AuditLog.create({ tenantId: req.auth.tenantId, actorId: req.auth.userId, action: "attendance.recorded", entityType: "attendance", entityId: course._id, after: { courseId: input.courseId, date: input.date, count: input.records.length } }).catch(() => {}); res.json({ message: "Attendance saved" }); } catch (e) { next(e); } });

app.get("/api/audit-logs", authenticate, async (req, res, next) => {
  try {
    if (!["college_admin", "platform_admin"].includes(req.auth.role)) return res.status(403).json({ message: "Permission denied" });
    const querySchema = pageInput.extend({
      action: z.string().trim().min(1).max(100).optional(),
      entityType: z.string().trim().min(1).max(100).optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional()
    }).strict();
    const query = querySchema.safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: "Invalid audit filters or pagination" });
    const { page, limit, action, entityType, from, to } = query.data;
    if (from && to && from > to) return res.status(400).json({ message: "The start date must not follow the end date" });
    const filter = req.auth.role === "platform_admin" ? {} : { tenantId: req.auth.tenantId };
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) filter.createdAt.$lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86400000);
    }
    const total = await AuditLog.countDocuments(filter);
    const data = await AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate("actorId", "name email");
    res.json({
      data: data.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        tenantId: event.tenantId,
        actor: event.actorId ? { name: event.actorId.name, email: event.actorId.email } : null,
        before: event.before,
        after: event.after,
        createdAt: event.createdAt
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) { next(error); }
});

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use(sendError);

export async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error("Set MONGODB_URI and JWT_SECRET in server/.env");
  if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) throw new Error("Production JWT_SECRET must contain at least 32 characters");
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([Tenant.init(), User.init(), Student.init(), AuditLog.init(), Course.init(), Enrollment.init(), Attendance.init()]);
  const port = Number(process.env.PORT || 3000);
  return app.listen(port, () => console.log(`API running at http://localhost:${port}`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((error) => { console.error(error); process.exit(1); });
}

export default app;
