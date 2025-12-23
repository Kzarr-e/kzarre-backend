router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    // 🔐 VERIFY REFRESH TOKEN
    const payload = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // 🔎 FIND USER (ADMIN TABLE ONLY)
    const admin = await Admin.findById(payload.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "User not found" });
    }

    // 🔒 SESSION CHECK (OPTIONAL BUT GOOD)
    if (admin.currentSession?.token !== refreshToken) {
      return res.status(401).json({ message: "Session invalid" });
    }

    // ✅ ISSUE NEW ACCESS TOKEN
    const newAccessToken = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("REFRESH ERROR:", err.message);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});
