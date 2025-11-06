// controllers/contextController.js
const extractTextFromFile = require("../utils/extractTextFromFile");
const chunkText = require("../utils/chunkText");
const { storeContextChunks } = require("../services/contextService");
const { validateBody } = require("../utils/validationHelpers");

exports.uploadContextFile = async (req, res) => {
  if (!validateBody(req, res)) return;

  try {
    const file = req.file;
    const { chatbotId } = req.body;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    if (!chatbotId) {
      return res.status(400).json({ message: "Missing chatbotId." });
    }

    const ext = file.originalname.split(".").pop().toLowerCase();
    const text = await extractTextFromFile(file.buffer, ext);

    const chunks = chunkText(text, 300, 50);
    const results = await storeContextChunks(chunks, chatbotId);

    res.status(201).json({
      message: "File uploaded and embeddings stored",
      chunksStored: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Upload file error:", error); // 🛠 full error log
    res.status(500).json({ message: "Error processing file" });
  }
};
