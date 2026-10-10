import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import {IUser} from "../models/user.js"


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
    if (!token ) {
      res.status(401).json({ message: "No token provided" });
      return;
    }

    const decodedValue = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    if (!decodedValue || !decodedValue.user) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    req.user = decodedValue.user;
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

