import { Request, Response } from "express";
import Order from "../models/order";
import Address from "../models/address";
import tryCatch from "../middleware/tryCatch";
import { AuthenticatedRequest } from "../middleware/isAuth";
import Cart from "../models/cart";
import Restaurant from "../models/Restaurant";
import axios from "axios";
import { publishEvent } from "../config/order.publisher"; 

import type { IMenuItem } from "../models/MenuItems";
import type { IRestaurant } from "../models/Restaurant";


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

  const address = await Address.findOne({
    _id: addressId,
    userId: user._id,
  });

  if (!address) {
    return res.status(404).json({ message: "Address not found" });
  }

  const cartItems = await Cart.find({ userId: user._id })
    .populate<{ itemId: IMenuItem }>("itemId")
    .populate<{ restaurantId: IRestaurant }>("restaurantId");

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
    (cart: any) =>
      cart.restaurantId?._id?.toString() === cartRestaurantId.toString()
  );

  if (!allSameRestaurant) {
    return res
      .status(400)
      .json({ message: "Cart contains items from multiple restaurants" });
  }

  const restaurant = await Restaurant.findById(cartRestaurantId);

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurant not found" });
  }

  if (!restaurant.isOpen) {
    return res.status(400).json({ message: "Sorry, restaurant is closed" });
  }

  let subtotal = 0;

  const orderItems = cartItems.map((cart: any) => {
    const item = cart.itemId;

    if (!item) {
      throw new Error("Invalid cart item");
    }

    const itemTotal = item.price * cart.quantity;
    subtotal += itemTotal;

    return {
      itemId: item._id.toString(),
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

  const order = await Order.create({
    userId: user._id.toString(),
    restaurantId: restaurant._id.toString(),
    restaurantName: restaurant.name,
    riderId: null,
    distance,
    riderAmount,
    items: orderItems,
    subtotal,
    deliveryFee,
    platformFee,
    totalAmount,
    addressId: address._id.toString(),
    deliveryAddress: {
      formattedAddress: (address as any).formattedAddress,
      mobile: (address as any).phone,
      latitude: (address as any).location?.coordinates?.[1],
      longitude: (address as any).location?.coordinates?.[0],
    },
    pickupAddress: {
      formattedAddress: restaurant.autoLocation?.formattedAddress || restaurant.name,
      latitude: restaurant.autoLocation?.coordinates?.[1] || 0,
      longitude: restaurant.autoLocation?.coordinates?.[0] || 0,
    },
    paymentMethod,
    paymentStatus: paymentMethod === "COD" ? "paid" : "pending",
    status: "placed",
    ...(expiredAt && { expiredAt }),
  });

  await Cart.deleteMany({ userId: user._id });

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
    orderId: order._id.toString(),
    amount: totalAmount,
  });
});

// FETCH FOR PAYMENT
export const fetchOrderForPayment = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Order ID required" });
  }

  const order = await Order.findById(id);

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

    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant id is required" });
    }

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (restaurant.ownerId.toString() !== user._id.toString()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, limit: limitParam } = req.query;
    const limit = limitParam ? Number(limitParam) : 0;

    const query: Record<string, any> = {
      restaurantId,
      paymentStatus: "paid",
    };

    if (status && typeof status === "string") {
      const statuses = status.split(",").map((s) => s.trim());
      query.status = { $in: statuses };
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

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

    const { orderId } = req.params;
    const { status } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ message: "Order is not paid yet" });
    }

    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (restaurant.ownerId.toString() !== user._id.toString()) {
      return res
        .status(401)
        .json({ message: "You are not allowed to update this order" });
    }

    order.status = status;
    await order.save();

    // Realtime notify — failure should not block the response
    try {
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `user:${order.userId}`,
          payload: {
            orderId: order._id.toString(),
            status: order.status,
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
        console.log("Publishing order to RabbitMQ for rider assignment", order._id);

        await publishEvent(
          process.env.ORDER_READY_QUEUE as string,
          "order_ready_for_rider",
          {
            orderId: order._id.toString(),
            restaurantId: order.restaurantId.toString(),
            restaurantName: restaurant.name,
            location: {
              type: restaurant.autoLocation.type,
              coordinates: restaurant.autoLocation.coordinates,
            },
            pickupAddress: order.pickupAddress?.formattedAddress || restaurant.autoLocation.formattedAddress,
            dropAddress: order.deliveryAddress?.formattedAddress,
            distance: order.distance,
            riderAmount: order.riderAmount || Math.max(45, Math.ceil(Number(order.distance) || 3) * 18),
          }
        );

        console.log("Event published to RabbitMQ for rider assignment", order._id);
      } catch (error) {
        console.error("Failed to publish order_ready_for_rider event:", error);
      }
    }

    return res.status(200).json({ message: "Order status updated", order });
  }
);

export const getMyOrders = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const orders = await Order.find({
    userId: req.user._id.toString(),
    paymentStatus: "paid",
  }).sort({ createdAt: -1 });

  return res.json({ orders });
});

export const fetchSingleOrder = tryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.userId.toString() !== req.user._id.toString()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.json({ order });
});

export const assignRiderToOrder = tryCatch(async (req , res) => {
  if(req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { orderId, riderId, riderPhone, ridername, riderLocation } = req.body;

  if (!orderId || !riderId) {
    return res.status(400).json({ message: "orderId and riderId are required" });
  }

  // Atomic update: only succeeds if riderId is currently null (prevents race condition)
  const orderUpdate = await Order.findOneAndUpdate(
    { _id: orderId, riderId: null, status: "ready_for_rider" },
    {
      $set: {
        riderId,
        riderPhone,
        riderName: ridername,
        status: "rider_assigned",
        ...(riderLocation && { riderLocation }),
      },
    },
    { returnDocument: 'after' }
  );

  if (!orderUpdate) {
    // Either order not found, or another rider already claimed it
    return res.status(409).json({ message: "Order is already assigned to another rider or is not ready" });
  }

  // Notify customer in real-time — non-blocking
  try {
    const customerPayload = {
      orderId: orderUpdate._id.toString(),
      status: "rider_assigned",
      riderId: orderUpdate.riderId,
      riderName: orderUpdate.riderName,
      riderPhone: orderUpdate.riderPhone,
      riderLocation: orderUpdate.riderLocation,
      order: orderUpdate,
    };

    // Emit to customer's personal room
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

    // Emit to order-specific rooms
    await axios.post(
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
    ).catch(() => {});

    const restaurantPayload = {
      orderId: orderUpdate._id.toString(),
      status: "rider_assigned",
      riderId: orderUpdate.riderId,
      riderName: orderUpdate.riderName,
      riderPhone: orderUpdate.riderPhone,
      order: orderUpdate,
    };

    // Notify restaurant room
    await axios.post(
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
    ).catch(() => {});

    // Also notify restaurant owner's personal user room
    const restaurantDoc = await Restaurant.findById(orderUpdate.restaurantId);
    if (restaurantDoc?.ownerId) {
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `user:${restaurantDoc.ownerId.toString()}`,
          payload: restaurantPayload,
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      ).catch(() => {});
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

  const rawOrders = await Order.find({
    riderId: riderId.toString(),
    status: { $in: ["rider_assigned", "picked_up"] },
  }).sort({ updatedAt: -1 });

  const orders = rawOrders.map((o) => {
    const doc = o.toObject();
    if (!doc.riderAmount || doc.riderAmount <= 0) {
      doc.riderAmount = Math.ceil(doc.distance || 3) * 17;
    }
    return doc;
  });

  return res.status(200).json({
    orders,
  });
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

  const rawOrders = await Order.find({
    riderId: riderId.toString(),
    status: "delivered",
  }).sort({ updatedAt: -1 });

  const orders = rawOrders.map((o) => {
    const doc = o.toObject();
    if (!doc.riderAmount || doc.riderAmount <= 0) {
      doc.riderAmount = Math.ceil(doc.distance || 3) * 17;
    }
    return doc;
  });

  return res.status(200).json({
    orders,
  });
});

export const updateOrderStatusRider = tryCatch(async (req, res) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({
      message: "Forbidden",
    });
  }

  const { orderId } = req.body;

  if (!orderId) {
    return res
      .status(400)
      .json({ message: "Order ID is required" });
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return res.status(404).json({
      message: "Order not found",
    });
  }

  // Rider reached restaurant & picked up order
  if (order.status === "rider_assigned") {
    order.status = "picked_up";
    await order.save();

    try {
      // Notify Restaurant
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `restaurant:${order.restaurantId}`,
          payload: order,
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      );

      // Notify Customer
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `user:${order.userId}`,
          payload: {
            orderId: order._id.toString(),
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
      order,
    });
  }

  // Rider delivered order
  if (order.status === "picked_up") {
    order.status = "delivered";
    await order.save();

    // Re-enable rider availability via internal call to rider service
    if (order.riderId) {
      try {
        await axios.put(
          `${process.env.RIDER_SERVICE}/api/rider/set-available`,
          { riderId: order.riderId },
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
      // Notify Restaurant
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order:delivered",
          room: `restaurant:${order.restaurantId}`,
          payload: {
            orderId: order._id.toString(),
            status: "delivered",
          },
        },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
          },
        }
      );

      // Notify Customer
      await axios.post(
        `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
        {
          event: "order_status_updated",
          room: `user:${order.userId}`,
          payload: {
            orderId: order._id.toString(),
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
      order,
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

  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: "paid" } },
    {
      $set: { paymentStatus: "paid" },
      $unset: { expiredAt: 1 },
    },
    { returnDocument: 'after' }
  );

  if (!order) {
    return res.status(404).json({ message: "Order not found or already paid" });
  }

  return res.status(200).json({ message: "Order marked as paid", order });
});