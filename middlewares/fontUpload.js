const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["font/ttf", "font/woff", "font/woff2", "application/font-woff"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid font format. Allowed: ttf, woff, woff2"), false);
};

module.exports = multer({ storage, fileFilter });
