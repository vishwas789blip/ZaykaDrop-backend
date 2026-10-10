import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import { addToCart, getCart, removeFromCart, clearCart } from "../controller/cart.js";

const router = express.Router();

router.post("/add", isAuth, addToCart);
router.get("/get", isAuth, getCart);
router.delete("/remove/:itemId", isAuth, removeFromCart);
router.delete("/clear", isAuth, clearCart);

export default router;