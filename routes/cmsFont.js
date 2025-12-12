const express = require("express");
const CMSFont = require("../models/CMSFont");
const fontUpload = require("../middlewares/fontUpload");
const uploadFontToS3 = require("../utils/uploadFontToS3");

const router = express.Router();

router.post("/font/add", fontUpload.single("fontFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No font uploaded" });
    }

    const fileUrl = await uploadFontToS3(req.file);

    const font = await CMSFont.create({
      fontName: req.body.fontName,
      fontUrl: fileUrl,
    });

    return res.json({ success: true, font });
  } catch (err) {
    console.error("❌ Font Upload Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/fonts", async (req, res) => {
  try {
    const fonts = await CMSFont.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      fonts: fonts.map((f) => ({
        name: f.fontName,
        url: f.fontUrl,
      })),
    });
  } catch (err) {
    console.error("❌ Fetch Fonts Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
