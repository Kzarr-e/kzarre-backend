const express = require("express");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const Address = require("../models/Address");
const CustomerPromise = require("../models/CRMPromise");
const CRMNote = require("../models/CRMNote");

const router = express.Router();

/* ============================================================
   ✅ SEARCH CUSTOMER (EMAIL / PHONE / ORDER ID)
============================================================ */





/* ================================
   ✅ CREATE NOTE
================================ */
router.post("/notes/create", async (req, res) => {
  try {
    const { customerId, message } = req.body;

    if (!customerId || !message)
      return res.status(400).json({ message: "Missing fields" });

    const note = await CRMNote.create({
      customerId,
      message,
      createdBy: "Admin",
    });

    res.json(note);
  } catch (err) {
    res.status(500).json({ message: "Failed to create note" });
  }
});

/* ================================
   ✅ GET NOTES BY CUSTOMER
================================ */
router.get("/notes/:customerId", async (req, res) => {
  try {
    const notes = await CRMNote.find({
      customerId: req.params.customerId,
    }).sort({ createdAt: -1 });

    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});

router.post("/promises/create", async (req, res) => {
  try {
    const { customerId, type, dueDate, notes, attachmentUrl } = req.body;

    if (!customerId || !type || !dueDate)
      return res.status(400).json({ message: "Missing required fields" });

    const promise = await CustomerPromise.create({
      customer: customerId,
      type,
      dueDate,
      notes,
      attachmentUrl,
      createdBy: req.user?.id || null, // attach admin if auth middleware exists
    });

    res.json({ success: true, promise });
  } catch (err) {
    console.error("PROMISE CREATE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/promises/:customerId", async (req, res) => {
  try {
    const promises = await CustomerPromise.find({
      customer: req.params.customerId,
    }).sort({ createdAt: -1 });

    res.json(promises);
  } catch (err) {
    console.error("PROMISE FETCH ERROR:", err);
    res.status(500).json([]);
  }
});



router.get("/search", async (req, res) => {
  try {
    const { email, phone, orderId } = req.query;

    let customer = null;

    // ✅ 1. SEARCH BY ORDER ID
    if (orderId) {
      const order = await Order.findOne({ orderId }).populate("userId");
      if (!order || !order.userId) {
        return res.status(404).json({ message: "Customer not found" });
      }
      customer = order.userId;
    }

    // ✅ 2. SEARCH BY EMAIL
    if (!customer && email) {
      customer = await Customer.findOne({ email });
    }

    // ✅ 3. SEARCH BY PHONE
    if (!customer && phone) {
      customer = await Customer.findOne({
        $or: [{ phone }, { fullPhone: phone }],
      });
    }

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    /* ============================================================
       ✅ REAL ORDER METRICS
    ============================================================ */
    const orders = await Order.find({ userId: customer._id });

    const delivered = orders.filter(o => o.status === "delivered");
    const cancelled = orders.filter(o => o.status === "cancelled");

    const ltv = delivered.reduce((sum, o) => sum + (o.amount || 0), 0);
    const aov = delivered.length > 0 ? Math.round(ltv / delivered.length) : 0;
    const returnRate =
      orders.length > 0
        ? Math.round((cancelled.length / orders.length) * 100)
        : 0;

    /* ============================================================
       ✅ LOAD ADDRESSES FROM ADDRESS COLLECTION (YOUR STRUCTURE)
    ============================================================ */
    const addressDocs = await Address.find({ user: customer._id });

    const addresses = addressDocs.map(addr =>
      `${addr.line1}, ${addr.city}, ${addr.state} - ${addr.pincode}`
    );

    /* ============================================================
       ✅ FINAL SAFE RESPONSE (NO UNDEFINED FIELDS)
    ============================================================ */
    res.json({
      _id: customer._id,
      name: customer.name,
      email: customer.email,
      phone: customer.fullPhone || customer.phone || "-",

      addresses: addresses || [],      // ✅ SAFE
      tags: [],                        // ✅ SAFE
      consentEmail: true,
      consentSms: true,

      metrics: {
        ltv: ltv || 0,                 // ✅ SAFE
        aov: aov || 0,                 // ✅ SAFE
        returnRate: returnRate || 0,  // ✅ SAFE
      },
    });
  } catch (err) {
    console.error("CRM SEARCH ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================================================
   ✅ TIMELINE (ORDERS → CRM FEED)
============================================================ */
router.get("/timeline/:id", async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.id }).sort({
      createdAt: -1,
    });

    const timeline = orders.map(o => ({
      _id: o._id,
      type: "order",
      title: `Order ${o.orderId}`,
      description: `₹${o.amount} • ${o.status}`,
      createdAt: o.createdAt,
    }));

    res.json(timeline);
  } catch (err) {
    console.error("CRM TIMELINE ERROR:", err);
    res.status(500).json([]);
  }
});

/* ============================================================
   ✅ PROMISES (EMPTY FOR NOW – READY)
============================================================ */
router.get("/promises/:id", async (req, res) => {
  res.json([]);
});

module.exports = router;
