const express = require("express");
const router = express.Router();
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const CMSContent = require("../models/CMSContent");
require("dotenv").config();
const CMSFont = require("../models/CMSFont");

// =============================
// 🔹 AWS S3 Setup
// =============================
console.log("🧩 AWS ENV CHECK:", {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ? "✅ Loaded" : "❌ Missing",
  secretKey: process.env.AWS_SECRET_ACCESS_KEY ? "✅ Loaded" : "❌ Missing",
  bucket: process.env.AWS_BUCKET_NAME,
});

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// =============================
// 🔹 Multer Config (in-memory)
// =============================
const storage = multer.memoryStorage();
const upload = multer({ storage }); // ✅ Do NOT call .any() here

const uploadToS3 = async (file, displayTo) => {
  try {
    let folder = "cms/others";
    if (displayTo === "home-landing-video") folder = "cms/videos";
    else if (displayTo === "home-banner") folder = "cms/images/banners";
    else if (displayTo === "men-page-video") folder = "cms/videos/men";
    else if (displayTo === "women-page-video") folder = "cms/videos/women";
    else if (displayTo === "accessories-video")
      folder = "cms/videos/accessories";
    else if (displayTo === "heritage-video") folder = "cms/videos/heritage";
    else if (displayTo === "post") folder = "cms/images/posts";
    else if (displayTo === "about-page") folder = "cms/images/about";
    else if (displayTo === "product-page") folder = "cms/images/products";

    const fileName = `${crypto.randomBytes(8).toString("hex")}-${
      file.originalname
    }`;
    const key = `${folder}/${fileName}`;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(params));
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    console.log(`✅ Uploaded to S3: ${fileUrl}`);
    return fileUrl;
  } catch (err) {
    console.error("❌ uploadToS3 Error:", err);
    throw err;
  }
};

// =============================
// ✅ Save CMS Content (Create Post)
// =============================
// =============================
// ✅ Save CMS Content (Create Post)
// =============================

router.post("/save", upload.any(), async (req, res) => {
  try {
    const {
      title,
      description,
      displayTo,
      visibleDate,
      visibleTime,
      metaTag,
      metaDescription,
      keywords,
      titles,
      descriptions,
      metaTags,
      metaDescriptions,
      keywords: perImageKeywords,
    } = req.body;

    const displayToValue = displayTo || "";

    // -----------------------------
    // FIX KEYWORDS (meta.keywords)
    // Always convert to string
    // -----------------------------
    let cleanKeywords = keywords;
    try {
      const parsed = JSON.parse(keywords);
      cleanKeywords = Array.isArray(parsed) ? parsed.join(",") : keywords;
    } catch {
      cleanKeywords = keywords; // if not JSON, keep as string
    }

    // -----------------------------
    // Files
    // -----------------------------
    const videoFile = req.files?.find((f) => f.mimetype.startsWith("video/"));
    const imageFiles = req.files?.filter((f) =>
      f.mimetype.startsWith("image/")
    );

    let heroVideoUrl = null;
    let media = null;
    let mediaGroup = [];

    // NEW: Banner Styling
let parsedBannerStyle = {};
if (req.body.bannerStyle) {
  try {
    parsedBannerStyle = JSON.parse(req.body.bannerStyle);
  } catch (err) {
    console.log("❌ Invalid bannerStyle JSON:", err);
  }
}

    // ============================================
    // 1️⃣ Home Landing Video
    // ============================================
    if (
      displayToValue === "home-landing-video" ||
      displayToValue === "men-page-video" ||
      displayToValue === "women-page-video" ||
      displayToValue === "accessories-video" ||
      displayToValue === "heritage-video"
    ) {
      if (!videoFile)
        return res.status(400).json({ error: "Video required for landing" });

      heroVideoUrl = await uploadToS3(videoFile, displayToValue);

      media = {
        url: heroVideoUrl,
        name: videoFile.originalname,
        kind: "video",
        displayTo: displayToValue,
      };
    }

    // ============================================
    // 2️⃣ Single Banners (1 image)
    // ============================================
    else if (["bannerOne", "bannerTwo"].includes(displayToValue)) {
      if (!imageFiles || imageFiles.length !== 1)
        return res.status(400).json({ error: "Exactly 1 image required" });

      const url = await uploadToS3(imageFiles[0], displayToValue);

      const { title, description } = req.body; // ⬅️ added

      media = {
        url,
        name: imageFiles[0].originalname,
        kind: "image",
        displayTo: displayToValue,
        title, // ⬅️ added
        description, // ⬅️ added
      };
    }

    // ============================================
    // 3️⃣ Women / Men 4-Grid (EXACT 4 images)
    // ============================================
    else if (["women-4grid", "men-4grid"].includes(displayToValue)) {
      if (!imageFiles || imageFiles.length !== 4)
        return res.status(400).json({ error: "Requires EXACTLY 4 images" });

      mediaGroup = await Promise.all(
        imageFiles.map(async (file, i) => ({
          imageUrl: await uploadToS3(file, displayToValue),
          title: `Grid Item ${i + 1}`, // ⭐ AUTO TITLE
          description: `Description ${i + 1}`, // ⭐ AUTO DESCRIPTION
          metaTag: "",
          metaDescription: "",
          keywords: "",
          order: i + 1,
          style: parsedBannerStyle
        }))
      );
    }

    // ============================================
    // 4️⃣ Women / Men 5-Grid (EXACT 5 images + metadata)
    // ============================================
    else if (["women-grid", "men-grid"].includes(displayToValue)) {
      if (!imageFiles || imageFiles.length !== 5)
        return res.status(400).json({ error: "Requires EXACTLY 5 images" });

      const arrTitles = JSON.parse(req.body.titles || "[]");
      const arrDescriptions = JSON.parse(req.body.descriptions || "[]");
      const arrMetaTags = JSON.parse(req.body.metaTags || "[]");
      const arrMetaDescriptions = JSON.parse(req.body.metaDescriptions || "[]");

      // keywords safe parse
      let arrKeywords = [];
      try {
        const parsed = JSON.parse(req.body.keywords || "[]");
        arrKeywords = Array.isArray(parsed) ? parsed : [];
      } catch {
        arrKeywords = [];
      }

      mediaGroup = await Promise.all(
        imageFiles.map(async (file, i) => ({
          imageUrl: await uploadToS3(file, displayToValue),
          title: arrTitles[i] || `Grid Item ${i + 1}`, // ⭐ auto fallback
          description: arrDescriptions[i] || `Description ${i + 1}`, // ⭐ auto fallback
          metaTag: arrMetaTags[i] || "",
          metaDescription: arrMetaDescriptions[i] || "",
          keywords: Array.isArray(arrKeywords[i])
            ? arrKeywords[i].join(",")
            : arrKeywords[i] || "",
          order: i + 1,
              style: parsedBannerStyle
        }))
      );
    }

    // ============================================
    // 5️⃣ Blog Post (single image)
    // ============================================
    else if (displayToValue === "post") {
      if (!imageFiles || imageFiles.length !== 1)
        return res.status(400).json({ error: "Post requires 1 image" });

      const url = await uploadToS3(imageFiles[0], displayToValue);

      media = {
        url,
        name: imageFiles[0].originalname,
        kind: "image",
        displayTo: displayToValue,
      };
    }

    // ============================================
    // 6️⃣ Save to MongoDB
    // ============================================
// ============================================
// 6️⃣ Save to MongoDB
// ============================================
const saved = await CMSContent.create({
  title,
  description,
  displayTo: displayToValue,
  heroVideoUrl,
  media,
  mediaGroup,

  // NEW FIELD — save banner styles
  bannerStyle: parsedBannerStyle,

  meta: {
    tag: metaTag,
    description: metaDescription,
    keywords: cleanKeywords,
    visibleDate,
    visibleTime,
  },

  author: "Admin",
  status: "Pending Review",
});



    res.json({ success: true, message: "Saved (Pending Review)", saved });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// ✅ Get All CMS (Admin Panel)
// =============================
router.get("/", async (req, res) => {
  try {
    const cmsContent = await CMSContent.find().sort({ createdAt: -1 });
    res.status(200).json(cmsContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================
// ✅ GET SIMILAR PRODUCTS
// ==================================================
router.get("/similar/:id", async (req, res) => {
  try {
    const current = await Product.findById(req.params.id);
    if (!current) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const similar = await Product.find({
      _id: { $ne: current._id },
      category: current.category,
    })
      .limit(10)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: similar.length,
      products: similar,
    });
  } catch (err) {
    console.error("Similar products error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// =============================
// ✅ Get Public CMS (Frontend)
// =============================
router.get("/public", async (req, res) => {
  try {
    const all = await CMSContent.find({ status: "Approved" });
    const allFonts = await CMSFont.find();

    const response = {
      heroVideoUrl: null,
      menPageVideoUrl: null,
      womenPageVideoUrl: null,
      accessoriesVideoUrl: null,
      heritageVideoUrl: null,

      banners: {
        bannerOne: null,
        bannerTwo: null,
      },

      women4Grid: [],
      men4Grid: [],
      womenGrid: [],
      menGrid: [],

      bannerCarousel: [],
      posts: [],
      fonts: [],
    };

    all.forEach((item) => {
      // -----------------------------
      // VIDEOS
      // -----------------------------
      if (item.displayTo === "home-landing-video")
        response.heroVideoUrl = item.media?.url;

      if (item.displayTo === "men-page-video")
        response.menPageVideoUrl = item.media?.url;

      if (item.displayTo === "women-page-video")
        response.womenPageVideoUrl = item.media?.url;

      if (item.displayTo === "accessories-video")
        response.accessoriesVideoUrl = item.media?.url;

      if (item.displayTo === "heritage-video")
        response.heritageVideoUrl = item.media?.url;

      // -----------------------------
      // BANNERS
      // -----------------------------
      if (item.displayTo === "bannerOne")
        response.banners.bannerOne = {
          image: item.media?.url,
          title: item.media?.title || item.title || "",
          description: item.media?.description || item.description || "",
          style: item.bannerStyle || {},
        };

      if (item.displayTo === "bannerTwo")
        response.banners.bannerTwo = {
          image: item.media?.url,
          title: item.media?.title || item.title || "",
          description: item.media?.description || item.description || "",
          style: item.bannerStyle || {},
        };

      // -----------------------------
      // WOMEN 4 GRID
      // -----------------------------
      if (item.displayTo === "women-4grid")
        response.women4Grid = item.mediaGroup
          ?.sort((a, b) => a.order - b.order)
          ?.map((g) => ({
            ...g,
            style: g.style || item.bannerStyle || {},
          }));

      // -----------------------------
      // MEN 4 GRID
      // -----------------------------
      if (item.displayTo === "men-4grid")
        response.men4Grid = item.mediaGroup
          ?.sort((a, b) => a.order - b.order)
          ?.map((g) => ({
            ...g,
            style: g.style || item.bannerStyle || {},
          }));

      // -----------------------------
      // WOMEN 5 GRID
      // -----------------------------
      if (item.displayTo === "women-grid")
        response.womenGrid = item.mediaGroup
          ?.sort((a, b) => a.order - b.order)
          ?.map((g) => ({
            ...g,
            style: g.style || item.bannerStyle || {},
          }));

      // -----------------------------
      // MEN 5 GRID
      // -----------------------------
      if (item.displayTo === "men-grid")
        response.menGrid = item.mediaGroup
          ?.sort((a, b) => a.order - b.order)
          ?.map((g) => ({
            ...g,
            style: g.style || item.bannerStyle || {},
          }));

      // -----------------------------
      // BANNER CAROUSEL
      // -----------------------------
      if (item.displayTo === "home-banner-carousel")
        response.bannerCarousel.push(
          ...(item.mediaGroup || []).map((m) => m.imageUrl)
        );

      // -----------------------------
      // POSTS
      // -----------------------------
      if (item.displayTo === "post")
        response.posts.push({
          title: item.title,
          description: item.description,
          media: item.media,
        });
    });

    // -----------------------------
    // FONTS
    // -----------------------------
    response.fonts = allFonts.map((f) => ({
      name: f.fontName,
      url: f.fontUrl,
      weight: f.fontWeight,
      style: f.fontStyle,
    }));

    return res.json(response);

  } catch (err) {
    console.error("❌ Public CMS Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


router.get("/fonts", async (req, res) => {
  try {
    const fonts = await CMSFont.find().sort({ createdAt: -1 });
    res.json({ success: true, fonts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/upload-font", upload.single("font"), async (req, res) => {
  try {
    const file = req.file;

    if (!file)
      return res.status(400).json({ error: "Font file is required" });

    const fontName = req.body.fontName;
    const fontWeight = req.body.fontWeight || "400";
    const fontStyle = req.body.fontStyle || "normal";

    if (!fontName)
      return res.status(400).json({ error: "Font name is required" });

    // Upload font to S3
    const fontUrl = await uploadToS3(file, "fonts");

    const saved = await CMSFont.create({
      fontName,
      fontUrl,
      fontWeight,
      fontStyle,
    });

    res.json({ success: true, font: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// =============================
// ✅ Approve / Reject (Admin Only)
// =============================
router.patch("/approve/:id", async (req, res) => {
  try {
    const post = await CMSContent.findByIdAndUpdate(
      req.params.id,
      { status: "Approved", updatedAt: new Date() },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: "Post not found" });
    console.log("✅ Post Approved:", post._id);
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/reject/:id", async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await CMSContent.findByIdAndUpdate(
      req.params.id,
      {
        status: "Rejected",
        rejectionReason: reason || "No reason provided",
        updatedAt: new Date(),
      },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: "Post not found" });
    console.log("❌ Post Rejected:", post._id);
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await CMSContent.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: "CMS content not found" });
    }

    res.json(item);
  } catch (err) {
    console.error("GET CMS Content Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/update/:id", upload.any(), async (req, res) => {
  try {
    const id = req.params.id;

    const existing = await CMSContent.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Content not found" });
    }

    // Parse bannerStyle JSON if exists
    let bannerStyle = existing.bannerStyle;
    if (req.body.bannerStyle) {
      try {
        bannerStyle = JSON.parse(req.body.bannerStyle);
      } catch (e) {}
    }

    // Update main fields
    existing.title = req.body.title || existing.title;
    existing.description = req.body.description || existing.description;
    existing.displayTo = req.body.displayTo || existing.displayTo;

    // Meta fields
    existing.meta = {
      tag: req.body.metaTag || existing.meta.tag,
      description: req.body.metaDescription || existing.meta.description,
      keywords: req.body.keywords || existing.meta.keywords,
      visibleDate: req.body.visibleDate || existing.meta.visibleDate,
      visibleTime: req.body.visibleTime || existing.meta.visibleTime,
    };

    existing.bannerStyle = bannerStyle;

    /* ------------------------------
       FILE UPLOAD HANDLING (SINGLE)
    ------------------------------- */
    if (req.file) {
      existing.media = req.file.location;
    }

    /* ------------------------------
       MULTI FILE (GRID / CAROUSEL)
    ------------------------------- */
    if (req.files && req.files.length > 0) {
      const titles = JSON.parse(req.body.titles || "[]");
      const descriptions = JSON.parse(req.body.descriptions || "[]");

      existing.mediaGroup = req.files.map((file, i) => ({
        imageUrl: file.location,
        title: titles[i] || "",
        description: descriptions[i] || "",
        order: i + 1,
      }));
    }

    await existing.save();

    res.json({ success: true, updated: existing });
  } catch (err) {
    console.error("UPDATE CMS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});
module.exports = router;
