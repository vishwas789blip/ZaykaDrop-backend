import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/user.js";
import axios from "axios";
import jwt from "jsonwebtoken";
import tryCatch from "../middleware/tryCatch.js";
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { oauth2client } from "../config/googleConfig.js";

const allowedRoles = ["customer", "rider", "seller"] as const;
type Role = typeof allowedRoles[number];

// ---------- Helper: sign JWT ----------
const generateToken = (user: any) => {
  return jwt.sign(
    { user: { _id: user._id, email: user.email, role: user.role } },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );
};

// ---------- Helper: shape user response ----------
const shapeUser = (user: any) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  image: user.image || null,
  role: user.role,
});

// =========================================================
// NORMAL EMAIL/PASSWORD SIGNUP
// =========================================================
export const RegisterUser = tryCatch(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ message: "User already exists, please login" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
  });

  const token = generateToken(user);

  res.status(201).json({
    message: "Signup successful",
    token,
    user: shapeUser(user),
    needsRoleSelection: !user.role,
  });
});

// =========================================================
// NORMAL EMAIL/PASSWORD LOGIN
// =========================================================
export const LoginWithPassword = tryCatch(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  // User exist hi nahi karta
  if (!user) {
    return res.status(404).json({ message: "No account found with this email. Please sign up first." });
  }

  // User Google se bana tha, password set hi nahi hai
  if (!user.password) {
    return res.status(400).json({ message: "This account uses Google Sign-In. Please continue with Google." });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Incorrect password" });
  }

  const token = generateToken(user);

  res.status(200).json({
    message: "Login successful",
    token,
    user: shapeUser(user),
    needsRoleSelection: !user.role,
  });
});

// =========================================================
// GOOGLE OAUTH — SIGNUP + LOGIN (unified)
// =========================================================
export const GoogleAuth = tryCatch(async (req: Request, res: Response) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: "Authorization code is required" });
  }

  const googleRes = await oauth2client.getToken(code);
  oauth2client.setCredentials(googleRes.tokens);

  const userRes = await axios.get(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${googleRes.tokens.access_token}`,
      },
    }
  );

  const { email, name, picture } = userRes.data;
  const normalizedEmail = email.trim().toLowerCase();

  let user = await User.findOne({ email: normalizedEmail });
  let isNewUser = false;

  if (!user) {
    // User exist nahi karta → naya account banao (auto signup)
    user = await User.create({
      email: normalizedEmail,
      name,
      image: picture,
    });
    isNewUser = true;
  } else if (!user.image && picture) {
    // Agar existing user (password wala) same email se Google use kare, image update kar do
    user.image = picture;
    await user.save();
  }

  const token = generateToken(user);

  res.status(200).json({
    message: isNewUser ? "Signup successful" : "Login successful",
    token,
    user: shapeUser(user),
    needsRoleSelection: !user.role,
  });
});

// =========================================================
// ADD / UPDATE ROLE
// =========================================================
export const addUserRole = tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?._id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { role } = req.body as { role: Role };

  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { role },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const token = generateToken(user);

  res.json({ user: shapeUser(user), token });
});

// =========================================================
// PROFILE
// =========================================================
export const myProfile = tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(shapeUser(user));
});