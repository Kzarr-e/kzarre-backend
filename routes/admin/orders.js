const createShipment = require("../services/createShipment");

router.post("/:id/ship", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.shipping?.trackingId) {
    return res.status(400).json({ message: "Shipment already created" });
  }

  const shipment = await createShipment(order);

  order.shipping = {
    courier: shipment.courier,
    trackingId: shipment.trackingId,
    labelUrl: shipment.labelUrl,
    status: "label_created",
    history: [
      { status: "label_created", date: new Date() }
    ],
  };

  order.status = "shipped";
  await order.save();

  res.json({ success: true, order });
});
