import axios from "axios";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, IUser } from "../middleware/isAuth.js";
import tryCatch from "../middleware/tryCatch.js";
import {
  createRestaurant,
  findNearbyRestaurants,
  findRestaurantById,
  findRestaurantByOwnerId,
  updateRestaurantByOwner,
  updateRestaurantStatusByOwner,
} from "../models/Restaurant.js";
import getBuffer from "../config/datauri.js";

export const addRestaurant = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const existingRestaurant = await findRestaurantByOwnerId(user._id);
    if (existingRestaurant) {
      return res.status(400).json({
        message: "Restaurant already exists for this user",
      });
    }

    const { name, description, latitude, longitude, formattedAddress, phone } =
      req.body;

    if (!name || !description || !phone || !formattedAddress) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Coordinates are required" });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const fileBuffer = getBuffer(file);
    if (!fileBuffer?.content) {
      return res.status(500).json({ message: "Failed to process image" });
    }

    let uploadResult;
    try {
      const { data } = await axios.post(
        `${process.env.UTILS_SERVICE}/api/upload`,
        {
          buffer: file.buffer.toString("base64"),
          name: file.originalname,
          type: file.mimetype,
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
          },
        }
      );
      uploadResult = data;
    } catch (err) {
      console.error("Upload service error:", err);
      return res.status(502).json({ message: "Image upload service failed" });
    }

    if (!uploadResult?.url) {
      return res.status(500).json({ message: "Image upload failed" });
    }

    const newRestaurant = await createRestaurant({
      name,
      description,
      phone,
      image: uploadResult.url,
      ownerId: user._id,
      latitude: Number(latitude),
      longitude: Number(longitude),
      formattedAddress,
      isVerified: false,
    });

    return res.status(201).json({
      message: "Restaurant created successfully",
      restaurant: newRestaurant,
    });
  }
);

export const fetchMyRestaurant = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Please login" });
    }

    const foundRestaurant = await findRestaurantByOwnerId(req.user._id);

    if (!foundRestaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (!req.user.restaurantId) {
      const updatedUser: IUser & { restaurantId: string } = {
        ...req.user,
        restaurantId: foundRestaurant._id.toString(),
      };

      const token = jwt.sign(
        { user: updatedUser },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        message: "Restaurant fetched successfully with session upgrade",
        restaurant: foundRestaurant,
        token,
      });
    }

    return res.status(200).json({
      message: "Restaurant fetched successfully",
      restaurant: foundRestaurant,
    });
  }
);

export const updateStatusRestaurant = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(403).json({
        message: "Please login",
      });
    }

    const { status } = req.body;

    if (typeof status !== "boolean") {
      return res.status(400).json({
        message: "Status must be a boolean",
      });
    }

    const restaurant = await updateRestaurantStatusByOwner(
      req.user._id,
      status
    );

    if (!restaurant) {
      return res.status(404).json({
        message: "Restaurant not found",
      });
    }

    return res.json({
      message: "Restaurant status updated successfully",
      restaurant,
    });
  }
);

export const updateRestaurant = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(403).json({ message: "Please login" });
    }

    const { name, description, phone } = req.body;

    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const updates: { name?: string; description?: string; phone?: string } = {};
    if (name) updates.name = name;
    if (description) updates.description = description;
    if (phone) updates.phone = phone;

    const restaurant = await updateRestaurantByOwner(req.user._id, updates);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    return res.json({
      message: "Restaurant profile updated successfully",
      restaurant,
    });
  }
);

export const getNearByRestaurant = tryCatch(async (req, res) => {
  const { latitude, longitude, radius = 5000, search = "" } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({
      message: "Latitude and longitude are required",
    });
  }

  const restaurants = await findNearbyRestaurants(
    Number(latitude),
    Number(longitude),
    Number(radius),
    typeof search === "string" ? search.trim() : ""
  );

  res.json({ success: true, count: restaurants.length, restaurants });
});

export const fetchSingleRestaurant = tryCatch(async (req, res) => {
  const id = req.params.id as string;

  if (!id) {
    return res.status(400).json({ message: "Restaurant id is required" });
  }

  const restaurant = await findRestaurantById(id);

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurant not found" });
  }

  res.json({ restaurant });
});
