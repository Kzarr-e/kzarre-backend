const express = require("express");
const router = express.Router();

const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const Product = require("../models/product"); // note: lowercase file in your project

// ✅ LIST return requests with optional filter ?status=pending (NO AUTH)
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const returns = await ReturnRequest.find(filter)
      .populate("order")
      .populate("customer")
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.json(returns);
  } catch (err) {
    console.error("GET /admin/returns error:", err);
    res.status(500).json({ message: "Failed to fetch return requests" });
  }
});

// ✅ CREATE a return request (NO AUTH)
router.post("/", async (req, res) => {
  try {
    const { orderId, items, reasonGeneral, restockOnApproval = true } =
      req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const customerId = order.customer;

    const returnRequest = await ReturnRequest.create({
      order: orderId,
      customer: customerId,
      items,
      reasonGeneral,
      restockOnApproval,
    });

    res.status(201).json(returnRequest);
  } catch (err) {
    console.error("POST /admin/returns error:", err);
    res.status(500).json({ message: "Failed to create return request" });
  }
});

/**
 * ✅ UPDATE status: approve / deny / complete (NO AUTH)
 * Body: { status: "approved" | "denied" | "completed", adminNotes?, refundAmount?, restockItems? }
 */
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, refundAmount, restockItems } = req.body;

    if (!["pending", "approved", "denied", "completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const returnReq = await ReturnRequest.findById(id).populate(
      "items.product"
    );
    if (!returnReq) {
      return res.status(404).json({ message: "Return request not found" });
    }

    // ✅ If approving and restocking is requested
    if (status === "approved") {
      if (restockItems) {
        await restockProducts(returnReq);
        returnReq.restockedAt = new Date();
      }
    }

    if (status === "completed") {
      if (returnReq.restockOnApproval && !returnReq.restockedAt) {
        await restockProducts(returnReq);
        returnReq.restockedAt = new Date();
      }
    }

    returnReq.status = status;
    if (typeof adminNotes === "string") returnReq.adminNotes = adminNotes;
    if (typeof refundAmount === "number") {
      returnReq.refundAmount = refundAmount;
    }

    await returnReq.save();

    res.json(returnReq);
  } catch (err) {
    console.error("PATCH /admin/returns/:id/status error:", err);
    res.status(500).json({ message: "Failed to update return status" });
  }
});

// ✅ Helper to restock products
async function restockProducts(returnReq) {
  const bulkOps = [];

  returnReq.items.forEach((item) => {
    if (!item.product || !item.quantity) return;

    bulkOps.push({
      updateOne: {
        filter: { _id: item.product._id || item.product },
        update: { $inc: { stock: item.quantity } },
      },
    });
  });

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps);
  }
}

module.exports = router;
