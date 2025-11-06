const logger = require('../utils/logger');
const axios = require('axios');

// ============================================================
// Unicode ranges for different languages (instant regex detection)
// ============================================================

// INDIAN LANGUAGES
const DEVANAGARI_REGEX = /[\u0900-\u097F]/; // Hindi, Marathi, Sanskrit, Nepali
const BENGALI_REGEX = /[\u0980-\u09FF]/; // Bengali, Assamese
const GURMUKHI_REGEX = /[\u0A00-\u0A7F]/; // Punjabi
const GUJARATI_REGEX = /[\u0A80-\u0AFF]/; // Gujarati
const ORIYA_REGEX = /[\u0B00-\u0B7F]/; // Odia/Oriya
const TAMIL_REGEX = /[\u0B80-\u0BFF]/; // Tamil
const TELUGU_REGEX = /[\u0C00-\u0C7F]/; // Telugu
const KANNADA_REGEX = /[\u0C80-\u0CFF]/; // Kannada
const MALAYALAM_REGEX = /[\u0D00-\u0D7F]/; // Malayalam
const SINHALA_REGEX = /[\u0D80-\u0DFF]/; // Sinhala (Sri Lanka)

// MIDDLE EASTERN & CENTRAL ASIAN
const ARABIC_REGEX = /[\u0600-\u06FF]/; // Arabic
const HEBREW_REGEX = /[\u0590-\u05FF]/; // Hebrew
const PERSIAN_REGEX = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/; // Persian/Farsi (uses Arabic script with additions)

// EAST ASIAN
const CHINESE_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF]/; // Chinese (Simplified & Traditional)
const JAPANESE_HIRAGANA_REGEX = /[\u3040-\u309F]/; // Japanese Hiragana
const JAPANESE_KATAKANA_REGEX = /[\u30A0-\u30FF]/; // Japanese Katakana
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/; // Japanese (all scripts)
const KOREAN_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/; // Korean (Hangul)
const THAI_REGEX = /[\u0E00-\u0E7F]/; // Thai
const LAO_REGEX = /[\u0E80-\u0EFF]/; // Lao
const MYANMAR_REGEX = /[\u1000-\u109F]/; // Myanmar/Burmese
const KHMER_REGEX = /[\u1780-\u17FF]/; // Khmer/Cambodian

// EUROPEAN (Cyrillic)
const CYRILLIC_REGEX = /[\u0400-\u04FF]/; // Russian, Ukrainian, Bulgarian, Serbian, etc.
const GREEK_REGEX = /[\u0370-\u03FF]/; // Greek

// AFRICAN
const ETHIOPIC_REGEX = /[\u1200-\u137F]/; // Amharic, Tigrinya (Ethiopia)

const ARABIC_PUNCTUATION = /[\u061f\u060c]/g;

// ============================================================
// Romanized/Transliterated Language Detection (Hinglish, etc.)
// ============================================================

// Common words/patterns in romanized Indian languages
const ROMANIZED_PATTERNS = {
  // Hindi/Hinglish (most common)
  'hi': {
    keywords: ['kya', 'hai', 'hain', 'main', 'mujhe', 'aap', 'tumhe', 'chahiye', 'kaise', 'kahan', 'kitna', 'kyun', 'toh', 'yeh', 'woh', 'nahi', 'haan', 'accha', 'theek', 'bahut', 'kaun', 'kab', 'kuch', 'sab', 'abhi', 'phir', 'agar', 'lekin', 'bhi', 'mein', 'se', 'ko', 'ka', 'ki', 'ke', 'ne', 'par'],
    patterns: [/\b(kya|hai|mujhe|chahiye|theek|bahut)\b/i, /\b(nahi|haan|accha)\b/i]
  },
  // Marathi (romanized)
  'mr': {
    keywords: ['mala', 'tumhala', 'aahe', 'nahi', 'kay', 'kasa', 'kuthe', 'kiti', 'kon', 'kadhi', 'mhanje', 'tar', 'pan', 'he', 'te', 'mi', 'tu', 'aamhi', 'tumhi'],
    patterns: [/\b(mala|tumhala|aahe|kay|kasa)\b/i]
  },
  // Tamil (romanized - Tanglish)
  'ta': {
    keywords: ['naan', 'nee', 'enakku', 'unakku', 'irukku', 'illa', 'enna', 'eppadi', 'enga', 'evlo', 'yaaru', 'eppo', 'romba', 'konjam', 'venum', 'vendaam', 'sari', 'ponga'],
    patterns: [/\b(enakku|irukku|venum|romba)\b/i]
  },
  // Telugu (romanized)
  'te': {
    keywords: ['nenu', 'neeku', 'undi', 'ledu', 'enti', 'ela', 'ekkada', 'entha', 'evaru', 'eppudu', 'chala', 'konchem', 'kavali', 'vaddu', 'sare', 'bagundi'],
    patterns: [/\b(nenu|neeku|kavali|chala)\b/i]
  },
  // Kannada (romanized)
  'kn': {
    keywords: ['naanu', 'neenu', 'nanage', 'ninage', 'ide', 'illa', 'yaava', 'hege', 'elli', 'eshtu', 'yaaru', 'yaavaga', 'thumba', 'swalpan', 'beku', 'beda', 'sari'],
    patterns: [/\b(naanu|nanage|beku|thumba)\b/i]
  },
  // Malayalam (romanized - Manglish)
  'ml': {
    keywords: ['njaan', 'nee', 'enikku', 'ninakku', 'undu', 'illa', 'enthu', 'engane', 'evide', 'ethra', 'aaaru', 'eppo', 'valare', 'korachan', 'venam', 'venda', 'sheri'],
    patterns: [/\b(njaan|enikku|venam|valare)\b/i]
  },
  // Gujarati (romanized)
  'gu': {
    keywords: ['mane', 'tamne', 'chhe', 'nathi', 'shu', 'kem', 'kyan', 'ketla', 'kaun', 'kyare', 'khub', 'thodu', 'joiye', 'nahi', 'thik'],
    patterns: [/\b(mane|tamne|chhe|joiye)\b/i]
  },
  // Punjabi (romanized)
  'pa': {
    keywords: ['main', 'tenu', 'hai', 'nahi', 'ki', 'kiven', 'kithe', 'kinna', 'kaun', 'kado', 'bahut', 'thoda', 'chahida', 'theek', 'haan'],
    patterns: [/\b(tenu|chahida|kiven|kithe)\b/i]
  },
  // Bengali (romanized - Benglish)
  'bn': {
    keywords: ['ami', 'tumi', 'amake', 'tomake', 'ache', 'nei', 'ki', 'kemon', 'kothay', 'koto', 'ke', 'kobe', 'khub', 'ektu', 'chai', 'thik', 'haan'],
    patterns: [/\b(ami|tumi|ache|chai)\b/i]
  }
};

const ARABIC_TO_ENGLISH_RULES = [
  { pattern: /\u0643\u0645 \u0627\u0644\u0633\u0639\u0631/i, result: 'what is the price' },
  { pattern: /\u0645\u0627 \u0627\u0644\u062e\u062f\u0645\u0627\u062a/i, result: 'what services do you offer' },
  { pattern: /\u0637\u0631\u0642 \u0627\u0644\u062a\u0648\u0627\u0635\u0644|\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u0648\u0627\u0635\u0644|\u0627\u062a\u0635\u0627\u0644/i, result: 'contact details' },
  { pattern: /\u0627\u0644\u062a\u0643\u0644\u0641\u0629|\u0627\u0644\u0633\u0639\u0631|\u0627\u0644\u0623\u0633\u0639\u0627\u0631/i, result: 'pricing' },
];

const ENGLISH_TO_ARABIC_RULES = [
  { pattern: /here are the products found/gi, result: '\u0625\u0644\u064a\u0643 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0627\u0644\u0645\u062a\u0648\u0641\u0631\u0629' },
  { pattern: /no products found/gi, result: '\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0645\u0646\u062a\u062c\u0627\u062a' },
  { pattern: /price/gi, result: '\u0627\u0644\u0633\u0639\u0631' },
  { pattern: /available in stock/gi, result: '\u0645\u062a\u0648\u0641\u0631 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0648\u0646' },
  { pattern: /contact details/gi, result: '\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u0648\u0627\u0635\u0644' },
];

let francPromise;
let francModule; // Cache the loaded module

function normaliseArabic(text) {
  return text
    .normalize('NFKC')
    .replace(ARABIC_PUNCTUATION, '')
    .trim();
}

async function loadFranc() {
  if (francModule) return francModule; // Return cached module immediately
  if (!francPromise) {
    francPromise = import('franc-min').then(mod => {
      francModule = mod; // Cache the module
      return mod;
    });
  }
  return francPromise;
}

// Detect romanized/transliterated languages (Hinglish, Tanglish, etc.)
function detectRomanizedLanguage(text) {
  if (!text || typeof text !== 'string') return null;

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  // Score each language based on keyword matches
  const scores = {};

  for (const [lang, config] of Object.entries(ROMANIZED_PATTERNS)) {
    let score = 0;

    // Count keyword matches
    for (const keyword of config.keywords) {
      if (words.includes(keyword)) {
        score += 2; // Higher weight for exact keyword matches
      }
    }

    // Check pattern matches
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        score += 1;
      }
    }

    if (score > 0) {
      scores[lang] = score;
    }
  }

  // Return language with highest score if it meets threshold
  const entries = Object.entries(scores);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const [topLang, topScore] = entries[0];

  // Need at least 2 matches to be confident
  if (topScore >= 2) {
    return topLang;
  }

  return null;
}

class LanguageService {
  async detectLanguage(text, hint = null) {
    if (!text || typeof text !== 'string') {
      logger.warn('[LanguageService] Invalid text provided for language detection');
      return 'en';
    }

    logger.info(`[LanguageService] Detecting language for text: "${text.substring(0, 100)}..." (hint: ${hint || 'none'})`);

    // IMPORTANT: Always detect from actual text content for multilingual support
    // The hint is only used as a fallback when regex patterns don't match

    // ============================================================
    // Fast path: Unicode-based script detection (instant, no async)
    // Order matters: check more specific scripts first
    // ============================================================

    // EAST ASIAN (check first - very distinct)
    if (JAPANESE_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Japanese (ja) via Unicode regex');
      return 'ja';
    }
    if (KOREAN_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Korean (ko) via Unicode regex');
      return 'ko';
    }
    if (CHINESE_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Chinese (zh) via Unicode regex');
      return 'zh';
    }
    if (THAI_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Thai (th) via Unicode regex');
      return 'th';
    }
    if (MYANMAR_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Myanmar (my) via Unicode regex');
      return 'my';
    }
    if (KHMER_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Khmer (km) via Unicode regex');
      return 'km';
    }
    if (LAO_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Lao (lo) via Unicode regex');
      return 'lo';
    }

    // INDIAN LANGUAGES (Devanagari shares script, so needs context)
    if (TAMIL_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Tamil (ta) via Unicode regex');
      return 'ta';
    }
    if (TELUGU_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Telugu (te) via Unicode regex');
      return 'te';
    }
    if (KANNADA_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Kannada (kn) via Unicode regex');
      return 'kn';
    }
    if (MALAYALAM_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Malayalam (ml) via Unicode regex');
      return 'ml';
    }
    if (BENGALI_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Bengali (bn) via Unicode regex');
      return 'bn';
    }
    if (GUJARATI_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Gujarati (gu) via Unicode regex');
      return 'gu';
    }
    if (GURMUKHI_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Punjabi (pa) via Unicode regex');
      return 'pa'; // Punjabi
    }
    if (ORIYA_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Odia (or) via Unicode regex');
      return 'or'; // Odia
    }
    if (SINHALA_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Sinhala (si) via Unicode regex');
      return 'si';
    }

    // Devanagari (used by Hindi, Marathi, Nepali - default to Hindi)
    if (DEVANAGARI_REGEX.test(text)) {
      // Use hint or franc to distinguish between Hindi/Marathi
      if (hint === 'mr') {
        logger.info('[LanguageService] Detected Marathi (mr) via Devanagari regex + hint');
        return 'mr'; // Marathi
      }
      if (hint === 'ne') {
        logger.info('[LanguageService] Detected Nepali (ne) via Devanagari regex + hint');
        return 'ne'; // Nepali
      }
      logger.info('[LanguageService] Detected Hindi (hi) via Devanagari regex (default)');
      return 'hi'; // Default to Hindi
    }

    // MIDDLE EASTERN
    if (HEBREW_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Hebrew (he) via Unicode regex');
      return 'he';
    }
    if (ARABIC_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Arabic (ar) via Unicode regex');
      return 'ar'; // Also covers Persian, needs refinement
    }

    // EUROPEAN
    if (CYRILLIC_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Russian (ru) via Cyrillic regex');
      return 'ru'; // Russian (could also be Ukrainian, Bulgarian, etc.)
    }
    if (GREEK_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Greek (el) via Unicode regex');
      return 'el';
    }

    // AFRICAN
    if (ETHIOPIC_REGEX.test(text)) {
      logger.info('[LanguageService] Detected Amharic (am) via Unicode regex');
      return 'am'; // Amharic
    }

    // ============================================================
    // ROMANIZED LANGUAGE DETECTION (Hinglish, Tanglish, etc.)
    // Check BEFORE using hint or franc
    // ============================================================
    const romanizedLang = detectRomanizedLanguage(text);
    if (romanizedLang) {
      logger.info(`[LanguageService] Detected romanized ${romanizedLang} in text: "${text.substring(0, 50)}..."`);
      return romanizedLang;
    }

    // If hint provided and no script detected, use hint (voice input optimization)
    if (hint && typeof hint === 'string' && /^[a-z]{2,3}$/.test(hint)) {
      return hint;
    }

    // For short text without clear script markers, default to English
    if (text.trim().length < 10) {
      return 'en';
    }

    // For longer text without script markers, use franc (cached after first load)
    try {
      const { franc } = await loadFranc();
      const lang = franc(text) || 'eng';

      // Map franc codes to ISO 639-1 codes
      const langMap = {
        'ara': 'ar',  // Arabic
        'eng': 'en',  // English
        'spa': 'es',  // Spanish
        'fra': 'fr',  // French
        'deu': 'de',  // German
        'ita': 'it',  // Italian
        'por': 'pt',  // Portuguese
        'rus': 'ru',  // Russian
        'jpn': 'ja',  // Japanese
        'kor': 'ko',  // Korean
        'cmn': 'zh',  // Chinese
        'hin': 'hi',  // Hindi
        'ben': 'bn',  // Bengali
        'tam': 'ta',  // Tamil
        'tel': 'te',  // Telugu
        'mar': 'mr',  // Marathi
        'guj': 'gu',  // Gujarati
        'kan': 'kn',  // Kannada
        'mal': 'ml',  // Malayalam
        'pan': 'pa',  // Punjabi
        'tha': 'th',  // Thai
        'vie': 'vi',  // Vietnamese
        'tur': 'tr',  // Turkish
        'pol': 'pl',  // Polish
        'ukr': 'uk',  // Ukrainian
        'heb': 'he',  // Hebrew
        'fas': 'fa',  // Persian/Farsi
        'ind': 'id',  // Indonesian
        'nld': 'nl',  // Dutch
        'swe': 'sv',  // Swedish
        'nor': 'no',  // Norwegian
        'dan': 'da',  // Danish
        'fin': 'fi',  // Finnish
      };

      return langMap[lang] || 'en';
    } catch (error) {
      logger.warn(`Language detection failed: ${error.message}`);
      return 'en';
    }
  }

  // Legacy method - kept for backward compatibility
  translateArabicToEnglish(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    const normalised = normaliseArabic(text);
    for (const rule of ARABIC_TO_ENGLISH_RULES) {
      if (rule.pattern.test(normalised)) {
        return rule.result;
      }
    }

    return normalised || text;
  }

  // Legacy method - kept for backward compatibility
  translateEnglishToArabic(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let translated = text;
    for (const rule of ENGLISH_TO_ARABIC_RULES) {
      translated = translated.replace(rule.pattern, rule.result);
    }

    return translated;
  }

  // New: Universal translation using OpenAI API (simple and fast)
  async translateText(text, targetLanguage) {
    if (!text || !targetLanguage || targetLanguage === 'en') {
      return text;
    }

    const languageNames = {
      // Indian Languages
      'hi': 'Hindi',
      'bn': 'Bengali',
      'te': 'Telugu',
      'mr': 'Marathi',
      'ta': 'Tamil',
      'gu': 'Gujarati',
      'kn': 'Kannada',
      'ml': 'Malayalam',
      'pa': 'Punjabi',
      'or': 'Odia',
      'si': 'Sinhala',
      'ne': 'Nepali',

      // East Asian
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'my': 'Burmese',
      'km': 'Khmer',
      'lo': 'Lao',

      // Middle Eastern
      'ar': 'Arabic',
      'he': 'Hebrew',
      'fa': 'Persian',
      'tr': 'Turkish',
      'ur': 'Urdu',

      // European
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'pl': 'Polish',
      'uk': 'Ukrainian',
      'el': 'Greek',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'da': 'Danish',
      'fi': 'Finnish',
      'cs': 'Czech',
      'ro': 'Romanian',
      'hu': 'Hungarian',

      // African
      'am': 'Amharic',
      'sw': 'Swahili',

      // Other
      'id': 'Indonesian',
      'ms': 'Malay',
    };

    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    // Conversational style instructions for specific languages
    const conversationalStyleHints = {
      'hi': `Use everyday spoken Hindi (रोजमर्रा की हिंदी), NOT formal or literary Hindi.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Use simple, commonly spoken words - avoid Sanskrit-heavy formal vocabulary
- Write like you're chatting on WhatsApp with a friend, not writing a formal letter
- Examples of good style: "हम ये services देते हैं", "आपको किस चीज़ की जानकारी चाहिए?"
- Avoid overly formal phrases like "हम निम्नलिखित सेवाएं प्रदान करते हैं"`,

      'mr': `Use everyday spoken Marathi (रोजच्या बोलण्याची मराठी), NOT formal or literary Marathi.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Use simple, commonly spoken words - avoid overly formal Sanskrit-based vocabulary
- Write like you're chatting on WhatsApp with a friend, not writing a formal letter
- Examples of good style: "आम्ही हे services देतो", "तुम्हाला कशाबद्दल माहिती हवी आहे?"
- Avoid overly formal phrases like "खालील सेवांचा प्रस्ताव ठेवतो" or "व्यवस्थापित करणारे"`,

      'ta': `Use everyday spoken Tamil (பேச்சு தமிழ்), NOT formal or literary Tamil.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Write like you're chatting on WhatsApp, not writing formal literature`,

      'te': `Use everyday spoken Telugu (మాట్లాడే తెలుగు), NOT formal or literary Telugu.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Write like you're chatting on WhatsApp, not writing formal literature`,

      'bn': `Use everyday spoken Bengali (কথ্য বাংলা), NOT formal or literary Bengali.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Write like you're chatting on WhatsApp, not writing formal literature`,

      'gu': `Use everyday spoken Gujarati (રોજિંદા ગુજરાતી), NOT formal or literary Gujarati.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Write like you're chatting on WhatsApp, not writing formal literature`,

      'kn': `Use everyday spoken Kannada (ಮಾತನಾಡುವ ಕನ್ನಡ), NOT formal or literary Kannada.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Write like you're chatting on WhatsApp, not writing formal literature`,

      'ml': `Use everyday spoken Malayalam (സംസാര മലയാളം), NOT formal or literary Malayalam.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Write like you're chatting on WhatsApp, not writing formal literature`,

      'pa': `Use everyday spoken Punjabi (ਰੋਜ਼ਾਨਾ ਪੰਜਾਬੀ), NOT formal or literary Punjabi.
- Mix common English words naturally (like "service", "business", "website", etc.)
- Write like you're chatting on WhatsApp, not writing formal literature`,
    };

    const styleHint = conversationalStyleHints[targetLanguage] || '';
    const hasConversationalStyle = !!styleHint;
    const baseInstruction = styleHint
      ? `You are a conversational translator who translates to casual, everyday ${targetLangName} - like how people actually talk on WhatsApp or in daily conversations, NOT formal written language.

${styleHint}

Return ONLY the translation, no explanations.`
      : `You are a professional translator. Translate the following text to ${targetLangName}. Return ONLY the translation, no explanations.`;

    logger.info(`[LanguageService] Translating to ${targetLanguage} (${targetLangName})`);
    logger.info(`[LanguageService] Translation mode: ${hasConversationalStyle ? 'CONVERSATIONAL' : 'STANDARD'}`);
    logger.info(`[LanguageService] Input text: "${text.substring(0, 100)}..."`);

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: baseInstruction
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.6, // Increased from 0.3 for more natural, conversational output
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000, // Fast timeout for translation
        }
      );

      const translatedText = response.data.choices[0].message.content.trim();
      logger.info(`[LanguageService] Translation complete. Output: "${translatedText.substring(0, 100)}..."`);
      return translatedText;
    } catch (error) {
      logger.warn(`Translation to ${targetLanguage} failed: ${error.message}`);
      // Fallback: return original text
      return text;
    }
  }

  async processQuery(query, languageHint = null) {
    logger.info(`[LanguageService] Processing query: "${query.substring(0, 100)}..." (hint: ${languageHint || 'none'})`);

    const language = await this.detectLanguage(query, languageHint);
    logger.info(`[LanguageService] Detected language: ${language}`);

    // If query is NOT in English, translate to English for processing
    if (language !== 'en') {
      let translatedQuery;

      // Use legacy rule-based translation for Arabic (faster)
      if (language === 'ar') {
        logger.info('[LanguageService] Using legacy Arabic-to-English translation');
        translatedQuery = this.translateArabicToEnglish(query);
      } else {
        // For romanized/transliterated languages and others, use OpenAI translation
        // OpenAI handles romanized text well (e.g., "mujhe shoes chahiye" → "I need shoes")
        logger.info('[LanguageService] Using OpenAI translation to English');
        translatedQuery = await this.translateText(query, 'en');
      }

      const needsTranslation = translatedQuery !== query;
      const isRomanized = this.isLikelyRomanized(query, language);

      logger.info(`[LanguageService] Query translation complete:`);
      logger.info(`  - Original: "${query.substring(0, 100)}..."`);
      logger.info(`  - Translated: "${translatedQuery.substring(0, 100)}..."`);
      logger.info(`  - Needs translation: ${needsTranslation}`);
      logger.info(`  - Is romanized: ${isRomanized}`);

      return {
        originalQuery: query,
        translatedQuery: translatedQuery || query, // Fallback to original if translation fails
        language,
        needsTranslation,
        isRomanized, // Track if romanized
      };
    }

    // Query is already in English
    logger.info('[LanguageService] Query is already in English, no translation needed');
    return {
      originalQuery: query,
      translatedQuery: query,
      language: 'en',
      needsTranslation: false,
      isRomanized: false,
    };
  }

  // Helper to check if text is romanized (no native script)
  isLikelyRomanized(text, detectedLang) {
    if (!text || detectedLang === 'en') return false;

    // If language is Indian but has no Indic script, it's romanized
    const indicLanguages = ['hi', 'mr', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'or'];
    if (indicLanguages.includes(detectedLang)) {
      // Check if text contains any Indic Unicode characters
      const hasIndicScript = /[\u0900-\u0D7F]/.test(text);
      return !hasIndicScript; // If no Indic script, it's romanized
    }

    return false;
  }

  async processResponse(response, originalLanguage, isRomanized = false) {
    logger.info(`[LanguageService] Processing response translation:`);
    logger.info(`  - Target language: ${originalLanguage}`);
    logger.info(`  - Is romanized: ${isRomanized}`);
    logger.info(`  - Response: "${response.substring(0, 100)}..."`);

    // If user's language is NOT English, translate response back to their language
    if (originalLanguage && originalLanguage !== 'en') {
      let translatedResponse;

      // Use legacy rule-based translation for Arabic (faster)
      if (originalLanguage === 'ar') {
        logger.info('[LanguageService] Using legacy English-to-Arabic translation');
        translatedResponse = this.translateEnglishToArabic(response);
      } else {
        // For romanized input, ask OpenAI to transliterate the response
        if (isRomanized) {
          logger.info(`[LanguageService] Using romanized translation for ${originalLanguage}`);
          translatedResponse = await this.translateToRomanized(response, originalLanguage);
        } else {
          // For native script input, translate to native script
          logger.info(`[LanguageService] Using native script translation for ${originalLanguage}`);
          translatedResponse = await this.translateText(response, originalLanguage);
        }
      }

      logger.info(`[LanguageService] Response translation complete:`);
      logger.info(`  - Original (English): "${response.substring(0, 100)}..."`);
      logger.info(`  - Translated (${originalLanguage}): "${(translatedResponse || response).substring(0, 100)}..."`);

      return {
        originalResponse: response,
        translatedResponse: translatedResponse || response, // Fallback to original if translation fails
        language: originalLanguage,
        isRomanized,
      };
    }

    // Response is already in English (user's language)
    logger.info('[LanguageService] Response is already in target language (English)');
    return {
      originalResponse: response,
      translatedResponse: response,
      language: originalLanguage || 'en',
      isRomanized: false,
    };
  }

  // Special translation for romanized output (transliteration)
  async translateToRomanized(text, targetLanguage) {
    if (!text || !targetLanguage || targetLanguage === 'en') {
      return text;
    }

    const languageNames = {
      'hi': 'Hindi (romanized/Hinglish)',
      'mr': 'Marathi (romanized)',
      'ta': 'Tamil (romanized/Tanglish)',
      'te': 'Telugu (romanized)',
      'gu': 'Gujarati (romanized)',
      'kn': 'Kannada (romanized)',
      'ml': 'Malayalam (romanized/Manglish)',
      'pa': 'Punjabi (romanized)',
      'bn': 'Bengali (romanized/Benglish)',
    };

    const targetLangName = languageNames[targetLanguage] || `${targetLanguage} (romanized)`;

    // Conversational romanized style hints
    const romanizedStyleHints = {
      'hi': `- Use casual Hinglish style - mix Hindi and English freely
- Examples: "Hum ye services dete hain", "Aapko kis cheez ki jaankari chahiye?"
- Keep it natural like WhatsApp chat, not formal`,

      'mr': `- Use casual romanized Marathi - mix Marathi and English freely
- Examples: "Amhi he services deto", "Tumhala kashabaddal mahiti havi aahe?"
- Keep it natural like WhatsApp chat, not formal`,

      'ta': `- Use casual Tanglish style - mix Tamil and English freely
- Keep it natural like WhatsApp chat, not formal`,

      'te': `- Use casual romanized Telugu - mix Telugu and English freely
- Keep it natural like WhatsApp chat, not formal`,
    };

    const romanizedHint = romanizedStyleHints[targetLanguage] || '';
    const hasRomanizedStyle = !!romanizedHint;

    logger.info(`[LanguageService] Romanized translation to ${targetLanguage} (${targetLangName})`);
    logger.info(`[LanguageService] Romanized style mode: ${hasRomanizedStyle ? 'CONVERSATIONAL' : 'STANDARD'}`);
    logger.info(`[LanguageService] Input: "${text.substring(0, 100)}..."`);

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a conversational translator. Translate the following text to ${targetLangName} using ONLY English/Latin alphabet (romanized script).

IMPORTANT: Use CASUAL, EVERYDAY language - like chatting with a friend on WhatsApp, NOT formal or literary language.
${romanizedHint}

Do NOT use native script. Return ONLY the romanized translation, no explanations.

Examples:
- "Hello" → "Namaste" (Hindi romanized)
- "Thank you" → "Dhanyavaad" (Hindi romanized)
- "We offer these services" → "Hum ye services dete hain" (Hindi romanized, mixing English naturally)`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.6, // Increased for more natural output
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      const translatedText = response.data.choices[0].message.content.trim();
      logger.info(`[LanguageService] Romanized translation complete. Output: "${translatedText.substring(0, 100)}..."`);
      return translatedText;
    } catch (error) {
      logger.warn(`[LanguageService] Romanized translation to ${targetLanguage} failed: ${error.message}`);
      return text; // Fallback to original
    }
  }
}

module.exports = new LanguageService();
