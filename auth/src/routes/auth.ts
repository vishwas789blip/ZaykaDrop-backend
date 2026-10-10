import Express from "express";
import {
  RegisterUser,
  LoginWithPassword,
  GoogleAuth,
  addUserRole,
  myProfile,
} from "../controller/auth.js";
import { isAuth } from "../middleware/isAuth.js";

const router = Express.Router();

router.post("/register", RegisterUser);        
router.post("/login", LoginWithPassword);       
router.post("/google", GoogleAuth);             
router.put("/add/role", isAuth, addUserRole);
router.get("/me", isAuth, myProfile);

export default router;