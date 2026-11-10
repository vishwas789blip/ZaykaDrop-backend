import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoute from "./routes/auth.js";

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

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "auth-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoute);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`auth service is running on port ${PORT}`);
  connectDB();
});

const handleGracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down auth service...`);
  server.close(async () => {
    try {
      await mongoose.disconnect();
      console.log("MongoDB connection closed cleanly.");
    } catch (err) {
      console.error("Error disconnecting MongoDB:", err);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
