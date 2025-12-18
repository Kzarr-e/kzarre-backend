const axios = require("axios");
const CourierConfig = require("../../models/CourierConfig");

module.exports = async function getCourierClient(carrier) {
  const config = await CourierConfig.findOne({ carrier, enabled: true });

  if (!config) {
    throw new Error(`${carrier} is not enabled`);
  }

  const baseURL =
    config.environment === "production"
      ? config.baseUrls.production
      : config.baseUrls.sandbox;

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });
};
