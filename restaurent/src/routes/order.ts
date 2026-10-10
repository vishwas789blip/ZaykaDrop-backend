import express from "express";
import { isAuth ,isSeller} from "../middleware/isAuth.js";
import { 
    createOrder, 
    fetchOrderForPayment, 
    fetchRestaurantOrders,  
    fetchSingleOrder,  
    getMyOrders,  
    updateOrderStatus,  
    assignRiderToOrder,  
    getCurrentOrdersForRider,  
    getRiderOrderHistory,
    updateOrderStatusRider,
    markOrderPaid
 } from "../controller/order.js";

const router = express.Router();

router.post("/new", isAuth, createOrder);
router.post("/mark-paid", markOrderPaid);
router.get("/payment/:id", fetchOrderForPayment);
router.get("/my", isAuth, getMyOrders);
router.get("/single/:id", isAuth, fetchSingleOrder);
router.get("/:restaurantId", isAuth, isSeller, fetchRestaurantOrders);
router.put("/:orderId", isAuth, isSeller, updateOrderStatus);
router.put("/assign/rider",  assignRiderToOrder);
router.get("/current/rider", getCurrentOrdersForRider);
router.get("/history/rider", getRiderOrderHistory);
router.put("/update/status/rider", updateOrderStatusRider);

export default router;