const mongoose = require("mongoose");

const CourierConfigSchema = new mongoose.Schema(
  {
    carrier: {
      type: String,
      enum: ["dhl", "fedex", "ups"],
      required: true,
      unique: true,
    },

    enabled: { type: Boolean, default: false },

    environment: {
      type: String,
      enum: ["sandbox", "production"],
      default: "sandbox",
    },

    apiKey: { type: String },
    apiSecret: { type: String },
    accountNumber: { type: String },

    baseUrls: {
      sandbox: String,
      production: String,
    },

    labelFormat: {
      type: String,
      enum: ["PDF", "ZPL", "PNG"],
      default: "PDF",
    },

    defaultService: String,

    currency: {
      type: String,
      default: "USD",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CourierConfig", CourierConfigSchema);
