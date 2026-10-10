import multer from "multer";

const storage = multer.memoryStorage();

const uploadFile = multer({ storage }).single("image");

export default uploadFile;
