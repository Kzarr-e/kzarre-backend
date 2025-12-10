// ✅ utils/notify.js

function sendNotification(data) {
  if (!global.io) {
    console.log("❌ global.io is NOT available");
    return;
  }

  console.log("📢 EMITTING SOCKET NOTIFICATION:", data);

  global.io.emit("notification", {
    title: data.title,
    message: data.message,
    type: data.type,
    orderId: data.orderId,
    createdAt: new Date(),
  });
}

module.exports = { sendNotification };
