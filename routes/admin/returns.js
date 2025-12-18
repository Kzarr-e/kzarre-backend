router.get("/:orderId", async (req, res) => {
  const ret = await ReturnRequest.findOne({ orderId: req.params.orderId });
  if (!ret) return res.status(404).json({});

  const order = await Order.findById(ret.orderId);

  res.json({
    status: ret.status,
    courier: ret.returnShipment?.courier,
    trackingId: ret.returnShipment?.trackingId,
    timeline: order.shipping?.history || [],
  });
});
