// utils/queryBuilders.js
// Small helpers to build common MongoDB query fragments

function buildDateRangeFilter({ startDate, endDate }, field = 'timestamp') {
  const range = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate) range.$lte = new Date(endDate);
  if (Object.keys(range).length === 0) return {};
  return { [field]: range };
}

module.exports = { buildDateRangeFilter };
