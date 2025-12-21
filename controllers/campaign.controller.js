import Newsletter from "../models/Newsletter.js";
import Subscriber from "../models/Subscriber.js";
import sendEmail from "../utils/sendEmail.js";

export const sendCampaign = async (req, res) => {
  try {
    const { subject, html, testEmail } = req.body;

    if (!subject || !html) {
      return res.status(400).json({ message: "Missing subject or HTML" });
    }

    // ✅ Test email mode
    if (testEmail) {
      await sendEmail({
        to: testEmail,
        subject,
        html,
      });

      return res.json({ success: true, message: "Test email sent" });
    }

    // ✅ Real campaign
    const subscribers = await Subscriber.find({ subscribed: true });

    for (const user of subscribers) {
      await sendEmail({
        to: user.email,
        subject,
        html,
      });
    }

    res.json({
      success: true,
      sent: subscribers.length,
    });
  } catch (err) {
    console.error("CAMPAIGN SEND ERROR:", err);
    res.status(500).json({ message: "Campaign send failed" });
  }
};
