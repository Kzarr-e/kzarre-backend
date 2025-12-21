const axios = require("axios");

module.exports = async function createShipment(order, courier) {
  console.log("\n📦 ===== CREATE SHIPMENT START =====");

  /* =====================
     BASE URL
  ===================== */
  const baseUrl =
    courier.environment === "production"
      ? courier.baseUrls?.production
      : courier.baseUrls?.sandbox;

  if (!baseUrl) throw new Error("Courier base URL missing");

  /* =====================
     HEADERS
  ===================== */
  const headers = {};
  for (const key in courier.headersTemplate || {}) {
    headers[key] = courier.headersTemplate[key]
      .replace("{{token}}", courier.auth?.token || "")
      .replace("{{apiKey}}", courier.auth?.apiKey || "");
  }

  console.log("🔐 HEADERS:", {
    ...headers,
    Authorization: headers.Authorization
      ? "Bearer ****" + headers.Authorization.slice(-6)
      : undefined,
  });

  /* =====================
     VALIDATION
  ===================== */
  if (!order?.address) {
    throw new Error("Order address missing");
  }

  const postalCode =
    order.address.postal_code || order.address.pincode;

  if (!postalCode || !order.address.city || !order.address.line1) {
    throw new Error("Incomplete US address");
  }

  /* =====================
     US STATE NORMALIZATION
  ===================== */
  const usStateMap = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    California: "CA",
    Florida: "FL",
    Georgia: "GA",
    Illinois: "IL",
    Texas: "TX",
    Washington: "WA",
    "New York": "NY",
    "New Jersey": "NJ",
    Pennsylvania: "PA",
  };

  const rawState = (order.address.state || "").trim();
  const stateCode = usStateMap[rawState] || rawState;

  console.log("📍 STATE NORMALIZED:", rawState, "→", stateCode);

  /* =====================
     PHONE NORMALIZATION (US)
  ===================== */
  const normalizePhone = (phone = "") =>
    "+1" + phone.replace(/\D/g, "").slice(-10);

  /* =====================
     EASYSHIP PAYLOAD (US → US)
  ===================== */
  const payload = {
    metadata: {
      order_id: order.orderId,
    },

    origin_address: {
      company_name: "KZARRE LLC",
      line_1: "123 Warehouse Street",
      city: "New York",
      state: "NY",
      postal_code: "10001",
      country_alpha2: "US",
      contact_name: "KZARRE Warehouse",
      contact_phone: "+12125551234",
      contact_email: "warehouse@kzarre.com",
    },

    destination_address: {
      company_name: order.address.name || "Customer",
      line_1: order.address.line1.slice(0, 35),
      city: order.address.city.trim(),
      state: stateCode,
      postal_code: postalCode,
      country_alpha2: "US",
      contact_name: order.address.name || "Customer",
      contact_phone: normalizePhone(order.address.phone),
      contact_email: order.email || "customer@kzarre.com",
    },

    parcels: [
      {
        items: order.items.map((i) => ({
          description: i.name,
          quantity: i.qty,

          // REQUIRED (US)
          actual_weight: 1, // lb
          declared_customs_value: i.price,
          declared_currency: "USD",

          // REQUIRED
          hs_code: "610910", // Apparel / T-Shirt

          dimensions: {
            length: 10,
            width: 10,
            height: 5,
          },
        })),
      },
    ],
  };

  const createShipmentUrl =
    `${baseUrl}${courier.endpoints.createShipment}`;

  console.log("🚀 CREATE SHIPMENT URL:", createShipmentUrl);
  console.log("📦 CREATE SHIPMENT BODY:", JSON.stringify(payload, null, 2));

  /* =====================
     CREATE SHIPMENT
  ===================== */
  const shipmentRes = await axios.post(
    createShipmentUrl,
    payload,
    { headers }
  );

  console.log("✅ CREATE SHIPMENT RESPONSE:", shipmentRes.data);

  const shipment =
    shipmentRes.data?.shipment;

  const shipmentId =
    shipment?.easyship_shipment_id;

  if (!shipmentId) {
    throw new Error("Easyship shipment ID missing");
  }

  /* =====================
     RATES (EMBEDDED ONLY)
  ===================== */
  const rates = shipment.rates || [];

  if (!rates.length) {
    console.warn("⚠️ No Easyship rates available");

    return {
      courier: courier.slug,
      shipmentId,
      trackingId: null,
      labelUrl: null,
      status: "shipment_created_no_rates",
      raw: shipmentRes.data,
    };
  }

  const bestRate = rates[0];

const courierServiceId =
  shipment.courier_service?.id ||
  shipment.rates?.[0]?.courier_service_id;

if (!courierServiceId) {
  throw new Error("Courier service ID missing for label purchase");
}

let labelRes = null;

try {
  labelRes = await axios.post(
    `${baseUrl}/2024-09/labels`,
    {
      shipment_id: shipmentId,
      courier_service_id: courierServiceId,
    },
    { headers }
  );
} catch (err) {
  if (err.response?.status === 404) {
    console.warn(
      "⚠️ Label purchase not available in Easyship sandbox for this courier"
    );

    return {
      courier: courier.slug,
      shipmentId,
      trackingId: null,
      labelUrl: null,
      status: "label_pending_sandbox",
      raw: shipmentRes.data,
    };
  }

  throw err; // real error
}
console.log(
  "🧾 LABEL FULL RESPONSE:",
  JSON.stringify(labelRes.data, null, 2)
);

console.log("✅ LABEL RESPONSE:", labelRes.data);
  console.log("📦 ===== CREATE SHIPMENT END =====\n");

  return {
    courier: courier.slug,
    shipmentId,
    trackingId: labelRes.data?.label?.tracking_number || null,
    labelUrl: labelRes.data?.label?.label_url || null,
    raw: labelRes.data,
  };
};
