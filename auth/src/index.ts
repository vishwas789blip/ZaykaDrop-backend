import dotenv from "dotenv";
dotenv.config();

import dns from "dns";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoute from "./routes/auth.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]); // Windows IPv6 link-local DNS issue fix

const app = express();
app.use(cors());

app.use(express.json());

app.use("/api/auth", authRoute);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`auth service is running on port ${PORT}`);
  connectDB();
});