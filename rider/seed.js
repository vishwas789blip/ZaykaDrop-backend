require("dotenv").config();

const riders = [
  {
    userId: "seed_rider_user_1",
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
    userId: "seed_rider_user_2",
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
  const db = require("./dist/config/db.js");
  await db.default();
  const pool = db.getPool();
  console.log("Connected to PostgreSQL");

  await pool.query("DELETE FROM riders");
  console.log("Cleared existing riders");

  for (const r of riders) {
    const [longitude, latitude] = r.location.coordinates;
    const { rows } = await pool.query(
      `INSERT INTO riders (
        user_id, picture, phone_number, aadhar_number, driving_license_number,
        vehicle_number, is_verified, is_available, rating_average, rating_count,
        latitude, longitude
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING vehicle_number, phone_number`,
      [
        r.userId,
        r.picture,
        r.phoneNumber,
        r.aadharNumber,
        r.drivingLicenseNumber,
        r.vehicleNumber,
        r.isVerified,
        r.isAvailable,
        r.rating.average,
        r.rating.count,
        latitude,
        longitude,
      ]
    );

    const rider = rows[0];
    console.log(`Seeded rider: ${rider.vehicle_number} (phone: ${rider.phone_number})`);
  }

  console.log("\nSeed complete! 2 riders inserted.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
