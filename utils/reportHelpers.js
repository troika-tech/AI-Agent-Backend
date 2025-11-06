// utils/reportHelpers.js
// Shared helpers for report formatting (CSV and HTML)

function convertGuestMessagesToCSV(messages) {
  const headers = [
    'Message ID',
    'Chatbot Name',
    'Company Name',
    'Session ID',
    'Sender',
    'Content',
    'Timestamp',
    'Is Guest'
  ];

  const rows = messages.map((msg) => [
    msg._id.toString(),
    msg.chatbot_id?.name || 'Unknown',
    msg.chatbot_id?.company_id?.name || 'Unknown',
    msg.session_id || '',
    msg.sender || '',
    msg.content || '',
    msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
    msg.is_guest ? 'Yes' : 'No',
  ]);

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const csvContent = [headers.map(escapeCSV).join(','), ...rows.map((row) => row.map(escapeCSV).join(','))].join('\n');
  return csvContent;
}

function generateGuestAnalyticsHTML(analytics) {
  return `
  <html>
    <head>
      <style>
        body { font-family: Arial; padding: 30px; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-label { font-weight: bold; color: #555; }
        .metric-value { font-size: 1.2em; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .chart-container { margin: 20px 0; }
        .query-item { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>Guest Message Analytics Report</h1>
      <p><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Period:</strong> ${analytics.period}</p>
      <div class="summary">
        <h2>Summary</h2>
        <div class="metric">
          <div class="metric-label">Total Messages:</div>
          <div class="metric-value">${analytics.summary.total_messages}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Guest Messages:</div>
          <div class="metric-value">${analytics.summary.guest_messages}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Authenticated Messages:</div>
          <div class="metric-value">${analytics.summary.authenticated_messages}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Guest Percentage:</div>
          <div class="metric-value">${analytics.summary.guest_percentage}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Guest Sessions:</div>
          <div class="metric-value">${analytics.summary.total_guest_sessions}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Conversion Rate:</div>
          <div class="metric-value">${analytics.summary.conversion_rate}%</div>
        </div>
      </div>
      <h2>Daily Breakdown</h2>
      <table>
        <tr>
          <th>Date</th>
          <th>Guest Messages</th>
          <th>Authenticated Messages</th>
          <th>Total</th>
        </tr>
        ${analytics.daily_breakdown
          .map(
            (day) => `
          <tr>
            <td>${day._id}</td>
            <td>${day.guest_messages}</td>
            <td>${day.authenticated_messages}</td>
            <td>${day.guest_messages + day.authenticated_messages}</td>
          </tr>
        `
          )
          .join('')}
      </table>
      <h2>Top Guest Queries</h2>
      ${analytics.top_guest_queries
        .map(
          (query, index) => `
        <div class="query-item">
          <strong>#${index + 1}</strong> - "${query.query}"<br>
          <small>Asked ${query.count} times by ${query.unique_sessions} unique sessions</small>
        </div>
      `
        )
        .join('')}
    </body>
  </html>`;
}

function generateOverallHTML(data) {
  return `
  <html>
    <head>
      <style>
        body { font-family: Arial; padding: 30px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f5f5f5; }
        .section { margin-bottom: 50px; page-break-inside: avoid; }
        .history { font-size: 0.9em; color: #555; margin-top: 10px; }
      </style>
    </head>
    <body>
      <h1>Overall Chatbot Report</h1>
      <p><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
      ${data
        .map(
          (bot, index) => `
          <div class="section">
            <h2>Chatbot ${index + 1}: ${bot.companyName}</h2>
            <table>
              <tr><th>Company</th><td>${bot.companyName}</td></tr>
              <tr><th>Domain</th><td>${bot.domain}</td></tr>
              <tr><th>Plan Name</th><td>${bot.planName}</td></tr>
              <tr><th>Plan Duration (Months)</th><td>${bot.planDuration}</td></tr>
              <tr><th>Start Date</th><td>${bot.startDate}</td></tr>
              <tr><th>End Date</th><td>${bot.endDate}</td></tr>
              <tr><th>Days Remaining</th><td>${bot.daysRemaining}</td></tr>
              <tr><th>Total Users</th><td>${bot.totalUsers}</td></tr>
              <tr><th>Remaining Users</th><td>${bot.remainingUsers}</td></tr>
              <tr><th>Total Messages</th><td>${bot.totalMessages}</td></tr>
              <tr><th>Guest Messages</th><td>${bot.guestMessages} (${bot.guestPercentage}%)</td></tr>
              <tr><th>Authenticated Messages</th><td>${bot.authenticatedMessages}</td></tr>
              <tr>
                <th>Message History</th>
                <td>
                  <ul class="history">
                    ${bot.messageHistory
                      .map(
                        (msg) => `<li><strong>${msg.sender}:</strong> ${msg.content} ${
                          msg.is_guest ? '<span style="color: #ff6b6b; font-size: 0.8em;">[GUEST]</span>' : ''
                        }</li>`
                      )
                      .join('')}
                  </ul>
                </td>
              </tr>
            </table>
          </div>`
        )
        .join('')}
    </body>
  </html>`;
}

module.exports = {
  convertGuestMessagesToCSV,
  generateGuestAnalyticsHTML,
  generateOverallHTML,
};
