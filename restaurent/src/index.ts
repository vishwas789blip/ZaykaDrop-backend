import dotenv from "dotenv";
dotenv.config();

import express from "express";
import resturentRoutes from "./routes/Restaurant.js";
import MenuRoutes from "./routes/MenuItems.js";
import cartRoutes from "./routes/cart.js"
import cors from "cors";
import connectDB from "./config/db.js";
import addressRoutes from "./routes/address.js";
import orderRoutes from "./routes/order.js"
import { connectRabbitMQ } from "./config/rabbitmq.js";


const app = express();
app.use(cors());

app.use(express.json());

const PORT = process.env.PORT || 5001;

app.use("/api/restaurant",resturentRoutes);
app.use("/api/menu", MenuRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/address", addressRoutes);
app.use("/api/order", orderRoutes);

const startServer = async () => {
  try {
    await connectDB();
    console.log("MongoDB connected");

    await connectRabbitMQ();
    console.log("RabbitMQ connected");

    app.listen(PORT, () => {
      console.log(`Restaurant service is running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Failed to start restaurant service:", error);
    process.exit(1);
  }
};

startServer();