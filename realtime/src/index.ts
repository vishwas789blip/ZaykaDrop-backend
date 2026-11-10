import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import dns from "dns";
import { initSocket } from "./socket.js";
import internalRoute from "./routes/internal.js";

dotenv.config();

// Ensure Node prioritizes IPv4 resolution for external cloud services
dns.setDefaultResultOrder("ipv4first");

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

app.use("/api/v1/internal", internalRoute);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "realtime-service",
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5004;

server.listen(PORT, () => {
  console.log(`Realtime service running on port ${PORT}`);
});

const handleGracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down realtime service...`);
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
