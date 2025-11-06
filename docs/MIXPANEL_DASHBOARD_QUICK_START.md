# Mixpanel Dashboard - Quick Start Guide (Non-Technical)

## 🎯 Goal
Create ONE dashboard showing all your chatbot performance metrics that anyone can understand.

---

## 📊 Your Dashboard Will Show:

### **Top Row - Big Numbers (Most Important)**
- ✅ **94.5% Success Rate** - How many chats complete successfully
- ⚠️ **5.5% Error Rate** - How many fail
- ⏱️ **3.2 sec Average Response** - How fast your bot responds
- 👥 **1,234 Total Conversations** - Volume this month

### **Second Row - Trends**
- 📈 **Response Time Graph** - Is your bot getting faster or slower?
- 📊 **Sessions Per Day** - When do people use your bot most?

### **Third Row - Features**
- 🔊 **Voice ON: 75% | Voice OFF: 25%** - How many use voice features
- 🌍 **Languages: English 60%, Hindi 30%, Others 10%**
- 🤖 **AI Intelligence: Standard 70%, Advanced 30%**

### **Bottom Row - Business Insights**
- 🌍 **Map showing where users are from**
- 📱 **Mobile: 60% | Desktop: 40%**
- ⏰ **Peak hours: 2pm-4pm most busy**

---

## 🚀 Step-by-Step Setup (15 Minutes)

### Step 1: Create Your Dashboard
1. Open Mixpanel: https://mixpanel.com/project/3854964
2. Click **"Boards"** on the left sidebar (looks like a grid icon 📊)
3. Click blue **"Create Board"** button (top right)
4. Name it: **"My Chatbot Dashboard"**
5. Click **"Create"**

✅ **You now have an empty dashboard!**

---

### Step 2: Add Your First Metric - Success Rate (Big Number)

1. Click **"+ Add"** button → Select **"Insights"**
2. You'll see a query builder screen

**Now follow these clicks:**

```
┌─────────────────────────────────────┐
│ Select Event: [Click dropdown]      │
│   → Choose "Streaming Completed"    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ This is metric "A"                  │
│ Click "+ Add Metric" button         │
│   → Choose "Streaming Started"      │
│ This is metric "B"                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Click "Formula" button              │
│ Type: (A/B)*100                     │
│ This calculates success %           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Click visualization icon            │
│ Choose "Number" (big single number) │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Click "Save" button                 │
│ Name it: "Success Rate %"           │
└─────────────────────────────────────┘
```

🎉 **You just added your first metric!** You should see a big number like "94.5"

---

### Step 3: Add Error Rate (Same Process, Different Formula)

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Failed"** (this is A)
3. Click **"+ Add Metric"** → Select **"Streaming Started"** (this is B)
4. Click **"Formula"** → Type: `(A/B)*100`
5. Change to **"Number"** visualization
6. Save as **"Error Rate %"**

---

### Step 4: Add Total Conversations (Easiest One!)

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Started"**
3. That's it! It automatically counts them
4. Change to **"Number"** visualization
5. Save as **"Total Conversations"**

---

### Step 5: Add Average Response Time

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Completed"**
3. Click **"Total"** dropdown → Select **"Average"**
4. Choose property: **"duration_ms"**
5. Click **"Formula"** → Type: `A/1000` (converts to seconds)
6. Change to **"Number"** visualization
7. Save as **"Average Response Time (sec)"**

---

### Step 6: Add Response Time Trend (Line Graph)

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Completed"**
3. Click **"Total"** dropdown → **"Average"** → **"duration_ms"**
4. Leave as **"Line"** chart (default)
5. At top, change time range to **"Last 30 Days"**
6. Save as **"Response Time Trend"**

🎉 **You should see a line going up and down showing how response time changes!**

---

### Step 7: Add Voice Feature Usage (Pie Chart)

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Started"**
3. Click **"Breakdown"** button
4. Select property: **"enable_tts"**
5. Change visualization to **"Pie"** chart
6. Save as **"Voice ON vs OFF"**

🎉 **You'll see a pie chart showing % with voice enabled vs disabled**

---

### Step 8: Add Language Distribution (Bar Chart)

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Started"**
3. Click **"Breakdown"**
4. Select property: **"language"**
5. Leave as **"Bar"** chart
6. Save as **"Popular Languages"**

---

### Step 9: Add Peak Usage Hours (Line Chart)

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Started"**
3. Click **"Breakdown"** → Select **"Hour of Day"**
4. Leave as **"Line"** chart
5. Save as **"Peak Usage Hours"**

🎉 **You'll see which hours are busiest!**

---

### Step 10: Add Popular Chatbots (Bar Chart)

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Started"**
3. Click **"Breakdown"**
4. Select property: **"chatbot_id"**
5. Leave as **"Bar"** chart
6. Save as **"Most Popular Chatbots"**

---

### Step 11: Add Error Breakdown (Bar Chart)

1. Click **"+ Add"** → **"Insights"**
2. Select event: **"Streaming Failed"**
3. Click **"Breakdown"**
4. Select property: **"error_type"**
5. Leave as **"Bar"** chart
6. Save as **"Errors by Type"**

---

### Step 12: Add Conversion Funnel (How Many Complete?)

1. Click **"+ Add"** → **"Funnels"** (not Insights!)
2. Step 1: Select **"Streaming Started"**
3. Click **"+ Add Step"**
4. Step 2: Select **"Streaming Completed"**
5. Save as **"Session Completion Funnel"**

🎉 **You'll see how many people complete vs abandon!**

---

## 📐 Arrange Your Dashboard (Make it Look Nice!)

1. **Drag and drop** reports to rearrange them
2. **Resize** reports by dragging corners
3. **Recommended layout:**

```
Top Row (4 big numbers side-by-side):
┌────────────┬────────────┬────────────┬────────────┐
│ Success %  │ Error %    │ Avg Time   │ Total Chats│
│   94.5%    │   5.5%     │  3.2 sec   │   1,234    │
└────────────┴────────────┴────────────┴────────────┘

Second Row (2 wide charts):
┌─────────────────────────┬─────────────────────────┐
│ Response Time Trend     │ Peak Usage Hours        │
│ (Line going up/down)    │ (Line showing hours)    │
└─────────────────────────┴─────────────────────────┘

Third Row (3 medium charts):
┌───────────────┬───────────────┬───────────────┐
│ Voice ON/OFF  │ Languages     │ Popular Bots  │
│ (Pie chart)   │ (Bar chart)   │ (Bar chart)   │
└───────────────┴───────────────┴───────────────┘

Bottom Row (2 wide charts):
┌─────────────────────────┬─────────────────────────┐
│ Conversion Funnel       │ Errors by Type          │
│ Started → Completed     │ (Bar chart)             │
└─────────────────────────┴─────────────────────────┘
```

---

## 🎨 Make it Pretty (Optional but Recommended)

### Add Dashboard Description:
1. Click ⚙️ (settings icon) on your dashboard
2. Add description: *"Real-time chatbot performance monitoring. Updated every 5 minutes."*

### Set Auto-Refresh:
1. Click ⚙️ (settings icon)
2. Enable **"Auto-refresh"**
3. Set to **5 minutes**

### Add Section Headers:
1. Click **"+ Add"** → **"Text"**
2. Type: **"📊 KEY METRICS"**
3. Make it big and bold
4. Drag it above your first row
5. Repeat for other sections:
   - **"📈 TRENDS"**
   - **"🎯 FEATURE USAGE"**
   - **"⚠️ ERRORS & ISSUES"**

---

## 📱 Access Your Dashboard

### On Computer:
Bookmark this URL:
```
https://mixpanel.com/project/3854964/view/[YOUR-BOARD-ID]/app/boards
```

### On Mobile:
1. Download **Mixpanel Mobile** app
2. Login with your account
3. Your dashboard will sync automatically

### Share with Team:
1. Click **"Share"** button (top right)
2. Enter email addresses
3. They'll get a link to view (read-only)

---

## 🎓 Understanding Your Dashboard (For Non-Technical People)

### **Success Rate (94.5%)**
**What it means:** Out of 100 people who start a chat, 94-95 successfully complete it.
**Good number:** Above 90% is excellent
**Red flag:** Below 80% means something is wrong

### **Error Rate (5.5%)**
**What it means:** How many chats fail due to technical issues.
**Good number:** Below 10% is acceptable
**Red flag:** Above 20% needs immediate attention

### **Average Response Time (3.2 sec)**
**What it means:** How long users wait for a response.
**Good number:** Under 5 seconds is fast
**Red flag:** Above 10 seconds feels slow to users

### **Total Conversations**
**What it means:** How many people used your chatbot this month.
**Watch for:** Trends - going up is good growth!

### **Response Time Trend (Line Graph)**
**What it means:** Is your bot getting faster or slower over time?
**Look for:** Flat line = consistent, Upward trend = getting slower (bad), Downward = getting faster (good)

### **Peak Usage Hours**
**What it means:** When are people using your bot most?
**Use this for:** Scheduling maintenance during off-peak hours

### **Voice ON vs OFF (Pie Chart)**
**What it means:** What % of users enable voice features?
**Use this for:** Deciding if voice feature is worth investing in

### **Popular Languages**
**What it means:** Which languages do your users prefer?
**Use this for:** Deciding which languages to improve

### **Conversion Funnel**
**What it means:** Shows dropoff - how many start but don't finish
**Example:** "85% completion" means 85 out of 100 people finish their chat
**Use this for:** Finding where users abandon

### **Errors by Type**
**What it means:** What kind of errors are happening most?
**Use this for:** Prioritizing bug fixes
**Common types:**
- OpenAI Error = AI service problem
- TTS Error = Voice generation problem
- Network Error = Internet connectivity issue

---

## 🆘 Troubleshooting

### "I don't see any data"
- Wait 5-10 minutes after creating reports
- Make sure date range is "Last 30 Days" not "Today"
- Check that events are being tracked (look at Events page)

### "My numbers seem wrong"
- Check your time zone settings (should be US/Pacific or your local time)
- Verify date range at top of dashboard
- Refresh the page

### "I can't find a specific property"
- Some properties only appear after that type of event happens
- Try searching in the property dropdown
- Check spelling (e.g., "chatbot_id" not "chatbotId")

---

## ✅ Checklist - You're Done When:

- [ ] Dashboard has at least 10 reports
- [ ] You can see big numbers at the top (Success %, Error %, etc.)
- [ ] You have at least 2 line charts showing trends
- [ ] You have pie/bar charts showing breakdowns
- [ ] Dashboard is bookmarked for easy access
- [ ] Auto-refresh is enabled
- [ ] You shared it with your team (if applicable)

---

## 🎯 Next Level (Optional)

Once you're comfortable, you can add:
- **Alerts**: Get email when error rate > 10%
- **Comparisons**: Compare this week vs last week
- **Filters**: Filter by specific chatbot or language
- **Annotations**: Mark when you deploy new versions

---

## 📞 Need Help?

If you get stuck:
1. Check Mixpanel's help icon (?) in top right
2. Watch their video tutorials: https://mixpanel.com/get-started
3. Ask me for help with specific reports!

---

**Remember:** You don't need to be technical to use this. It's just clicking buttons and selecting options from dropdowns. Take it slow, one report at a time!

🎉 **Happy Dashboarding!**
