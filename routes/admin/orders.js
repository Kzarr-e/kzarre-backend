const express = require("express");
const router = express.Router();

const Order = require("../../models/Order");
const CourierPartner = require("../../models/CourierPartner.model");
const createShipment = require("../../services/createShipment");

/* ======================================================
   CREATE SHIPMENT (ADMIN)
   POST /api/admin/orders/:orderId/ship
====================================================== */

// GET ALL ORDERS (ADMIN)
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .select("orderId status amount shipment createdAt");

    // ✅ MUST return array
    res.json(orders);
  } catch (err) {
    console.error("ADMIN ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});


router.post("/:orderId/retry-label", async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.shipment?.meta) {
      return res.status(400).json({
        message: "Shipment data missing, cannot retry label",
      });
    }

    // ✅ BACKWARD-SAFE META
    const shipmentMeta =
      order.shipment.meta?.shipment ||
      order.shipment.meta;

    if (!shipmentMeta?.easyship_shipment_id) {
      return res.status(400).json({
        message: "Easyship shipment ID missing",
      });
    }

    const courierPartner = await CourierPartner.findOne({
      slug: order.shipment.carrier,
      enabled: true,
    });

    if (!courierPartner) {
      return res.status(400).json({
        message: "Courier not enabled",
      });
    }

    const baseUrl =
      courierPartner.environment === "production"
        ? courierPartner.baseUrls.production
        : courierPartner.baseUrls.sandbox;

    const headers = {
      Authorization: `Bearer ${courierPartner.auth.token}`,
      "Content-Type": "application/json",
    };

    // ✅ COURIER SERVICE ID (SAFE)
    const courierServiceId =
      shipmentMeta.courier_service?.id ||
      shipmentMeta.rates?.[0]?.courier_service_id;

    if (!courierServiceId) {
      return res.status(400).json({
        message: "Courier service ID missing",
      });
    }

    // ✅ BUY LABEL
    const axios = require("axios");
    const labelRes = await axios.post(
      `${baseUrl}/2024-09/labels`,
      {
        shipment_id: shipmentMeta.easyship_shipment_id,
        courier_service_id: courierServiceId,
      },
      { headers }
    );

    const label = labelRes.data?.label;

    if (!label) {
      return res.status(400).json({
        message: "Label creation failed",
        raw: labelRes.data,
      });
    }

    // ✅ SAVE
    order.shipment.trackingId = label.tracking_number;
    order.shipment.labelUrl = label.label_url;
    order.shipment.status = "label_created";
    order.shipment.labeledAt = new Date();

    await order.save();

    res.json({
      success: true,
      trackingId: label.tracking_number,
      labelUrl: label.label_url,
    });
  } catch (err) {
    console.error("RETRY LABEL ERROR:", err.response?.data || err);
    res.status(500).json({
      message: "Retry label failed",
      error: err.response?.data || err.message,
    });
  }
});


/* ======================================================
   RETRY LABEL (ADMIN)
   POST /api/admin/orders/:orderId/retry-label
====================================================== */
router.post("/:orderId/retry-label", async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.shipment || !order.shipment.meta) {
      return res.status(400).json({
        message: "Shipment data missing, cannot retry label",
      });
    }

    const shipmentMeta = order.shipment.meta.shipment;
    const courierSlug = order.shipment.carrier;

    if (!shipmentMeta?.easyship_shipment_id) {
      return res.status(400).json({
        message: "Easyship shipment ID missing",
      });
    }

    const courierPartner = await CourierPartner.findOne({
      slug: courierSlug,
      enabled: true,
    });

    if (!courierPartner) {
      return res.status(400).json({
        message: "Courier not enabled",
      });
    }

    const baseUrl =
      courierPartner.environment === "production"
        ? courierPartner.baseUrls.production
        : courierPartner.baseUrls.sandbox;

    const headers = {
      Authorization: `Bearer ${courierPartner.auth.token}`,
      "Content-Type": "application/json",
    };

    // ✅ Courier service ID
    const courierServiceId =
      shipmentMeta.courier_service?.id ||
      shipmentMeta.rates?.[0]?.courier_service_id;

    if (!courierServiceId) {
      return res.status(400).json({
        message: "Courier service ID missing",
      });
    }

    // ✅ BUY LABEL
    const labelRes = await require("axios").post(
      `${baseUrl}/2024-09/labels`,
      {
        shipment_id: shipmentMeta.easyship_shipment_id,
        courier_service_id: courierServiceId,
      },
      { headers }
    );

    const label = labelRes.data?.label;

    if (!label) {
      return res.status(400).json({
        message: "Label creation failed",
        raw: labelRes.data,
      });
    }

    // ✅ SAVE RESULT
    order.shipment.trackingId = label.tracking_number;
    order.shipment.labelUrl = label.label_url;
    order.shipment.status = "label_created";
    order.shipment.labeledAt = new Date();

    await order.save();

    res.json({
      success: true,
      trackingId: label.tracking_number,
      labelUrl: label.label_url,
    });
  } catch (err) {
    console.error("RETRY LABEL ERROR:", err.response?.data || err);
    res.status(500).json({
      message: "Retry label failed",
      error: err.response?.data || err.message,
    });
  }
});


router.patch("/:orderId/shipment", async (req, res) => {
  try {
    const { status, trackingId } = req.body;

    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.shipment) {
      order.shipment = {};
    }

    // ✅ Update tracking ID (manual or webhook)
    if (trackingId) {
      order.shipment.trackingId = trackingId;
    }

    // ✅ Update shipment status
    if (status) {
      order.shipment.status = status;

      // 🔁 Auto-sync order status
      if (["in_transit", "out_for_delivery"].includes(status)) {
        order.status = "shipped";
      }

      if (status === "delivered") {
        order.status = "delivered";
        order.shipment.deliveredAt = new Date();
      }

      if (status === "exception") {
        // optional: flag for support
        order.shipment.hasIssue = true;
      }
    }

    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    console.error("SHIPMENT UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to update shipment" });
  }
});

module.exports = router;