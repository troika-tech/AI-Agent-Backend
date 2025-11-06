/**
 * Utility functions for time-related operations
 */

/**
 * Get current time in IST (Indian Standard Time)
 * @returns {Object} Object containing formatted time information
 */
function getCurrentISTTime() {
  const now = new Date();
  
  // Convert to IST (UTC+5:30)
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  
  // Format options
  const options = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  
  const formattedTime = istTime.toLocaleString('en-IN', options);
  const dayOfWeek = istTime.toLocaleDateString('en-IN', { weekday: 'long' });
  const dateOnly = istTime.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return {
    fullDateTime: formattedTime,
    dayOfWeek: dayOfWeek,
    date: dateOnly,
    time: istTime.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    }),
    timestamp: istTime.getTime(),
    isoString: istTime.toISOString()
  };
}

/**
 * Get a formatted time context string for LLM
 * @returns {string} Formatted time context
 */
function getTimeContextForLLM() {
  const timeInfo = getCurrentISTTime();
  
  return `CURRENT TIME CONTEXT:
- Current IST Time: ${timeInfo.fullDateTime}
- Day: ${timeInfo.dayOfWeek}
- Date: ${timeInfo.date}
- Time: ${timeInfo.time}`;
}

module.exports = {
  getCurrentISTTime,
  getTimeContextForLLM
};
