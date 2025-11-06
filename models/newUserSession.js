const mongoose = require("mongoose");

const newUserSessionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: [
        function (value) {
          return this.phone || value;
        },
        "Either email or phone must be provided.",
      ],
    },
    phone: {
      type: String,
      trim: true,
      validate: [
        function (value) {
          return this.email || value;
        },
        "Either email or phone must be provided.",
      ],
    },
    chatbot_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chatbot",
      required: true,
      index: true,
    },
  },
  { timestamps: true } // createdAt + updatedAt
);

/**
 * Ensure only one active session per (chatbot_id + email) OR (chatbot_id + phone).
 * Use partial unique indexes so null values don't collide.
 */
newUserSessionSchema.index(
  { email: 1, chatbot_id: 1 },
  { unique: true, partialFilterExpression: { email: { $exists: true, $ne: null } } }
);
newUserSessionSchema.index(
  { phone: 1, chatbot_id: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $ne: null } } }
);

module.exports = mongoose.model("NewUserSession", newUserSessionSchema);
