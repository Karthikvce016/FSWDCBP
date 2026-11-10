# CampusDesk — Multi-Tenant Student Management

CampusDesk is a local coursework prototype for managing student records across multiple colleges. It uses one React/Vite frontend, an Express API, and MongoDB. The backend scopes records using the signed-in user's role and college membership.

This guide describes the code as it exists today, how to run and demonstrate it, and what remains incomplete. This is not a production-ready student information system.

## Contents

- Technology and project structure
- Current capabilities and roles
- Data model and API
- Local setup and demo accounts
- Security, tests, and known gaps

## Technology and project structure

| Area | Technology |
| --- | --- |
| Frontend | React, JavaScript/JSX, Vite, React Router, CSS |
| Backend | Node.js, Express, JavaScript |
| Database | MongoDB and Mongoose |
| Authentication | bcrypt password hashes and a JWT in an HTTP-only cookie |
| Input validation | Zod |

    client/src/App.jsx       Routes, screens, API calls, and UI state
    client/src/App.css       Layout and component styles
    client/src/main.jsx      React entry point
    server/src/server.js     Express app, Mongoose models, routes, auth, validation
    server/src/seed.js       Creates/updates demo colleges and accounts
    server/test/             MongoDB-backed API security and tenant-isolation tests

The API listens on port 3000 by default. Vite normally uses port 5173. The client builds its API URL from the hostname used to open the page, unless VITE_API_URL is set. Use the same hostname consistently: localhost and 127.0.0.1 have separate browser cookies.

## Current capabilities

### Login and navigation

- Sign in with a college slug, email, and password.
- Maintain a two-hour session in an HTTP-only cookie and clear it on logout.
- Restore the current session from the backend.
- Show navigation based on the signed-in role.

### Dashboard

- College Admin: student count, faculty count, course count, enrollment count, an attendance percentage, students by department, and recent college activity.
- Platform Admin: totals for colleges, students, and courses across the platform, and recent platform activity.
- Student: academic profile, enrolled courses, attendance percentage, and recent attendance records.
- Faculty: assigned-course and enrollment counts, plus assigned courses.

Values are queried from MongoDB. Attendance percentage is unavailable when no attendance records exist.

### Students

- List students with server-side pagination.
- Filter by department and academic year.
- Open a row to view a student profile.
- College Admins can create a student login and profile, edit the profile, and delete a student after a confirmation.
- Students can view only their own profile through the API.

Student academic fields are student number, department, and year; name and email come from the linked User account.

### Courses and enrollment

- College Admins can create, edit, search, and delete courses.
- College Admins can create faculty accounts and assign faculty to courses.
- Search matches course name, code, or department.
- Course codes are unique within a college.
- Course rows show their enrollment count.
- College Admins can enroll a same-college student, list active enrollments, and remove an enrollment.
- Duplicate student/course enrollments are blocked by a unique index.
- Courses cannot be deleted while they have enrollment or attendance records.
- Faculty course lists are filtered to courses assigned to that faculty user. Student dashboards show their profile, enrolled courses, attendance percentage, and recent attendance.

### Attendance

- College Admins can choose a course and date, mark enrolled students Present or Absent, and save.
- Faculty can submit attendance for a course assigned to them.
- Selecting a course/date loads saved statuses. Saving again updates those records rather than adding duplicate records.
- Submissions are limited to students enrolled in the selected course.
- A unique index prevents duplicate attendance for one student/course/date.
- Students see an overall percentage on their dashboard. The backend also exposes an endpoint for retrieving their own records.

### Colleges and onboarding

- Platform Admins can view colleges with pagination.
- Platform Admins can create a college together with its initial College Admin account.
- The initial admin is scoped to the new college. The password is bcrypt-hashed and is not returned in the API response.

### Audit log

- College Admins see activity for their college; Platform Admins see platform-level activity.
- The UI supports action and date filters plus pagination.
- Some events include before/after snapshots. Passwords and password hashes are not written into those snapshots.

## Roles and access

| Role | Current access |
| --- | --- |
| Platform Admin | Platform dashboard, college list/onboarding, platform audit history, and a cross-college student list through the student API. Not automatically allowed to modify attendance. |
| College Admin | College dashboard, student management, course management, enrollment management, attendance management, and college audit history. |
| Faculty | Assigned-course dashboard/list and attendance submission for assigned courses. Faculty accounts are created by a College Admin with a temporary password; password reset is not available in the UI. |
| Student | Own profile, enrolled-course dashboard, and own attendance percentage/records. Cannot modify records. |

The backend checks roles and college ownership. Hiding a link in the frontend is not the only access control.

## Data model

- Tenant: college name, unique slug, active/suspended status.
- User: name, email, password hash, role, status, and optional tenant ID. Platform Admin users have no tenant.
- Student: tenant, linked user, student number, department, and year.
- Course: tenant, name, code, department, optional description, optional faculty assignment.
- Enrollment: tenant and references to one student and one course.
- Attendance: tenant, student, course, date, Present/Absent status, and recorder.
- AuditLog: optional tenant, actor, action, entity, before/after data, and timestamps. A null tenant marks a platform-level event.

Database uniqueness rules include tenant slug, student number within a college, course code within a college, student/course enrollment, and student/course/date attendance.

## Local setup

Requirements: Node.js 22.12 or newer, npm, and MongoDB Community Server.

### One-time setup

On macOS with Homebrew MongoDB:

    brew services start mongodb-community

Install backend dependencies:

    cd server
    npm install

Create server/.env from server/.env.example only if server/.env does not already exist. Do not overwrite an existing local configuration.

    cp .env.example .env

The default MongoDB URI is:

    mongodb://127.0.0.1:27017/student_management

Set JWT_SECRET in server/.env to a random secret. Generate one with:

    openssl rand -hex 32

Install frontend dependencies:

    cd client
    npm install

### Demo data

If the demo colleges/accounts are not present, run:

    cd server
    npm run seed

Seeding creates or updates College A, College B, their Admin, Student, and Faculty accounts, courses, and enrollments. It resets those seeded accounts to the demo passwords below. Running the seed again is safe and updates existing records.

### Start the app

Keep both terminals running.

Terminal 1 — API:

    cd server
    npm run dev

Terminal 2 — frontend:

    cd client
    npm run dev

Open http://localhost:5173. Use localhost consistently for the frontend session. Stop either process with Ctrl+C.

## Demo accounts

| Role | College slug | Email | Password |
| --- | --- | --- | --- |
| College Admin | college-a | admin@college-a.example | ReviewDemo123! |
| College Admin | college-b | admin@college-b.example | ReviewDemo123! |
| Faculty | college-a | priya@college-a.example | FacultyDemo123! |
| Faculty | college-a | rajan@college-a.example | FacultyDemo123! |
| Faculty | college-b | anita@college-b.example | FacultyDemo123! |
| Student | college-a | student@college-a.example | StudentDemo123! |
| Student | college-b | student@college-b.example | StudentDemo123! |
| Platform Admin | platform | admin@platform.example | ReviewDemo123! |

These credentials are for local demonstrations only.

Suggested demonstration:

1. Sign in as College A Admin.
2. Browse the Students list — filter by department or year. Open a profile and edit it.
3. Visit the Faculty page to see the seeded faculty accounts.
4. Visit the Courses page to see seeded courses with faculty assignments and enrollment counts. Enroll a student in a new course.
5. Go to Attendance, pick a course and date, mark students Present/Absent, and save. Reopen the same course/date to confirm saved statuses.
6. Sign in as a faculty member (priya@college-a.example / FacultyDemo123!) and take attendance for an assigned course.
7. Sign in as the student (student@college-a.example / StudentDemo123!) to see their profile, courses, attendance percentage, and recent attendance.
8. Review the Audit log as College A Admin.
9. Sign in as College B Admin and show that its records are separate.
10. Sign in as Platform Admin to create a new college and its first College Admin.

## API reference

Routes are under /api. Except health, login, and logout, they require the session cookie.

| Method and path | Purpose and access |
| --- | --- |
| GET /health | API/database readiness. |
| POST /auth/login | Sign in with tenantSlug, email, password; slug platform selects Platform Admin. |
| POST /auth/logout | Clear the session cookie. |
| GET /auth/me | Return the public current-user record. |
| GET /dashboard | Role-specific live dashboard data. |
| GET /tenants?page=&limit= | Paginated college list; Platform Admin. |
| POST /tenants | Create college and initial admin; Platform Admin. Requires name, slug, adminName, adminEmail, adminPassword. |
| GET /students?page=&limit=&department=&year= | Paginated student list; student results are self-only; other roles are tenant-scoped except Platform Admin. |
| POST /students | Create student account/profile; College Admin. |
| GET /students/:id | Read a profile; tenant-scoped, students can read only themselves. |
| PATCH /students/:id | Edit student and linked user fields; College Admin. |
| DELETE /students/:id | Delete student and linked user; College Admin. |
| GET /faculty | List active faculty in the current college; College Admin. |
| POST /faculty | Create a faculty login; College Admin. Requires name, email, password (12+ characters). |
| GET /courses?search= | Course list; tenant-scoped and filtered for student/faculty roles. |
| POST /courses | Create course; College Admin. Optionally accepts facultyId to assign a faculty member. |
| PATCH /courses/:id | Edit course and faculty assignment; College Admin. |
| DELETE /courses/:id | Delete course only when no enrollments/attendance exist; College Admin. |
| GET /enrollments?courseId= | Read enrollment list; tenant-scoped, student sees self. |
| POST /enrollments | Enroll same-college student in course; College Admin. |
| DELETE /enrollments/:id | Remove enrollment; College Admin. |
| GET /attendance?courseId=&date= | Read attendance; students are limited to own records. |
| POST /attendance | Create/update a session; College Admin or assigned Faculty. |
| GET /audit-logs?page=&limit=&action=&entityType=&from=&to= | Filtered audit history; College Admin gets college events, Platform Admin platform events. |

## Security and tenant isolation

- Passwords are stored as bcrypt hashes and are excluded from normal user queries.
- Login sets an HTTP-only JWT cookie with a two-hour expiry.
- Login attempts are rate limited.
- Helmet sets security headers; JSON request bodies are size-limited.
- Mutating API requests must come from an allowed frontend origin; CORS allows credentialed requests.
- Zod validates important request bodies and rejects unexpected fields on strict schemas.
- College-scoped records use the authenticated tenant ID rather than a tenant ID supplied by the browser.
- Course and enrollment creation checks that records belong to the same college.
- Attendance submission checks the course, enrolled students, and faculty assignment where applicable.

This is not a full production security review. See the access and test limitations below.

## Build and test commands

Frontend production build:

    cd client
    npm run build

Backend syntax checks:

    cd server
    npm run build

MongoDB-backed integration test:

    cd server
    npm test

The integration test needs MongoDB and MONGODB_URI in server/.env. It creates temporary records and cleans them up. The current test covers login/session behavior, student CRUD and authorization, tenant isolation, pagination validation, audit scoping, and college/admin onboarding. It does not cover course, enrollment, attendance, dashboard, or frontend behavior.

## Known gaps and limitations

These are gaps in the current implementation:

1. **Faculty read permissions need tightening.** Faculty course lists and attendance writes check assignment, but the student directory is college-wide and enrollment/attendance read endpoints do not consistently restrict faculty to assigned courses. Tenant scoping still applies.
2. **Attendance calculations are approximate.** The College Admin dashboard shows an overall attendance percentage across all courses and dates. Student percentage is an all-time percentage across courses. The UI has no per-course percentage or present/absent count summary.
3. **Student attendance history is limited in the UI.** Students see an overall percentage and courses on their dashboard, not a browsable attendance-record page. The API can return their own records.
4. **Writes are not transaction-backed.** Some student and onboarding failure paths use best-effort compensating cleanup, but multi-document operations are not atomic.
5. **Validation is uneven.** Student and onboarding input validation is more complete than validation for some course, enrollment, and attendance identifiers/queries.
6. **Automated coverage is incomplete.** The MongoDB integration suite is one security-focused scenario; the newer workflows need their own tests. Its cleanup removes the temporary onboarding college but may leave that test college's initial admin user in the database.
7. **No account recovery or deployment setup.** There is no password-reset/email workflow, production hosting configuration, or managed-database setup.

## Troubleshooting

- **API will not start:** Confirm MongoDB is running and check MONGODB_URI and JWT_SECRET in server/.env.
- **Login reports “Load failed” or pages say authentication is required:** Use one hostname consistently. For example, open http://localhost:5173 rather than 127.0.0.1:5173 if the session was created on localhost, then sign in again.
- **Demo login fails:** Run npm run seed from server. This resets seeded demo accounts to the passwords in this guide.
- **Port is already in use:** Stop an earlier Vite/API process with Ctrl+C. If Vite selects a different port, use the printed URL and keep the frontend/API hostname aligned.
