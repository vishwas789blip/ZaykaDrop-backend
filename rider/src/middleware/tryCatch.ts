import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./isAuth.js";

type AsyncHandler = (
  req: AuthenticatedRequest,  
  res: Response,
  next: NextFunction
) => Promise<any>;

const tryCatch = (handler: AsyncHandler) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (err: any) {
      console.error(err);   // 👈 ye line add karo
      res.status(500).json({
        message: err.message,
      });
    }
  };
};

export default tryCatch;
export { tryCatch };