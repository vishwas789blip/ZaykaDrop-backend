import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import {
  addAddress,
  deleteAddress,
  getMyAddresses,
} from "../controller/address.js";

const router = express.Router();

router.post("/new", isAuth, addAddress);
router.delete("/delete/:id", isAuth, deleteAddress);
router.get("/my", isAuth, getMyAddresses);

export default router;