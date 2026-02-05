const { createShippingLabel } = require("../services/shippingEngine");

router.post("/:orderId/ship", adminAuth, async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const label = await createShippingLabel(order);

  order.shipment = {
    carrier: label.carrier,
    trackingId: label.trackingId,
    labelUrl: label.labelUrl,
    status: "label_created",
    shippedAt: new Date(),
  };

  await order.save();
  res.json(order);
}); 


