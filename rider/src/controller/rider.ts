import getBuffer from '../config/datauri';
import { AuthenticatedRequest } from '../middleware/isAuth';
import tryCatch from '../middleware/tryCatch';
import axios from 'axios';
import Rider from '../models/rider';

export const addRiderProfile = tryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if(user.role !== 'rider') {
        return res.status(403).json({ message: 'Forbidden: Only riders can add a profile' });
    }

    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: 'Profile picture is required' });
    }

    const { phoneNumber, aadharNumber, drivingLicenseNumber, vehicleNumber } = req.body;

    if (!phoneNumber || !aadharNumber || !drivingLicenseNumber || !vehicleNumber || !req.body.location) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    let location;
    try {
        location = JSON.parse(req.body.location);
    } catch {
        return res.status(400).json({ message: 'Invalid location format' });
    }

    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        return res.status(400).json({ message: 'Invalid location coordinates' });
    }

    const existingRider = await Rider.findOne({ userId: user._id });
    if (existingRider) {
        return res.status(400).json({ message: 'Rider profile already exists' });
    }

    const fileBuffer = getBuffer(file);

    if(!fileBuffer?.content) {
        return res.status(500).json({ message: 'failed to generate image buffer' });
    }

    const { data: uplaodResult } = await axios.post(`${process.env.UTILS_SERVICE}/api/upload`,
        {
            buffer: fileBuffer.content,
        },
        {
            headers: {
                "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
            },
        }
    );

    const riderProfile = await Rider.create({
        userId: user._id,
        picture: uplaodResult.url,
        phoneNumber,
        aadharNumber,
        drivingLicenseNumber,
        vehicleNumber,
        location: {
            type: "Point",
            coordinates: [location.longitude, location.latitude]
        },
        isAvailable: false,
        isVerified: true,
    });

    return res.status(201).json({ message: 'Rider profile created successfully', riderProfile });
});

export const fetchMyProfile = tryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const account = await Rider.findOne({ userId: user._id });
    if (!account) {
        return res.status(404).json({ message: 'Rider profile not found' });
    }

    // Auto-verify so the rider is not blocked by missing admin workflow
    if (!account.isVerified) {
        account.isVerified = true;
        await account.save();
    }

    return res.status(200).json({ message: 'Rider profile fetched successfully', account });
});

export const toggleAvailability = tryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user; 
    
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if(user.role !== 'rider') {
        return res.status(403).json({ message: 'Forbidden: Only riders can add a profile' });
    }

    const { isAvailable, latitude, longitude } = req.body;

    if(typeof isAvailable !== 'boolean' || typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ message: 'Invalid request body' });
    }

    const riderProfile = await Rider.findOne({ userId: user._id });
    if (!riderProfile) {
        return res.status(404).json({ message: 'Rider profile not found' });
    }

    if(!riderProfile.isVerified) {
        return res.status(403).json({ message: 'Rider profile is not verified' });
    }

    riderProfile.isAvailable = isAvailable;
    riderProfile.location.coordinates = [longitude, latitude];
    riderProfile.lastActiveAt = new Date();

    await riderProfile.save();

    return res.status(200).json({ message: isAvailable ? "Rider availability updated successfully" : "Rider is now unavailable", riderProfile });
});

export const acceptOrder = tryCatch(async (req: AuthenticatedRequest, res) => {
    const riderUserId = req.user?._id;
    const { orderId } = req.params;

    if (!riderUserId) {
        return res.status(400).json({ message: 'Unauthorized' });
    }

    const riderProfile = await Rider.findOne({ userId: riderUserId });

    if (!riderProfile) {
        return res.status(404).json({ message: 'Rider profile not found or not available' });
    }

    try{

        const { data } = await axios.put(`${process.env.RESTAURANT_SERVICE}/api/order/assign/rider`, 
            { 
                orderId,
                riderId: riderProfile._id.toString(),
                riderUserId: riderProfile.userId,
                ridername: req.user?.name || `Rider (${riderProfile.phoneNumber})`,
                riderPhone: riderProfile.phoneNumber,
                riderLocation: riderProfile.location?.coordinates
                    ? {
                        latitude: riderProfile.location.coordinates[1],
                        longitude: riderProfile.location.coordinates[0],
                    }
                    : undefined,
            },{
                headers: {
                    "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
                }
            }
        );

        if (data.success) {
            const riderDetails = await Rider.findOneAndUpdate({
                userId: riderUserId,
                isAvailable: true
            },
            { isAvailable: false }, 
            { returnDocument: 'after' });

            res.json ({ message: " Order accepted successfully" });

        }else {
            return res.status(400).json({ message: 'Order could not be assigned' });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(400).json({ message: "Failed to accept order", error: message });
    }
});

export const fetchCurrentOrders = tryCatch(async (req: AuthenticatedRequest, res) => {
    const riderUserId = req.user?._id;
     if (!riderUserId) {
        return res.status(400).json({ message: 'Unauthorized' });
    }

    const riderProfile = await Rider.findOne({ userId: riderUserId });

    if (!riderProfile) {
        return res.status(404).json({ message: 'Rider profile not found or not available' });
    }

    try {
        const { data } = await axios.get(`${process.env.RESTAURANT_SERVICE}/api/order/current/rider?riderId=${riderProfile._id.toString()}`, 
            {
                headers: {
                    "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
                }
            }
        );
        const orders = (data.orders || []).map((order: any) => {
            if (!order.riderAmount || order.riderAmount <= 0) {
                order.riderAmount = Math.ceil(Number(order.distance) || 3) * 17;
            }
            return order;
        });
        res.json({ message: "Current orders fetched successfully", orders });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: "Failed to fetch current orders", error: message });
    }
});

export const updateOrderStatusRider = tryCatch(async (req: AuthenticatedRequest, res) => {
    const riderUserId = req.user?._id;

    if (!riderUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const rider = await Rider.findOne({ userId: riderUserId });

    if (!rider) {
        return res.status(404).json({ message: 'Rider profile not found' });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: 'Status is required' });
    }

    try {
        const { data } = await axios.put(
            `${process.env.RESTAURANT_SERVICE}/api/order/update/status/rider`,
            {
                orderId,
                status,
                riderId: rider._id.toString(),
            },
            {
                headers: {
                    "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
                },
            }
        );

        return res.json({ message: "Order status updated successfully", order: data.order });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return res.status(400).json({ message: "Failed to update order status", error: message });
    }
});

export const setRiderAvailable = tryCatch(async (req, res) => {
    if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
        return res.status(403).json({ message: "Forbidden" });
    }

    const { riderId } = req.body;
    if (!riderId) {
        return res.status(400).json({ message: "riderId is required" });
    }

    const rider = await Rider.findByIdAndUpdate(
        riderId,
        { isAvailable: true },
        { returnDocument: 'after' }
    );

    if (!rider) {
        return res.status(404).json({ message: "Rider not found" });
    }

    return res.status(200).json({ message: "Rider set to available", rider });
});

export const updateLocation = tryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { latitude, longitude } = req.body;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({ message: "Valid latitude and longitude are required" });
    }

    const rider = await Rider.findOneAndUpdate(
        { userId: user._id },
        {
            $set: {
                "location.coordinates": [longitude, latitude],
                lastActiveAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    if (!rider) {
        return res.status(404).json({ message: "Rider profile not found" });
    }

    return res.status(200).json({ message: "Location updated", location: rider.location });
});

export const fetchOrderHistory = tryCatch(async (req: AuthenticatedRequest, res) => {
    const riderUserId = req.user?._id;
    if (!riderUserId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const riderProfile = await Rider.findOne({ userId: riderUserId });
    if (!riderProfile) {
        return res.status(404).json({ message: "Rider profile not found" });
    }

    try {
        const { data } = await axios.get(
            `${process.env.RESTAURANT_SERVICE}/api/order/history/rider?riderId=${riderProfile._id.toString()}`,
            {
                headers: {
                    "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
                },
            }
        );
        const orders = (data.orders || []).map((order: any) => {
            if (!order.riderAmount || order.riderAmount <= 0) {
                order.riderAmount = Math.ceil(Number(order.distance) || 3) * 17;
            }
            return order;
        });
        return res.json({ message: "Order history fetched successfully", orders });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ message: "Failed to fetch order history", error: message });
    }
});

export const getEarnings = tryCatch(async (req: AuthenticatedRequest, res) => {
    const riderUserId = req.user?._id;
    if (!riderUserId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const riderProfile = await Rider.findOne({ userId: riderUserId });
    if (!riderProfile) {
        return res.status(404).json({ message: "Rider profile not found" });
    }

    try {
        const { data } = await axios.get(
            `${process.env.RESTAURANT_SERVICE}/api/order/history/rider?riderId=${riderProfile._id.toString()}`,
            {
                headers: {
                    "x-internal-key": process.env.INTERNAL_SERVICE_KEY || "",
                },
            }
        );

        const orders: any[] = data.orders || [];
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        let totalEarnings = 0;
        let todayEarnings = 0;
        let todayTrips = 0;

        for (const order of orders) {
            const amount = Number(order.riderAmount) > 0 
                ? Number(order.riderAmount) 
                : Math.ceil(Number(order.distance) || 3) * 17;
            totalEarnings += amount;

            const orderDate = new Date(order.updatedAt || order.createdAt).getTime();
            if (orderDate >= startOfToday) {
                todayEarnings += amount;
                todayTrips += 1;
            }
        }

        return res.json({
            todayEarnings,
            todayTrips,
            totalEarnings,
            totalTrips: orders.length,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ message: "Failed to compute earnings", error: message });
    }
});