import express from "express";
import dotenv from "dotenv";
dotenv.config();

import riderRoutes from "./routes/rider";
import connectDB from "./config/db";
import cors from "cors";
import { connectRabbitMQ } from "./config/rabbitmq";
import { startOrderReadyConsumer } from "./config/orderReadyConsumer";

const app = express();
app.use(express.json());
app.use(cors());

app.use("/api/rider", riderRoutes);

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();
    console.log("MongoDB connected");

    await connectRabbitMQ();
    console.log("RabbitMQ connected");

    await startOrderReadyConsumer();

    app.listen(PORT, () => {
      console.log(`Rider service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start rider service:", error);
    process.exit(1); 
  }
};

startServer()