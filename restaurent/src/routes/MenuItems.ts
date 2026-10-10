import express from "express";
import { isAuth, isSeller } from "../middleware/isAuth.js";
import { addMenuItems, getAllItems ,deleteMenuItem,toggleMenuItemAvailability} from "../controller/menuItems.js";
import uploadFile from "../middleware/multer.js";

const router = express.Router();

router.post("/add", isAuth, isSeller, uploadFile,     addMenuItems);
router.get("/all/:id", getAllItems);
router.delete("/:itemId", isAuth, isSeller , deleteMenuItem);
router.put("/status/:itemId", isAuth, isSeller , toggleMenuItemAvailability);

export default router;