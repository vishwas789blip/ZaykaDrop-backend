import { Server } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";

let io: Server;

export const initSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Authenticate every socket connection via JWT
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.data.user = decoded.user;
      next();
    } catch (err) {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    if (!user) {
      socket.disconnect();
      return;
    }

    const userId = user._id;

    // Every user joins their personal room for order status updates
    socket.join(`user:${userId}`);

    // Rider joins their personal room
    if (user.role === "rider") {
      socket.join(`rider:${userId}`);
    }

    // Restaurant owner manually joins their restaurant room after connecting.
    // We cannot rely on JWT payload for restaurantId since it is not stored there.
    socket.on("join_restaurant", ({ restaurantId }: { restaurantId: string }) => {
      if (!restaurantId) return;
      // Only sellers are permitted to monitor restaurant order rooms
      if (socket.data.user?.role !== "seller") {
        socket.emit("error", { message: "Unauthorized: sellers only" });
        return;
      }
      socket.join(`restaurant:${restaurantId}`);
      console.log(`Owner ${userId} joined restaurant:${restaurantId}`);
    });

    console.log(`Client connected: ${userId}`);
    console.log("Socket rooms:", [...socket.rooms]);

    // Rider sends location updates via their authenticated socket
    socket.on("rider:location-update", ({ userId: targetUserId, latitude, longitude }: { userId: string; latitude: number; longitude: number }) => {
      if (socket.data.user?.role !== "rider") return;
      // Forward to the customer's personal room
      io.to(`user:${targetUserId}`).emit("rider:location-update", { latitude, longitude });
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${userId}`);
    });
  });
};

export const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};