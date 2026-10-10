import express from "express";
import  http from "http";
import dotenv from "dotenv";
import cors from "cors";
import { initSocket } from "./socket.js";
import internalRoute from "./routes/internal.js"

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/internal", internalRoute    )

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app)
initSocket(server);

const PORT = process.env.PORT || 5004;

server.listen(PORT, () => {
  console.log(`Realtime service running on port ${PORT}`);
});