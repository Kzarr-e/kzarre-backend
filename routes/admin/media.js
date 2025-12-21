const express = require("express");
const router = express.Router();
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");
require("dotenv").config();

/* ================= AWS CLIENT ================= */

if (!process.env.AWS_BUCKET_NAME) {
  throw new Error("AWS_BUCKET_NAME is missing");
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/* ================= MULTER ================= */

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,

    // ❌ DO NOT SET ACL (bucket blocks it)

    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(
        null,
        `email-assets/${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${ext}`
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ================= ROUTE ================= */

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file || !req.file.location) {
    return res.status(400).json({ message: "Upload failed" });
  }

  res.json({
    url: req.file.location, // 🔥 S3 public URL
    key: req.file.key,
  });
});

module.exports = router;
