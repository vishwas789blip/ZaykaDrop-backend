import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { tryCatch } from "../middleware/tryCatch.js";
import {
  createAddress,
  deleteAddressByIdAndUser,
  findAddressesByUser,
  findAddressByIdAndUser,
} from "../models/address.js";

// ── Add New Address ──
export const addAddress = tryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Please login" });
    }

    const { phone, formattedAddress, latitude, longitude, pincode } = req.body;

    if (
      !phone ||
      !formattedAddress ||
      latitude === undefined ||
      longitude === undefined ||
      !pincode
    ) {
      return res.status(400).json({ message: "All address fields are required" });
    }

    if (!/^\d{10}$/.test(String(phone))) {
      return res.status(400).json({
        message: "Mobile number must be a valid 10-digit sequence",
      });
    }

    const newAddress = await createAddress({
      userId: user._id.toString(),
      phone: Number(phone),
      formattedAddress,
      latitude: Number(latitude),
      longitude: Number(longitude),
      pincode: String(pincode),
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

    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        message: "id is required",
      });
    }

    const address = await findAddressByIdAndUser(id, user._id.toString());

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    await deleteAddressByIdAndUser(id, user._id.toString());

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

    const addresses = await findAddressesByUser(user._id.toString());

    return res.json({ addresses });
  }
);
