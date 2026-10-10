import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { tryCatch } from "../middleware/tryCatch.js"
import Address from "../models/address.js";

// ── Add New Address ──
export const addAddress = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Please login" });
    }

    const { phone, formattedAddress, latitude, longitude, pincode, } = req.body;

    if (!phone || !formattedAddress || latitude === undefined || longitude === undefined || !pincode) {
      return res.status(400).json({ message: "All address fields are required" });
    }

    const newAddress = await Address.create({
      userId: user._id.toString(),
      phone,
      formattedAddress,
      location:{
        type: "Point",
        coordinates: [Number(longitude), Number(latitude)]
      },
      pincode,
    });


    res.json({
      message: "Address added successfully",
      address: newAddress,
    });
  }
);

// ── Delete Address ──
export const deleteAddress = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Please login" });
    }

    const { id } = req.params;

    if (!id){
      return res.status(400).json({
        message: "id is required",
      });
    }


    const address = await Address.findOne({ _id: id, userId: user._id.toString(), });

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    await address.deleteOne();

    return res.json({ message: "Address deleted successfully" });
  }
); 

// ── Get All Addresses ──
export const getMyAddresses = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Please login" });
    }           

    const addresses = await Address.find({ 
      userId: user._id.toString(),
    }).sort({
      createdAt: -1,
    });

    return res.json({ addresses });
  }
);