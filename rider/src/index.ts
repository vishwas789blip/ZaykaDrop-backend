import express from "express";
import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import riderRoutes from "./routes/rider";
import connectDB, { getPool } from "./config/db";
import cors from "cors";
import { connectRabbitMQ } from "./config/rabbitmq";
import { startOrderReadyConsumer } from "./config/orderReadyConsumer";

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
    service: "rider-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/rider", riderRoutes);

const PORT = process.env.PORT || 5002;

let server: ReturnType<typeof app.listen> | null = null;

const startServer = async () => {
  try {
    await connectDB();
    console.log("PostgreSQL connected");

    await connectRabbitMQ();
    console.log("RabbitMQ connected");

    await startOrderReadyConsumer();

    server = app.listen(PORT, () => {
      console.log(`Rider service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start rider service:", error);
    process.exit(1);
  }
};

const handleGracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down rider service...`);
  if (server) {
    server.close(async () => {
      try {
        await getPool().end();
        console.log("PostgreSQL pool closed cleanly.");
      } catch (err) {
        console.error("Error closing PostgreSQL pool:", err);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

startServer();
