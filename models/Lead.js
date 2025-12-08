const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    source: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", LeadSchema);
