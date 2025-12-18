const mongoose = require("mongoose");

const CarrierSchema = new mongoose.Schema({
  enabled: Boolean,
  apiKey: String,
  secretKey: String,
  accountNumber: String,
  labelFormat: { type: String, default: "PDF" },
  defaultService: String,
});

const ShippingSettingsSchema = new mongoose.Schema({
  ups: CarrierSchema,
  fedex: CarrierSchema,
  dhl: CarrierSchema,
  defaultCarrier: String,
});

module.exports =
  mongoose.models.ShippingSettings ||
  mongoose.model("ShippingSettings", ShippingSettingsSchema);
