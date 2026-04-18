(function (root, factory) {
  var config = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  }

  if (root) {
    root.SITE_CONFIG = config;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var siteBaseUrl = 'https://thinkgreen-az.netlify.app';
  var manifestPath = '/manifest.json';
  var reviewSourceUrl = 'https://www.google.com/maps/place/Think+Green+Design+%7C+Build+Landscape/@33.61549,-111.9165894,17z/data=!3m1!4b1!4m6!3m5!1s0x872b74777c987d53:0x8acb242f61538220!8m2!3d33.6154856!4d-111.9140145!16s%2Fg%2F1vg4k7_v?entry=ttu&g_ep=EgoyMDI2MDQxNS4wIKXMDSoASAFQAw%3D%3D';

  return {
    siteBaseUrl: siteBaseUrl,
    manifestPath: manifestPath,
    businessName: 'Think Green Design | Build Landscape',
    shortName: 'Think Green',
    email: 'thinkgreen@thinkgreenaz.com',
    ownerEmail: 'thinkgreen@thinkgreenaz.com',
    phone: {
      raw: '4809229497',
      display: '(480) 922-9497'
    },
    phoneTracking: {
      default: {
        raw: '4809229497',
        display: '(480) 922-9497'
      },
      sources: {
        google: {
          raw: '4809229497',
          display: '(480) 922-9497'
        },
        gbp: {
          raw: '4809229497',
          display: '(480) 922-9497'
        },
        ads: {
          raw: '4809229497',
          display: '(480) 922-9497'
        }
      }
    },
    address: {
      line1: '7730 E. Gelding Dr. Ste 1',
      city: 'Scottsdale',
      state: 'AZ',
      zip: '85260'
    },
    serviceAreas: [
      'Scottsdale',
      'Paradise Valley',
      'Phoenix',
      'Fountain Hills',
      'Cave Creek',
      'Gilbert',
      'Tempe',
      'Mesa',
      'Chandler',
      'Glendale',
      'Peoria',
      'Ahwatukee',
      'North Phoenix'
    ],
    coreServices: [
      'Landscape Design & Build',
      'Hardscaping',
      'Outdoor Kitchens',
      'Fire Features',
      'Desert Landscaping',
      'Artificial Turf',
      'Irrigation Systems',
      'Outdoor Lighting',
      'Pergolas and Shade Structures'
    ],
    trustSignals: {
      licensed: true,
      bonded: true,
      insured: true,
      responsePromise: 'Most project requests receive a response within one business day.',
      reviewSourceLabel: 'Google Reviews',
      projectCountLabel: '150+ completed outdoor living and landscape projects shown across site proof sections',
      noFakeClaimsNote: 'Do not invent awards, years in business, rankings, or review counts when cloning this template.'
    },
    aiReadability: {
      summary: 'Think Green Design | Build Landscape is a Scottsdale-based residential landscaping and outdoor living company serving homeowners across Scottsdale, Paradise Valley, Phoenix, and nearby East Valley communities.',
      homeownerFit: 'Best fit for homeowners who want design-build planning, premium hardscape and outdoor living upgrades, desert-climate durability, and a clear consultation path.',
      consultationPath: '/free-consultation',
      priorityPages: [
        { label: 'Home', path: '/' },
        { label: 'Services', path: '/services' },
        { label: 'Landscape Design & Build', path: '/services/landscape-design' },
        { label: 'Hardscaping', path: '/services/hardscaping' },
        { label: 'Outdoor Kitchens', path: '/services/outdoor-kitchens' },
        { label: 'Desert Landscaping', path: '/services/desert-landscaping' },
        { label: 'Scottsdale Landscaping', path: '/scottsdale-landscaping' },
        { label: 'Phoenix Landscaping', path: '/phoenix-landscaping' },
        { label: 'Paradise Valley Landscaping', path: '/paradise-valley-landscaping' },
        { label: 'Portfolio', path: '/portfolio' },
        { label: 'About', path: '/about' },
        { label: 'Reviews', path: '/reviews' },
        { label: 'Process', path: '/process' },
        { label: 'Free Consultation', path: '/free-consultation' },
        { label: 'Resources', path: '/resources' }
      ]
    },
    locationPages: {
      '/scottsdale-landscaping': {
        city: 'Scottsdale',
        nearbyAreas: 'North Scottsdale, DC Ranch, McCormick Ranch, and surrounding communities',
        trustBullets: [
          'Most Scottsdale requests center on full backyard transformations, pavers, fire features, and premium lighting.',
          'Project planning usually needs HOA-aware finish coordination, clear phasing, and stronger shade strategy.',
          'Consultations focus on layout flow, finish level, and the highest-value first phase before construction starts.'
        ],
        featuredReview: {
          author: 'Sarah M.',
          projectType: 'Paver patio and fire pit',
          reviewDate: 'January 2026',
          quote: 'Fire pit and paver patio came out exactly like the render. Crew cleaned up every day and stayed on schedule.'
        }
      },
      '/phoenix-landscaping': {
        city: 'Phoenix',
        nearbyAreas: 'Arcadia, Biltmore, North Phoenix, and nearby neighborhoods',
        trustBullets: [
          'Phoenix homeowners usually need stronger outdoor living flow, water-wise planting, and heat-aware material planning.',
          'Design choices are shaped around daily usability, not just curb appeal photos.',
          'The first consultation is used to narrow scope, city fit, and the most efficient project phase.'
        ],
        featuredReview: {
          author: 'Amanda L.',
          projectType: 'Modern xeriscape design-build',
          reviewDate: 'November 2025',
          quote: 'Our Arcadia yard needed a modern xeriscape plan. The 3D concept matched the finished build almost exactly.'
        }
      },
      '/paradise-valley-landscaping': {
        city: 'Paradise Valley',
        nearbyAreas: 'Camelback-adjacent enclaves, hillside properties, and nearby luxury neighborhoods',
        trustBullets: [
          'Paradise Valley projects usually demand stronger material coordination, privacy planning, and entertaining layout clarity.',
          'Luxury scopes benefit from one design-build team instead of fragmented trades and handoffs.',
          'Consultations focus on circulation, shade, finish hierarchy, and what the property needs first.'
        ],
        featuredReview: {
          author: 'David R.',
          projectType: 'Full outdoor living remodel',
          reviewDate: 'December 2025',
          quote: 'Communication was excellent from quote to final walkthrough. We always knew what phase was next.'
        }
      },
      '/arcadia-landscaping': {
        city: 'Arcadia',
        nearbyAreas: 'Arcadia Proper, Lower Arcadia, and neighboring Phoenix pockets',
        trustBullets: [
          'Arcadia work usually centers on modernizing older yards without losing character or mature-tree value.',
          'Scope planning often combines shade, entertaining flow, irrigation cleanup, and architectural hardscape detailing.',
          'The goal is a cleaner design direction before money gets spent on disconnected upgrades.'
        ],
        featuredReview: {
          author: 'Rachel S.',
          projectType: 'Shade patio and low-water planting update',
          reviewDate: 'December 2025',
          quote: 'We wanted the Arcadia yard to feel cleaner and easier to use. The new patio layout and planting plan gave us that without losing the mature character of the property.'
        }
      },
      '/mesa-landscaping': {
        city: 'Mesa',
        nearbyAreas: 'Eastmark-adjacent communities, Red Mountain areas, and nearby East Valley neighborhoods',
        trustBullets: [
          'Mesa homeowners often want lower-maintenance backyards that still feel finished and usable for families.',
          'Popular requests combine turf strategy, hardscape cleanup, irrigation tuning, and easier circulation.',
          'Consultations help separate must-have function upgrades from later-phase visual improvements.'
        ],
        featuredReview: {
          author: 'Nicole P.',
          projectType: 'Front-yard refresh',
          reviewDate: 'September 2025',
          quote: 'The crew was professional and detail-oriented. Our front yard now looks high-end without high maintenance.'
        }
      },
      '/chandler-landscaping': {
        city: 'Chandler',
        nearbyAreas: 'Ocotillo, South Chandler, and nearby East Valley communities',
        trustBullets: [
          'Chandler projects usually focus on outdoor kitchens, patio upgrades, and cleaner entertaining zones.',
          'A strong first plan avoids mismatched appliance, patio, and shade decisions later in the build.',
          'We use consultations to map how the yard is used today and what should be phased first.'
        ],
        featuredReview: {
          author: 'Brandon K.',
          projectType: 'Covered patio and grill island upgrade',
          reviewDate: 'November 2025',
          quote: 'We needed a Chandler backyard that worked better for hosting. The patio extension and grill area feel integrated now instead of pieced together.'
        }
      },
      '/tempe-landscaping': {
        city: 'Tempe',
        nearbyAreas: 'South Tempe, Papago-adjacent neighborhoods, and nearby university-area communities',
        trustBullets: [
          'Tempe projects usually need shade, patio usability, and lower-maintenance planning without losing entertainment value.',
          'Family use, guest flow, and long-term upkeep typically matter more than one oversized feature.',
          'Consultations help narrow the best first zone so the yard improves quickly without wasted scope.'
        ],
        featuredReview: {
          author: 'Chris T.',
          projectType: 'Outdoor kitchen installation',
          reviewDate: 'October 2025',
          quote: 'Outdoor kitchen build finished faster than expected. The team was respectful and the jobsite stayed clean.'
        }
      },
      '/gilbert-landscaping': {
        city: 'Gilbert',
        nearbyAreas: 'Agritopia-adjacent neighborhoods, Val Vista areas, and nearby East Valley communities',
        trustBullets: [
          'Gilbert requests usually blend family-friendly function, irrigation efficiency, and lower-maintenance layout improvements.',
          'Backyard lighting, turf strategy, and patio flow are often more valuable than starting with decorative features alone.',
          'The first consultation helps define the strongest initial phase and the right long-term plan.'
        ],
        featuredReview: {
          author: 'Erin W.',
          projectType: 'Family backyard lighting and turf refresh',
          reviewDate: 'October 2025',
          quote: 'Our Gilbert yard needed better night use and less patchy grass. The lighting and turf plan made the whole space feel more finished for everyday family use.'
        }
      },
      '/fountain-hills-landscaping': {
        city: 'Fountain Hills',
        nearbyAreas: 'Hillside-view properties and nearby northeast Valley communities',
        trustBullets: [
          'Fountain Hills work usually needs stronger grade awareness, view preservation, and nighttime usability planning.',
          'Hardscape, lighting, and drought-smart planting need to be planned together to avoid a sparse or disjointed result.',
          'Consultations focus on slope, access, and the most important living zones first.'
        ],
        featuredReview: {
          author: 'Matt R.',
          projectType: 'Backyard remodel',
          reviewDate: 'August 2025',
          quote: 'No surprises on scope or pricing. Great coordination and the final punch list was handled quickly.'
        }
      },
      '/cave-creek-landscaping': {
        city: 'Cave Creek',
        nearbyAreas: 'Desert-lot properties and nearby north Valley communities',
        trustBullets: [
          'Cave Creek homeowners usually need shade, desert planting structure, and materials that feel intentional at larger scales.',
          'The best projects coordinate hardscape, lighting, and planting early instead of treating them as separate add-ons.',
          'Consultations help define what creates the biggest day-to-day comfort and property impact first.'
        ],
        featuredReview: {
          author: 'Dana H.',
          projectType: 'Desert patio and shade structure plan',
          reviewDate: 'September 2025',
          quote: 'The Cave Creek property needed more comfort without fighting the desert setting. The layout finally feels intentional, and the shade strategy made a huge difference.'
        }
      }
    },
    businessYears: '15+ years of Arizona residential landscape experience',
    brand: {
      logoPath: 'img/logo.png',
      primary: '#1b4332',
      primaryMid: '#2d6a4f',
      paper: '#faf7f3'
    },
    reviewSummary: {
      rating: '4.7',
      count: '43',
      source: 'Google',
      sourceUrl: reviewSourceUrl,
      snapshotDate: 'Reviewed March 8, 2026'
    },
    reviewRating: '4.7',
    reviewCount: '43',
    reviewSource: 'Google',
    reviewSourceUrl: reviewSourceUrl,
    reviewSnapshotDate: 'Reviewed March 8, 2026',
    socialProfiles: [
      {
        label: 'Yelp',
        url: 'https://www.yelp.com/biz/think-green-design-build-landscape-scottsdale',
        footerLabel: 'Yelp',
        icon: 'yelp'
      },
      {
        label: 'Instagram',
        url: '',
        footerLabel: 'Instagram',
        icon: 'instagram',
        isPlaceholder: true
      },
      {
        label: 'X',
        url: '',
        footerLabel: 'X',
        icon: 'x',
        isPlaceholder: true
      },
      {
        label: 'YouTube',
        url: '',
        footerLabel: 'YouTube',
        icon: 'youtube',
        isPlaceholder: true
      },
      {
        label: 'LinkedIn',
        url: '',
        footerLabel: 'LinkedIn',
        icon: 'linkedin',
        isPlaceholder: true
      }
    ],
    contactFormServices: [
      'Landscape Design & Build',
      'Hardscaping',
      'Artificial Turf',
      'Desert / Drought-Tolerant Design',
      'Water Feature',
      'Fire Feature / Outdoor Kitchen',
      'Outdoor Lighting',
      'Pergola / Shade Structure',
      'Irrigation',
      'Putting Green',
      'Not sure yet'
    ],
    projectFit: [
      {
        label: 'Most Requested',
        title: 'Full Landscape Design & Build',
        description: 'Best for complete yard transformations, phased construction, and master planning.',
        ctaService: 'Landscape Design & Build'
      },
      {
        label: 'Lifestyle Upgrade',
        title: 'Hardscape, Fire, and Outdoor Living',
        description: 'Great for patios, kitchens, fireplaces, pathways, and entertainment-centered layouts.',
        ctaService: 'Fire Feature / Outdoor Kitchen'
      },
      {
        label: 'Desert Smart',
        title: 'Drought-Tolerant Modernization',
        description: 'Ideal for water-wise upgrades, low-maintenance planting, and Arizona climate resilience.',
        ctaService: 'Desert / Drought-Tolerant Design'
      }
    ],
    beforeAfter: {
      beforeImage: 'img/projects/before-29.jpg',
      beforeAlt: 'Scottsdale backyard before renovation with worn grass, dated concrete, and limited shade',
      afterImage: 'img/projects/after-29.jpg',
      afterAlt: 'Scottsdale backyard after renovation with pavers, fire feature, lighting, and low-water planting',
      note: 'Drag the slider to compare a real project before and after completion.'
    },
    reviews: [
      {
        author: 'Sarah M.',
        location: 'North Scottsdale, AZ',
        rating: 5,
        projectType: 'Paver patio and fire pit',
        reviewDate: 'January 2026',
        text: 'Fire pit and paver patio came out exactly like the render. Crew cleaned up every day and stayed on schedule.'
      },
      {
        author: 'David R.',
        location: 'Paradise Valley, AZ',
        rating: 5,
        projectType: 'Full outdoor living remodel',
        reviewDate: 'December 2025',
        text: 'Communication was excellent from quote to final walkthrough. We always knew what phase was next.'
      },
      {
        author: 'Amanda L.',
        location: 'Arcadia, Phoenix',
        rating: 5,
        projectType: 'Modern xeriscape design-build',
        reviewDate: 'November 2025',
        text: 'Our Arcadia yard needed a modern xeriscape plan. The 3D concept matched the finished build almost exactly.'
      },
      {
        author: 'Chris T.',
        location: 'Tempe, AZ',
        rating: 5,
        projectType: 'Outdoor kitchen installation',
        reviewDate: 'October 2025',
        text: 'Outdoor kitchen build finished faster than expected. The team was respectful and the jobsite stayed clean.'
      },
      {
        author: 'Nicole P.',
        location: 'Mesa, AZ',
        rating: 4,
        projectType: 'Front-yard refresh',
        reviewDate: 'September 2025',
        text: 'The crew was professional and detail-oriented. A couple finishing items took a follow-up visit, but they handled it well and our front yard now looks high-end without high maintenance.'
      },
      {
        author: 'Matt R.',
        location: 'Scottsdale, AZ',
        rating: 5,
        projectType: 'Backyard remodel',
        reviewDate: 'August 2025',
        text: 'No surprises on scope or pricing. Great coordination and the final punch list was handled quickly.'
      }
    ],
    googleReviews: {
      rating: '4.7',
      count: '43',
      platform: 'Google',
      profileUrl: reviewSourceUrl,
      snapshotDate: 'Reviewed March 8, 2026'
    },
    trustAssets: {
      licenseVerifyUrl: 'https://roc.az.gov/contractor-search?combined=157201',
      bondVerifyUrl: '',
      licenseNumbers: ['157201 CR-21', '304902 B-4'],
      licensePrompt: 'Homeowners can verify Think Green Design | Build Landscape through the official Arizona ROC contractor search using the license numbers shown below.',
      bondPrompt: 'Bond and insurance documentation is provided during consultation so you can review current coverage before project start.',
      insuranceStatement: 'Current insurance and bonding documentation is available during consultation for full transparency.',
      responsePromise: 'Most new project requests receive a response within one business day, often sooner.',
      workmanshipWarranty: 'Workmanship warranty details are reviewed during handoff so scope, coverage, and maintenance expectations stay clear.',
      trustHighlights: [
        'Licensed, bonded, and insured for Arizona residential work',
        'Verified Google review snapshot shown directly on the site',
        'Local project experience across Scottsdale, Paradise Valley, Phoenix, Mesa, and Chandler'
      ]
    },
    financing: {
      enabled: true,
      copy: 'Financing options may be available for qualified projects. Ask about payment plans during your free consultation.',
      ctaLabel: 'Ask About Financing',
      ctaHref: '/free-consultation?source=financing_inquiry'
    },
    analytics: {
      ga4MeasurementId: 'G-B85D2Y2858'
    }
  };
});
