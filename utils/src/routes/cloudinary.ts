import express from "express";
import cloudinary from "cloudinary";

const router = express.Router();

router.post("/upload", async (req, res) => {
  // Only allow calls from internal services (restaurant, rider)
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_SERVICE_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const { buffer, name } = req.body;

    if (!buffer) {
      res.status(400).json({ error: "No file buffer provided" });
      return;
    }

    const result = await cloudinary.v2.uploader.upload(buffer, {
      public_id: name,
      resource_type: "auto",
    });

    res.json({ url: result.secure_url });
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});
export default router;