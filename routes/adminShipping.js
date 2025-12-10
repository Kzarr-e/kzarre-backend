// routes/adminShipping.js
const express = require("express");
const router = express.Router();

const ShippingIntegration = require("../models/ShippingIntegration");
const Order = require("../models/Order"); // adjust path as needed
const { auth } = require("../middlewares/auth");

// Helper: ensure only admins

// GET current shipping integration settings
router.get("/settings", async (req, res) => {
  try {
    const storeId = "default"; // or derive from req.user if multi-tenant
    let settings = await ShippingIntegration.findOne({ storeId });

    if (!settings) {
      settings = await ShippingIntegration.create({ storeId });
    }

    res.json(settings);
  } catch (err) {
    console.error("GET /admin/shipping/settings error:", err);
    res.status(500).json({ message: "Failed to fetch shipping settings" });
  }
});

// UPDATE shipping integration settings (UPS / FedEx / DHL)
router.put("/settings", async (req, res) => {
  try {
    const storeId = "default";
    const payload = req.body;

    const settings = await ShippingIntegration.findOneAndUpdate(
      { storeId },
      { $set: payload },
      { new: true, upsert: true }
    );

    res.json(settings);
  } catch (err) {
    console.error("PUT /admin/shipping/settings error:", err);
    res.status(500).json({ message: "Failed to update shipping settings" });
  }
});

// ✅ Generate shipping label + auto attach tracking to order
router.post("/label/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { carrier } = req.body;

    const storeId = "default";
    const settings = await ShippingIntegration.findOne({ storeId });

    if (!settings) {
      return res
        .status(400)
        .json({ message: "Shipping settings not configured" });
    }

    const activeCarrier = carrier || settings.defaultCarrier;

    if (!activeCarrier || !settings[activeCarrier]?.enabled) {
      return res.status(400).json({
        message: "Requested carrier not enabled or no default carrier set",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ✅ Simulated label generation
    const label = await simulateLabelGeneration(
      activeCarrier,
      order,
      settings[activeCarrier]
    );

    // ✅ ✅ ✅ AUTO ATTACH TRACKING + SHIPMENT STATUS
    order.shipment = {
      carrier: activeCarrier,
      trackingId: label.trackingNumber,
      status: "label_created",
      labelUrl: label.url,
      shippedAt: new Date(),
    };

    // ✅ AUTO UPDATE MAIN ORDER STATUS
    order.status = "shipped";

    await order.save();

    res.json({
      success: true,
      message: "Label created, tracking attached & order shipped",
      carrier: activeCarrier,
      trackingNumber: label.trackingNumber,
      labelFormat: label.format,
      labelUrl: label.url,
      order,
    });
  } catch (err) {
    console.error("POST /admin/shipping/label error:", err);
    res.status(500).json({ message: "Failed to generate shipping label" });
  }
});


// Simulated label generation (replace with real UPS/FedEx/DHL SDK/API calls)
async function simulateLabelGeneration(carrier, order, carrierConfig) {
  // In real integration, build payload and call carrier API here.
  const fakeTracking =
    carrier.toUpperCase().slice(0, 3) +
    "-" +
    Math.floor(Math.random() * 1_000_000_000);

  return {
    trackingNumber: fakeTracking,
    format: carrierConfig.labelFormat || "PDF",
    url: `https://example.com/labels/${fakeTracking}.pdf`,
  };
}

module.exports = router;
