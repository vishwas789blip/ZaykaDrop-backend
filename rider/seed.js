require("dotenv").config();
const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    picture: { type: String, required: true },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{10}$/, "Phone number must be 10 digits"],
    },
    aadharNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{12}$/, "Aadhar number must be 12 digits"],
      select: false,
    },
    drivingLicenseNumber: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    vehicleNumber: { type: String, required: true, uppercase: true },
    isVerified: { type: Boolean, default: false },
    rating: {
      average: { type: Number, default: 5, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        default: [0, 0],
      },
    },
    isAvailable: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

riderSchema.index({ location: "2dsphere" });

const Rider = mongoose.model("Rider", riderSchema);

const riders = [
  {
    userId: new mongoose.Types.ObjectId(),
    picture: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400",
    phoneNumber: "9876500001",
    aadharNumber: "123456789012",
    drivingLicenseNumber: "UP1420230012345",
    vehicleNumber: "UP14AB1234",
    isVerified: true,
    isAvailable: true,
    rating: { average: 4.7, count: 32 },
    location: {
      type: "Point",
      coordinates: [77.4429262, 28.6307001], // Ghaziabad center
    },
  },
  {
    userId: new mongoose.Types.ObjectId(),
    picture: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400",
    phoneNumber: "9876500002",
    aadharNumber: "123456789013",
    drivingLicenseNumber: "UP1420230012346",
    vehicleNumber: "UP14CD5678",
    isVerified: true,
    isAvailable: true,
    rating: { average: 4.9, count: 58 },
    location: {
      type: "Point",
      coordinates: [77.4520, 28.6420], // Kavi Nagar, Ghaziabad
    },
  },
];

async function seed() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/ZaykaDrop";

  await mongoose.connect(MONGO_URI, { dbName: "ZaykaDrop" });
  console.log("Connected to MongoDB (ZaykaDrop database)");

  await Rider.deleteMany({});
  console.log("Cleared existing riders");

  for (const r of riders) {
    const rider = await Rider.create(r);
    console.log(`Seeded rider: ${rider.vehicleNumber} (phone: ${rider.phoneNumber})`);
  }

  console.log("\nSeed complete! 2 riders inserted.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});