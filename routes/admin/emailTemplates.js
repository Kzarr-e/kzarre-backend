const express = require("express");
const EmailTemplate = require("../../models/EmailTemplate");
const router = express.Router();

/* CREATE */
router.post("/", async (req, res) => {
  const template = await EmailTemplate.create(req.body);
  res.json(template);
});

/* LIST */
router.get("/", async (_, res) => {
  const templates = await EmailTemplate.find().sort({ createdAt: -1 });
  res.json(templates);
});

/* GET ONE */
router.get("/:id", async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);
  res.json(template);
});

module.exports = router;
