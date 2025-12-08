const mongoose = require("mongoose");

const SEOSettingsSchema = new mongoose.Schema(
  {
    page: String,
    metaTitle: String,
    metaDescription: String,
    altTextMap: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("SEOSettings", SEOSettingsSchema);
