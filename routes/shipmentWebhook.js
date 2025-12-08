const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// ✅ Carrier Webhook Simulation
router.post("/webhook", async (req, res) => {
  const { trackingId, shipmentStatus } = req.body;

  const order = await Order.findOne({
    "shipment.trackingId": trackingId,
  });

  if (!order)
    return res.status(404).json({ message: "Tracking not found" });

  order.shipment.status = shipmentStatus;

  if (shipmentStatus === "delivered") {
    order.status = "delivered";
    order.shipment.deliveredAt = new Date();
  }

  await order.save();

  res.json({ success: true, message: "Shipment status updated", order });
});

module.exports = router;
