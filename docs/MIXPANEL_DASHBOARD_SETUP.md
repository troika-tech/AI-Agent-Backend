# Mixpanel Master Analytics Dashboard Setup Guide

This guide will help you create a comprehensive dashboard showing all your chatbot streaming metrics in one place.

## Dashboard Overview

**Dashboard Name:** Chatbot Streaming Analytics - Master Dashboard
**Purpose:** Monitor performance, usage, features, and business metrics in real-time

---

## How to Create the Dashboard

### Step 1: Create New Board
1. Go to your Mixpanel dashboard
2. Click on **"Boards"** in the left sidebar
3. Click **"Create Board"**
4. Name it: **"Chatbot Streaming Analytics - Master"**
5. Click **"Create"**

---

## Reports to Add

### 📊 SECTION 1: PERFORMANCE METRICS

#### 1.1 Average Session Duration
- **Type:** Insights → Line Chart
- **Event:** `Streaming Completed`
- **Metric:** Average of `duration_ms`
- **Time Range:** Last 30 Days
- **Formula:** `duration_ms / 1000` (to show seconds)
- **Chart Title:** "Average Session Duration (seconds)"

**How to Create:**
```
1. Click "Add Report" → "Insights"
2. Select event: "Streaming Completed"
3. Click "Total" dropdown → "Average" → "duration_ms"
4. Add formula: A/1000
5. Set time range: Last 30 Days
6. Save as "Average Session Duration"
```

---

#### 1.2 Success Rate
- **Type:** Insights → Number (Single Metric)
- **Formula:** `(Streaming Completed / Streaming Started) * 100`
- **Time Range:** Last 7 Days
- **Chart Title:** "Success Rate %"

**How to Create:**
```
1. Add Report → Insights
2. Select event: "Streaming Completed" (A)
3. Click "+ Add Metric" → "Streaming Started" (B)
4. Click "Formula" → Enter: (A/B)*100
5. Change visualization to "Number"
6. Save as "Success Rate %"
```

---

#### 1.3 Error Rate
- **Type:** Insights → Number
- **Formula:** `(Streaming Failed / Streaming Started) * 100`
- **Time Range:** Last 7 Days
- **Chart Title:** "Error Rate %"

---

#### 1.4 Response Time Trends
- **Type:** Insights → Line Chart
- **Event:** `Streaming Completed`
- **Metric:** P50, P95, P99 of `duration_ms`
- **Time Range:** Last 30 Days
- **Chart Title:** "Response Time Trends (Latency Percentiles)"

**How to Create:**
```
1. Add Report → Insights
2. Select event: "Streaming Completed"
3. Click "Average" → "Percentiles" → "duration_ms"
4. Select: 50th, 95th, 99th percentiles
5. Line chart view
6. Save as "Response Time Trends"
```

---

#### 1.5 Audio Generation Performance (TTS)
- **Type:** Insights → Bar Chart
- **Event:** `Streaming Completed`
- **Metric:** Average of `audio_chunks`
- **Filter:** Where `enable_tts` = true
- **Breakdown:** By `language`
- **Chart Title:** "Average Audio Chunks by Language"

---

### 📈 SECTION 2: USAGE METRICS

#### 2.1 Total Streaming Sessions
- **Type:** Insights → Number
- **Event:** `Streaming Started`
- **Metric:** Total Count
- **Time Range:** Last 30 Days
- **Chart Title:** "Total Streaming Sessions"

---

#### 2.2 Sessions per Chatbot
- **Type:** Insights → Bar Chart
- **Event:** `Streaming Started`
- **Breakdown:** By `chatbot_id`
- **Time Range:** Last 30 Days
- **Sort:** Descending by count
- **Chart Title:** "Most Popular Chatbots"

---

#### 2.3 Sessions Over Time (Peak Times)
- **Type:** Insights → Line Chart
- **Event:** `Streaming Started`
- **Metric:** Total Count
- **Breakdown:** By Hour of Day
- **Time Range:** Last 7 Days
- **Chart Title:** "Sessions by Hour of Day"

**How to Create:**
```
1. Add Report → Insights
2. Select event: "Streaming Started"
3. Click "Breakdown" → "Time" → "Hour of Day"
4. Line chart view
5. Save as "Peak Usage Hours"
```

---

#### 2.4 Active Users (Unique Sessions)
- **Type:** Insights → Line Chart
- **Event:** `Streaming Started`
- **Metric:** Unique `distinct_id`
- **Time Range:** Last 30 Days
- **Chart Title:** "Daily Active Users"

---

#### 2.5 Returning Users
- **Type:** Insights → Number
- **Event:** `Streaming Started`
- **Filter:** Where `total_conversations` > 1
- **Metric:** Unique `distinct_id`
- **Chart Title:** "Returning Users"

---

### 🎯 SECTION 3: FEATURE ADOPTION

#### 3.1 TTS Usage Rate
- **Type:** Insights → Pie Chart
- **Event:** `Streaming Started`
- **Breakdown:** By `enable_tts`
- **Time Range:** Last 30 Days
- **Chart Title:** "TTS Enabled vs Disabled"

---

#### 3.2 Language Preferences
- **Type:** Insights → Bar Chart
- **Event:** `Streaming Started`
- **Breakdown:** By `language`
- **Time Range:** Last 30 Days
- **Chart Title:** "Popular Languages"

---

#### 3.3 Intelligence Feature Usage
- **Type:** Insights → Bar Chart
- **Event:** `Streaming Completed`
- **Breakdown:** By `intelligence_level`
- **Time Range:** Last 30 Days
- **Chart Title:** "Intelligence Level Distribution"

---

#### 3.4 Suggestions Engagement
- **Type:** Insights → Pie Chart
- **Event:** `Streaming Completed`
- **Breakdown:** By `has_suggestions`
- **Time Range:** Last 30 Days
- **Chart Title:** "Sessions with Suggestions"

---

### 📏 SECTION 4: QUALITY METRICS

#### 4.1 Word Count Distribution
- **Type:** Insights → Histogram
- **Event:** `Streaming Completed`
- **Metric:** `word_count`
- **Buckets:** 0-50, 50-100, 100-200, 200-500, 500+
- **Chart Title:** "Response Length Distribution"

**How to Create:**
```
1. Add Report → Insights
2. Select event: "Streaming Completed"
3. Click "Breakdown" → "Property" → "word_count"
4. Click "Edit Buckets" → Custom buckets: 0,50,100,200,500
5. Bar chart view
6. Save as "Response Length Distribution"
```

---

#### 4.2 Audio Chunks per Session
- **Type:** Insights → Line Chart
- **Event:** `Streaming Completed`
- **Metric:** Average of `audio_chunks`
- **Filter:** Where `audio_chunks` > 0
- **Time Range:** Last 30 Days
- **Chart Title:** "Average Audio Chunks Over Time"

---

#### 4.3 Intelligence Items Utilized
- **Type:** Insights → Number
- **Event:** `Streaming Completed`
- **Metric:** Average of `intelligence_items_used`
- **Time Range:** Last 30 Days
- **Chart Title:** "Avg Market Intelligence Items per Session"

---

#### 4.4 Response Mode Breakdown
- **Type:** Insights → Pie Chart
- **Event:** `Streaming Completed`
- **Breakdown:** By `response_mode`
- **Time Range:** Last 30 Days
- **Chart Title:** "Detailed vs Concise Responses"

---

### 💼 SECTION 5: BUSINESS INSIGHTS

#### 5.1 Conversion Funnel
- **Type:** Funnels
- **Steps:**
  1. `Streaming Started`
  2. `Streaming Completed`
- **Time Range:** Last 30 Days
- **Conversion Window:** 5 minutes
- **Chart Title:** "Session Completion Funnel"

**How to Create:**
```
1. Click "Add Report" → "Funnels"
2. Step 1: Select "Streaming Started"
3. Step 2: Select "Streaming Completed"
4. Set conversion window: 5 minutes
5. Save as "Session Completion Funnel"
```

---

#### 5.2 Geographic Distribution
- **Type:** Insights → Map (if available) or Table
- **Event:** `Streaming Started`
- **Breakdown:** By `client_ip` → Country (requires IP geolocation)
- **Time Range:** Last 30 Days
- **Chart Title:** "Sessions by Country"

**Note:** Mixpanel automatically geolocation from IP addresses

---

#### 5.3 Device/Browser Breakdown
- **Type:** Insights → Table
- **Event:** `Streaming Started`
- **Breakdown:** By `user_agent` → Parsed into Browser/Device
- **Time Range:** Last 30 Days
- **Chart Title:** "User Devices & Browsers"

---

#### 5.4 Time-based Patterns
- **Type:** Insights → Heatmap
- **Event:** `Streaming Started`
- **Metric:** Total Count
- **Breakdown:** Day of Week + Hour of Day
- **Time Range:** Last 30 Days
- **Chart Title:** "Usage Heatmap (Day × Hour)"

---

### 🚨 SECTION 6: ERROR MONITORING

#### 6.1 Error Rate by Type
- **Type:** Insights → Bar Chart
- **Event:** `Streaming Failed`
- **Breakdown:** By `error_type`
- **Time Range:** Last 7 Days
- **Chart Title:** "Errors by Type"

---

#### 6.2 Recent Errors (Debug View)
- **Type:** Insights → Table
- **Event:** `Streaming Failed`
- **Columns:** `error_type`, `error_message`, `chatbot_id`, `time`
- **Time Range:** Last 24 Hours
- **Chart Title:** "Recent Errors"

---

#### 6.3 Error Trend
- **Type:** Insights → Line Chart
- **Event:** `Streaming Failed`
- **Metric:** Total Count
- **Time Range:** Last 30 Days
- **Chart Title:** "Error Trend Over Time"

---

## Quick Setup Instructions

### Option 1: Manual Setup (Recommended for Learning)
Follow each report creation step above, one by one. This takes ~30-45 minutes but helps you understand Mixpanel.

### Option 2: Using Template (If Available)
Mixpanel allows sharing dashboard templates. Once you create this dashboard, you can:
1. Click "Share" on your board
2. Export as template
3. Share with team members

---

## Dashboard Layout Suggestion

Organize your dashboard in this order:

```
┌─────────────────────────────────────────────────────────┐
│  CHATBOT STREAMING ANALYTICS - MASTER DASHBOARD         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📊 PERFORMANCE METRICS                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Success Rate │ │ Error Rate   │ │ Avg Duration │   │
│  │    94.5%     │ │    5.5%      │ │   3.2 sec    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │     Response Time Trends (Line Chart)           │   │
│  │     P50, P95, P99 Latency                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📈 USAGE METRICS                                       │
│  ┌──────────────┐ ┌──────────────┐                     │
│  │ Total        │ │ Daily Active │                     │
│  │ Sessions     │ │ Users        │                     │
│  │   1,234      │ │    456       │                     │
│  └──────────────┘ └──────────────┘                     │
│                                                         │
│  ┌──────────────────┐ ┌──────────────────┐             │
│  │ Peak Hours       │ │ Popular Chatbots │             │
│  │ (Line Chart)     │ │ (Bar Chart)      │             │
│  └──────────────────┘ └──────────────────┘             │
│                                                         │
│  🎯 FEATURE ADOPTION                                    │
│  ┌──────────────────┐ ┌──────────────────┐             │
│  │ TTS Usage        │ │ Languages        │             │
│  │ (Pie Chart)      │ │ (Bar Chart)      │             │
│  └──────────────────┘ └──────────────────┘             │
│                                                         │
│  📏 QUALITY METRICS                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Word Count Distribution (Histogram)             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  💼 BUSINESS INSIGHTS                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Conversion Funnel: Started → Completed          │   │
│  │ [████████████████░░░░] 85% conversion           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────┐ ┌──────────────────┐             │
│  │ Geographic Map   │ │ Usage Heatmap    │             │
│  │                  │ │ (Day × Hour)     │             │
│  └──────────────────┘ └──────────────────┘             │
│                                                         │
│  🚨 ERROR MONITORING                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Errors by Type (Bar Chart)                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Recent Errors (Table - Last 24h)                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Tips for Best Results

1. **Set Default Time Range:** Use "Last 30 Days" for most reports
2. **Use Comparison Mode:** Compare current period vs previous period
3. **Add Filters:** Filter by specific chatbots or environments
4. **Enable Auto-Refresh:** Set dashboard to refresh every 5 minutes for real-time monitoring
5. **Share with Team:** Use "Share Board" to give access to stakeholders

---

## Next Steps After Creation

1. **Bookmark the Dashboard** for quick access
2. **Set up Alerts** for critical metrics (error rate > 10%, etc.)
3. **Schedule Email Reports** to receive daily/weekly summaries
4. **Create Mobile View** for monitoring on the go
5. **Add Annotations** for deployments or major events

---

## Support

For questions about creating specific reports, refer to:
- Mixpanel Docs: https://docs.mixpanel.com/
- Or ask me to help you create any specific visualization!
