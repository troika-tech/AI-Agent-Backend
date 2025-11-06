// db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  // Add event listeners for connection events
  mongoose.connection.on("connected", () => {
    console.log("📡 Mongoose connected to DB");
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  Mongoose disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("🔄 Mongoose reconnected");
  });

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: false,
      maxPoolSize: 20,
      family: 4
    });

    console.log("✅ MongoDB connected");

    // Close the connection gracefully on app termination
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🔌 Mongoose connection closed due to app termination");
      process.exit(0);
    });

  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    // Do not exit to allow app startup without blocking
  }
};

module.exports = connectDB;
