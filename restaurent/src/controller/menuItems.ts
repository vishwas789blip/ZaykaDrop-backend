import axios from "axios";
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { tryCatch } from "../middleware/tryCatch.js";
import getBuffer from "../config/datauri.js";
import {
  findRestaurantByIdAndOwner,
  findRestaurantByOwnerId,
} from "../models/Restaurant.js";
import {
  createMenuItem,
  deleteMenuItemById,
  findMenuItemById,
  findMenuItemsByRestaurantId,
  toggleMenuItemAvailabilityById,
} from "../models/MenuItems.js";

export const addMenuItems = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Please login" });
    }

    const restaurant = await findRestaurantByOwnerId(req.user._id);
    if (!restaurant) {
      return res.status(404).json({ message: "No restaurant found" });
    }

    const { name, description, price } = req.body;
    if (!name || !price) {
      return res.status(400).json({ message: "Name and price are required" });
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
      console.error("External utility bucket service upload failure:", err);
      return res
        .status(502)
        .json({ message: "Media storage server connection refused or timed out" });
    }

    const item = await createMenuItem({
      name,
      description,
      price: Number(price),
      restaurantId: restaurant._id,
      image: uploadResult.url,
      isAvailable: true,
    });

    res.json({
      message: "Item added successfully",
      item,
    });
  }
);

export const getAllItems = tryCatch(async (req: AuthenticatedRequest, res) => {
  const id = req.params.id as string;
  if (!id) {
    return res.status(400).json({ message: "Id is required" });
  }

  const items = await findMenuItemsByRestaurantId(id);
  res.json(items);
});

export const deleteMenuItem = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  const itemId = req.params.itemId as string;
  if (!itemId) {
    return res.status(400).json({ message: "Id is required" });
  }

  const item = await findMenuItemById(itemId);
  if (!item) {
    return res.status(404).json({ message: "Item not found" });
  }

  const restaurant = await findRestaurantByIdAndOwner(
    item.restaurantId,
    req.user._id
  );
  if (!restaurant) {
    return res.status(403).json({ message: "Not authorized" });
  }

  await deleteMenuItemById(item._id);

  res.json({ message: "Menu item deleted successfully" });
});

export const toggleMenuItemAvailability = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Please login" });
    }

    const itemId = req.params.itemId as string;
    if (!itemId) {
      return res.status(400).json({ message: "Id is required" });
    }

    const item = await findMenuItemById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const restaurant = await findRestaurantByIdAndOwner(
      item.restaurantId,
      req.user._id
    );
    if (!restaurant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updatedItem = await toggleMenuItemAvailabilityById(item._id);

    res.json({
      message: `Item marked as ${updatedItem?.isAvailable ? "available" : "unavailable"}`,
      item: updatedItem,
    });
  }
);
