const axios = require("axios");
const logger = require("../utils/logger");

const PEXELS_API_KEY = "E4WJnmgjGXSd6pTZSpYqhsFlODMGUINJeDMncwy8rBGHPJUkSvO0rv3z";
const PEXELS_API_URL = "https://api.pexels.com/v1/search";

// Image cache to avoid repetition
const imageCache = new Map();
const MAX_CACHE_SIZE = 50;

/**
 * Map service keywords to Pexels search terms
 */
const SERVICE_KEYWORDS = {
  'ai_websites': ['modern website design', 'business website', 'tech startup', 'digital agency', 'web development'],
  'supa_agent': ['ai technology', 'artificial intelligence', 'smart assistant', 'tech innovation', 'digital transformation'],
  'whatsapp_marketing': ['social media marketing', 'digital marketing', 'mobile business', 'customer engagement', 'marketing strategy'],
  'pricing': ['business success', 'financial growth', 'investment', 'business strategy', 'professional services'],
  'features': ['technology innovation', 'business solutions', 'digital tools', 'modern technology', 'tech features'],
  'demo': ['business presentation', 'professional meeting', 'tech demo', 'business consultation', 'product showcase'],
  'contact': ['business communication', 'customer service', 'professional support', 'business consultation', 'team meeting'],
  'general': ['business technology', 'digital solutions', 'modern business', 'professional office', 'tech innovation']
};

/**
 * Search for images using Pexels API with variety and caching
 * @param {string} query - Search query
 * @param {number} perPage - Number of images to return (max 80)
 * @param {string} context - Context to avoid repetition
 * @returns {Promise<Object>} - Image search results
 */
async function searchImages(query, perPage = 3, context = 'general') {
  try {
    // Check cache first
    const cacheKey = `${query}_${context}`;
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey);
      if (cached.length > 0) {
        logger.info(`Using cached image for: ${query}`);
        return {
          success: true,
          images: [cached[0]] // Return first cached image
        };
      }
    }

    // Add variety to search terms
    const varietyTerms = [
      query,
      `${query} modern`,
      `${query} professional`,
      `${query} business`,
      `${query} technology`
    ];
    
    // Pick a random variety term
    const searchTerm = varietyTerms[Math.floor(Math.random() * varietyTerms.length)];
    
    const response = await axios.get(PEXELS_API_URL, {
      headers: {
        'Authorization': PEXELS_API_KEY
      },
      params: {
        query: searchTerm,
        per_page: Math.min(perPage * 2, 10), // Get more images for variety
        orientation: 'landscape',
        size: 'large' // Use large size for better quality
      }
    });

    if (response.data && response.data.photos && response.data.photos.length > 0) {
      const images = response.data.photos.map(photo => ({
        id: photo.id,
        url: photo.src.medium,
        photographer: photo.photographer,
        photographer_url: photo.photographer_url,
        alt: photo.alt || query
      }));

      // Cache the images for this context
      imageCache.set(cacheKey, images);
      
      // Clean cache if it gets too large
      if (imageCache.size > MAX_CACHE_SIZE) {
        const firstKey = imageCache.keys().next().value;
        imageCache.delete(firstKey);
      }

      // Return a random image from the results
      const randomImage = images[Math.floor(Math.random() * images.length)];
      
      return {
        success: true,
        images: [randomImage]
      };
    } else {
      return {
        success: false,
        message: 'No images found'
      };
    }
  } catch (error) {
    logger.error('Pexels API error:', error.response?.data || error.message);
    return {
      success: false,
      message: 'Image search failed'
    };
  }
}

/**
 * Get relevant image search terms based on user message and context
 * @param {string} userMessage - User's message
 * @param {string} botResponse - Bot's response
 * @param {string} context - Additional context (service, action, etc.)
 * @returns {string} - Best search term for image search
 */
function getImageSearchTerm(userMessage, botResponse, context = 'general') {
  const message = (userMessage + ' ' + botResponse).toLowerCase();
  
  // Check for specific service mentions
  if (message.includes('ai website') || message.includes('website')) {
    return SERVICE_KEYWORDS.ai_websites[0];
  }
  if (message.includes('supa agent') || message.includes('chatbot') || message.includes('ai assistant')) {
    return SERVICE_KEYWORDS.supa_agent[0];
  }
  if (message.includes('whatsapp') || message.includes('marketing')) {
    return SERVICE_KEYWORDS.whatsapp_marketing[0];
  }
  if (message.includes('price') || message.includes('cost') || message.includes('pricing')) {
    return SERVICE_KEYWORDS.pricing[0];
  }
  if (message.includes('feature') || message.includes('capability')) {
    return SERVICE_KEYWORDS.features[0];
  }
  if (message.includes('demo') || message.includes('presentation')) {
    return SERVICE_KEYWORDS.demo[0];
  }
  if (message.includes('contact') || message.includes('call') || message.includes('reach')) {
    return SERVICE_KEYWORDS.contact[0];
  }
  
  // Use context-based search
  if (SERVICE_KEYWORDS[context]) {
    return SERVICE_KEYWORDS[context][0];
  }
  
  // Default to general business technology
  return SERVICE_KEYWORDS.general[0];
}

/**
 * Get image for a specific service or context
 * @param {string} service - Service name (ai_websites, supa_agent, etc.)
 * @returns {Promise<Object>} - Image result
 */
async function getServiceImage(service) {
  const searchTerm = SERVICE_KEYWORDS[service] ? SERVICE_KEYWORDS[service][0] : SERVICE_KEYWORDS.general[0];
  return await searchImages(searchTerm, 1);
}

/**
 * Get random business/technology image
 * @returns {Promise<Object>} - Image result
 */
async function getRandomBusinessImage() {
  const businessTerms = [
    'modern business',
    'digital technology',
    'business innovation',
    'professional office',
    'tech startup'
  ];
  
  const randomTerm = businessTerms[Math.floor(Math.random() * businessTerms.length)];
  return await searchImages(randomTerm, 1);
}

module.exports = {
  searchImages,
  getImageSearchTerm,
  getServiceImage,
  getRandomBusinessImage,
  SERVICE_KEYWORDS
};
