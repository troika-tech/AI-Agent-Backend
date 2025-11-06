(function () {
  const scriptTag = document.currentScript;
  const chatbotId = scriptTag.getAttribute("chatbot-id");

  console.log("🔥 SupaChatbot loader started");
  if (!chatbotId) {
    console.error("❌ chatbot-id is missing");
    return;
  }

  // Load the UMD bundle
  const script = document.createElement("script");
  script.src = "https://api.0804.in/chatbot-loader/troika-widget.js";
  script.onload = () => {
    console.log("✅ widget.js loaded");
    if (window.renderSupaChatbot) {
      window.renderSupaChatbot({ chatbotId });
    } else {
      console.error("⛔ renderSupaChatbot not found");
    }
  };
  script.onerror = () => {
    console.error("❌ Failed to load widget.js");
  };
  document.head.appendChild(script);
})();
