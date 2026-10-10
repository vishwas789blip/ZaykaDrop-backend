import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { tryCatch } from "../middleware/tryCatch.js";
import Cart from "../models/cart.js";
import MenuItems from "../models/MenuItems.js";

export const addToCart = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  const userId = req.user._id;
  const { restaurantId, itemId } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(restaurantId) ||
    !mongoose.Types.ObjectId.isValid(itemId)
  ) {
    return res.status(400).json({
      message: "Invalid restaurant and item id",
    });
  }

  const cartFromDifferentRestaurant = await Cart.findOne({
    userId,
    restaurantId: { $ne: restaurantId },  // $ne = not equal
  });

  if (cartFromDifferentRestaurant) {
    return res.status(400).json({
      message: "You can order from only one restaurant at a time. Please clear cart first to add items from this restaurant.",
    });
  }

  const menuItem = await MenuItems.findOne({
    _id: itemId,
    restaurantId,
    isAvailable: true,
  });

  if (!menuItem) {
    return res.status(404).json({
      message: "Item not found, unavailable, or does not belong to this restaurant",
    });
  }

  const cartItem = await Cart.findOneAndUpdate(
    { userId, restaurantId, itemId },
    {
      $inc: { quantity: 1 },                      // ✅ typo fix
      $setOnInsert: { userId, restaurantId, itemId },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  return res.json({
    message: "Item added to cart",
    cart: cartItem,
  });
});

export const getCart = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  const cart = await Cart.find({ userId: req.user._id })
    .populate("itemId")        // MenuItem details
    .populate("restaurantId"); // Restaurant details

  res.json({ cart });
});

export const removeFromCart = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  const itemId  = req.params.itemId as string;
  if (!itemId) {
    return res.status(400).json({ message: "Item id is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: "Invalid item id" });
  }

  const cartItem = await Cart.findOne({
    userId: req.user._id,
    itemId,
  });

  if (!cartItem) {
    return res.status(404).json({ message: "Item not found in cart" });
  }

  if (cartItem.quantity > 1) {
    cartItem.quantity -= 1;
    await cartItem.save();
  } else {
    await cartItem.deleteOne();
  }

  res.json({ message: "Item removed from cart" });
});

export const clearCart = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  await Cart.deleteMany({ userId: req.user._id });

  res.json({ message: "Cart cleared successfully" });
});