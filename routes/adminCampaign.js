const express = require("express");
const router = express.Router();
const Newsletter = require("../models/Newsletter");
const Subscriber = require("../models/Subscriber");
const Lead = require("../models/Lead");
const { auth } = require("../middlewares/auth");

// Subscribers
router.get("/subscribers", auth(), async (req, res) => {
  res.json(await Subscriber.find());
});

// Create Newsletter
router.post("/newsletter", auth(), async (req, res) => {
  const { subject, content } = req.body;
  const mail = await Newsletter.create({ subject, content });
  res.json(mail);
});

// Leads
router.get("/leads", auth(), async (req, res) => {
  res.json(await Lead.find());
});

module.exports = router;
