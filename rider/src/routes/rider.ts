import express from "express";
import { isAuth } from "../middleware/isAuth";
import uploadFile from "../middleware/multer";
import {
    fetchMyProfile,
    toggleAvailability,
    addRiderProfile,
    acceptOrder,
    updateOrderStatusRider,
    fetchCurrentOrders,
    setRiderAvailable,
    updateLocation,
    fetchOrderHistory,
    getEarnings
} from "../controller/rider";

const router = express.Router();

router.post("/new", isAuth, uploadFile, addRiderProfile);
router.get("/myprofile", isAuth, fetchMyProfile);
router.patch("/toggle-availability", isAuth, toggleAvailability);
router.patch("/location", isAuth, updateLocation);
router.get("/earnings", isAuth, getEarnings);
router.post("/accept/:orderId", isAuth, acceptOrder);
router.get("/order/current-orders", isAuth, fetchCurrentOrders);
router.get("/order/history", isAuth, fetchOrderHistory);
router.put("/order/update-status/:orderId", isAuth, updateOrderStatusRider);
router.put("/set-available", setRiderAvailable);

export default router;