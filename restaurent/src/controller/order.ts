import axios from "axios";
import tryCatch from "../middleware/tryCatch.js";
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { publishEvent } from "../config/order.publisher.js";
import { findAddressByIdAndUser } from "../models/address.js";
import { findPopulatedCartByUser } from "../models/cart.js";
import { findRestaurantById } from "../models/Restaurant.js";
import {
  assignRiderAtomic,
  createOrderAndClearCart,
  findCurrentOrdersForRider,
  findOrderById,
  findOrdersByRestaurant,
  findPaidOrdersByUser,
  findRiderOrderHistory,
  markOrderPaidAtomic,
  updateOrderStatusById,
} from "../models/order.js";

// POST /new
export const createOrder = tryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Please login" });
  }

  const { addressId, distance, paymentMethod } = req.body;

  if (!addressId) {
    return res.status(400).json({ message: "Address is required" });
  }

  if (typeof distance !== "number" || distance <= 0) {
    return res.status(400).json({ message: "Valid distance is required" });
  }

  if (!paymentMethod) {
    return res.status(400).json({ message: "Payment method is required" });
  }

  const address = await findAddressByIdAndUser(addressId, user._id.toString());

  if (!address) {
    return res.status(404).json({ message: "Address not found" });
  }

  const cartItems = await findPopulatedCartByUser(user._id.toString());

  if (cartItems.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  const firstCartItem = cartItems[0];

  if (!firstCartItem || !firstCartItem.restaurantId) {
    return res.status(400).json({ message: "Invalid cart data" });
  }

  const cartRestaurantId = firstCartItem.restaurantId._id;

  // Enforce single-restaurant cart integrity at order time too
  const allSameRestaurant = cartItems.every(
    (cart) => cart.restaurantId._id === cartRestaurantId
  );

  if (!allSameRestaurant) {
    return res
      .status(400)
      .json({ message: "Cart contains items from multiple restaurants" });
  }

  const restaurant = await findRestaurantById(cartRestaurantId);

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurant not found" });
  }

  if (!restaurant.isOpen) {
    return res.status(400).json({ message: "Sorry, restaurant is closed" });
  }

  let subtotal = 0;

  const orderItems = cartItems.map((cart) => {
    const item = cart.itemId;
    if (!item) {
      throw new Error("Invalid cart item");
    }

    const itemTotal = item.price * cart.quantity;
    subtotal += itemTotal;

    return {
      itemId: item._id,
      name: item.name,
      price: item.price,
      quantity: cart.quantity,
    };
  });

  const deliveryFee = subtotal < 250 ? 49 : 0;
  const platformFee = 7;
  const totalAmount = subtotal + deliveryFee + platformFee;
  const riderAmount = Math.max(45, Math.ceil(Number(distance) || 3) * 18);

  const expiredAt =
    paymentMethod !== "COD"
      ? new Date(Date.now() + 10 * 60 * 1000)
      : undefined;

  const order = await createOrderAndClearCart({
    userId: user._id.toString(),
    restaurantId: restaurant._id,
    restaurantName: restaurant.name,
    distance,
    riderAmount,
    items: orderItems,
    subtotal,
    deliveryFee,
    platformFee,
    totalAmount,
    addressId: address._id,
    deliveryAddress: {
      formattedAddress: address.formattedAddress,
      mobile: address.phone,
      latitude: address.location.coordinates[1],
      longitude: address.location.coordinates[0],
    },
    pickupAddress: {
      formattedAddress: restaurant.autoLocation.formattedAddress || restaurant.name,
      latitude: restaurant.autoLocation.coordinates[1] || 0,
      longitude: restaurant.autoLocation.coordinates[0] || 0,
    },
    paymentMethod,
    paymentStatus: paymentMethod === "COD" ? "paid" : "pending",
    status: "placed",
    ...(expiredAt && { expiredAt }),
  });

  // Realtime notify — do NOT let this fail the whole request.
  // Order + cart are already committed at this point.
  try {
    await axios.post(
      `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
      {
        event: "order:new",
        room: `restaurant:${restaurant._id}`,
        payload: order,
      },
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
        },
      }
    );
  } catch (error) {
    console.error("Failed to emit realtime new order event:", error);
  }

  return res.status(201).json({
    message: "Order place ho gaya!",
    orderId: order._id,
    amount: totalAmount,
  });
});

// FETCH FOR PAYMENT
export const fetchOrderForPayment = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const id = req.params.id as string;

  if (!id) {
    return res.status(400).json({ message: "Order ID required" });
  }

  const order = await findOrderById(id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.paymentStatus === "paid") {
    return res.status(400).json({ message: "Order already paid" });
  }

  return res.status(200).json({
    orderId: order._id,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
  });
});

export const fetchRestaurantOrders = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const restaurantId = req.params.restaurantId as string;

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant id is required" });
    }

    const restaurant = await findRestaurantById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (restaurant.ownerId.toString() !== user._id.toString()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, limit: limitParam } = req.query;
    const limit = limitParam ? Number(limitParam) : 0;
    const statuses =
      status && typeof status === "string"
        ? status.split(",").map((s) => s.trim())
        : undefined;

    const orders = await findOrdersByRestaurant(restaurantId, statuses, limit);

    return res.json({
      success: true,
      count: orders.length,
      orders,
    });
  }
);

const ALLOWED_STATUSES = ["accepted", "preparing", "ready_for_rider"] as const;

export const updateOrderStatus = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orderId = req.params.orderId as string;
    const { status } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await findOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ message: "Order is not paid yet" });
    }

    const restaurant = await findRestaurantById(order.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (restaurant.ownerId.toString() !== user._id.toString()) {
      return res
        .status(401)
        .json({ message: "You are not allowed to update this order" });
    }

    const updatedOrder = await updateOrderStatusById(order._id, status);
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Realtime notify — failure should not block the response
    try {
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `user:${updatedOrder.userId}`,
          payload: {
            orderId: updatedOrder._id,
            status: updatedOrder.status,
          },
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      );
    } catch (error) {
      console.error("Failed to emit realtime order status update:", error);
    }

    if (status === "ready_for_rider") {
      try {
        console.log("Publishing order to RabbitMQ for rider assignment", updatedOrder._id);

        await publishEvent(
          process.env.ORDER_READY_QUEUE as string,
          "order_ready_for_rider",
          {
            orderId: updatedOrder._id,
            restaurantId: updatedOrder.restaurantId,
            restaurantName: restaurant.name,
            location: {
              type: restaurant.autoLocation.type,
              coordinates: restaurant.autoLocation.coordinates,
            },
            pickupAddress:
              updatedOrder.pickupAddress?.formattedAddress ||
              restaurant.autoLocation.formattedAddress,
            dropAddress: updatedOrder.deliveryAddress?.formattedAddress,
            distance: updatedOrder.distance,
            riderAmount:
              updatedOrder.riderAmount ||
              Math.max(45, Math.ceil(Number(updatedOrder.distance) || 3) * 18),
          }
        );

        console.log("Event published to RabbitMQ for rider assignment", updatedOrder._id);
      } catch (error) {
        console.error("Failed to publish order_ready_for_rider event:", error);
      }
    }

    return res.status(200).json({ message: "Order status updated", order: updatedOrder });
  }
);

export const getMyOrders = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const orders = await findPaidOrdersByUser(req.user._id.toString());
  return res.json({ orders });
});

export const fetchSingleOrder = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const order = await findOrderById(req.params.id as string);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.userId.toString() !== req.user._id.toString()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.json({ order });
});

export const assignRiderToOrder = tryCatch(async (req, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { orderId, riderId, riderPhone, ridername, riderLocation } = req.body;

  if (!orderId || !riderId) {
    return res.status(400).json({ message: "orderId and riderId are required" });
  }

  // Atomic update: only succeeds if rider_id IS NULL (prevents race condition)
  const orderUpdate = await assignRiderAtomic({
    orderId,
    riderId,
    riderPhone,
    riderName: ridername,
    riderLocation,
  });

  if (!orderUpdate) {
    return res.status(409).json({
      message: "Order is already assigned to another rider or is not ready",
    });
  }

  // Notify customer in real-time — non-blocking
  try {
    const customerPayload = {
      orderId: orderUpdate._id,
      status: "rider_assigned",
      riderId: orderUpdate.riderId,
      riderName: orderUpdate.riderName,
      riderPhone: orderUpdate.riderPhone,
      riderLocation: orderUpdate.riderLocation,
      order: orderUpdate,
    };

    await axios.post(
      `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
      {
        event: "order_status_updated",
        room: `user:${orderUpdate.userId}`,
        payload: customerPayload,
      },
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
        },
      }
    );

    await axios
      .post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `order_${orderUpdate._id}`,
          payload: customerPayload,
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      )
      .catch(() => {});

    const restaurantPayload = {
      orderId: orderUpdate._id,
      status: "rider_assigned",
      riderId: orderUpdate.riderId,
      riderName: orderUpdate.riderName,
      riderPhone: orderUpdate.riderPhone,
      order: orderUpdate,
    };

    await axios
      .post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `restaurant:${orderUpdate.restaurantId}`,
          payload: restaurantPayload,
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      )
      .catch(() => {});

    const restaurantDoc = await findRestaurantById(orderUpdate.restaurantId);
    if (restaurantDoc?.ownerId) {
      await axios
        .post(
          `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
          {
            event: "order_status_updated",
            room: `user:${restaurantDoc.ownerId}`,
            payload: restaurantPayload,
          },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
            },
          }
        )
        .catch(() => {});
    }
  } catch (error) {
    console.error("Failed to emit rider_assigned realtime event:", error);
  }

  return res.status(200).json({
    message: "Rider assigned successfully",
    success: true,
    order: orderUpdate,
  });
});

export const getCurrentOrdersForRider = tryCatch(async (req, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { riderId } = req.query;

  if (!riderId) {
    return res.status(400).json({
      message: "Rider ID is required",
    });
  }

  const rawOrders = await findCurrentOrdersForRider(riderId.toString());

  const orders = rawOrders.map((doc) => ({
    ...doc,
    riderAmount:
      doc.riderAmount && doc.riderAmount > 0
        ? doc.riderAmount
        : Math.ceil(doc.distance || 3) * 17,
  }));

  return res.status(200).json({ orders });
});

export const getRiderOrderHistory = tryCatch(async (req, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { riderId } = req.query;

  if (!riderId) {
    return res.status(400).json({
      message: "Rider ID is required",
    });
  }

  const rawOrders = await findRiderOrderHistory(riderId.toString());

  const orders = rawOrders.map((doc) => ({
    ...doc,
    riderAmount:
      doc.riderAmount && doc.riderAmount > 0
        ? doc.riderAmount
        : Math.ceil(doc.distance || 3) * 17,
  }));

  return res.status(200).json({ orders });
});

export const updateOrderStatusRider = tryCatch(async (req, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({
      message: "Forbidden",
    });
  }

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  const order = await findOrderById(orderId);

  if (!order) {
    return res.status(404).json({
      message: "Order not found",
    });
  }

  // Rider reached restaurant & picked up order
  if (order.status === "rider_assigned") {
    const updatedOrder = await updateOrderStatusById(order._id, "picked_up");
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    try {
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `restaurant:${updatedOrder.restaurantId}`,
          payload: updatedOrder,
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      );

      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `user:${updatedOrder.userId}`,
          payload: {
            orderId: updatedOrder._id,
            status: "picked_up",
          },
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      );
    } catch (err) {
      console.error("Realtime notification failed:", err);
    }

    return res.status(200).json({
      success: true,
      message: "Order picked up successfully",
      order: updatedOrder,
    });
  }

  // Rider delivered order
  if (order.status === "picked_up") {
    const updatedOrder = await updateOrderStatusById(order._id, "delivered");
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Re-enable rider availability via internal call to rider service
    if (updatedOrder.riderId) {
      try {
        await axios.put(
          `${process.env.RIDER_SERVICE}/api/rider/set-available`,
          { riderId: updatedOrder.riderId },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
            },
          }
        );
      } catch (err) {
        console.error("Failed to restore rider availability:", err);
      }
    }

    try {
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order:delivered",
          room: `restaurant:${updatedOrder.restaurantId}`,
          payload: {
            orderId: updatedOrder._id,
            status: "delivered",
          },
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      );

      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `user:${updatedOrder.userId}`,
          payload: {
            orderId: updatedOrder._id,
            status: "delivered",
          },
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      );
    } catch (err) {
      console.error("Realtime notification failed:", err);
    }

    return res.status(200).json({
      success: true,
      message: "Order delivered successfully",
      order: updatedOrder,
    });
  }

  return res.status(400).json({
    message: `Cannot update order from status '${order.status}'`,
  });
});

export const markOrderPaid = tryCatch(async (req, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "orderId is required" });
  }

  const order = await markOrderPaidAtomic(orderId);

  if (!order) {
    return res.status(404).json({ message: "Order not found or already paid" });
  }

  return res.status(200).json({ message: "Order marked as paid", order });
});
