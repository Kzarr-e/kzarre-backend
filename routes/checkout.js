const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { sendEmail } = require("../utils/sendEmail");
const Order = require("../models/Order");
const Product = require("../models/product");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function generateOrderId() {
  const num = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return "ORD-" + num;
}

router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId }).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error("GET ORDER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/cod", async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false });

    if (order.status === "paid") {
      return res.json({ success: true, order });
    }

    // ✅ REDUCE STOCK IMMEDIATELY
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      if (product.variants?.length) {
        const variant = product.variants.find(
          v =>
            v.size === item.size &&
            (item.color ? v.color === item.color : true)
        );
        if (variant) variant.stock -= item.qty;

        product.stockQuantity = product.variants.reduce(
          (sum, v) => sum + (v.stock || 0),
          0
        );
      } else {
        product.stockQuantity -= item.qty;
      }

      await product.save();
    }

     order.paymentMethod = "COD";
    order.status = "conform"; // ✅ NOT paid
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    console.error("COD ERROR:", err);
    res.status(500).json({ success: false });
  }
});


router.post("/create-order", async (req, res) => {
  try {
    const { userId, productId, qty, size, color, address } = req.body;

    if (!productId || !qty || !address) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }


    let variant = null;

    if (product.variants?.length) {
      variant = product.variants.find(
        (v) =>
          v.size === size &&
          (color ? v.color === color : true)
      );

      if (!variant || (variant.stock || 0) < qty) {
        return res.status(400).json({
          success: false,
          message: "Variant out of stock",
        });
      }
    } else {
      if ((product.stockQuantity || 0) < qty) {
        return res.status(400).json({
          success: false,
          message: "Out of stock",
        });
      }
    }

    const subtotal = product.price * qty;
    const deliveryFee = 15;
    const totalAmount = subtotal + deliveryFee;

    const orderId = generateOrderId();

    const order = await Order.create({
      userId: userId ? new mongoose.Types.ObjectId(userId) : null,
      items: [
        {
          product: productId,
          qty,
          price: product.price,
          name: product.name,
          image: product.imageUrl,
          size: size || "",
          color: color || "",
          sku: product.sku || "N/A",
          barcode: variant?.barcode || product.sku || "N/A",
        },
      ],
      address,
      amount: totalAmount,
      paymentMethod: "STRIPE",
      paymentId: null,
      orderId,
      status: "conform",
      createdAt: new Date(),
    });
        if (address?.email) {
  await sendEmail(
    address.email,
    "✅ Order Created – KZARRÈ",
    `
      <h2>Your order has been created ✅</h2>
      <p><b>Order ID:</b> ${order.orderId}</p>
      <p><b>Amount:</b> $${order.amount}</p>
      <p>Status: <b>CONFROM</b></p>
    `
  );
}
    res.json({ success: true, orderId, order });
  } catch (err) {
    console.error("CREATE-ORDER ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/stripe/pay", async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId)
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required" });

    const order = await Order.findOne({ orderId });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    if (["cancelled", "failed", "refunded"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot pay for ${order.status} order`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: order.items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(Number(item.price) * 100),
        },
        quantity: Number(item.qty),
      })),
      success_url: `${process.env.FRONTEND_BASE_URL}/payment/success?order=${order.orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_BASE_URL}/payment/cancel?order=${order.orderId}`,
      metadata: { orderId: order.orderId },
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error("STRIPE PAY ERROR:", err);
    res.status(500).json({ success: false, message: "Stripe error" });
  }
});

router.post("/stripe/confirm", async (req, res) => {
  try {
    const { orderId, sessionId } = req.body;

    if (!orderId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "orderId and sessionId are required",
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // ✅ Already paid? Do nothing
    if (order.status === "paid") {
      return res.json({ success: true, message: "Already paid", order });
    }

    // ✅ Get Checkout Session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Make sure it's actually paid
    if (session.payment_status !== "paid") {
      return res
        .status(400)
        .json({ success: false, message: "Payment not completed" });
    }

    const paymentIntentId = session.payment_intent;
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "No payment intent for this session" });
    }

    // (Optional double-check)
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return res
        .status(400)
        .json({ success: false, message: "Payment not verified" });
    }

    // ✅ Reduce stock (same logic you had)
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      if (product.variants?.length) {
        const v = product.variants.find(
          (v) =>
            v.size === item.size &&
            (item.color ? v.color === item.color : true)
        );
        if (v) {
          v.stock = Math.max(0, (v.stock || 0) - item.qty);
        }
        product.stockQuantity = product.variants.reduce(
          (s, v) => s + (v.stock || 0),
          0
        );
      } else {
        product.stockQuantity = Math.max(
          0,
          (product.stockQuantity || 0) - item.qty
        );
      }

      await product.save();
    }

    // ✅ Mark order as Stripe paid
    order.status = "paid";
    order.paymentId = paymentIntentId;
    order.paymentMethod = "STRIPE";
    await order.save();

    res.json({ success: true, message: "Payment confirmed", order });
  } catch (err) {
    console.error("stripe/confirm error:", err);
    res.status(500).json({ success: false, message: "Confirm failed" });
  }
});


router.post("/payment-cancel", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID required" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // If already paid / refunded / cancelled → do nothing
    if (["paid", "refunded", "cancelled"].includes(order.status)) {
      return res.json({
        success: true,
        message: "Order already finalized, no stock change",
      });
    }

    // ✅ Restore stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      if (product.variants?.length) {
        const v = product.variants.find(
          (v) =>
            v.size === item.size &&
            (item.color ? v.color === item.color : true)
        );
        if (v) {
          v.stock = (v.stock || 0) + item.qty;
        }
        product.stockQuantity = product.variants.reduce(
          (s, v) => s + (v.stock || 0),
          0
        );
      } else {
        product.stockQuantity = (product.stockQuantity || 0) + item.qty;
      }

      await product.save();
    }

    order.status = "failed";
    order.paymentMethod = "STRIPE";
    order.paymentId = null;
    await order.save();

    res.json({
      success: true,
      message: "Payment failed / cancelled & stock restored",
    });
  } catch (err) {
    console.error("PAYMENT CANCEL ERROR:", err);
    res.status(500).json({ success: false, message: "Payment cancel failed" });
  }
});

router.post("/refund", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID required" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: `Order cannot be refunded (status: ${order.status})`,
      });
    }

    if (!order.paymentId) {
      return res.status(400).json({
        success: false,
        message: "No payment ID found for this order",
      });
    }

    // ✅ 1️⃣ Create Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: order.paymentId,
      reason: "requested_by_customer",
    });

    // ✅ 2️⃣ Restore stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      if (product.variants?.length) {
        const v = product.variants.find(
          (v) =>
            v.size === item.size &&
            (item.color ? v.color === item.color : true)
        );
        if (v) {
          v.stock = (v.stock || 0) + item.qty;
        }
        product.stockQuantity = product.variants.reduce(
          (s, v) => s + (v.stock || 0),
          0
        );
      } else {
        product.stockQuantity = (product.stockQuantity || 0) + item.qty;
      }

      await product.save();
    }

    // ✅ 3️⃣ Mark order as refunded
    order.status = "refunded";
    order.refundId = refund.id;
    await order.save();

    res.json({
      success: true,
      message: "Payment refunded successfully",
      refund,
      order,
    });
  } catch (err) {
    console.error("REFUND ERROR:", err);
    res.status(500).json({ success: false, message: "Refund failed" });
  }
});

module.exports = router;

