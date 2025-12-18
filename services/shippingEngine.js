const axios = require("axios");

async function createShipment(order, courier) {
  const baseUrl =
    courier.environment === "production"
      ? courier.baseUrls.production
      : courier.baseUrls.sandbox;

  const url = baseUrl + courier.endpoints.shipment;

  const headers = buildHeaders(courier);
  const payload = buildPayload(order, courier);

  const res = await axios.post(url, payload, { headers });

  return {
    trackingId: res.data.tracking_number || res.data.trackingId,
    labelUrl: res.data.label_url,
    raw: res.data,
  };
}

function buildHeaders(courier) {
  const h = { ...(courier.headersTemplate || {}) };

  if (courier.auth.type === "apiKey") {
    h["Authorization"] = courier.auth.apiKey;
  }

  if (courier.auth.type === "bearer") {
    h["Authorization"] = `Bearer ${courier.auth.token}`;
  }

  return h;
}

function buildPayload(order, courier) {
  // Uses admin-defined payloadTemplate
  // Map order → courier format dynamically
  return courier.payloadTemplate;
}

module.exports = { createShipment };
