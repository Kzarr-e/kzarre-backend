// services/refundOrder.js
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function refundOrder(order) {
  if (!order.paymentId) return;

  await stripe.refunds.create({
    payment_intent: order.paymentId,
  });
};
