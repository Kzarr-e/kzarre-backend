const mongoose = require("mongoose");

const BlockSchema = new mongoose.Schema({
  type: String,
  content: String,
  src: String,
  url: String,
  color: String,
  bgColor: String,
  fontSize: Number,
  padding: Number,
  align: String,
  radius: Number,
});

const SectionSchema = new mongoose.Schema({
  background: String,
  padding: Number,
  blocks: [BlockSchema],
});

module.exports = mongoose.model("emailTemplate", {
  name: String,
  sections: [SectionSchema],
  createdAt: { type: Date, default: Date.now },
});
