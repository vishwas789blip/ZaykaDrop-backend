import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import resturentRoutes from "./routes/Restaurant.js";
import MenuRoutes from "./routes/MenuItems.js";
import cartRoutes from "./routes/cart.js";
import cors from "cors";
import connectDB, { getPool } from "./config/db.js";
import addressRoutes from "./routes/address.js";
import orderRoutes from "./routes/order.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";

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
    service: "restaurant-service",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 5001;

app.use("/api/restaurant", resturentRoutes);
app.use("/api/menu", MenuRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/address", addressRoutes);
app.use("/api/order", orderRoutes);

let server: ReturnType<typeof app.listen> | null = null;

const startServer = async () => {
  try {
    await connectDB();
    console.log("PostgreSQL connected");

    await connectRabbitMQ();
    console.log("RabbitMQ connected");

    server = app.listen(PORT, () => {
      console.log(`Restaurant service is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start restaurant service:", error);
    process.exit(1);
  }
};

const handleGracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down restaurant service...`);
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
