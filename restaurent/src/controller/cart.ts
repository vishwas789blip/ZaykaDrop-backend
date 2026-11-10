import { isValidUUID } from "../config/db.js";
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { tryCatch } from "../middleware/tryCatch.js";
import {
  clearCartByUser,
  decrementOrDeleteCartItem,
  findDifferentRestaurantInCart,
  findPopulatedCartByUser,
  upsertIncrementCartItem,
} from "../models/cart.js";
import { findAvailableMenuItem } from "../models/MenuItems.js";

export const addToCart = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  const userId = req.user._id;
  const { restaurantId, itemId } = req.body;

  if (
    typeof restaurantId !== "string" ||
    typeof itemId !== "string" ||
    !isValidUUID(restaurantId) ||
    !isValidUUID(itemId)
  ) {
    return res.status(400).json({
      message: "Invalid restaurant and item id",
    });
  }

  const cartFromDifferentRestaurant = await findDifferentRestaurantInCart(
    userId,
    restaurantId
  );

  if (cartFromDifferentRestaurant) {
    return res.status(400).json({
      message:
        "You can order from only one restaurant at a time. Please clear cart first to add items from this restaurant.",
    });
  }

  const menuItem = await findAvailableMenuItem(itemId, restaurantId);

  if (!menuItem) {
    return res.status(404).json({
      message:
        "Item not found, unavailable, or does not belong to this restaurant",
    });
  }

  const cartItem = await upsertIncrementCartItem(userId, restaurantId, itemId);

  return res.json({
    message: "Item added to cart",
    cart: cartItem,
  });
});

export const getCart = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  const cart = await findPopulatedCartByUser(req.user._id);
  res.json({ cart });
});

export const removeFromCart = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  const itemId = req.params.itemId as string;
  if (!itemId) {
    return res.status(400).json({ message: "Item id is required" });
  }

  if (!isValidUUID(itemId)) {
    return res.status(400).json({ message: "Invalid item id" });
  }

  const result = await decrementOrDeleteCartItem(req.user._id, itemId);

  if (result === "not_found") {
    return res.status(404).json({ message: "Item not found in cart" });
  }

  res.json({ message: "Item removed from cart" });
});

export const clearCart = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Please login" });
  }

  await clearCartByUser(req.user._id);
  res.json({ message: "Cart cleared successfully" });
});
