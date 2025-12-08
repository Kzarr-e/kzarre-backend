const mongoose = require("mongoose");

const crmNoteSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },

  message: {
    type: String,
    required: true,
    trim: true,
  },

  createdBy: {
    type: String,
    default: "Admin",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("CRMNote", crmNoteSchema);
