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
const Tenant = mongoose.model("Tenant", tenantSchema);
const User = mongoose.model("User", userSchema);
const Student = mongoose.model("Student", studentSchema);

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in server/.env");
  await mongoose.connect(process.env.MONGODB_URI);

  for (const slug of ["college-a", "college-b"]) {
    const collegeName = slug === "college-a" ? "College A" : "College B";
    const tenant = await Tenant.findOneAndUpdate(
      { slug },
      { $set: { name: collegeName, status: "active" } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    const adminEmail = `admin@${slug}.example`;
    const admin = await User.findOneAndUpdate(
      { tenantId: tenant._id, email: adminEmail },
      { $set: { name: `${collegeName} Admin`, passwordHash: await bcrypt.hash("ReviewDemo123!", 12), role: "college_admin", status: "active" } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    const studentEmail = `student@${slug}.example`;
    const studentUser = await User.findOneAndUpdate(
      { tenantId: tenant._id, email: studentEmail },
      { $set: { name: `${collegeName} Student`, passwordHash: await bcrypt.hash("StudentDemo123!", 12), role: "student", status: "active" } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await Student.findOneAndUpdate(
      { tenantId: tenant._id, studentNumber: slug === "college-a" ? "A001" : "B001" },
      { $set: { userId: studentUser._id, department: "CSE", year: 2 } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    console.log(`Seeded ${collegeName}: ${admin.email}`);
  }

  const platformAdmin = await User.findOneAndUpdate(
    { tenantId: null, email: "admin@platform.example" },
    {
      $set: {
        name: "Platform Admin",
        passwordHash: await bcrypt.hash("ReviewDemo123!", 12),
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
