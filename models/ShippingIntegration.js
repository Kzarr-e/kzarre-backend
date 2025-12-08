// models/ShippingIntegration.js
const mongoose = require("mongoose");

const CarrierConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    apiKey: { type: String },
    accountNumber: { type: String },
    labelFormat: {
      type: String,
      enum: ["PDF", "ZPL", "PNG"],
      default: "PDF",
    },
    defaultService: { type: String }, // e.g., "GROUND", "EXPRESS"
  },
  { _id: false }
);

const ShippingIntegrationSchema = new mongoose.Schema(
  {
    // In case you want multi-tenant later:
    storeId: { type: String, default: "default", index: true },

    ups: CarrierConfigSchema,
    fedex: CarrierConfigSchema,
    dhl: CarrierConfigSchema,

    defaultCarrier: {
      type: String,
      enum: ["ups", "fedex", "dhl", null],
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ShippingIntegration",
  ShippingIntegrationSchema
);
