import express from "express";
import dotenv from "dotenv";
import cloudinary from "cloudinary";
import cors from "cors";
import dns from "dns";
import uploadRoutes from "./routes/cloudinary.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";

dotenv.config();

// Ensure Node prioritizes IPv4 resolution for external cloud services
dns.setDefaultResultOrder("ipv4first");
connectRabbitMQ();

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error("Missing Cloudinary environment variables");
}

cloudinary.v2.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const app = express();

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((s) => s.trim())
  : "*";

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "utils-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", uploadRoutes);

const PORT = process.env.PORT || 5003;

const server = app.listen(PORT, () => {
  console.log(`Utils service running on port ${PORT}`);
});

const handleGracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down utils service...`);
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
