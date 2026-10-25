import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import "./App.css";
// Keep the API on the same host as the page so the browser sends the
// HTTP-only session cookie (localhost and 127.0.0.1 are separate sites).
const API =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000/api`;
async function api(path, o = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      ...o,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...o.headers },
    });
  } catch {
    throw Error("Can't reach the server. Check that the backend is running.");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.message || "Request failed");
  return d;
}
const allowed = (u, ...r) => r.includes(u.role);
export default function App() {
  const [u, setU] = useState(null),
    [wait, setWait] = useState(true),
    [notice, setNotice] = useState("");
  useEffect(() => {
    api("/auth/me")
      .then((x) => setU(x.user))
      .catch(() => {})
      .finally(() => setWait(false));
  }, []);
  if (wait) return <main className="center">Checking your session…</main>;
  const page = (x) =>
    u ? (
      <Layout
        u={u}
        logout={() => setU(null)}
        notice={notice}
        clearNotice={() => setNotice("")}
      >
        {x}
      </Layout>
    ) : (
      <Navigate to="/login" />
    );
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={u ? <Navigate to="/" /> : <Login setU={setU} />}
        />
        <Route path="/" element={page(<Dashboard u={u} />)} />
        <Route
          path="/students"
          element={page(<Students u={u} notify={setNotice} />)}
        />
        <Route
          path="/students/new"
          element={page(<StudentForm notify={setNotice} />)}
        />
        <Route
          path="/students/:id"
          element={page(<StudentDetails u={u} notify={setNotice} />)}
        />
        <Route
          path="/courses"
          element={page(<Courses u={u} notify={setNotice} />)}
        />
        <Route
          path="/attendance"
          element={page(<Attendance u={u} notify={setNotice} />)}
        />
        <Route
          path="/tenants"
          element={page(<Tenants u={u} notify={setNotice} />)}
        />
        <Route path="/audit" element={page(<Audit />)} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
function Login({ setU }) {
  const [f, setF] = useState({
      tenantSlug: "college-a",
      email: "admin@college-a.example",
      password: "ReviewDemo123!",
    }),
    [err, setErr] = useState(""),
    go = useNavigate();
  async function submit(e) {
    e.preventDefault();
    try {
      const x = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(f),
      });
      setU(x.user);
      go("/");
    } catch (x) {
      setErr(x.message);
    }
  }
  return (
    <main className="login-page">
      <div className="brand-mark">SMS</div>
      <p className="eyebrow">STUDENT MANAGEMENT SYSTEM</p>
      <h1>Student Management System</h1>
      <p className="muted">Sign in to your college workspace.</p>
      <form onSubmit={submit}>
        <label>
          College slug
          <input
            value={f.tenantSlug}
            onChange={(e) => setF({ ...f, tenantSlug: e.target.value })}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
        </label>
        {err && <p className="error-box">{err}</p>}
        <button>Sign in</button>
      </form>
    </main>
  );
}
function Layout({ u, logout, notice, clearNotice, children }) {
  const go = useNavigate();
  async function out() {
    await api("/auth/logout", { method: "POST" });
    logout();
    go("/login");
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="sidebar-brand" to="/">
          <span className="brand-mark small">SMS</span>Student Management System
        </Link>
        <p className="nav-label">WORKSPACE</p>
        <nav className="side-nav">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/students">Students</NavLink>
          {allowed(u, "college_admin", "faculty") && (
            <>
              <NavLink to="/courses">Courses</NavLink>
              <NavLink to="/attendance">Attendance</NavLink>
            </>
          )}
          {allowed(u, "college_admin", "platform_admin") && (
            <NavLink to="/audit">Audit log</NavLink>
          )}
          {allowed(u, "platform_admin") && (
            <NavLink to="/tenants">Colleges</NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{u.name[0]}</span>
          <div className="account">
            <strong>{u.name}</strong>
            <span>{u.role.replaceAll("_", " ")}</span>
          </div>
          <button className="text-button" onClick={out}>
            Log out
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>{u.tenantId ? "College workspace" : "Platform workspace"}</span>
          <span className="status-pill">● Active session</span>
        </header>
        {notice && (
          <button className="notice" onClick={clearNotice}>
            {notice} ×
          </button>
        )}
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
function Dashboard({ u }) {
  const [d, setD] = useState(null),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/dashboard")
      .then((x) => setD(x.data))
      .catch((x) => setErr(x.message));
  }, []);
  if (err) return <p className="error-box">{err}</p>;
  if (!d) return <p className="empty-state">Loading dashboard…</p>;
  if (u.role === "student")
    return (
      <>
        <Head
          title={"Welcome, " + u.name.split(" ")[0]}
          sub="Your profile, courses, and attendance."
        />
        <section className="stat-grid">
          <article className="stat-card">
            <span>Attendance</span>
            <strong>
              {d.attendancePercentage == null
                ? "—"
                : d.attendancePercentage + "%"}
            </strong>
          </article>
          <article className="stat-card">
            <span>Enrolled courses</span>
            <strong>{d.courses.length}</strong>
          </article>
        </section>
        <section className="table-card">
          <Table
            heads={["Code", "Course"]}
            rows={d.courses.map((x) => [x.code, x.name])}
            empty="You are not enrolled in any courses yet."
          />
        </section>
      </>
    );
  if (u.role === "faculty")
    return (
      <>
        <Head
          title={"Welcome, " + u.name.split(" ")[0]}
          sub="Your assigned courses and attendance workload."
        />
        <section className="stat-grid">
          <article className="stat-card">
            <span>Assigned courses</span>
            <strong>{d.courses.length}</strong>
          </article>
          <article className="stat-card">
            <span>Enrolled students</span>
            <strong>{d.enrollments}</strong>
          </article>
        </section>
        <section className="table-card">
          <Table
            heads={["Code", "Course"]}
            rows={d.courses.map((x) => [x.code, x.name])}
            empty="No courses have been assigned yet."
          />
        </section>
      </>
    );
  const cards =
    u.role === "platform_admin"
      ? [
          ["Colleges", d.colleges],
          ["Students", d.students],
          ["Courses", d.courses],
        ]
      : [
          ["Students", d.students],
          ["Faculty", d.faculty],
          ["Courses", d.courses],
          ["Active enrollments", d.enrollments],
          [
            "Attendance today",
            d.attendancePercentage == null ? "—" : d.attendancePercentage + "%",
          ],
        ];
  return (
    <>
      <Head
        title={"Welcome, " + u.name.split(" ")[0]}
        sub="Live data for your permitted workspace."
      />
      <section className="stat-grid">
        {cards.map((x) => (
          <article className="stat-card" key={x[0]}>
            <span>{x[0]}</span>
            <strong>{x[1]}</strong>
          </article>
        ))}
      </section>
      {u.role === "college_admin" && (
        <section className="quick-grid">
          <Link className="quick-card" to="/students">
            Student directory
          </Link>
          <Link className="quick-card" to="/courses">
            Courses & enrollments
          </Link>
          <Link className="quick-card" to="/attendance">
            Take attendance
          </Link>
        </section>
      )}
      {d.departments && (
        <section className="table-card">
          <h2>Students by department</h2>
          {d.departments.length ? (
            <div>
              {d.departments.map((x) => (
                <div className="distribution" key={x._id}>
                  <span>{x._id}</span>
                  <b>{x.count}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No student data yet.</p>
          )}
        </section>
      )}
      <Activity data={d.activities} />
    </>
  );
}
function Students({ u, notify }) {
  const [students, setStudents] = useState([]),
    [filters, setFilters] = useState({ department: "", year: "" });
  const [page, setPage] = useState(1),
    [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true),
    [err, setErr] = useState("");
  const go = useNavigate();
  async function load(nextPage = 1, nextFilters = filters) {
    setLoading(true);
    setErr("");
    const query = new URLSearchParams({ page: String(nextPage), limit: "10" });
    if (nextFilters.department) query.set("department", nextFilters.department);
    if (nextFilters.year) query.set("year", nextFilters.year);
    try {
      const result = await api("/students?" + query);
      setStudents(result.data);
      setPagination(result.pagination);
      setPage(result.pagination.page);
    } catch (problem) {
      setErr(problem.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(1);
  }, []);
  async function removeStudent(event, id) {
    event.stopPropagation();
    if (!window.confirm("Delete this student and their login account?")) return;
    try {
      await api("/students/" + id, { method: "DELETE" });
      notify("Student deleted successfully");
      load(students.length === 1 && page > 1 ? page - 1 : page);
    } catch (problem) {
      setErr(problem.message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DIRECTORY</p>
          <h1>Students</h1>
          <p className="muted">{pagination.total} student records</p>
        </div>
        {allowed(u, "college_admin") && (
          <Link to="/students/new" className="button-link">
            ＋ Add student
          </Link>
        )}
      </div>
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          load(1);
        }}
      >
        <input
          placeholder="Filter by department"
          value={filters.department}
          onChange={(event) =>
            setFilters({ ...filters, department: event.target.value })
          }
        />
        <select
          value={filters.year}
          onChange={(event) =>
            setFilters({ ...filters, year: event.target.value })
          }
        >
          <option value="">All years</option>
          {[1, 2, 3, 4, 5, 6].map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button className="secondary-button">Apply filters</button>
        {(filters.department || filters.year) && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const blank = { department: "", year: "" };
              setFilters(blank);
              load(1, blank);
            }}
          >
            Clear
          </button>
        )}
      </form>
      {err && <p className="error-box">{err}</p>}
      <section className="table-card">
        {loading ? (
          <p className="empty-state">Loading student records…</p>
        ) : students.length === 0 ? (
          <p className="empty-state">No students found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>STUDENT NO.</th>
                  <th>DEPARTMENT</th>
                  <th>YEAR</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => go("/students/" + student.id)}
                  >
                    <td>
                      <strong>{student.name}</strong>
                      <small>{student.email}</small>
                    </td>
                    <td>{student.studentNumber}</td>
                    <td>{student.department}</td>
                    <td>Year {student.year}</td>
                    <td>
                      {allowed(u, "college_admin") && (
                        <button
                          className="delete-button"
                          onClick={(event) => removeStudent(event, student.id)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination
        page={page}
        pagination={pagination}
        onPage={(nextPage) => load(nextPage)}
      />
    </>
  );
}
const blankStudent = {
  name: "",
  email: "",
  password: "StudentDemo123!",
  studentNumber: "",
  department: "CSE",
  year: "1",
};
function StudentFields({ fields, setFields, password = false }) {
  const items = [
    ["name", "Full name", "text"],
    ["email", "Email", "email"],
    ...(password ? [["password", "Temporary password", "password"]] : []),
    ["studentNumber", "Student number", "text"],
    ["department", "Department", "text"],
    ["year", "Year", "number"],
  ];
  return (
    <div className="form-grid">
      {items.map(([key, label, type]) => (
        <label key={key}>
          {label}
          <input
            type={type}
            min={key === "year" ? 1 : undefined}
            max={key === "year" ? 6 : undefined}
            minLength={key === "password" ? 12 : undefined}
            value={fields[key] || ""}
            onChange={(event) =>
              setFields({ ...fields, [key]: event.target.value })
            }
            required
          />
        </label>
      ))}
    </div>
  );
}
function StudentForm({ notify }) {
  const [fields, setFields] = useState(blankStudent),
    [err, setErr] = useState(""),
    [saving, setSaving] = useState(false);
  const go = useNavigate();
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await api("/students", {
        method: "POST",
        body: JSON.stringify({ ...fields, year: Number(fields.year) }),
      });
      notify("Student created successfully");
      go("/students");
    } catch (problem) {
      setErr(problem.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Head
        title="Add student"
        sub="Create a login and academic profile for a student."
      />
      <form className="edit-card" onSubmit={submit}>
        <StudentFields fields={fields} setFields={setFields} password />
        {err && <p className="error-box">{err}</p>}
        <div className="form-actions">
          <button disabled={saving}>
            {saving ? "Saving…" : "Create student"}
          </button>
          <Link className="secondary-link" to="/students">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
function StudentDetails({ u, notify }) {
  const { id } = useParams();
  const [student, setStudent] = useState(null),
    [fields, setFields] = useState({}),
    [err, setErr] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    api("/students/" + id)
      .then(({ data }) => {
        setStudent(data);
        setFields({
          name: data.name,
          email: data.email,
          studentNumber: data.studentNumber,
          department: data.department,
          year: String(data.year),
        });
      })
      .catch((problem) => setErr(problem.message))
      .finally(() => setLoading(false));
  }, [id]);
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const result = await api("/students/" + id, {
        method: "PATCH",
        body: JSON.stringify({ ...fields, year: Number(fields.year) }),
      });
      setStudent(result.data);
      notify("Student updated successfully");
    } catch (problem) {
      setErr(problem.message);
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <p className="empty-state">Loading student profile…</p>;
  if (!student)
    return (
      <section className="table-card">
        <h1>Student not found</h1>
        <p className="muted">
          {err || "This record may belong to another college."}
        </p>
        <Link to="/students">Back to students</Link>
      </section>
    );
  const editable = allowed(u, "college_admin");
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STUDENT PROFILE</p>
          <h1>{student.name}</h1>
          <p className="muted">{student.studentNumber}</p>
        </div>
        <Link className="secondary-link" to="/students">
          ← Back to students
        </Link>
      </div>
      {editable ? (
        <form className="edit-card" onSubmit={save}>
          <StudentFields fields={fields} setFields={setFields} />
          {err && <p className="error-box">{err}</p>}
          <div className="form-actions">
            <button disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <section className="profile-card">
          <p>
            <span>Email</span>
            {student.email}
          </p>
          <p>
            <span>Student number</span>
            {student.studentNumber}
          </p>
          <p>
            <span>Department</span>
            {student.department}
          </p>
          <p>
            <span>Year</span>
            {student.year}
          </p>
        </section>
      )}
    </>
  );
}
function Courses({ u, notify }) {
  const [c, setC] = useState([]),
    [s, setS] = useState([]),
    [enrollments, setEnrollments] = useState([]),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState(null),
    [f, setF] = useState({
      name: "",
      code: "",
      department: "",
      description: "",
    }),
    [en, setEn] = useState({ courseId: "", studentId: "" }),
    [err, setErr] = useState("");
  const load = (term = search) => {
    api("/courses" + (term ? "?search=" + encodeURIComponent(term) : ""))
      .then((x) => setC(x.data))
      .catch((x) => setErr(x.message));
    if (allowed(u, "college_admin"))
      api("/enrollments")
        .then((x) => setEnrollments(x.data))
        .catch((x) => setErr(x.message));
  };
  useEffect(() => {
    load();
    api("/students?limit=50").then((x) => setS(x.data));
  }, []);
  async function add(e) {
    e.preventDefault();
    try {
      await api("/courses", { method: "POST", body: JSON.stringify(f) });
      setF({ name: "", code: "", department: "", description: "" });
      load();
      notify("Course created successfully");
    } catch (x) {
      setErr(x.message);
    }
  }
  async function enroll(e) {
    e.preventDefault();
    try {
      await api("/enrollments", { method: "POST", body: JSON.stringify(en) });
      load();
      notify("Student enrolled successfully");
    } catch (x) {
      setErr(x.message);
    }
  }
  async function removeEnrollment(id) {
    if (!window.confirm("Remove this student from the course?")) return;
    try {
      await api("/enrollments/" + id, { method: "DELETE" });
      load();
      notify("Enrollment removed successfully");
    } catch (x) {
      setErr(x.message);
    }
  }
  async function updateCourse(event) {
    event.preventDefault();
    try {
      await api("/courses/" + editing.id, {
        method: "PATCH",
        body: JSON.stringify({
          name: editing.name,
          code: editing.code,
          department: editing.department,
          description: editing.description || "",
        }),
      });
      setEditing(null);
      load();
      notify("Course updated successfully");
    } catch (x) {
      setErr(x.message);
    }
  }
  async function removeCourse(course) {
    if (
      !window.confirm(
        "Delete " +
          course.code +
          "? Courses with enrollments or attendance cannot be deleted.",
      )
    )
      return;
    try {
      await api("/courses/" + course.id, { method: "DELETE" });
      load();
      notify("Course deleted successfully");
    } catch (x) {
      setErr(x.message);
    }
  }
  return (
    <>
      <Head title="Courses" sub="Courses and live enrollment counts." />
      {err && <p className="error-box">{err}</p>}
      {allowed(u, "college_admin") && (
        <>
          <form className="edit-card compact-form" onSubmit={add}>
            <h2>Add course</h2>
            <div className="form-grid">
              {[
                ["name", "Course name"],
                ["code", "Course code"],
                ["department", "Department"],
                ["description", "Description (optional)"],
              ].map((x) => (
                <label key={x[0]}>
                  {x[1]}
                  <input
                    value={f[x[0]]}
                    onChange={(e) => setF({ ...f, [x[0]]: e.target.value })}
                    required={x[0] !== "description"}
                  />
                </label>
              ))}
            </div>
            <button>Create course</button>
          </form>
          <form className="edit-card compact-form" onSubmit={enroll}>
            <h2>Enroll student</h2>
            <div className="form-grid">
              <label>
                Course
                <select
                  value={en.courseId}
                  onChange={(e) => setEn({ ...en, courseId: e.target.value })}
                  required
                >
                  <option value="">Select a course</option>
                  {c.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.code} — {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Student
                <select
                  value={en.studentId}
                  onChange={(e) => setEn({ ...en, studentId: e.target.value })}
                  required
                >
                  <option value="">Select a student</option>
                  {s.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.name} — {x.studentNumber}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button>Enroll student</button>
          </form>
        </>
      )}
      <section className="table-card">
        <div className="table-toolbar">
          <h2>Course catalogue</h2>
          <input
            placeholder="Search courses"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && load()}
          />
          <button className="secondary-button" onClick={() => load()}>
            Search
          </button>
        </div>
        {c.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CODE</th>
                  <th>COURSE</th>
                  <th>DEPARTMENT</th>
                  <th>ENROLLED</th>
                  {allowed(u, "college_admin") && <th />}
                </tr>
              </thead>
              <tbody>
                {c.map((course) => (
                  <tr key={course.id}>
                    <td>{course.code}</td>
                    <td>
                      <strong>{course.name}</strong>
                      {course.description && (
                        <small>{course.description}</small>
                      )}
                    </td>
                    <td>{course.department}</td>
                    <td>{course.enrollmentCount}</td>
                    {allowed(u, "college_admin") && (
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setEditing({ ...course })}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => removeCourse(course)}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No courses match this search.</p>
        )}
      </section>
      {editing && (
        <form className="edit-card" onSubmit={updateCourse}>
          <div className="page-heading">
            <div>
              <h2>Edit course</h2>
              <p className="muted">Update the course record.</p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setEditing(null)}
            >
              Close
            </button>
          </div>
          <div className="form-grid">
            {[
              ["name", "Course name"],
              ["code", "Course code"],
              ["department", "Department"],
              ["description", "Description"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={editing[key] || ""}
                  onChange={(event) =>
                    setEditing({ ...editing, [key]: event.target.value })
                  }
                  required={key !== "description"}
                />
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button>Save course</button>
          </div>
        </form>
      )}
      {allowed(u, "college_admin") && (
        <section className="table-card">
          <h2>Active enrollments</h2>
          {enrollments.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>COURSE</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.student?.name || item.student?.studentNumber}
                      </td>
                      <td>
                        {item.course?.code} — {item.course?.name}
                      </td>
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => removeEnrollment(item.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">No active enrollments.</p>
          )}
        </section>
      )}
    </>
  );
}
function Attendance({ u, notify }) {
  const [c, setC] = useState([]),
    [e, setE] = useState([]),
    [courseId, setCourse] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [status, setStatus] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/courses")
      .then((x) => setC(x.data))
      .catch((x) => setErr(x.message));
  }, []);
  useEffect(() => {
    if (courseId)
      api("/enrollments?courseId=" + courseId).then(async (x) => {
        setE(x.data);
        const defaults = Object.fromEntries(
          x.data.map((a) => [a.student._id, "Present"]),
        );
        try {
          const saved = await api(
            "/attendance?courseId=" + courseId + "&date=" + date,
          );
          setStatus({
            ...defaults,
            ...Object.fromEntries(
              saved.data.map((record) => [
                record.studentId?._id,
                record.status,
              ]),
            ),
          });
        } catch (problem) {
          setErr(problem.message);
        }
      });
  }, [courseId, date]);
  async function save() {
    try {
      await api("/attendance", {
        method: "POST",
        body: JSON.stringify({
          courseId,
          date,
          records: e.map((x) => ({
            studentId: x.student._id,
            status: status[x.student._id] || "Present",
          })),
        }),
      });
      setMsg("Attendance saved. Existing records were updated.");
      notify("Attendance saved successfully");
    } catch (x) {
      setErr(x.message);
    }
  }
  if (!allowed(u, "college_admin", "faculty"))
    return (
      <p className="error-box">
        Attendance actions are not available for this role.
      </p>
    );
  return (
    <>
      <Head title="Attendance" sub="Take or update an attendance session." />
      {err && <p className="error-box">{err}</p>}
      {msg && <p className="notice">{msg}</p>}
      <section className="edit-card">
        <div className="form-grid">
          <label>
            Course
            <select
              value={courseId}
              onChange={(x) => setCourse(x.target.value)}
            >
              <option value="">Select a course</option>
              {c.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(x) => setDate(x.target.value)}
            />
          </label>
        </div>
        {courseId &&
          (e.length ? (
            e.map((x) => (
              <p className="attendance-row" key={x.id}>
                <span>{x.student.studentNumber}</span>
                <strong>{x.student.name || "Student"}</strong>
                <select
                  value={status[x.student._id] || "Present"}
                  onChange={(a) =>
                    setStatus({ ...status, [x.student._id]: a.target.value })
                  }
                >
                  <option>Present</option>
                  <option>Absent</option>
                </select>
              </p>
            ))
          ) : (
            <p className="empty-state">No students enrolled.</p>
          ))}
        <button disabled={!e.length} onClick={save}>
          Save attendance
        </button>
      </section>
    </>
  );
}
function Tenants({ u, notify }) {
  const [l, setL] = useState([]),
    [f, setF] = useState({
      name: "",
      slug: "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
    }),
    [err, setErr] = useState(""),
    [page, setPage] = useState(1),
    [pagination, setPagination] = useState({ total: 0, totalPages: 1 }),
    [loading, setLoading] = useState(true);
  const load = (nextPage = 1) => {
    setLoading(true);
    return api("/tenants?page=" + nextPage + "&limit=10")
      .then((x) => {
        setL(x.data);
        setPage(x.pagination.page);
        setPagination(x.pagination);
      })
      .catch((x) => setErr(x.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  async function submit(e) {
    e.preventDefault();
    try {
      await api("/tenants", { method: "POST", body: JSON.stringify(f) });
      setF({
        name: "",
        slug: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      });
      await load(1);
      notify("College and initial administrator created successfully");
    } catch (x) {
      setErr(x.message);
    }
  }
  if (!allowed(u, "platform_admin"))
    return <p className="error-box">Platform administrator access required.</p>;
  return (
    <>
      <Head
        title="Colleges"
        sub="Create a college and its initial administrator together."
      />
      {err && <p className="error-box">{err}</p>}
      <form className="edit-card" onSubmit={submit}>
        <h2>College onboarding</h2>
        <div className="form-grid">
          {[
            ["name", "College name", "text"],
            ["slug", "College slug", "text"],
            ["adminName", "Administrator name", "text"],
            ["adminEmail", "Administrator email", "email"],
            ["adminPassword", "Administrator password", "password"],
          ].map((x) => (
            <label key={x[0]}>
              {x[1]}
              <input
                type={x[2]}
                minLength={x[0] === "adminPassword" ? 12 : undefined}
                value={f[x[0]]}
                onChange={(e) =>
                  setF({
                    ...f,
                    [x[0]]:
                      x[0] === "slug"
                        ? e.target.value.toLowerCase()
                        : e.target.value,
                  })
                }
                required
              />
            </label>
          ))}
        </div>
        <button>Create college & administrator</button>
      </form>
      <section className="table-card">
        {loading ? (
          <p className="empty-state">Loading colleges…</p>
        ) : (
          <Table
            heads={["College", "Slug", "Status"]}
            rows={l.map((x) => [x.name, x.slug, x.status])}
            empty="No colleges found."
          />
        )}
      </section>
      <Pagination page={page} pagination={pagination} onPage={load} />
    </>
  );
}
function Audit() {
  const [d, setD] = useState([]),
    [filters, setFilters] = useState({ action: "", from: "", to: "" });
  const [page, setPage] = useState(1),
    [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true),
    [err, setErr] = useState("");
  async function load(nextPage = 1, nextFilters = filters) {
    setLoading(true);
    setErr("");
    const query = new URLSearchParams({ page: String(nextPage), limit: "20" });
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    try {
      const result = await api("/audit-logs?" + query);
      setD(result.data);
      setPage(result.pagination.page);
      setPagination(result.pagination);
    } catch (problem) {
      setErr(problem.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(1);
  }, []);
  return (
    <>
      <Head title="Audit log" sub="Recent accountable changes." />
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          load(1);
        }}
      >
        <select
          value={filters.action}
          onChange={(event) =>
            setFilters({ ...filters, action: event.target.value })
          }
        >
          <option value="">All actions</option>
          <option value="student.created">Student created</option>
          <option value="student.updated">Student updated</option>
          <option value="student.deleted">Student deleted</option>
          <option value="course.created">Course created</option>
          <option value="tenant.created">College created</option>
        </select>
        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters({ ...filters, from: event.target.value })
            }
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(event) =>
              setFilters({ ...filters, to: event.target.value })
            }
          />
        </label>
        <button className="secondary-button">Filter</button>
      </form>
      {err && <p className="error-box">{err}</p>}
      <section className="table-card">
        {loading ? (
          <p className="empty-state">Loading audit history…</p>
        ) : (
          <Table
            heads={["Event", "Actor", "Time"]}
            rows={d.map((x) => [
              x.action,
              x.actor?.name || "Unknown",
              new Date(x.createdAt).toLocaleString(),
            ])}
            empty="No audit events yet."
          />
        )}
      </section>
      <Pagination page={page} pagination={pagination} onPage={load} />
    </>
  );
}
function Activity({ data = [] }) {
  return (
    <section className="table-card">
      <h2>Recent activity</h2>
      <Table
        heads={["Event", "Actor", "Time"]}
        rows={data.map((x) => [
          x.action,
          x.actorId?.name || "System",
          new Date(x.createdAt).toLocaleString(),
        ])}
        empty="No recent activity."
      />
    </section>
  );
}
function Head({ title, sub }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">WORKSPACE</p>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
    </div>
  );
}
function Pagination({ page, pagination, onPage }) {
  return (
    <div className="pagination">
      <span>
        {pagination.total} records · Page {page} of{" "}
        {Math.max(1, pagination.totalPages)}
      </span>
      <div>
        <button
          className="secondary-button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="secondary-button"
          disabled={page >= pagination.totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
function Table({ heads, rows, empty }) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((x, j) => (
                <td key={j}>{x}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="empty-state">{empty}</p>
  );
}
