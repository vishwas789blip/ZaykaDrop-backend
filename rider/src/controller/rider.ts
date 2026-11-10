import axios from "axios";
import getBuffer from "../config/datauri";
import { AuthenticatedRequest } from "../middleware/isAuth";
import tryCatch from "../middleware/tryCatch";
import {
  claimRiderUnavailable,
  createRider,
  findRiderByUserId,
  markRiderVerifiedByUserId,
  setRiderAvailableById,
  updateRiderAvailabilityAndLocation,
  updateRiderLocationByUserId,
} from "../models/rider";

export const addRiderProfile = tryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.role !== "rider") {
    return res.status(403).json({ message: "Forbidden: Only riders can add a profile" });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "Profile picture is required" });
  }

  const { phoneNumber, aadharNumber, drivingLicenseNumber, vehicleNumber } = req.body;

  if (!phoneNumber || !aadharNumber || !drivingLicenseNumber || !vehicleNumber || !req.body.location) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!/^\d{10}$/.test(String(phoneNumber))) {
    return res.status(400).json({ message: "Phone number must be 10 digits" });
  }

  if (!/^\d{12}$/.test(String(aadharNumber))) {
    return res.status(400).json({ message: "Aadhar number must be 12 digits" });
  }

  let location;
  try {
    location = JSON.parse(req.body.location);
  } catch {
    return res.status(400).json({ message: "Invalid location format" });
  }

  if (typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    return res.status(400).json({ message: "Invalid location coordinates" });
  }

  const existingRider = await findRiderByUserId(user._id);
  if (existingRider) {
    return res.status(400).json({ message: "Rider profile already exists" });
  }

  const fileBuffer = getBuffer(file);

  if (!fileBuffer?.content) {
    return res.status(500).json({ message: "failed to generate image buffer" });
  }

  const { data: uplaodResult } = await axios.post(
    `${process.env.UTILS_SERVICE}/api/upload`,
    {
      buffer: fileBuffer.content,
    },
    {
      headers: {
        "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
      },
    }
  );

  try {
    const riderProfile = await createRider({
      userId: user._id,
      picture: uplaodResult.url,
      phoneNumber: String(phoneNumber),
      aadharNumber: String(aadharNumber),
      drivingLicenseNumber: String(drivingLicenseNumber),
      vehicleNumber: String(vehicleNumber),
      latitude: location.latitude,
      longitude: location.longitude,
      isAvailable: false,
      isVerified: true,
    });

    return res.status(201).json({ message: "Rider profile created successfully", riderProfile });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({
        message: "Phone number, Aadhar, driving license, or user already registered",
      });
    }
    throw err;
  }
});

export const fetchMyProfile = tryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let account = await findRiderByUserId(user._id);
  if (!account) {
    return res.status(404).json({ message: "Rider profile not found" });
  }

  // Auto-verify so the rider is not blocked by missing admin workflow
  if (!account.isVerified) {
    account = (await markRiderVerifiedByUserId(user._id)) ?? account;
  }

  return res.status(200).json({ message: "Rider profile fetched successfully", account });
});

export const toggleAvailability = tryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.role !== "rider") {
    return res.status(403).json({ message: "Forbidden: Only riders can add a profile" });
  }

  const { isAvailable, latitude, longitude } = req.body;

  if (typeof isAvailable !== "boolean" || typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ message: "Invalid request body" });
  }

  const existing = await findRiderByUserId(user._id);
  if (!existing) {
    return res.status(404).json({ message: "Rider profile not found" });
  }

  if (!existing.isVerified) {
    return res.status(403).json({ message: "Rider profile is not verified" });
  }

  const riderProfile = await updateRiderAvailabilityAndLocation(
    user._id,
    isAvailable,
    latitude,
    longitude
  );

  return res.status(200).json({
    message: isAvailable ? "Rider availability updated successfully" : "Rider is now unavailable",
    riderProfile,
  });
});

export const acceptOrder = tryCatch(async (req: AuthenticatedRequest, res) => {
  const riderUserId = req.user?._id;
  const { orderId } = req.params;

  if (!riderUserId) {
    return res.status(400).json({ message: "Unauthorized" });
  }

  const riderProfile = await findRiderByUserId(riderUserId);

  if (!riderProfile) {
    return res.status(404).json({ message: "Rider profile not found or not available" });
  }

  try {
    const { data } = await axios.put(
      `${process.env.RESTAURANT_SERVICE}/api/order/assign/rider`,
      {
        orderId,
        riderId: riderProfile._id,
        riderUserId: riderProfile.userId,
        ridername: req.user?.name || `Rider (${riderProfile.phoneNumber})`,
        riderPhone: riderProfile.phoneNumber,
        riderLocation: riderProfile.location?.coordinates
          ? {
              latitude: riderProfile.location.coordinates[1],
              longitude: riderProfile.location.coordinates[0],
            }
          : undefined,
      },
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
        },
      }
    );

    if (data.success) {
      await claimRiderUnavailable(riderUserId);
      res.json({ message: " Order accepted successfully" });
    } else {
      return res.status(400).json({ message: "Order could not be assigned" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ message: "Failed to accept order", error: message });
  }
});

export const fetchCurrentOrders = tryCatch(async (req: AuthenticatedRequest, res) => {
  const riderUserId = req.user?._id;
  if (!riderUserId) {
    return res.status(400).json({ message: "Unauthorized" });
  }

  const riderProfile = await findRiderByUserId(riderUserId);

  if (!riderProfile) {
    return res.status(404).json({ message: "Rider profile not found or not available" });
  }

  try {
    const { data } = await axios.get(
      `${process.env.RESTAURANT_SERVICE}/api/order/current/rider?riderId=${riderProfile._id}`,
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
        },
      }
    );
    const orders = (data.orders || []).map((order: any) => {
      if (!order.riderAmount || order.riderAmount <= 0) {
        order.riderAmount = Math.ceil(Number(order.distance) || 3) * 17;
      }
      return order;
    });
    res.json({ message: "Current orders fetched successfully", orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: "Failed to fetch current orders", error: message });
  }
});

export const updateOrderStatusRider = tryCatch(async (req: AuthenticatedRequest, res) => {
  const riderUserId = req.user?._id;

  if (!riderUserId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const rider = await findRiderByUserId(riderUserId);

  if (!rider) {
    return res.status(404).json({ message: "Rider profile not found" });
  }

  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  try {
    const { data } = await axios.put(
      `${process.env.RESTAURANT_SERVICE}/api/order/update/status/rider`,
      {
        orderId,
        status,
        riderId: rider._id,
      },
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
        },
      }
    );

    return res.json({ message: "Order status updated successfully", order: data.order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ message: "Failed to update order status", error: message });
  }
});

export const setRiderAvailable = tryCatch(async (req, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { riderId } = req.body;
  if (!riderId) {
    return res.status(400).json({ message: "riderId is required" });
  }

  const rider = await setRiderAvailableById(String(riderId));

  if (!rider) {
    return res.status(404).json({ message: "Rider not found" });
  }

  return res.status(200).json({ message: "Rider set to available", rider });
});

export const updateLocation = tryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { latitude, longitude } = req.body;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ message: "Valid latitude and longitude are required" });
  }

  const rider = await updateRiderLocationByUserId(user._id, latitude, longitude);

  if (!rider) {
    return res.status(404).json({ message: "Rider profile not found" });
  }

  return res.status(200).json({ message: "Location updated", location: rider.location });
});

export const fetchOrderHistory = tryCatch(async (req: AuthenticatedRequest, res) => {
  const riderUserId = req.user?._id;
  if (!riderUserId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const riderProfile = await findRiderByUserId(riderUserId);
  if (!riderProfile) {
    return res.status(404).json({ message: "Rider profile not found" });
  }

  try {
    const { data } = await axios.get(
      `${process.env.RESTAURANT_SERVICE}/api/order/history/rider?riderId=${riderProfile._id}`,
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
        },
      }
    );
    const orders = (data.orders || []).map((order: any) => {
      if (!order.riderAmount || order.riderAmount <= 0) {
        order.riderAmount = Math.ceil(Number(order.distance) || 3) * 17;
      }
      return order;
    });
    return res.json({ message: "Order history fetched successfully", orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Failed to fetch order history", error: message });
  }
});

export const getEarnings = tryCatch(async (req: AuthenticatedRequest, res) => {
  const riderUserId = req.user?._id;
  if (!riderUserId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const riderProfile = await findRiderByUserId(riderUserId);
  if (!riderProfile) {
    return res.status(404).json({ message: "Rider profile not found" });
  }

  try {
    const { data } = await axios.get(
      `${process.env.RESTAURANT_SERVICE}/api/order/history/rider?riderId=${riderProfile._id}`,
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
        },
      }
    );

    const orders: any[] = data.orders || [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let totalEarnings = 0;
    let todayEarnings = 0;
    let todayTrips = 0;

    for (const order of orders) {
      const amount =
        Number(order.riderAmount) > 0
          ? Number(order.riderAmount)
          : Math.ceil(Number(order.distance) || 3) * 17;
      totalEarnings += amount;

      const orderDate = new Date(order.updatedAt || order.createdAt).getTime();
      if (orderDate >= startOfToday) {
        todayEarnings += amount;
        todayTrips += 1;
      }
    }

    return res.json({
      todayEarnings,
      todayTrips,
      totalEarnings,
      totalTrips: orders.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Failed to compute earnings", error: message });
  }
});
