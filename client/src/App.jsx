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
const DEPARTMENTS = ["CSE", "ECE", "CSE-AIML", "EEE", "MECH", "CIVIL"];
const YEARS = [1, 2, 3, 4];
const localDate = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
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
          path="/faculty"
          element={page(u && allowed(u, "college_admin") ? <Faculty notify={setNotice} /> : <Navigate to="/" />)}
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
      tenantSlug: "",
      email: "",
      password: "",
    }),
    [err, setErr] = useState(""),
    go = useNavigate();
  useEffect(() => { document.title = "Sign in — Student Management System"; }, []);
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
          {allowed(u, "college_admin", "faculty", "student") && (
            <>
              <NavLink to="/courses">Courses</NavLink>
              <NavLink to="/attendance">Attendance</NavLink>
            </>
          )}
          {allowed(u, "college_admin") && <NavLink to="/faculty">Faculty</NavLink>}
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
            <span>Overall attendance</span>
            <strong>
              {d.attendancePercentage == null
                ? "—"
                : d.attendancePercentage + "%"}
            </strong>
            {d.totalClasses ? (
              <span className="muted" style={{ fontSize: "11px" }}>{d.presentClasses} of {d.totalClasses} classes</span>
            ) : null}
          </article>
          <article className="stat-card">
            <span>Enrolled courses</span>
            <strong>{d.courses.length}</strong>
          </article>
        </section>
        <section className="quick-grid">
          <Link className="quick-card" to="/courses">
            My courses
          </Link>
          <Link className="quick-card" to="/attendance">
            Attendance records
          </Link>
        </section>
        {d.profile && (
          <section className="profile-card student-summary">
            <p><span>Student number</span><strong>{d.profile.studentNumber}</strong></p>
            <p><span>Department</span><strong>{d.profile.department}</strong></p>
            <p><span>Year</span><strong>Year {d.profile.year}</strong></p>
          </section>
        )}
        <section className="table-card">
          <h2>Enrolled courses</h2>
          <Table
            heads={["CODE", "COURSE"]}
            rows={d.courses.map((x) => [x.code, x.name])}
            empty="You are not enrolled in any courses yet."
          />
        </section>
        <section className="table-card attendance-history">
          <h2>Recent attendance</h2>
          <Table
            heads={["DATE", "COURSE", "STATUS"]}
            rows={(d.attendance || []).map((item) => [
              new Date(item.date).toLocaleDateString(),
              `${item.course?.code || "Course"} — ${item.course?.name || ""}`,
              item.status,
            ])}
            empty="Your attendance records will appear here."
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
            "Attendance rate",
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
        <select
          value={filters.department}
          onChange={(event) =>
            setFilters({ ...filters, department: event.target.value })
          }
        >
          <option value="">All departments</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
        <select
          value={filters.year}
          onChange={(event) =>
            setFilters({ ...filters, year: event.target.value })
          }
        >
          <option value="">All years</option>
          {YEARS.map((year) => (
            <option key={year} value={String(year)}>
              Year {year}
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
                  {u.role === "platform_admin" && <th>COLLEGE</th>}
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
                    {u.role === "platform_admin" && (
                      <td>
                        <strong>{student.college?.name || "—"}</strong>
                        <small>{student.college?.slug}</small>
                      </td>
                    )}
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
  return (
    <div className="form-grid">
      <label>
        Full name
        <input
          type="text"
          value={fields.name || ""}
          onChange={(event) =>
            setFields({ ...fields, name: event.target.value })
          }
          required
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={fields.email || ""}
          onChange={(event) =>
            setFields({ ...fields, email: event.target.value })
          }
          required
        />
      </label>
      {password && (
        <label>
          Temporary password
          <input
            type="password"
            minLength={12}
            value={fields.password || ""}
            onChange={(event) =>
              setFields({ ...fields, password: event.target.value })
            }
            required
          />
        </label>
      )}
      <label>
        Student number
        <input
          type="text"
          value={fields.studentNumber || ""}
          onChange={(event) =>
            setFields({ ...fields, studentNumber: event.target.value })
          }
          required
        />
      </label>
      <label>
        Department
        <select
          value={fields.department || "CSE"}
          onChange={(event) =>
            setFields({ ...fields, department: event.target.value })
          }
          required
        >
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      </label>
      <label>
        Year
        <select
          value={String(fields.year || "1")}
          onChange={(event) =>
            setFields({ ...fields, year: event.target.value })
          }
          required
        >
          {YEARS.map((year) => (
            <option key={year} value={String(year)}>
              Year {year}
            </option>
          ))}
        </select>
      </label>
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
  useEffect(() => {
    if (student?.name) document.title = student.name + " — Student Management System";
  }, [student]);
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
    [faculty, setFaculty] = useState([]),
    [enrollments, setEnrollments] = useState([]),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState(null),
    [f, setF] = useState({
      name: "",
      code: "",
      department: "CSE",
      description: "",
      facultyId: "",
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
    if (allowed(u, "college_admin")) api("/faculty").then((x) => setFaculty(x.data));
  }, []);
  async function add(e) {
    e.preventDefault();
    setErr("");
    try {
      await api("/courses", { method: "POST", body: JSON.stringify(f) });
      setF({ name: "", code: "", department: "CSE", description: "", facultyId: "" });
      load();
      notify("Course created successfully");
    } catch (x) {
      setErr(x.message);
    }
  }
  async function enroll(e) {
    e.preventDefault();
    setErr("");
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
    setErr("");
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
    setErr("");
    try {
      await api("/courses/" + editing.id, {
        method: "PATCH",
        body: JSON.stringify({
          name: editing.name,
          code: editing.code,
          department: editing.department,
          description: editing.description || "",
          facultyId: editing.facultyId || "",
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
    setErr("");
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
              <label>
                Course name
                <input
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Course code
                <input
                  value={f.code}
                  onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
                  required
                />
              </label>
              <label>
                Department
                <select
                  value={f.department || "CSE"}
                  onChange={(e) => setF({ ...f, department: e.target.value })}
                  required
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description (optional)
                <input
                  value={f.description}
                  onChange={(e) => setF({ ...f, description: e.target.value })}
                />
              </label>
              <label>
                Assigned faculty
                <select value={f.facultyId} onChange={(e) => setF({ ...f, facultyId: e.target.value })}>
                  <option value="">Not assigned</option>
                  {faculty.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}
                </select>
              </label>
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
                      {x.name} — {x.studentNumber} ({x.department}, Year {x.year})
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
                  <th>FACULTY</th>
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
                    <td>{course.facultyName || "Not assigned"}</td>
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
            <label>
              Course name
              <input
                value={editing.name || ""}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
                required
              />
            </label>
            <label>
              Course code
              <input
                value={editing.code || ""}
                onChange={(event) =>
                  setEditing({ ...editing, code: event.target.value.toUpperCase() })
                }
                required
              />
            </label>
            <label>
              Department
              <select
                value={editing.department || "CSE"}
                onChange={(event) =>
                  setEditing({ ...editing, department: event.target.value })
                }
                required
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <input
                value={editing.description || ""}
                onChange={(event) =>
                  setEditing({ ...editing, description: event.target.value })
                }
              />
            </label>
            <label>
              Assigned faculty
              <select value={editing.facultyId || ""} onChange={(event) => setEditing({ ...editing, facultyId: event.target.value })}>
                <option value="">Not assigned</option>
                {faculty.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}
              </select>
            </label>
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
function StudentAttendance() {
  const [courses, setCourses] = useState([]);
  const [records, setRecords] = useState([]);
  const [filterCourse, setFilterCourse] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/courses")
      .then((res) => setCourses(res.data))
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = filterCourse ? "?courseId=" + filterCourse : "";
    api("/attendance" + query)
      .then((res) => setRecords(res.data))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filterCourse]);

  const total = records.length;
  const present = records.filter((r) => r.status === "Present").length;
  const absent = records.filter((r) => r.status === "Absent").length;
  const percentage = total ? Math.round((present / total) * 100) : null;

  return (
    <>
      <Head title="Attendance" sub="Your attendance history and records." />
      {err && <p className="error-box">{err}</p>}
      <section className="stat-grid">
        <article className="stat-card">
          <span>Attendance rate</span>
          <strong>{percentage === null ? "—" : percentage + "%"}</strong>
          {percentage !== null && percentage < 75 && (
            <span style={{ color: "#a34843", fontSize: "11px", fontWeight: 700 }}>⚠️ Below 75% requirement</span>
          )}
        </article>
        <article className="stat-card">
          <span>Total classes</span>
          <strong>{total}</strong>
        </article>
        <article className="stat-card">
          <span>Present</span>
          <strong>{present}</strong>
        </article>
        <article className="stat-card">
          <span>Absent</span>
          <strong>{absent}</strong>
        </article>
      </section>

      <div className="filter-bar">
        <label>
          Filter course:
          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
            <option value="">All enrolled courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>
        {filterCourse && (
          <button type="button" className="text-button" onClick={() => setFilterCourse("")}>
            Clear
          </button>
        )}
      </div>

      <section className="table-card">
        <h2>Attendance records</h2>
        {loading ? (
          <p className="empty-state">Loading attendance records…</p>
        ) : records.length === 0 ? (
          <p className="empty-state">No attendance records found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>COURSE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id}>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td>
                      <strong>{r.courseId?.code}</strong>
                      <small>{r.courseId?.name}</small>
                    </td>
                    <td>
                      <span className={r.status === "Present" ? "badge-present" : "badge-absent"}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Attendance({ u, notify }) {
  if (u.role === "student") return <StudentAttendance />;
  const [c, setC] = useState([]),
    [e, setE] = useState([]),
    [courseId, setCourse] = useState(""),
    [date, setDate] = useState(localDate()),
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
    setErr("");
    setMsg("");
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
function Faculty({ notify }) {
  const [people, setPeople] = useState([]);
  const [fields, setFields] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  async function load() {
    setLoading(true);
    try { const result = await api("/faculty"); setPeople(result.data); }
    catch (problem) { setError(problem.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await api("/faculty", { method: "POST", body: JSON.stringify(fields) });
      setFields({ name: "", email: "", password: "" });
      await load(); notify("Faculty account created successfully");
    } catch (problem) { setError(problem.message); }
    finally { setSaving(false); }
  }
  return <>
    <Head title="Faculty" sub="Create faculty accounts and assign them to courses." />
    {error && <p className="error-box">{error}</p>}
    <form className="edit-card compact-form" onSubmit={submit}>
      <h2>Add faculty member</h2>
      <div className="form-grid">
          <label>
            Full name
            <input value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} required maxLength={100} />
          </label>
          <label>
            Email
            <input type="email" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} required />
          </label>
          <label>
            Temporary password
            <input type="password" value={fields.password} onChange={(event) => setFields({ ...fields, password: event.target.value })} required minLength={12} />
          </label>
      </div>
      <p className="muted">Use at least 12 characters. Faculty can sign in and record attendance for courses assigned to them.</p>
      <button disabled={saving}>{saving ? "Creating…" : "Create faculty account"}</button>
    </form>
    <section className="table-card">
      <h2>Faculty directory</h2>
      {loading ? <p className="empty-state">Loading faculty…</p> : <Table heads={["NAME", "EMAIL"]} rows={people.map((person) => [person.name, person.email])} empty="No faculty accounts yet." />}
    </section>
  </>;
}

function CollegeDetails({ id, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    api("/tenants/" + id)
      .then((res) => setData(res.data))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="empty-state">Loading college details…</p>;
  if (err || !data)
    return (
      <section className="table-card" style={{ padding: "20px" }}>
        <p className="error-box">{err || "College not found"}</p>
        <button className="secondary-button" onClick={onBack}>
          ← Back to colleges
        </button>
      </section>
    );

  const { college, administrator, faculty, students, courses } = data;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COLLEGE SPECIFICS</p>
          <h1>{college.name}</h1>
          <p className="muted">
            Slug: <code>{college.slug}</code> · Status: <strong>{college.status}</strong>
          </p>
        </div>
        <button className="secondary-button" onClick={onBack}>
          ← Back to colleges
        </button>
      </div>

      <section className="stat-grid">
        <article className="stat-card">
          <span>Administrator</span>
          <strong style={{ fontSize: "16px", marginTop: "4px" }}>
            {administrator?.name || "None"}
          </strong>
          <small className="muted">{administrator?.email}</small>
        </article>
        <article className="stat-card">
          <span>Staff / Faculty</span>
          <strong>{faculty.length}</strong>
        </article>
        <article className="stat-card">
          <span>Enrolled students</span>
          <strong>{students.length}</strong>
        </article>
        <article className="stat-card">
          <span>Courses</span>
          <strong>{courses.length}</strong>
        </article>
      </section>

      <section className="table-card" style={{ marginBottom: "20px" }}>
        <h2>Staff & faculty directory</h2>
        <Table
          heads={["NAME", "ROLE", "EMAIL"]}
          rows={[
            ...(administrator
              ? [
                  [
                    administrator.name,
                    <span className="action-tag" key="admin">College Admin</span>,
                    administrator.email,
                  ],
                ]
              : []),
            ...faculty.map((f) => [
              f.name,
              <span className="year-tag" key={f.id}>Faculty</span>,
              f.email,
            ]),
          ]}
          empty="No staff or faculty accounts recorded."
        />
      </section>

      <section className="table-card" style={{ marginBottom: "20px" }}>
        <h2>Students</h2>
        <Table
          heads={["STUDENT", "STUDENT NO.", "DEPARTMENT", "YEAR"]}
          rows={students.map((s) => [
            s.name,
            s.studentNumber,
            s.department,
            `Year ${s.year}`,
          ])}
          empty="No students registered in this college."
        />
      </section>

      <section className="table-card">
        <h2>Courses</h2>
        <Table
          heads={["CODE", "COURSE", "DEPARTMENT", "ASSIGNED FACULTY"]}
          rows={courses.map((c) => [
            c.code,
            c.name,
            c.department,
            c.facultyName || "Not assigned",
          ])}
          empty="No courses created in this college."
        />
      </section>
    </>
  );
}

function Tenants({ u, notify }) {
  const [selectedId, setSelectedId] = useState(null),
    [l, setL] = useState([]),
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
    setErr("");
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

  if (selectedId) {
    return <CollegeDetails id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <>
      <Head
        title="Colleges"
        sub="Create and inspect colleges across the platform."
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
        <h2>Registered colleges</h2>
        {loading ? (
          <p className="empty-state">Loading colleges…</p>
        ) : l.length === 0 ? (
          <p className="empty-state">No colleges found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>COLLEGE</th>
                  <th>SLUG</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {l.map((x) => (
                  <tr
                    key={x._id || x.id}
                    onClick={() => setSelectedId(x._id || x.id)}
                  >
                    <td>
                      <strong>{x.name}</strong>
                    </td>
                    <td>
                      <code>{x.slug}</code>
                    </td>
                    <td>
                      <span className="status-pill">{x.status}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="secondary-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(x._id || x.id);
                        }}
                      >
                        View specifics →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <option value="faculty.created">Faculty created</option>
          <option value="course.created">Course created</option>
          <option value="course.updated">Course updated</option>
          <option value="course.deleted">Course deleted</option>
          <option value="enrollment.created">Enrollment created</option>
          <option value="enrollment.removed">Enrollment removed</option>
          <option value="attendance.recorded">Attendance recorded</option>
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
  useEffect(() => { document.title = title + " — Student Management System"; }, [title]);
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
