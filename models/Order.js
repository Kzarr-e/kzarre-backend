const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  email: { type: String },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      qty: { type: Number, required: true },
      price: { type: Number, required: true },

      name: { type: String },
      image: { type: String },
      sku: { type: String },
      barcode: { type: String },

      size: { type: String },
      color: { type: String }
    }
  ],

  address: {
    name: String,
    phone: String,
    pincode: String,
    city: String,
    state: String,
    line1: String,
  },

  amount: Number,

  paymentMethod: { type: String, default: "COD" },
  paymentId: String,
  orderId: String,

status: {
  type: String,
  enum: [
    "pending_payment",
    "paid",
    "failed",
    "cancelled",
    "shipped",
    "delivered",
    "refunded",
  ],
  default: "pending_payment",
},
  
stockReduced: { type: Boolean, default: false },

shipment: {
  carrier: String,
  service: String,

  trackingId: String,
  labelUrl: String,

  rate: {
    amount: Number,
    currency: { type: String, default: "USD" },
  },

  status: {
    type: String,
    enum: [
      "pending",
      "label_created",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "exception",
      "cancelled",
      "return_initiated",
      "returned",
    ],
    default: "pending",
  },

  history: [
    {
      status: String,
      note: String,
      date: { type: Date, default: Date.now },
    },
  ],

  shippedAt: Date,
  deliveredAt: Date,
},

return: {
  status: {
    type: String,
    enum: [
      "requested",     // customer clicked return
      "approved",      // admin approved
      "pickup_scheduled",
      "picked",
      "qc_passed",
      "qc_failed",
      "refunded",
      "rejected",
    ],
  },

  reason: { type: String },

  requestedAt: Date,
  approvedAt: Date,
  pickedAt: Date,
  qcAt: Date,
  refundedAt: Date,
},


  createdAt: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.Order || mongoose.model("Order", orderSchema);
