const express = require("express");
const router = express.Router();
const Order = require("../../models/Order");
const ReturnRequest = require("../../models/ReturnRequest");

/**
 * GET /api/admin/logistics/analytics
 */
router.get("/", async (req, res) => {
  const totalReturns = await ReturnRequest.countDocuments();
  const completedReturns = await ReturnRequest.countDocuments({
    status: "completed",
  });

  const slaBreaches = await ReturnRequest.countDocuments({
    "sla.completeBy": { $lt: new Date() },
    status: { $ne: "completed" },
  });

  const refunds = await Order.countDocuments({ status: "refunded" });

  res.json({
    returns: {
      total: totalReturns,
      completed: completedReturns,
      slaBreaches,
    },
    refunds,
  });
});

module.exports = router;
