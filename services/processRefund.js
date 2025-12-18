const Stripe = require("stripe");
const Order = require("../models/Order");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function processRefund(orderId) {
  const order = await Order.findById(orderId);

  if (!order || !order.paymentId) return;

  // Prevent double refund
  if (order.status === "refunded") return;

  await stripe.refunds.create({
    payment_intent: order.paymentId,
  });

  order.status = "refunded";
  order.shipping.history.push({
    status: "refund_processed",
    date: new Date(),
  });

  await order.save();
};
