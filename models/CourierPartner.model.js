const mongoose = require("mongoose");

const CourierPartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },        // DHL, FedEx, Custom
    slug: { type: String, required: true, unique: true }, // dhl, fedex, xyz

    enabled: { type: Boolean, default: false },

    environment: {
      type: String,
      enum: ["sandbox", "production"],
      default: "sandbox",
    },

    baseUrls: {
      sandbox: { type: String },
      production: { type: String },
    },

    auth: {
      type: {
        type: String, // apiKey | bearer | oauth2 | basic
        enum: ["apiKey", "bearer", "oauth2", "basic"],
        required: true,
      },
      apiKey: String,
      token: String,
      username: String,
      password: String,
    },

    endpoints: {
      createShipment: String, // POST
      getRates: String,       // POST
      buyLabel: String,       // POST
      tracking: String,       // GET
      cancel: String,
    },


    headersTemplate: Object,   // dynamic headers
    payloadTemplate: Object,   // dynamic request body mapping

    currency: { type: String, default: "USD" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CourierPartner", CourierPartnerSchema);
