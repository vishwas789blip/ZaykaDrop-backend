import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface IUser {
  _id: string;
  name: string;
  email: string;
  image: string;
  role: "customer" | "rider" | "seller" | "admin"; 
  restaurantId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: IUser | null;
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in .env file");
}

export const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "No token provided" });
      return;
    }

    const secret = process.env.JWT_SECRET!; 
    const decodedValue = jwt.verify(token, secret) as JwtPayload;

    if (!decodedValue || !decodedValue.user) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    const userData = decodedValue.user ? decodedValue.user : decodedValue;

    req.user = {
      ...userData,
      _id: userData._id || userData.id
    } as IUser;
    next();
  } catch (error: any) {
    if (error?.name === "TokenExpiredError") {
      res.status(401).json({ message: "Session expired, please login again", code: "TOKEN_EXPIRED" });
      return;
    }
    console.error("Auth error:", error);
    res.status(401).json({ message: "Unauthorized, invalid token" });
  }
};

export const isSeller = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (user.role !== "seller") {
    res.status(403).json({ message: "Access denied: Sellers only" });
    return;
  }

  next();
};

export const isAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (user.role !== "admin") {
    res.status(403).json({ message: "Access denied: Admins only" });
    return;
  }

  next();
};