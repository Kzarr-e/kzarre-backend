const express = require("express");
const router = express.Router();
const SEOSettings = require("../models/SEOSettings");
const { auth } = require("../middlewares/auth");

// Get SEO
router.get("/", auth(), async (req, res) => {
  res.json(await SEOSettings.find());
});

// Save SEO
router.post("/", auth(), async (req, res) => {
  const seo = await SEOSettings.findOneAndUpdate(
    { page: req.body.page },
    req.body,
    { upsert: true, new: true }
  );
  res.json(seo);
});

module.exports = router;
