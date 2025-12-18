const axios = require("axios");
const CourierPartner = require("../../models/CourierPartner");

function buildAuthHeaders(auth) {
  switch (auth.type) {
    case "apiKey":
      return { "x-api-key": auth.apiKey };

    case "bearer":
      return { Authorization: `Bearer ${auth.token}` };

    case "basic":
      return {
        Authorization:
          "Basic " +
          Buffer.from(`${auth.username}:${auth.password}`).toString("base64"),
      };

    default:
      return {};
  }
}

exports.callCourier = async ({
  courierSlug,
  action,        // rate | shipment | tracking | cancel
  payload,
}) => {
  const courier = await CourierPartner.findOne({
    slug: courierSlug,
    enabled: true,
  });

  if (!courier) {
    throw new Error("Courier not found or disabled");
  }

  const baseURL =
    courier.environment === "production"
      ? courier.baseUrls.production
      : courier.baseUrls.sandbox;

  const endpoint = courier.endpoints[action];
  if (!endpoint) {
    throw new Error(`Action ${action} not supported`);
  }

  const headers = {
    "Content-Type": "application/json",
    ...courier.headersTemplate,
    ...buildAuthHeaders(courier.auth),
  };

  const client = axios.create({ baseURL, headers });

  const response = await client.post(endpoint, payload);

  return response.data;
};
