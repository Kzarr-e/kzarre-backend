const express = require("express");
const router = express.Router();
const Order = require("../../models/Order");
const ReturnRequest = require("../../models/ReturnRequest");
const Product = require("../../models/product");

/**
 * POST /api/webhooks/courier
 * Generic webhook for ALL couriers
 */
router.post("/", async (req, res) => {
  try {
    const {
      trackingId,
      status, // picked_up | in_transit | delivered | return_completed
      courier,
      type,   // forward | reverse
      timestamp,
    } = req.body;

    // Find order by trackingId
    const order = await Order.findOne({
      "shipping.trackingId": trackingId,
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update shipping
    order.shipping.status = status;
    order.shipping.history.push({
      status,
      courier,
      date: timestamp ? new Date(timestamp) : new Date(),
    });

    await order.save();

    /**
     * =========================
     * RETURN COMPLETION LOGIC
     * =========================
     */
    if (type === "reverse" && status === "return_completed") {
      const ret = await ReturnRequest.findOne({ orderId: order._id });

      if (ret && ret.restockItems) {
        for (const item of order.items) {
          const product = await Product.findById(item.product);
          if (!product) continue;

          product.stockQuantity += item.qty;
          await product.save();
        }

        ret.status = "completed";
        await ret.save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("COURIER WEBHOOK ERROR:", err);
    res.status(500).json({ message: "Webhook failed" });
  }
});

module.exports = router;
