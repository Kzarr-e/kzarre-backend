const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const Order = require("../models/Order");
const Product = require("../models/product");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/webhook", async (req, res) => {
  console.log("✅✅✅ STRIPE WEBHOOK HIT ✅✅✅");

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    /* ✅ PAYMENT SUCCESS */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      console.log("✅ SESSION METADATA:", session.metadata);

      const orderId = session.metadata?.orderId;
      if (!orderId) return res.json({ received: true });

      const order = await Order.findOne({ orderId });

      if (!order || order.status === "paid" || order.stockReduced === true) {
        return res.json({ received: true });
      }

      // ✅ REDUCE STOCK
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (!product) continue;

        console.log("✅ BEFORE STOCK:", product.stockQuantity);

        if (product.variants?.length) {
          const variant = product.variants.find(
            v =>
              v.size === item.size &&
              (item.color ? v.color === item.color : true)
          );

          if (variant) {
            variant.stock = Math.max(0, (variant.stock || 0) - item.qty);
          }

          product.stockQuantity = product.variants.reduce(
            (sum, v) => sum + (v.stock || 0),
            0
          );
        } else {
          product.stockQuantity = Math.max(
            0,
            (product.stockQuantity || 0) - item.qty
          );
        }

        await product.save();

        console.log("✅ AFTER STOCK:", product.stockQuantity);
      }

      order.status = "paid";
      order.paymentMethod = "STRIPE";
      order.paymentId = session.payment_intent;
      order.stockReduced = true;
      await order.save();

      console.log("✅ STRIPE PAYMENT CONFIRMED & STOCK REDUCED:", orderId);
    }

    /* ❌ PAYMENT FAILED / EXPIRED */
    if (
      event.type === "checkout.session.expired" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const obj = event.data.object;
      const orderId = obj.metadata?.orderId;
      if (!orderId) return res.json({ received: true });

      const order = await Order.findOne({ orderId });

      if (
        !order ||
        ["paid", "cancelled", "refunded"].includes(order.status)
      ) {
        return res.json({ received: true });
      }

      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (!product) continue;

        if (product.variants?.length) {
          const variant = product.variants.find(
            v =>
              v.size === item.size &&
              (item.color ? v.color === item.color : true)
          );
          if (variant) variant.stock += item.qty;

          product.stockQuantity = product.variants.reduce(
            (sum, v) => sum + (v.stock || 0),
            0
          );
        } else {
          product.stockQuantity += item.qty;
        }

        await product.save();
      }

      order.status = "failed";
      order.paymentId = null;
      order.stockReduced = false;
      await order.save();
    }

    /* ✅ REFUND COMPLETED */
    if (event.type === "charge.refunded") {
      const charge = event.data.object;

      const order = await Order.findOne({
        paymentId: charge.payment_intent,
      });

      if (order) {
        order.status = "refunded";
        order.stockReduced = false;
        await order.save();
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("❌ WEBHOOK PROCESSING ERROR:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
