const axios = require("axios");

module.exports = async function createShipment(order, courier) {
  // 1️⃣ Resolve base URL
  const baseUrl =
    courier.environment === "production"
      ? courier.baseUrls.production
      : courier.baseUrls.sandbox;

  if (!baseUrl) {
    throw new Error("Courier base URL not configured");
  }

  // 2️⃣ Build headers dynamically
  const headers = {};
  for (const key in courier.headersTemplate || {}) {
    headers[key] = courier.headersTemplate[key]
      .replace("{{token}}", courier.auth.token || "")
      .replace("{{apiKey}}", courier.auth.apiKey || "");
  }

  // 3️⃣ Build payload dynamically
  const payload = JSON.parse(
    JSON.stringify(courier.payloadTemplate || {})
      .replace("{{orderId}}", order.orderId)
      .replace("{{name}}", order.address.name)
      .replace("{{phone}}", order.address.phone)
      .replace("{{city}}", order.address.city)
      .replace("{{pincode}}", order.address.pincode)
  );

  // 4️⃣ Call courier API
  const res = await axios.post(
    `${baseUrl}${courier.endpoints.shipment}`,
    payload,
    { headers }
  );

  // 5️⃣ Normalize response
  return {
    courier: courier.slug,
    trackingId:
      res.data.tracking_number ||
      res.data.trackingId ||
      `${courier.slug.toUpperCase()}-${Date.now()}`,
    labelUrl: res.data.label_url || res.data.labelUrl || null,
  };
};
