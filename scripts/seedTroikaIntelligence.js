const mongoose = require('mongoose');
const MarketIntelligence = require('../models/MarketIntelligence');
const EmbeddingService = require('../services/embeddingService');
require('dotenv').config();

const troikaIntelligenceData = [
  // ========================================
  // 1. SPEED ADVANTAGE
  // ========================================
  {
    type: 'troika_advantage',
    source: 'Troika Internal Analysis',
    sourceUrl: 'https://troikatech.co',
    title: 'Speed Advantage: 4 Hours vs Industry 2-3 Weeks',
    summary: `Troika Tech revolutionizes website delivery with AI-powered automation, delivering production-ready websites in just 4 hours for standard projects (24-72 hours for complex enterprise sites). Traditional web agencies require 2-3 weeks for the same output due to manual coding processes. This 10x speed advantage enables clients to launch faster, capitalize on market opportunities, and reduce time-to-revenue. Founded in 2012 by Godwin Pinto, Parvati Matkate, and Mawin Pinto, Troika has perfected this rapid delivery model over 13+ years.`,
    keyTakeaways: [
      'Troika delivery: 4 hours (standard sites), 24-72 hours (complex projects)',
      'Industry average: 2-3 weeks (manual coding + revisions)',
      '10x faster time-to-market for urgent launches',
      'No quality compromise: AI Created, Human Perfected philosophy',
      'Perfect for seasonal campaigns, product launches, urgent needs',
      'Client can make changes same-day vs waiting weeks',
      'Tagline: Not Just a Vendor. Your AI Growth Partner.'
    ],
    relevantServices: ['AI Websites'],
    relevantIndustries: ['all'],
    relevanceScore: 0.95,
    processingStatus: 'scraped'
  },

  // ========================================
  // 2. PRICING ADVANTAGE
  // ========================================
  {
    type: 'troika_advantage',
    source: 'Market Research 2024',
    sourceUrl: 'https://troikatech.co',
    title: 'Pricing Advantage: ₹25K + GST vs Industry ₹50K-₹2L',
    summary: `Comprehensive market analysis reveals that traditional web development agencies in India charge between ₹50,000 to ₹2,00,000 for a basic 5-page business website. Troika Tech disrupts this pricing model by offering AI-powered websites starting at ₹25,000 + GST with MORE features included (AI SEO, mobile optimization, SSL, analytics, CMS access). Domain + hosting renewal is only ₹10,000/year. This represents 50-75% cost savings without compromising quality.`,
    keyTakeaways: [
      'Troika Starter: ₹25,000 + GST for 5 pages (AI SEO, SSL, responsive, chatbot-ready)',
      'Corporate Plan: ₹50,000 + GST for 10+ pages with analytics',
      'Premium Plan: ₹1,00,000 + GST for 20+ pages with AI SEO & blog automation',
      'Traditional agencies: ₹50,000-₹2,00,000 for basic site only',
      'Savings: 50-75% vs industry average',
      'All-inclusive transparent pricing (no hidden costs)',
      'Additional pages: ₹3,000 + GST vs industry ₹8,000-₹15,000',
      'Renewal: ₹10,000/year for domain + hosting (industry: ₹15K-₹25K)'
    ],
    relevantServices: ['AI Websites'],
    relevantIndustries: ['all'],
    relevanceScore: 0.95,
    processingStatus: 'scraped'
  },

  // ========================================
  // 3. CASE STUDY - REAL ESTATE
  // ========================================
  {
    type: 'case_study',
    source: 'Troika Client Success Story',
    sourceUrl: 'https://troikatech.co/case-studies',
    title: 'Real Estate Developer: 3x More Inquiries with AI Website + Supa Agent',
    summary: `A real estate developer implemented Troika's AI Website + Supa Agent and saw transformational results. Before implementation, they struggled with delayed responses to property inquiries, especially after business hours. After going live with the AI-powered system (delivered in 24-72 hours), property inquiries tripled (3x more inquiries). The AI website showcased properties with SEO optimization, while Supa Agent handled 24/7 customer queries about availability, pricing, location, and amenities. Setup cost: ₹25,000 + GST for website + ₹40,000 setup + ₹5,000/month for Supa Agent (5000 chats included).`,
    keyTakeaways: [
      'Industry: Real Estate | Result: 3x more inquiries',
      'Delivery time: 24-72 hours for full setup',
      'AI Website: ₹25,000 + GST (5 pages with property listings)',
      'Supa Agent: ₹40,000 setup + ₹5,000/month (5000 chats)',
      '24/7 instant responses to property queries (availability, pricing, location)',
      'Key benefit: Captured after-hours inquiries (8 PM - 8 AM) that were previously lost',
      'Agent time saved: Focus on site visits, not repetitive FAQs'
    ],
    relevantServices: ['Supa Agent', 'AI Websites'],
    relevantIndustries: ['real estate'],
    relevanceScore: 0.92,
    processingStatus: 'scraped'
  },

  // ========================================
  // 4. CASE STUDY - EDUCATION
  // ========================================
  {
    type: 'case_study',
    source: 'Troika Client Success Story',
    sourceUrl: 'https://troikatech.co/case-studies',
    title: 'Education Institute: Inquiries Doubled, Staff Saved 70% Time',
    summary: `An education institute implemented Troika's AI Website + Supa Agent and achieved remarkable results. Before implementation, they struggled with managing admission inquiries during peak season, with admin staff overwhelmed answering repetitive questions about courses, fees, timings, and eligibility. After deployment (24-72 hours setup), inquiries doubled as the website improved their online visibility and SEO ranking. More importantly, staff time saved 70% as Supa Agent automated responses to FAQs 24/7 in multiple languages. Admin team shifted focus from answering calls to actual admission processing and student counseling.`,
    keyTakeaways: [
      'Industry: Education | Result: Inquiries doubled + 70% staff time saved',
      'Delivery time: 24-72 hours for website + Supa Agent setup',
      'AI Website: ₹25,000 + GST with course catalog, admission process, fee structure',
      'Supa Agent: ₹40,000 setup + ₹5,000/month with 80+ language support',
      '24/7 instant answers to course, fee, eligibility, timing queries',
      'Parent satisfaction improved: 24/7 availability without hold times',
      'Admin team freed up for high-value tasks (counseling, admissions processing)'
    ],
    relevantServices: ['Supa Agent', 'AI Websites'],
    relevantIndustries: ['education'],
    relevanceScore: 0.9,
    processingStatus: 'scraped'
  },

  // ========================================
  // 5. OBJECTION HANDLER - CHEAP PRICING
  // ========================================
  {
    type: 'objection_handler',
    source: 'Troika Sales Intelligence',
    sourceUrl: 'https://troikatech.co',
    title: 'Objection: "₹25K + GST sounds too cheap, is quality compromised?"',
    summary: `One of the most common objections from prospects is concern that low pricing indicates poor quality. This objection stems from the traditional agency mindset where "you get what you pay for." However, Troika's pricing (₹25,000 + GST for starter package) is a result of AI automation efficiency, not quality compromise. The "AI Created, Human Perfected" philosophy ensures automation handles repetitive tasks while expert developers review every site. With 13+ years experience, 6000+ clients across 47+ cities and 9+ countries, Troika has proven that AI-powered efficiency enables affordable excellence.`,
    keyTakeaways: [
      'Root cause: AI automates 80% of repetitive coding tasks → speed + cost efficiency',
      'Quality philosophy: AI Created, Human Perfected (not fully automated)',
      'Social proof: 13+ years, 6000+ active clients, 47+ cities, 9+ countries',
      'Delivery: 4 hours (standard), 24-72 hours (complex projects)',
      'Comparison: ₹50K+ agency sites often lack AI SEO, SSL, analytics, CMS',
      'Troika includes: AI SEO, SSL, responsive design, CMS access, analytics in base price',
      'Transparent pricing: ₹25K + GST (5 pages), ₹3K + GST per extra page',
      'Renewal: Only ₹10,000/year for domain + hosting (industry: ₹15K-₹25K)'
    ],
    relevantServices: ['AI Websites'],
    relevantIndustries: ['all'],
    relevanceScore: 0.88,
    processingStatus: 'scraped'
  },

  // ========================================
  // 6. OBJECTION HANDLER - AI QUALITY
  // ========================================
  {
    type: 'objection_handler',
    source: 'Troika Sales Intelligence',
    sourceUrl: 'https://troikatech.co',
    title: 'Objection: "Can AI really build quality websites?"',
    summary: `Second most common objection relates to skepticism about AI-generated websites. Clients worry about generic designs, cookie-cutter templates, or technical issues. Troika's "AI Created, Human Perfected" tagline directly addresses this by emphasizing the hybrid approach: AI handles repetitive tasks (layout, responsive design, SEO structure) while human developers add customization, quality checks, and business-specific logic.`,
    keyTakeaways: [
      'Hybrid model: AI automates repetitive tasks, humans add customization',
      'AI role: Layout, responsiveness, SEO structure, code optimization',
      'Human role: Design customization, business logic, QA, client-specific features',
      'Quality metrics: 95% first-delivery approval rate',
      'Revisions: Average 1.2 revision rounds vs industry 3-4 rounds',
      'Technical excellence: PageSpeed scores 85-95 (vs industry 60-75)',
      'Proof: 13 years experience, 6000+ sites built with hybrid model'
    ],
    relevantServices: ['AI Websites'],
    relevantIndustries: ['all'],
    relevanceScore: 0.86,
    processingStatus: 'scraped'
  },

  // ========================================
  // 7. OBJECTION HANDLER - SUPPORT CONCERNS
  // ========================================
  {
    type: 'objection_handler',
    source: 'Troika Sales Intelligence',
    sourceUrl: 'https://troikatech.co',
    title: 'Objection: "What if I need changes or support later?"',
    summary: `Many prospects worry about post-launch support, especially when comparing to traditional agencies with dedicated account managers. Common concerns include: response time for updates, cost of changes, language barriers, and long-term maintenance. Troika addresses this with transparent pricing, Indian team availability, and affordable renewal costs. Domain + hosting renewal is only ₹10,000/year. Additional pages cost ₹3,000 + GST (vs industry ₹8K-₹15K). Contact: +91 9821211755, info@troikatech.in.`,
    keyTakeaways: [
      'Support channels: Phone +91 9821211755, WhatsApp, Email (info@troikatech.in)',
      'Language support: Hindi, English, Gujarati, and 80+ languages via Supa Agent',
      'Renewal pricing: ₹10,000/year for domain + hosting (all-inclusive)',
      'Update pricing: ₹3,000 + GST per additional page (transparent, no surprises)',
      'Team: Indian support team based in Thane, Maharashtra (no offshore barriers)',
      'Office: 702, B44, Sector 1, Shanti Nagar, Mira Road East, Maharashtra 401107',
      'Track record: 13+ years (founded 2012), 6000+ active long-term clients',
      'Founders: Godwin Pinto, Parvati Matkate, Mawin Pinto'
    ],
    relevantServices: ['AI Websites', 'Supa Agent'],
    relevantIndustries: ['all'],
    relevanceScore: 0.84,
    processingStatus: 'scraped'
  },

  // ========================================
  // 8. COMPETITIVE COMPARISON - WIX
  // ========================================
  {
    type: 'competitive_comparison',
    source: 'Market Analysis 2024',
    sourceUrl: 'https://troikatech.co/compare',
    title: 'Troika vs Wix: Comprehensive Feature & Cost Comparison',
    summary: `Detailed side-by-side comparison of Troika AI Websites vs Wix platform. While Wix offers a DIY drag-and-drop builder starting free, the total cost of ownership (TCO) and time investment often exceeds Troika's done-for-you service. Key differentiators include: setup effort, ongoing costs, professional quality, chatbot integration, and Indian market support.`,
    keyTakeaways: [
      'Setup: Wix DIY (4-8 hours your time) vs Troika Done-for-you (4 hours)',
      'First year cost: Wix ₹0-₹10,800 (limited features) vs Troika ₹25,000 (full features)',
      'Chatbot: Wix ₹5,000+/month add-on vs Troika included (Supa Agent)',
      'Quality: Wix amateur/DIY look vs Troika professional developer quality',
      'Support: Wix community forums vs Troika dedicated Indian team',
      'SEO: Wix basic vs Troika advanced optimization',
      '3-year TCO: Wix ₹60,000+ vs Troika ₹30,000 (with maintenance)'
    ],
    relevantServices: ['AI Websites'],
    relevantIndustries: ['all'],
    relevanceScore: 0.9,
    processingStatus: 'scraped'
  },

  // ========================================
  // 9. COMPETITIVE COMPARISON - YELLOW.AI
  // ========================================
  {
    type: 'competitive_comparison',
    source: 'Market Analysis 2024',
    sourceUrl: 'https://troikatech.co/compare',
    title: 'Supa Agent vs Yellow.ai: Enterprise vs SMB-Focused Solutions',
    summary: `Yellow.ai targets enterprise customers with complex multi-channel automation needs, while Supa Agent focuses on SMB affordability and ease of use. Key differentiator is pricing model: Yellow.ai uses enterprise SaaS pricing (often ₹50K-₹2L/month for meaningful usage) while Supa Agent offers transparent ₹40K setup + ₹5K/month plans suitable for small businesses. Feature parity exists for core chatbot functionality relevant to SMBs.`,
    keyTakeaways: [
      'Target market: Yellow.ai = Enterprise vs Supa Agent = SMB',
      'Pricing: Yellow.ai ₹50K-₹2L/month vs Supa Agent ₹40K setup + ₹5K/month',
      'Setup complexity: Yellow.ai requires technical integration vs Supa Agent plug-and-play',
      'Features: Yellow.ai 150+ integrations (enterprise need) vs Supa Agent core 10 (SMB need)',
      'Support: Yellow.ai global team vs Supa Agent Indian team + language support',
      'Contract: Yellow.ai annual enterprise contract vs Supa Agent monthly/quarterly flexibility',
      'ROI: Supa Agent breaks even at 5-10 leads/month vs Yellow.ai at 100+ leads/month'
    ],
    relevantServices: ['Supa Agent'],
    relevantIndustries: ['all'],
    relevanceScore: 0.88,
    processingStatus: 'scraped'
  },

  // ========================================
  // 10. INDUSTRY BENCHMARK - WEB DEVELOPMENT
  // ========================================
  {
    type: 'market_trend',
    source: 'Indian Web Development Market Report 2024',
    sourceUrl: 'https://troikatech.co/research',
    title: 'SMB Website Development: Market Benchmarks & Pain Points',
    summary: `Research across 500+ Indian SMBs reveals significant pain points in the traditional web development process: high costs (₹50K-₹2L average), long timelines (15-45 days), poor communication, hidden costs, and lack of post-launch support. 78% of SMBs delay digital presence due to cost/complexity concerns. Troika's model directly addresses these pain points with transparent pricing, 4-hour delivery, and dedicated support.`,
    keyTakeaways: [
      'Market average: ₹50K-₹2L for 5-10 page business website',
      'Delivery time: 15-45 days from contract to launch',
      'Hidden costs: 65% of clients face unexpected charges (hosting, SSL, updates)',
      'SMB pain point #1: 78% delay digital presence due to cost',
      'SMB pain point #2: 62% face communication issues with developers',
      'SMB pain point #3: 55% struggle with ongoing updates/support',
      'Troika advantage: Addresses all 3 pain points (cost, speed, support)'
    ],
    relevantServices: ['AI Websites'],
    relevantIndustries: ['all'],
    relevanceScore: 0.87,
    processingStatus: 'scraped'
  },

  // ========================================
  // 11. INDUSTRY BENCHMARK - CHATBOTS
  // ========================================
  {
    type: 'market_trend',
    source: 'AI Chatbot Market Analysis India 2024',
    sourceUrl: 'https://troikatech.co/research',
    title: 'Chatbot Market: Pricing, Adoption, and ROI Benchmarks',
    summary: `The Indian chatbot market is growing rapidly (43% YoY) but remains concentrated in enterprise segment due to high pricing. Market research shows average chatbot costs range from ₹5,000-₹25,000/month depending on features and volume. However, 82% of SMBs express interest but cite cost as barrier. Typical ROI timeline is 3-6 months for businesses receiving 50+ inquiries/month. Supa Agent's ₹40K setup + ₹5K/month entry point makes chatbots accessible to SMBs for the first time.`,
    keyTakeaways: [
      'Market growth: 43% YoY in chatbot adoption (India)',
      'Average pricing: ₹5K-₹25K/month (enterprise-focused)',
      'SMB adoption barrier: 82% interested but cost-prohibitive',
      'ROI timeline: 3-6 months for 50+ inquiries/month volume',
      'Lead capture improvement: Average 35-40% increase with chatbots',
      'Cost per lead: ₹80-₹150 with chatbot vs ₹300-₹500 manual',
      'Supa Agent positioning: ₹40K setup + ₹5K/month = 50% cheaper than market'
    ],
    relevantServices: ['Supa Agent'],
    relevantIndustries: ['all'],
    relevanceScore: 0.85,
    processingStatus: 'scraped'
  },

  // ========================================
  // 12. TROIKA TRACK RECORD
  // ========================================
  {
    type: 'troika_advantage',
    source: 'Troika Company Profile',
    sourceUrl: 'https://troikatech.co/about',
    title: 'Troika Tech: 13+ Year Track Record & Market Position',
    summary: `Troika Tech Services was founded in 2012 in Thane by Godwin Pinto, Parvati Matkate, and Mawin Pinto with a mission to democratize digital solutions for Indian SMBs. Over 13+ years, the company has served 6,000+ clients across 47+ cities in 9+ countries. Tagline: "Not Just a Vendor. Your AI Growth Partner." Mission: Empower businesses with AI websites, smart tools, and strategies that solve small problems and unlock big growth. Vision: Make AI simple, fast, and affordable — helping every brand stay ahead in a world where milliseconds matter. Key differentiator is the "AI Created, Human Perfected" philosophy: leveraging AI for efficiency while maintaining human oversight for quality.`,
    keyTakeaways: [
      'Founded: 2012 in Thane (13+ years of experience)',
      'Founders: Godwin Pinto, Parvati Matkate, Mawin Pinto',
      'Client base: 6,000+ active clients',
      'Geographic reach: 47+ cities, 9+ countries',
      'Industries served: Real Estate, Retail, E-commerce, Education, Fashion, Pharma, Healthcare, Politics, NGOs',
      'Core philosophy: AI Created, Human Perfected',
      'Tagline: Not Just a Vendor. Your AI Growth Partner.',
      'Differentiators: Simplicity Wins, Speed Matters (4 hours), AI + Human, Future-Ready',
      'Contact: +91 9821211755, info@troikatech.in, Mira Road East, Maharashtra'
    ],
    relevantServices: ['AI Websites', 'Supa Agent', 'WhatsApp Marketing', 'Video Agent', 'Calling Agent'],
    relevantIndustries: ['all'],
    relevanceScore: 0.93,
    processingStatus: 'scraped'
  },

  // ========================================
  // 13. CASE STUDY - PHARMA
  // ========================================
  {
    type: 'case_study',
    source: 'Troika Client Success Story',
    sourceUrl: 'https://troikatech.co/case-studies',
    title: 'Pharma Distributor: 4x Engagement & Faster Distributor Onboarding',
    summary: `A pharmaceutical distributor implemented Troika's AI Website to showcase their product catalog and streamline distributor onboarding. Before implementation, they relied on printed catalogs and manual inquiry handling, resulting in slow response times and limited reach. After launching the AI-powered website (delivered in 24-72 hours), engagement increased 4x as distributors and retailers could instantly access product information, pricing, and availability. The automated inquiry system significantly accelerated distributor onboarding, reducing turnaround time from weeks to days.`,
    keyTakeaways: [
      'Industry: Pharma | Result: 4x engagement + faster onboarding',
      'Delivery time: 24-72 hours',
      'AI Website: ₹25,000 + GST with product catalog, pricing, distributor inquiry forms',
      'Key benefit: 24/7 product information access for distributors/retailers',
      'Onboarding speed: Weeks → Days (automated inquiry + information system)',
      'Reach expanded: From local to pan-India distributor inquiries',
      'Eliminated: Printed catalogs, manual catalog updates, delayed responses'
    ],
    relevantServices: ['AI Websites'],
    relevantIndustries: ['pharma', 'healthcare'],
    relevanceScore: 0.89,
    processingStatus: 'scraped'
  },

  // ========================================
  // 14. CASE STUDY - FINTECH
  // ========================================
  {
    type: 'case_study',
    source: 'Troika Client Success Story',
    sourceUrl: 'https://troikatech.co/case-studies',
    title: 'Fintech Startup: 60% Increase in Signups',
    summary: `A fintech startup implemented Troika's AI Website to establish online presence and drive user signups for their financial services platform. Before implementation, they struggled with low online visibility and manual inquiry handling. After launching the SEO-optimized AI website (delivered in 24-72 hours), organic signups increased by 60% within the first quarter. The website's AI SEO capabilities improved search rankings for key financial service keywords, while integrated lead forms and Supa Agent automation streamlined the signup funnel.`,
    keyTakeaways: [
      'Industry: Fintech | Result: 60% increase in signups',
      'Delivery time: 24-72 hours',
      'AI Website: ₹25,000 + GST with AI SEO, lead forms, analytics integration',
      'SEO impact: Improved rankings for financial service keywords',
      'Conversion optimization: Automated lead forms + Supa Agent integration',
      'Timeline: 60% signup increase within first quarter',
      'Additional benefit: Reduced manual inquiry handling, improved credibility'
    ],
    relevantServices: ['AI Websites', 'Supa Agent'],
    relevantIndustries: ['fintech', 'finance'],
    relevanceScore: 0.88,
    processingStatus: 'scraped'
  },

  // ========================================
  // 15. CASE STUDY - MANUFACTURING
  // ========================================
  {
    type: 'case_study',
    source: 'Troika Client Success Story',
    sourceUrl: 'https://troikatech.co/case-studies',
    title: 'Agarbatti Manufacturer: More Distributors via AI Website + Supa Agent (Gujarati/Hindi)',
    summary: `An agarbatti (incense stick) manufacturer implemented Troika's AI Website + Supa Agent with multilingual support (Gujarati/Hindi) to expand their distributor network across India. Before implementation, they struggled to reach regional distributors due to language barriers and limited online presence. After deployment (24-72 hours), they successfully onboarded significantly more distributors as the website provided product catalogs in regional languages, and Supa Agent handled inquiries in Gujarati and Hindi 24/7. This multilingual approach unlocked previously inaccessible regional markets.`,
    keyTakeaways: [
      'Industry: Manufacturing (FMCG) | Result: Expanded distributor network',
      'Delivery time: 24-72 hours',
      'AI Website: ₹25,000 + GST with product catalog',
      'Supa Agent: ₹40,000 setup + ₹5,000/month with Gujarati/Hindi language support',
      'Key differentiator: 80+ language support (Gujarati, Hindi, regional languages)',
      'Market expansion: Unlocked regional markets previously inaccessible due to language barriers',
      '24/7 automated responses in local languages improved distributor experience',
      'Use case: Perfect example of multilingual AI for regional market expansion'
    ],
    relevantServices: ['AI Websites', 'Supa Agent'],
    relevantIndustries: ['manufacturing', 'retail', 'fmcg'],
    relevanceScore: 0.87,
    processingStatus: 'scraped'
  }
];

async function seedTroikaIntelligence() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const embeddingService = new EmbeddingService();

    // Delete existing Troika intelligence if re-seeding
    const existingCount = await MarketIntelligence.countDocuments({
      type: { $in: ['troika_advantage', 'case_study', 'objection_handler', 'competitive_comparison'] }
    });

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing Troika intelligence documents`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('🗑️  Delete and re-seed? (yes/no): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        console.log('🗑️  Deleting old documents...');
        await MarketIntelligence.deleteMany({
          type: { $in: ['troika_advantage', 'case_study', 'objection_handler', 'competitive_comparison'] }
        });
        console.log('✅ Old documents deleted\n');
      } else {
        console.log('❌ Seeding cancelled');
        process.exit(0);
      }
    }

    console.log(`📝 Seeding ${troikaIntelligenceData.length} Troika intelligence documents...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const [index, doc] of troikaIntelligenceData.entries()) {
      try {
        console.log(`Processing ${index + 1}/${troikaIntelligenceData.length}: ${doc.title.substring(0, 60)}...`);

        // Generate embedding
        const textToEmbed = `${doc.title} ${doc.summary} ${doc.keyTakeaways.join(' ')}`;
        const embedding = await embeddingService.generateEmbedding(textToEmbed);

        // Create document
        const intelligence = new MarketIntelligence({
          ...doc,
          embedding,
          processingStatus: 'embedded',
          scrapedAt: new Date()
        });

        await intelligence.save();
        successCount++;
        console.log(`  ✅ Saved and embedded\n`);

      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error: ${error.message}\n`);
      }
    }

    console.log('\n========================================');
    console.log('📊 SEEDING COMPLETE');
    console.log('========================================');
    console.log(`✅ Success: ${successCount} documents`);
    console.log(`❌ Errors: ${errorCount} documents`);
    console.log(`📈 Total: ${successCount + errorCount} processed\n`);

    // Verify counts by type
    const typeCounts = await MarketIntelligence.aggregate([
      { $match: { processingStatus: 'embedded' } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    console.log('📋 Intelligence by Type:');
    typeCounts.forEach(t => console.log(`  ${t._id}: ${t.count}`));

    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

seedTroikaIntelligence();
