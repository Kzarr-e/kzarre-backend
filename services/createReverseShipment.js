// services/createReverseShipment.js
const CourierPartner = require("../models/CourierPartner.model");

module.exports = async function createReverseShipment(order, returnReq) {
  const courier = await CourierPartner.findOne({ enabled: true });
  if (!courier) throw new Error("No active courier");

  // ⚠️ MOCK (real API later using courier.payloadTemplate)
  const trackingId = `RET-${Date.now()}`;

  return {
    courier: courier.slug,
    trackingId,
    labelUrl: `https://labels.example.com/${trackingId}.pdf`,
  };
};
