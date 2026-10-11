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
    // Restaurant owner joins their restaurant room
    socket.on("join_restaurant", ({ restaurantId }: { restaurantId: string }) => {
      if (!restaurantId) return;
      socket.join(`restaurant:${restaurantId}`);
      console.log(`User ${userId} joined restaurant:${restaurantId}`);
    });

    console.log(`Client connected: ${userId}`);
    console.log("Socket rooms:", [...socket.rooms]);

    // Customer, rider, or seller joins the order-specific room
    socket.on("join_order_room", (room: string) => {
      if (room && typeof room === "string") {
        socket.join(room);
        console.log(`User ${userId} joined order room: ${room}`);
      }
    });

    socket.on("leave_order_room", (room: string) => {
      if (room && typeof room === "string") {
        socket.leave(room);
        console.log(`User ${userId} left order room: ${room}`);
      }
    });

    // Rider sends location updates via socket — broadcast directly to user and order rooms
    socket.on("rider:location-update", ({ userId: targetUserId, orderId, latitude, longitude }: { userId?: string; orderId?: string; latitude: number; longitude: number }) => {
      console.log(`📍 Location update: lat=${latitude}, lng=${longitude}, order=${orderId}`);
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit("rider:location-update", { latitude, longitude });
      }
      if (orderId) {
        io.to(`order_${orderId}`).emit("rider:location-update", { latitude, longitude });
        io.to(`order:${orderId}`).emit("rider:location-update", { latitude, longitude });
      }
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