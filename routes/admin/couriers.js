const express = require("express");
const router = express.Router();
const CourierPartner = require("../../models/CourierPartner.model");

// GET all couriers
router.get("/", async (req, res) => {
  const couriers = await CourierPartner.find().sort({ createdAt: -1 });
  res.json(couriers);
});

// CREATE / UPDATE courier (ADMIN)
router.put("/:slug", async (req, res) => {
  try {
    const courier = await CourierPartner.findOneAndUpdate(
      { slug: req.params.slug },
      req.body,
      { upsert: true, new: true, runValidators: true }
    );

    res.json(courier);
  } catch (err) {
    console.error("COURIER SAVE ERROR:", err.message);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
