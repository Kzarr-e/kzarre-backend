const express = require("express");
const router = express.Router();
const AdConfig = require("../models/AdConfig");
const { auth } = require("../middlewares/auth");

router.get("/", auth(), async (req, res) => {
  res.json(await AdConfig.findOne());
});

router.post("/", auth(), async (req, res) => {
  const config = await AdConfig.findOneAndUpdate({}, req.body, {
    upsert: true,
    new: true,
  });

  res.json(config);
});

module.exports = router;
