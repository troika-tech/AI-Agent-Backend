const mongoose = require("mongoose");

const customizationSchema = new mongoose.Schema(
  {
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chatbot",
      required: true,
      unique: true,
    },
    fontFamily: {
      type: String,
      default: "Amaranth",
    },
    headerBackground: {
      type: String,
      default: "linear-gradient(135deg, #a855f7, #ec4899)",
    },
    headerStyleType: {
      type: String,
      enum: ["solid", "gradient"],
      default: "gradient",
    },
    headerSubtitle: {
      type: String,
      default: "AI Assistant",
    },
    buttonColor: {
      type: String,
      default: "linear-gradient(135deg, #a855f7, #ec4899)",
    },
    buttonStyleType: {
      type: String,
      enum: ["solid", "gradient"],
      default: "gradient",
    },
    welcomeMessage: {
      type: String,
      default: "👋 Hello! I'm Supa Agent. How can I assist you today?",
    },
    startingSuggestions: {
      type: [
        {
          title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
          },
          icon: {
            type: String,
            required: true,
            default: "FaQuestionCircle",
          },
          iconBg: {
            type: String,
            required: true,
            default: "#6366F1",
          },
          bgType: {
            type: String,
            enum: ["solid", "gradient"],
            default: "solid",
          },
        },
      ],
      default: [
        {
          title: "Hi! I need some assistance",
          icon: "FaHandSparkles",
          iconBg: "#F59E0B",
          bgType: "solid",
        },
        {
          title: "Tell me more about the company",
          icon: "FaBuilding",
          iconBg: "#6366F1",
          bgType: "solid",
        },
        {
          title: "Give me contact details",
          icon: "FaPhoneAlt",
          iconBg: "#10B981",
          bgType: "solid",
        },
      ],
      validate: {
        validator: function (suggestions) {
          return suggestions.length <= 5;
        },
        message: "Cannot have more than 5 suggestions",
      },
    },

    chatWindowBg: {
      type: String,
      default: "#ffffff",
    },
    chatWindowBgType: {
      type: String,
      enum: ["solid", "gradient", "image"],
      default: "solid",
    },
    includeAudio: {
      type: Boolean,
      default: true,
    },
    includeSuggestionButton: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const ChatbotCustomization = mongoose.model(
  "ChatbotCustomization",
  customizationSchema
);

module.exports = ChatbotCustomization;
