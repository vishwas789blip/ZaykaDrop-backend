import multer from "multer";

const storage = multer.memoryStorage();

const uploadFile = multer({ storage }).single("picture");

export default uploadFile;
