const logger = require('../utils/logger');

class IndustryContextService {
  constructor() {
    // Industry-specific workflows
    this.workflows = {
      'real_estate': {
        'AI Websites': {
          dayOne: 'You provide 5-10 property listings + company logo + contact details',
          hour4: 'Website goes live with property gallery, search filters, inquiry forms, WhatsApp integration',
          hour5: 'Supa Agent activates - starts answering "Is this property available?", pricing, location queries',
          week1: 'You receive 10-15 qualified leads with name, phone, budget, property preference',
          month1: 'Typical client sees 40% more inquiries vs previous website (industry average)',
          proof: '3x more inquiries (real estate developer case study)'
        },
        'Supa Agent': {
          setup: '2-3 hours: We train Supa Agent on your property FAQs, pricing, availability',
          usage: 'Supa Agent answers property availability, pricing, location, amenities 24/7',
          impact: 'Captures 30% more leads by responding to late-night inquiries (8 PM - 8 AM)',
          metrics: '50+ property queries/day automated, agents save 12 hours/week',
          proof: 'Real estate client: 3x more inquiries with AI Website + Supa Agent'
        }
      },
      'education': {
        'Supa Agent': {
          setup: 'We train Supa Agent on admission process, course details, fees, eligibility, timings',
          usage: 'Handles student/parent inquiries about courses, admissions, fees instantly',
          impact: 'Staff saves 70% time during peak admission season',
          metrics: '100+ admission queries/day during March-June season',
          proof: 'Education institute: Inquiries doubled + 70% staff time saved'
        },
        'AI Websites': {
          dayOne: 'Provide course catalog, faculty info, admission process, fee structure',
          hour4: 'Website live with course listings, online inquiry forms, admission calendar',
          week1: 'Start receiving online admission inquiries with student details',
          month1: 'Inquiries typically double due to improved SEO and online visibility',
          proof: 'Education institute saw inquiries doubled after AI Website launch'
        }
      },
      'retail': {
        'Supa Agent': {
          setup: 'Train on product catalog, pricing, stock availability, return policy',
          usage: 'Answers product questions, checks stock, helps with orders 24/7',
          impact: 'Converts 20-25% of browsers into inquiries (vs 5-8% without)',
          metrics: 'Handles 200+ product queries/day, recommends alternatives when out-of-stock',
          proof: 'Retail client: 25% increase in online orders'
        }
      },
      'healthcare': {
        'Supa Agent': {
          setup: 'Train on services, appointment booking, doctor availability, pricing, insurance',
          usage: 'Books appointments, answers service queries, handles emergency protocol',
          impact: 'Reduces front-desk load by 50%, enables 24/7 appointment booking',
          metrics: '80+ appointment bookings/month automated',
          proof: 'Clinic: 40% more appointments booked vs phone-only system'
        }
      },
      'pharma': {
        'AI Websites': {
          setup: 'Product catalog with pricing, availability, distributor inquiry forms',
          delivery: '24-72 hours',
          impact: '4x engagement, faster distributor onboarding (weeks → days)',
          metrics: '24/7 product information access for distributors/retailers',
          proof: 'Pharma distributor: 4x engagement + faster onboarding'
        }
      },
      'manufacturing': {
        'Supa Agent': {
          setup: 'Multilingual support (80+ languages including Gujarati, Hindi)',
          usage: '24/7 distributor inquiries in regional languages',
          impact: 'Unlocks regional markets previously inaccessible due to language barriers',
          proof: 'Agarbatti manufacturer: Expanded distributor network via Gujarati/Hindi support'
        }
      },
      'fintech': {
        'AI Websites': {
          setup: 'AI SEO-optimized website with lead forms, analytics integration',
          delivery: '24-72 hours',
          impact: '60% increase in signups within first quarter',
          seo: 'Improved rankings for financial service keywords',
          proof: 'Fintech startup: 60% signup increase'
        }
      }
    };

    // Industry pain points
    this.painPoints = {
      'real_estate': [
        'Missing high-value leads due to delayed responses (agents busy showing properties)',
        '30-40% of inquiries come after business hours and go unanswered',
        'Agents spend 60% of time answering same repetitive questions',
        'No way to qualify leads before agent spends time',
        'Competing with 50+ other properties, need instant response edge'
      ],
      'education': [
        'Admission season overwhelms admin staff (100+ calls/day)',
        'Same questions asked repeatedly: fees, eligibility, timings, admission process',
        'Parents expect instant answers 24/7, get frustrated with delays',
        'Staff can\'t handle simultaneous phone calls, WhatsApp, walk-ins',
        'Manual data collection prone to errors, hard to manage'
      ],
      'retail': [
        'Customers leave website if product questions not answered immediately',
        'Staff can\'t respond to online queries while handling in-store customers',
        'Lost sales from after-hours browsing (no support available)',
        'Can\'t scale customer support during sale seasons',
        'High cart abandonment due to unanswered sizing/color/stock questions'
      ],
      'healthcare': [
        'Front desk overwhelmed with appointment booking calls',
        'Patients frustrated with busy phone lines, long hold times',
        'After-hours emergency protocol queries not handled',
        'Repetitive questions about services, pricing, doctor availability',
        'Manual appointment booking leads to scheduling conflicts'
      ],
      'pharma': [
        'Distributors need 24/7 access to product information, pricing, availability',
        'Printed catalogs outdated quickly, expensive to update',
        'Slow response times limit distributor onboarding speed',
        'Limited reach to regional distributors without digital presence',
        'Manual inquiry handling delays distributor engagement'
      ],
      'manufacturing': [
        'Language barriers prevent reaching regional distributors',
        'Limited online presence restricts market expansion',
        'Manual catalog distribution slow and expensive',
        'Delayed inquiry responses hurt competitive positioning',
        'Difficulty scaling to pan-India distribution'
      ],
      'fintech': [
        'Low online visibility limits organic user acquisition',
        'Manual inquiry handling doesn\'t scale with growth',
        'Poor SEO means missing high-intent searches',
        'Credibility concerns without professional web presence',
        'Conversion funnel leaks due to manual processes'
      ]
    };

    // Industry-specific benefits
    this.benefits = {
      'real_estate': {
        'speed': 'Launch property listings same day, capture leads immediately',
        'leads': 'Capture 30% more leads by responding to late-night inquiries',
        'efficiency': 'Agents focus on closings, not repetitive questions',
        'qualification': 'Supa Agent pre-qualifies budget, location, property type'
      },
      'education': {
        'scale': 'Handle 100+ inquiries/day without hiring more admin staff',
        'availability': 'Parents get instant answers 24/7, improving satisfaction',
        'efficiency': 'Admin focuses on actual admissions, not answering FAQs',
        'data': 'Structured lead data (name, phone, course interest) collected automatically'
      },
      'retail': {
        'conversion': 'Convert 20-25% of browsers to leads (vs 5-8% without)',
        'support': 'Scale customer support during sales without hiring',
        'sales': 'Capture after-hours browsing as leads, follow up next day',
        'satisfaction': 'Instant product answers increase customer confidence'
      },
      'healthcare': {
        'bookings': '40% more appointments booked via 24/7 online system',
        'efficiency': 'Front desk focuses on patient care, not phone duty',
        'satisfaction': 'Patients book instantly, no hold times or busy signals',
        'emergency': 'After-hours emergency protocol handled professionally'
      },
      'pharma': {
        'engagement': '4x engagement with 24/7 product information access',
        'onboarding': 'Distributor onboarding speed: Weeks → Days',
        'reach': 'Pan-India distributor inquiries vs local only',
        'efficiency': 'Eliminate printed catalogs and manual updates'
      },
      'manufacturing': {
        'market_expansion': 'Unlock regional markets with multilingual support (80+ languages)',
        'distributor_network': 'Expand distributor network without language barriers',
        'availability': '24/7 automated responses in local languages',
        'scalability': 'Scale to pan-India distribution efficiently'
      },
      'fintech': {
        'signups': '60% increase in organic signups (SEO-driven)',
        'credibility': 'Professional web presence builds trust',
        'seo': 'Improved rankings for financial service keywords',
        'automation': 'Automated lead forms + inquiry handling scale with growth'
      }
    };
  }

  /**
   * Get industry-specific workflow for a service
   */
  getWorkflow(industry, service) {
    if (!industry || !service) return null;

    const normalizedIndustry = industry.toLowerCase().replace(/\s+/g, '_');
    const workflow = this.workflows[normalizedIndustry]?.[service];

    if (workflow) {
      logger.info(`Retrieved workflow for ${normalizedIndustry} - ${service}`);
    }

    return workflow;
  }

  /**
   * Get industry pain points
   */
  getPainPoints(industry) {
    if (!industry) return [];

    const normalizedIndustry = industry.toLowerCase().replace(/\s+/g, '_');
    return this.painPoints[normalizedIndustry] || [];
  }

  /**
   * Get industry-specific benefits
   */
  getBenefits(industry) {
    if (!industry) return null;

    const normalizedIndustry = industry.toLowerCase().replace(/\s+/g, '_');
    return this.benefits[normalizedIndustry] || null;
  }

  /**
   * Detect industry from query or context
   */
  detectIndustry(query, context) {
    // First check explicit context
    if (context?.industry) {
      return context.industry;
    }

    // Try to detect from query keywords
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.match(/real estate|property|apartment|flat|builder|broker/)) {
      return 'real_estate';
    }
    if (lowerQuery.match(/education|school|college|institute|coaching|admission|student/)) {
      return 'education';
    }
    if (lowerQuery.match(/retail|shop|store|ecommerce|product|online store/)) {
      return 'retail';
    }
    if (lowerQuery.match(/healthcare|hospital|clinic|doctor|patient|appointment/)) {
      return 'healthcare';
    }
    if (lowerQuery.match(/pharma|medicine|drug|chemist|prescription|distributor/)) {
      return 'pharma';
    }
    if (lowerQuery.match(/manufacturing|factory|production|distributor|fmcg|agarbatti/)) {
      return 'manufacturing';
    }
    if (lowerQuery.match(/fintech|finance|financial|banking|investment|loan/)) {
      return 'fintech';
    }

    return null;
  }

  /**
   * Format workflow as readable text
   */
  formatWorkflow(workflow) {
    if (!workflow) return '';

    let formatted = '\n**Your Exact Workflow:**\n';
    Object.entries(workflow).forEach(([step, description]) => {
      formatted += `• **${step}:** ${description}\n`;
    });

    return formatted;
  }

  /**
   * Format pain points as readable text
   */
  formatPainPoints(painPoints) {
    if (!painPoints || painPoints.length === 0) return '';

    let formatted = '\n**Common Challenges in Your Industry:**\n';
    painPoints.slice(0, 3).forEach((point, index) => {
      formatted += `${index + 1}. ${point}\n`;
    });

    return formatted;
  }

  /**
   * Get comprehensive industry context for prompt
   */
  getIndustryContext(query, service, context) {
    const industry = this.detectIndustry(query, context);

    if (!industry) return null;

    const workflow = this.getWorkflow(industry, service);
    const painPoints = this.getPainPoints(industry);
    const benefits = this.getBenefits(industry);

    return {
      industry,
      workflow,
      painPoints,
      benefits,
      hasContext: !!(workflow || painPoints.length > 0)
    };
  }
}

module.exports = IndustryContextService;
