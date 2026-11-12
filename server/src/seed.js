import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const tenantSchema = new mongoose.Schema({
  name: String,
  slug: { type: String, unique: true },
  status: { type: String, default: "active" }
});
const userSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  name: String,
  email: String,
  passwordHash: String,
  role: String,
  status: { type: String, default: "active" }
});
const studentSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  studentNumber: String,
  department: String,
  year: Number
}, { timestamps: true });
const courseSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  name: String,
  code: { type: String, uppercase: true },
  department: String,
  description: String,
  facultyId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });
const enrollmentSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  studentId: mongoose.Schema.Types.ObjectId,
  courseId: mongoose.Schema.Types.ObjectId
}, { timestamps: true });
const attendanceSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  studentId: mongoose.Schema.Types.ObjectId,
  courseId: mongoose.Schema.Types.ObjectId,
  date: Date,
  status: String,
  recordedBy: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

const Tenant = mongoose.model("Tenant", tenantSchema);
const User = mongoose.model("User", userSchema);
const Student = mongoose.model("Student", studentSchema);
const Course = mongoose.model("Course", courseSchema);
const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in server/.env");
  await mongoose.connect(process.env.MONGODB_URI);

  const hash = (pw) => bcrypt.hash(pw, 12);

  for (const slug of ["college-a", "college-b", "vasavi"]) {
    const collegeName = slug === "college-a" ? "College A" : slug === "college-b" ? "College B" : "Vasavi College of Engineering";
    const tenant = await Tenant.findOneAndUpdate(
      { slug },
      { $set: { name: collegeName, status: "active" } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // College admin
    const adminEmail = slug === "vasavi" ? "karthik@gmail.com" : `admin@${slug}.example`;
    const adminName = slug === "vasavi" ? "Karthik" : `${collegeName} Admin`;
    const existingAdmin = await User.findOne({ tenantId: tenant._id, email: adminEmail });
    const adminPasswordHash = existingAdmin?.passwordHash || await hash("ReviewDemo123!");

    await User.findOneAndUpdate(
      { tenantId: tenant._id, email: adminEmail },
      { $set: { name: adminName, passwordHash: adminPasswordHash, role: "college_admin", status: "active" } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Faculty members
    const facultyData = slug === "college-a"
      ? [
          { name: "Dr. Priya Sharma", email: "priya@college-a.example" },
          { name: "Prof. Rajan Mehta", email: "rajan@college-a.example" }
        ]
      : slug === "college-b"
      ? [
          { name: "Dr. Anita Desai", email: "anita@college-b.example" }
        ]
      : [
          { name: "Dr. K. Srinivas", email: "srinivas@vasavi.example" },
          { name: "Prof. Swapna Rani", email: "swapna@vasavi.example" }
        ];

    const facultyUsers = [];
    for (const fac of facultyData) {
      const user = await User.findOneAndUpdate(
        { tenantId: tenant._id, email: fac.email },
        { $set: { name: fac.name, passwordHash: await hash("FacultyDemo123!"), role: "faculty", status: "active" } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      facultyUsers.push(user);
    }

    // Students
    const studentsData = slug === "college-a"
      ? [
          { name: "Arjun Patel", email: "student@college-a.example", number: "A001", dept: "CSE", year: 2 },
          { name: "Kavitha Nair", email: "kavitha@college-a.example", number: "A002", dept: "CSE", year: 2 },
          { name: "Rahul Gupta", email: "rahul@college-a.example", number: "A003", dept: "ECE", year: 3 },
          { name: "Meera Joshi", email: "meera@college-a.example", number: "A004", dept: "CSE", year: 1 }
        ]
      : slug === "college-b"
      ? [
          { name: "Sanjay Kumar", email: "student@college-b.example", number: "B001", dept: "CSE", year: 2 },
          { name: "Deepa Rao", email: "deepa@college-b.example", number: "B002", dept: "ECE", year: 1 }
        ]
      : [
          { name: "Karthik", email: "karthik.student@vasavi.example", number: "V001", dept: "CSE", year: 2 },
          { name: "Ram Charan", email: "ramcharan@vasavi.example", number: "V002", dept: "CSE", year: 2 },
          { name: "Ravi", email: "ravi@vasavi.example", number: "V003", dept: "ECE", year: 3 },
          { name: "Ram", email: "ram@vasavi.example", number: "V004", dept: "CSE-AIML", year: 2 },
          { name: "Charan", email: "charan@vasavi.example", number: "V005", dept: "EEE", year: 1 }
        ];

    const studentRecords = [];
    for (const s of studentsData) {
      const user = await User.findOneAndUpdate(
        { tenantId: tenant._id, email: s.email },
        { $set: { name: s.name, passwordHash: await hash("student123"), role: "student", status: "active" } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      const student = await Student.findOneAndUpdate(
        { tenantId: tenant._id, studentNumber: s.number },
        { $set: { userId: user._id, department: s.dept, year: s.year } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      studentRecords.push(student);
    }

    // Courses
    const coursesData = slug === "college-a"
      ? [
          { name: "Data Structures", code: "CS201", dept: "CSE", desc: "Arrays, linked lists, trees, and graphs.", faculty: 0 },
          { name: "Database Systems", code: "CS301", dept: "CSE", desc: "Relational databases, SQL, and normalization.", faculty: 0 },
          { name: "Digital Electronics", code: "EC201", dept: "ECE", desc: "Logic gates, flip-flops, and combinational circuits.", faculty: 1 },
          { name: "Web Development", code: "CS202", dept: "CSE", desc: "HTML, CSS, JavaScript, and React basics.", faculty: 0 }
        ]
      : slug === "college-b"
      ? [
          { name: "Operating Systems", code: "CS301", dept: "CSE", desc: "Process management, memory, and file systems.", faculty: 0 },
          { name: "Signal Processing", code: "EC202", dept: "ECE", desc: "Fourier transforms and filtering.", faculty: 0 }
        ]
      : [
          { name: "Data Structures & Algorithms", code: "CS201", dept: "CSE", desc: "Arrays, trees, graphs, and dynamic programming.", faculty: 0 },
          { name: "Full Stack Web Development", code: "CS202", dept: "CSE", desc: "React, Node.js, Express, and MongoDB.", faculty: 0 },
          { name: "Digital Systems Design", code: "EC201", dept: "ECE", desc: "Digital logic, VLSI, and microcontrollers.", faculty: 1 }
        ];

    const courseRecords = [];
    for (const c of coursesData) {
      const course = await Course.findOneAndUpdate(
        { tenantId: tenant._id, code: c.code },
        { $set: { name: c.name, department: c.dept, description: c.desc, facultyId: facultyUsers[c.faculty]?._id || null } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      courseRecords.push(course);
    }

    // Enrollments — enroll students in courses from their department
    for (const student of studentRecords) {
      const deptCourses = courseRecords.filter((c) => c.department === student.department);
      for (const course of deptCourses) {
        await Enrollment.findOneAndUpdate(
          { studentId: student._id, courseId: course._id },
          { $set: { tenantId: tenant._id } },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    }

    // Seed attendance records for demonstration
    if ((slug === "college-a" || slug === "vasavi") && courseRecords.length && facultyUsers.length) {
      const cs201 = courseRecords.find((c) => c.code === "CS201");
      const cseStudents = studentRecords.filter((s) => s.department === "CSE");
      if (cs201 && cseStudents.length) {
        const today = new Date();
        const d1 = new Date(today);
        d1.setDate(today.getDate() - 2);
        d1.setUTCHours(0, 0, 0, 0);

        const d2 = new Date(today);
        d2.setDate(today.getDate() - 1);
        d2.setUTCHours(0, 0, 0, 0);

        for (const s of cseStudents) {
          // Day 1
          await Attendance.findOneAndUpdate(
            { studentId: s._id, courseId: cs201._id, date: d1 },
            { $set: { tenantId: tenant._id, status: "Present", recordedBy: facultyUsers[0]._id } },
            { upsert: true, setDefaultsOnInsert: true }
          );
          // Day 2
          const status = s.studentNumber.endsWith("002") ? "Absent" : "Present";
          await Attendance.findOneAndUpdate(
            { studentId: s._id, courseId: cs201._id, date: d2 },
            { $set: { tenantId: tenant._id, status, recordedBy: facultyUsers[0]._id } },
            { upsert: true, setDefaultsOnInsert: true }
          );
        }
      }
    }

    console.log(`Seeded ${collegeName}: ${studentsData.length} students, ${facultyData.length} faculty, ${coursesData.length} courses`);
  }

  const platformAdmin = await User.findOneAndUpdate(
    { tenantId: null, email: "admin@platform.example" },
    {
      $set: {
        name: "Platform Admin",
        passwordHash: await hash("ReviewDemo123!"),
        role: "platform_admin",
        status: "active"
      }
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  console.log(`Seeded platform admin: ${platformAdmin.email}`);

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
