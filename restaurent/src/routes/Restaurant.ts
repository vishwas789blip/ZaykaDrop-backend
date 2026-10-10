import express from "express";
import { isAuth, isSeller } from "../middleware/isAuth";
import { addRestaurant, fetchMyRestaurant, updateStatusRestaurant, updateRestaurant,getNearByRestaurant,fetchSingleRestaurant} from "../controller/Restaurant";

import uploadFile from "../middleware/multer";

const router = express.Router();

router.post("/new", isAuth, isSeller,uploadFile, addRestaurant);
router.get("/my", isAuth, isSeller, fetchMyRestaurant);
router.put("/status", isAuth, isSeller, updateStatusRestaurant);
router.put("/edit", isAuth, isSeller, updateRestaurant);
router.get("/all", getNearByRestaurant);
router.get("/:id", fetchSingleRestaurant);

export default router;