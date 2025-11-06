// utils/dateHelpers.js
// Centralized date window helpers used across controllers and services

function deriveWindowFromSubscription(sub) {
  if (!sub) return null;

  const hasStart = !!sub.start_date;
  const hasEnd = !!sub.end_date;

  if (hasStart && hasEnd) {
    return { start: new Date(sub.start_date), end: new Date(sub.end_date) };
  }

  if (hasEnd && sub.duration_days) {
    const end = new Date(sub.end_date);
    const start = new Date(end);
    start.setDate(end.getDate() - (sub.duration_days - 1));
    return { start, end };
  }

  return null;
}

function makeDateFilter(window, field = "timestamp") {
  if (!window) return {};
  return { [field]: { $gte: window.start, $lte: window.end } };
}

module.exports = {
  deriveWindowFromSubscription,
  makeDateFilter,
};
