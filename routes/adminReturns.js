const express = require("express");
const router = express.Router();

const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const Product = require("../models/product");

const createReverseShipment = require("../services/createReverseShipment");

/**
 * GET ALL RETURNS
 * /api/admin/returns?status=pending|approved|denied|completed
 */
router.get("/:orderId", async (req, res) => {
  const ret = await ReturnRequest.findOne({ orderId: req.params.orderId });

  if (!ret) {
    return res.status(404).json({ message: "No return found" });
  }

  const order = await Order.findById(ret.orderId);

  res.json({
    status: ret.status,
    reason: ret.reason,
    courier: ret.returnShipment?.courier,
    trackingId: ret.returnShipment?.trackingId,
    labelUrl: ret.returnShipment?.labelUrl,
    timeline: order.shipping?.history || [],
    sla: ret.sla,
  });
});

router.get("/", async (req, res) => {
  const { status } = req.query;

  const filter =
    status && status !== "all" ? { status } : {};

  const returns = await ReturnRequest
    .find(filter)
    .sort({ createdAt: -1 });

  res.json(returns);
});

router.post("/exchange", async (req, res) => {
  const { orderId, reason, size, color } = req.body;

  const ret = await ReturnRequest.create({
    orderId,
    reason,
    exchange: {
      enabled: true,
      newVariant: { size, color },
    },
  });

  res.json(ret);
});

/**
 * UPDATE RETURN STATUS
 * PATCH /api/admin/returns/:id/status
 */
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, restockItems, note } = req.body;

    const ret = await ReturnRequest.findById(req.params.id);
    if (!ret) {
      return res.status(404).json({ message: "Return not found" });
    }

    const order = await Order.findById(ret.orderId)
      .populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    /* ============================
       APPROVE → CREATE REVERSE SHIPMENT
    ============================ */
    if (status === "approved") {
      const shipment = await createReverseShipment(order, ret);

      ret.returnShipment = shipment;

      // SLA rules
      ret.sla = {
        pickupBy: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        completeBy: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };

      // Update order shipping
      order.shipping = order.shipping || {};
      order.shipping.status = "return_initiated";
      order.shipping.trackingId = shipment.trackingId;
      order.shipping.courier = shipment.courier;

      order.shipping.history = order.shipping.history || [];
      order.shipping.history.push({
        status: "return_pickup_created",
        date: new Date(),
      });
    }

    /* ============================
       RESTOCK INVENTORY
    ============================ */
    if (status === "approved" && restockItems) {
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (!product) continue;

        product.stockQuantity += item.qty;
        await product.save();
      }
    }

    /* ============================
       FINALIZE RETURN
    ============================ */
    if (status === "completed") {
      order.shipping.status = "returned";
      order.shipping.history.push({
        status: "return_completed",
        date: new Date(),
      });
    }

    /* ============================
       COMMON UPDATES
    ============================ */
    ret.status = status;
    ret.restockItems = !!restockItems;
    ret.adminNote = note || "";
    await ret.save();

    await order.save();

    res.json(ret);
  } catch (err) {
    console.error("RETURN UPDATE ERROR:", err);
    res.status(500).json({ message: "Return update failed" });
  }
});

module.exports = router;
