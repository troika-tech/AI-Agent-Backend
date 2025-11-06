const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { OpenAI } = require("openai");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to convert audio files to MP3
const convertToMp3 = (inputPath, originalName) => {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.[^/.]+$/, "") + '.mp3';
    
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioChannels(1) // Convert to mono for better compatibility
      .audioFrequency(16000) // Standard frequency for speech recognition
      .on('end', () => {
        console.log('✅ Audio conversion completed:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Conversion failed:', err);
        reject(err);
      })
      .save(outputPath);
  });
};

router.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  let originalPath = null;
  let convertedPath = null;

  try {
    console.log("Incoming file:", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    originalPath = req.file.path;
    
    // Check if file needs conversion (MP4, WebM, or other formats)
    let audioPath = originalPath;
    const needsConversion = req.file.originalname.endsWith('.mp4') || 
                           req.file.originalname.endsWith('.webm') || 
                           req.file.mimetype === 'audio/mp4' || 
                           req.file.mimetype === 'audio/webm' ||
                           req.file.mimetype === 'audio/ogg';

    if (needsConversion) {
      console.log("🔄 Converting audio to MP3...", req.file.mimetype);
      convertedPath = await convertToMp3(originalPath, req.file.originalname);
      audioPath = convertedPath;
    }

    console.log("📤 Sending to Whisper API:", audioPath);

    // Use verbose_json to get language detection from Whisper
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fs.createReadStream(audioPath),
      response_format: "verbose_json",
    });

    console.log("✅ Transcription successful:", transcription.text);

    // Map Whisper language codes to our system (ISO 639-1)
    const languageMap = {
      // Indian Languages
      'hindi': 'hi',
      'bengali': 'bn',
      'telugu': 'te',
      'marathi': 'mr',
      'tamil': 'ta',
      'gujarati': 'gu',
      'kannada': 'kn',
      'malayalam': 'ml',
      'punjabi': 'pa',
      'odia': 'or',
      'urdu': 'ur',
      'nepali': 'ne',

      // East Asian
      'chinese': 'zh',
      'japanese': 'ja',
      'korean': 'ko',
      'thai': 'th',
      'vietnamese': 'vi',
      'burmese': 'my',
      'khmer': 'km',
      'lao': 'lo',

      // Middle Eastern
      'arabic': 'ar',
      'hebrew': 'he',
      'persian': 'fa',
      'turkish': 'tr',

      // European
      'english': 'en',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'italian': 'it',
      'portuguese': 'pt',
      'russian': 'ru',
      'polish': 'pl',
      'ukrainian': 'uk',
      'greek': 'el',
      'dutch': 'nl',
      'swedish': 'sv',
      'norwegian': 'no',
      'danish': 'da',
      'finnish': 'fi',
      'czech': 'cs',
      'romanian': 'ro',
      'hungarian': 'hu',

      // African
      'amharic': 'am',
      'swahili': 'sw',

      // Other
      'indonesian': 'id',
      'malay': 'ms',
    };
    const detectedLang = languageMap[transcription.language?.toLowerCase()] || 'en';

    res.json({
      text: transcription.text,
      language: detectedLang,
      confidence: transcription.segments?.[0]?.no_speech_prob < 0.5 ? 'high' : 'low'
    });

  } catch (error) {
    console.error("❌ Whisper transcription failed:", error);
    
    res.status(500).json({ 
      error: "Transcription failed",
      details: error.message 
    });
  } finally {
    // Cleanup files
    if (originalPath && fs.existsSync(originalPath)) {
      fs.unlinkSync(originalPath);
      console.log("🧹 Cleaned up original file");
    }
    if (convertedPath && fs.existsSync(convertedPath)) {
      fs.unlinkSync(convertedPath);
      console.log("🧹 Cleaned up converted file");
    }
  }
});

module.exports = router;
