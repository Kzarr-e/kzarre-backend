const express = require("express");
const router = express.Router();
const CourierPartner = require("../../models/CourierPartner.model");

/* =====================================================
   GET ALL COURIERS
===================================================== */
router.get("/", async (req, res) => {
  try {
    const couriers = await CourierPartner.find().sort({ createdAt: -1 });
    res.json(couriers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch couriers" });
  }
});

/* =====================================================
   CREATE / UPDATE COURIER (ADMIN)
===================================================== */
router.put("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug.trim().toLowerCase(); // 🔥 FIX 1

    const courier = await CourierPartner.findOneAndUpdate(
      { slug },
      { $set: req.body }, // 🔥 FIX 2 (CRITICAL)
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({ success: true, courier });
  } catch (err) {
    console.error("COURIER SAVE ERROR:", err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
