(function (root, factory) {
  var config = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  }

  if (root) {
    root.SITE_CONFIG = config;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var siteBaseUrl = 'https://thinkgreendesignbuild.com';
  var manifestPath = '/manifest.json';
  var reviewSourceUrl = 'https://www.google.com/maps/place/Think+Green+Design+%7C+Build+Landscape/@33.61549,-111.9165894,17z/data=!3m1!4b1!4m6!3m5!1s0x872b74777c987d53:0x8acb242f61538220!8m2!3d33.6154856!4d-111.9140145!16s%2Fg%2F1vg4k7_v?entry=ttu&g_ep=EgoyMDI2MDQxNS4wIKXMDSoASAFQAw%3D%3D';

  return {
    siteBaseUrl: siteBaseUrl,
    manifestPath: manifestPath,
    businessName: 'Think Green Design | Build Landscape',
    shortName: 'Think Green',
    email: 'hello@thinkgreendesignbuild.com',
    ownerEmail: 'hello@thinkgreendesignbuild.com',
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
    businessHours: {
      weekday: 'Mon–Fri: 8:00 AM – 4:00 PM',
      saturday: 'Sat: By appointment',
      sunday: 'Sun: Closed'
    },
    footer: {
      blurb: 'Premium landscape design and construction for Scottsdale, Paradise Valley, Phoenix, and nearby Valley communities.',
      note: 'Arizona licensed, bonded, and insured team',
      reviewLabel: 'Read Google reviews',
      reviewUrl: reviewSourceUrl
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
    primaryOffer: {
      label: 'Request Free Quote',
      shortLabel: 'Get Quote',
      pageTitle: 'Free Landscaping Quote',
      formTitle: 'Request a Free Landscaping Quote',
      submitLabel: 'Request My Free Quote',
      path: '/free-consultation',
      promise: 'No pressure, no obligation, and a local team member follows up within one business day.',
      customizableExamples: [
        'Free Landscaping Quote',
        'Free Turf Estimate',
        'Free Backyard Walkthrough',
        'Free Design Consultation',
        'Same-Week Estimate Request'
      ],
      cloningNote: 'Change this offer to match the landscaper sales process before launch. Keep the CTA outcome-specific and easy to understand.'
    },
    aiReadability: {
      summary: 'Think Green Design | Build Landscape is a Scottsdale-based residential landscaping and outdoor living company serving homeowners across Scottsdale, Paradise Valley, Phoenix, and nearby East Valley communities.',
      homeownerFit: 'Best fit for homeowners who want design-build planning, premium hardscape and outdoor living upgrades, desert-climate durability, and a clear quote request path.',
      quotePath: '/free-consultation',
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
        { label: 'Free Quote', path: '/free-consultation' },
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
          'Project reviews focus on layout flow, finish level, and the highest-value first phase before construction starts.'
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
          'The first project review is used to narrow scope, city fit, and the most efficient project phase.'
        ],
        featuredReview: {
          author: 'Amanda L.',
          projectType: 'Modern xeriscape design-build',
          reviewDate: 'November 2025',
          quote: 'Our Phoenix yard needed a modern xeriscape plan. The 3D concept matched the finished build almost exactly and helped us make better material choices.'
        }
      },
      '/paradise-valley-landscaping': {
        city: 'Paradise Valley',
        nearbyAreas: 'Camelback-adjacent enclaves, hillside properties, and nearby luxury neighborhoods',
        trustBullets: [
          'Paradise Valley projects usually demand stronger material coordination, privacy planning, and entertaining layout clarity.',
          'Luxury scopes benefit from one design-build team instead of fragmented trades and handoffs.',
          'Project reviews focus on circulation, shade, finish hierarchy, and what the property needs first.'
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
          quote: 'We wanted the yard to feel cleaner and easier to use. The new patio layout and planting plan gave us that without losing the mature character of the property.'
        }
      },
      '/mesa-landscaping': {
        city: 'Mesa',
        nearbyAreas: 'Eastmark-adjacent communities, Red Mountain areas, and nearby East Valley neighborhoods',
        trustBullets: [
          'Mesa homeowners often want lower-maintenance backyards that still feel finished and usable for families.',
          'Popular requests combine turf strategy, hardscape cleanup, irrigation tuning, and easier circulation.',
          'Project reviews help separate must-have function upgrades from later-phase visual improvements.'
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
          'We use project reviews to map how the yard is used today and what should be phased first.'
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
          'Project reviews help narrow the best first zone so the yard improves quickly without wasted scope.'
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
          'The first project review helps define the strongest initial phase and the right long-term plan.'
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
          'Project reviews focus on slope, access, and the most important living zones first.'
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
          'Project reviews help define what creates the biggest day-to-day comfort and property impact first.'
        ],
        featuredReview: {
          author: 'Dana H.',
          projectType: 'Desert patio and shade structure plan',
          reviewDate: 'September 2025',
          quote: 'The Cave Creek property needed more comfort without fighting the desert setting. The layout finally feels intentional, and the shade strategy made a huge difference.'
        }
      }
    },
    pageConversionGuides: {
      '/ahwatukee-landscape-design': {
        eyebrow: 'Design Quote Fit',
        title: 'Use This Page When the Yard Needs a Plan Before a Price',
        intro: 'Ahwatukee homeowners usually get the most value when the first conversation sorts layout, shade, and phasing before construction numbers are treated as final.',
        bullets: [
          'You are comparing ideas but do not yet know which backyard zone should happen first.',
          'The yard needs patios, shade, planting, lighting, or turf to feel connected instead of patched together.',
          'You want a quote path that can separate design scope from build-ready work.'
        ],
        questions: [
          'Photos of the yard from the house, patio, side gate, and any problem corners.',
          'A rough must-have list, even if the finish style is still undecided.',
          'Any HOA, drainage, access, or timing constraints that could affect build sequencing.'
        ],
        nextSteps: [
          'Whether the first step is a design plan, a focused quote, or a phased project roadmap.',
          'Which features should be priced now and which should stay in a later phase.',
          'What information is still needed before a realistic construction range can be given.'
        ],
        ctaHref: '/free-consultation?city=Ahwatukee&service=landscape-design&source=conversion_guide&autostart=1'
      },
      '/chandler-landscaping': {
        eyebrow: 'Chandler Quote Fit',
        title: 'Make the First Quote About the Backyard You Actually Use',
        intro: 'For Chandler yards, the strongest first quote usually connects entertaining space, shade, kitchen or grill plans, and everyday maintenance instead of pricing one isolated feature.',
        bullets: [
          'You want a patio, outdoor kitchen, turf, or lighting plan that works together.',
          'The yard is usable now but feels unfinished, hot, or awkward for hosting.',
          'You need help deciding whether the first phase should be hardscape, shade, or utilities.'
        ],
        questions: [
          'How many people the yard needs to handle on a normal weekend.',
          'Whether gas, electric, water, or drainage already exists near the project area.',
          'Which part of the yard feels most annoying or underused today.'
        ],
        nextSteps: [
          'A clear first-phase recommendation for the highest-use area.',
          'Whether kitchen, patio, shade, or lighting decisions should be bundled.',
          'Budget direction before appliance or finish choices create false expectations.'
        ],
        ctaHref: '/free-consultation?city=Chandler&source=conversion_guide&autostart=1'
      },
      '/mesa-landscaping': {
        eyebrow: 'Mesa Quote Fit',
        title: 'Start With the Practical Upgrade That Changes Daily Use',
        intro: 'Mesa projects often convert from scattered maintenance problems into cleaner family-use spaces. The quote should identify the most useful first phase before chasing every cosmetic idea.',
        bullets: [
          'You want lower maintenance without making the yard feel empty.',
          'Turf, pavers, irrigation, or lighting all touch the same area.',
          'You need a budget-conscious first phase that still supports a long-term plan.'
        ],
        questions: [
          'Which areas get used by kids, pets, guests, or no one at all.',
          'Current irrigation, drainage, grass, rock, or concrete problems.',
          'The rough budget range you are comfortable exploring first.'
        ],
        nextSteps: [
          'Whether turf, pavers, irrigation, or planting should lead the scope.',
          'Which items are must-fix function problems versus later visual upgrades.',
          'How to phase work without rebuilding the same area twice.'
        ],
        ctaHref: '/free-consultation?city=Mesa&source=conversion_guide&autostart=1'
      },
      '/glendale-hardscaping': {
        eyebrow: 'Hardscape Quote Fit',
        title: 'Price the Patio Around Use, Drainage, and Edge Details',
        intro: 'A useful hardscape quote should do more than name a square-foot price. It should clarify base prep, drainage, access, borders, steps, and how the new surface meets the rest of the yard.',
        bullets: [
          'You are comparing pavers, concrete, or patio expansion options.',
          'The current patio is too small, cracked, poorly drained, or disconnected from seating areas.',
          'You want a durable layout that supports shade, fire, lighting, or kitchen upgrades later.'
        ],
        questions: [
          'Approximate patio size and whether demolition is needed.',
          'Photos showing slope, gates, existing concrete, steps, and drainage trouble spots.',
          'Whether the patio needs to support furniture, cooking, fire, or a future cover.'
        ],
        nextSteps: [
          'A realistic hardscape range based on prep and finish level.',
          'Which details affect durability: base depth, edge restraint, drainage, and transitions.',
          'Whether the project should include lighting, seating walls, or future utility planning.'
        ],
        ctaHref: '/free-consultation?city=Glendale&service=hardscaping&source=conversion_guide&autostart=1'
      },
      '/north-phoenix-outdoor-lighting': {
        eyebrow: 'Lighting Quote Fit',
        title: 'Quote Lighting Around Safety, Curb Appeal, and Night Use',
        intro: 'Good lighting is not just fixture count. The first quote should separate path safety, accent lighting, patio comfort, wiring access, and the zones that matter after sunset.',
        bullets: [
          'The yard looks unfinished or unsafe at night.',
          'You want path, patio, tree, wall, or architecture lighting to feel coordinated.',
          'Existing lighting is dim, random, over-bright, or hard to maintain.'
        ],
        questions: [
          'Night photos or a short list of areas that feel too dark.',
          'Whether existing low-voltage wiring, transformer, or timers are already installed.',
          'Which zones matter most: entry, path, patio, pool-adjacent area, or feature plants.'
        ],
        nextSteps: [
          'Which fixtures and zones should be included in the first phase.',
          'Whether wiring access or transformer capacity affects price.',
          'How lighting can support future planting, patio, or hardscape upgrades.'
        ],
        ctaHref: '/free-consultation?city=North%20Phoenix&service=outdoor-lighting&source=conversion_guide&autostart=1'
      },
      '/outdoor-kitchen-planning-arizona': {
        eyebrow: 'Kitchen Quote Fit',
        title: 'Avoid Pricing an Outdoor Kitchen Before the Layout Works',
        intro: 'Outdoor kitchen quotes vary fast because utility routing, shade, counters, appliances, and seating flow all change the scope. This page should help narrow the right first conversation.',
        bullets: [
          'You know you want a grill area but not the exact layout or appliance package.',
          'The kitchen needs to connect to shade, seating, patio traffic, or a pool area.',
          'You want to avoid buying appliances before the build plan is clear.'
        ],
        questions: [
          'Preferred cooking style: quick grilling, hosting, prep space, bar seating, or full kitchen.',
          'Photos of nearby utilities, patio surface, shade, and access path.',
          'Appliance must-haves versus nice-to-haves.'
        ],
        nextSteps: [
          'Whether the first quote should include utilities, shade, patio changes, or just the kitchen island.',
          'Which appliance and counter choices drive the budget most.',
          'Whether the kitchen should be phased with hardscape, lighting, or fire features.'
        ],
        ctaHref: '/free-consultation?service=outdoor-kitchens&source=conversion_guide&autostart=1'
      },
      '/pavers-vs-concrete-arizona': {
        eyebrow: 'Material Quote Fit',
        title: 'Choose the Surface After You Understand the Tradeoffs',
        intro: 'This comparison should lead to a better quote conversation: not just pavers versus concrete, but how each option handles cracking, repair, drainage, heat, and the finish level of the yard.',
        bullets: [
          'You are replacing or expanding a patio, walkway, driveway edge, or gathering area.',
          'You care about repair flexibility, premium finish, or long-term appearance.',
          'You need to understand whether concrete savings are worth the visual and repair tradeoffs.'
        ],
        questions: [
          'Photos of the existing surface, edges, cracks, grade, and nearby walls or steps.',
          'Approximate square footage and how the area will be used.',
          'Whether the surface needs to tie into fire, seating, lighting, kitchen, or planting zones.'
        ],
        nextSteps: [
          'A recommendation based on use, finish expectations, and repair tolerance.',
          'Which prep items matter before any square-foot price is meaningful.',
          'Whether the patio should be quoted alone or with surrounding outdoor-living features.'
        ],
        ctaHref: '/free-consultation?service=hardscaping&source=conversion_guide&autostart=1'
      },
      '/peoria-artificial-turf': {
        eyebrow: 'Turf Quote Fit',
        title: 'Make the Turf Quote About Prep, Drainage, and Real Use',
        intro: 'Artificial turf pricing depends on more than square footage. A useful quote should account for base prep, edges, drainage, heat exposure, pets, play, and how turf meets hardscape.',
        bullets: [
          'You want a cleaner lawn look without constant watering or patch repair.',
          'The area needs to work for pets, kids, curb appeal, or a small putting/play zone.',
          'You care about installation quality instead of just the cheapest turf roll.'
        ],
        questions: [
          'Approximate turf area and whether old grass, rock, concrete, or irrigation must be removed.',
          'How the turf will be used: pets, kids, front-yard curb appeal, putting, or low-maintenance green.',
          'Photos showing edges, slopes, drainage, and adjacent pavers or planting.'
        ],
        nextSteps: [
          'A range based on prep, product, drainage, and edge complexity.',
          'Whether heat exposure or pet use changes the turf recommendation.',
          'How turf should connect to pavers, rock, lighting, or planting beds.'
        ],
        ctaHref: '/free-consultation?city=Peoria&service=artificial-turf&source=conversion_guide&autostart=1'
      },
      '/xeriscape-vs-turf-arizona': {
        eyebrow: 'Yard Strategy Fit',
        title: 'Choose the Yard Strategy Before Choosing Materials',
        intro: 'The right answer is not always turf or xeriscape. The better quote conversation starts with water use, maintenance tolerance, shade, pets, curb appeal, and how the family actually uses the yard.',
        bullets: [
          'You are deciding between lower-water planting, artificial turf, or a mixed layout.',
          'The current yard feels too hot, too thirsty, too bare, or too much work.',
          'You want a plan that looks intentional instead of just replacing grass with rock.'
        ],
        questions: [
          'Where the yard needs green softness versus where it can be lower-water planting.',
          'Pet, kid, HOA, shade, and maintenance requirements.',
          'Current irrigation condition and whether grass removal or grading is needed.'
        ],
        nextSteps: [
          'Whether turf, xeriscape, or a hybrid plan fits the actual use case.',
          'Which irrigation and soil-prep changes belong in the first quote.',
          'How to phase the project if front yard and backyard priorities differ.'
        ],
        ctaHref: '/free-consultation?service=desert-landscaping&source=conversion_guide&autostart=1'
      },
      '/landscaping-cost-scottsdale': {
        eyebrow: 'Budget Quote Fit',
        title: 'Turn a Rough Budget Into a Scope You Can Compare',
        intro: 'The cost guide should help homeowners avoid fake precision. A quote is most useful when budget, finish level, site conditions, and the first phase are all discussed together.',
        bullets: [
          'You have a rough budget but are not sure what it realistically buys.',
          'The project includes several possible scopes: patio, turf, planting, kitchen, lighting, or shade.',
          'You want to compare options without getting trapped by a vague low estimate.'
        ],
        questions: [
          'A comfortable budget range and the absolute must-have outcome.',
          'Photos and rough measurements for the highest-priority area.',
          'Whether you want the full yard priced or the strongest first phase priced first.'
        ],
        nextSteps: [
          'A realistic scope range instead of a misleading single number.',
          'Which features should be included, phased, or removed to match the budget.',
          'What site conditions could change pricing after an on-site review.'
        ],
        ctaHref: '/free-consultation?source=cost_guide_conversion&autostart=1'
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
      snapshotDate: 'Last updated April 2026'
    },
    reviewRating: '4.7',
    reviewCount: '43',
    reviewSource: 'Google',
    reviewSourceUrl: reviewSourceUrl,
    reviewSnapshotDate: 'Last updated April 2026',
    socialProfiles: [
      {
        label: 'Yelp',
        url: 'https://www.yelp.com/biz/think-green-design-build-landscape-scottsdale',
        footerLabel: 'Yelp',
        icon: 'yelp'
      },
      {
        label: 'Facebook',
        url: 'https://www.facebook.com/p/Think-Green-Design-Build-Landscape-61574951487842/',
        footerLabel: 'Facebook',
        icon: 'facebook'
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
      },
      {
        author: 'Jennifer K.',
        location: 'North Scottsdale, AZ',
        rating: 5,
        projectType: 'Pergola and outdoor lounge',
        reviewDate: 'March 2026',
        text: 'We got three bids and Think Green was the only team that walked us through material trade-offs before quoting. The pergola looks exactly how we envisioned it and holds up in the summer heat.'
      },
      {
        author: 'Brian W.',
        location: 'Chandler, AZ',
        rating: 5,
        projectType: 'Full backyard hardscape',
        reviewDate: 'February 2026',
        text: 'Drainage was a problem our previous landscaper ignored. Think Green fixed it properly before laying any pavers. The patio has been perfect through two rain seasons.'
      },
      {
        author: 'Melissa G.',
        location: 'Paradise Valley, AZ',
        rating: 5,
        projectType: 'Outdoor kitchen and fire feature',
        reviewDate: 'January 2026',
        text: 'The design process was thorough — we did two rounds of revisions on the layout before anything was built. Final result was worth every conversation. Our backyard is now the centerpiece of every dinner party.'
      },
      {
        author: 'Tom H.',
        location: 'Cave Creek, AZ',
        rating: 5,
        projectType: 'Desert landscaping and lighting',
        reviewDate: 'December 2025',
        text: 'We wanted desert-appropriate planting that still felt intentional and not just rocks and gravel. Think Green delivered a layered design that looks incredible at night with the lighting they installed.'
      },
      {
        author: 'Rachel S.',
        location: 'Gilbert, AZ',
        rating: 5,
        projectType: 'Turf and paver patio',
        reviewDate: 'November 2025',
        text: 'Kids needed a yard they could actually use. Turf went in perfectly, no seams visible, and the patio feels like an extension of our living room. Timeline was accurate and crew was great.'
      },
      {
        author: 'Kevin L.',
        location: 'Scottsdale, AZ',
        rating: 5,
        projectType: 'Irrigation system overhaul',
        reviewDate: 'October 2025',
        text: 'Our water bill was out of control. Think Green redesigned the entire drip and spray system, zoned it properly, and we saw the difference in the first billing cycle. Highly recommend for efficiency work.'
      },
      {
        author: 'Andrea M.',
        location: 'Fountain Hills, AZ',
        rating: 5,
        projectType: 'Resort-style pool surrounds',
        reviewDate: 'September 2025',
        text: 'We have views and wanted the landscaping to frame them, not block them. The design team understood immediately. Travertine, desert plants, and a fire table — exactly what this lot needed.'
      },
      {
        author: 'James P.',
        location: 'Phoenix, AZ',
        rating: 5,
        projectType: 'Xeriscape conversion',
        reviewDate: 'August 2025',
        text: 'Converted from grass to full xeriscape. Think Green handled the HOA paperwork, the removal, and the new install in one coordinated scope. Zero headaches from our end.'
      },
      {
        author: 'Stephanie B.',
        location: 'Scottsdale, AZ',
        rating: 5,
        projectType: 'Backyard entertainment zone',
        reviewDate: 'July 2025',
        text: 'The 3D rendering they provided before breaking ground made every decision easy. We knew exactly what we were getting. The finished yard matched it detail for detail.'
      },
      {
        author: 'Carlos V.',
        location: 'Tempe, AZ',
        rating: 5,
        projectType: 'Front and back yard design-build',
        reviewDate: 'June 2025',
        text: 'Think Green handled curb appeal and the backyard in one project. Neighbors have asked for their number twice since we finished. Communication through the whole build was excellent.'
      },
      {
        author: 'Patricia N.',
        location: 'Mesa, AZ',
        rating: 4,
        projectType: 'Hardscape and planting refresh',
        reviewDate: 'May 2025',
        text: 'The project came in on budget and on schedule. There was one plant substitution mid-build due to availability but they communicated it quickly and the replacement looked just as good.'
      },
      {
        author: 'Derek O.',
        location: 'Paradise Valley, AZ',
        rating: 5,
        projectType: 'Full estate landscape overhaul',
        reviewDate: 'April 2025',
        text: 'Large project across the front, side yard, and full back. Took about six weeks total and was managed tightly. The site was always clean, updates were consistent, and the end result is exceptional.'
      },
      {
        author: 'Laura C.',
        location: 'North Scottsdale, AZ',
        rating: 5,
        projectType: 'Outdoor lighting design',
        reviewDate: 'March 2025',
        text: 'We had landscape lighting installed before but it always felt random. Think Green designed a full path-and-accent system that actually highlights what we have out there. Night photos do not do it justice.'
      },
      {
        author: 'Mike F.',
        location: 'Ahwatukee, AZ',
        rating: 5,
        projectType: 'Shade structure and patio pavers',
        reviewDate: 'February 2025',
        text: 'Had a pergola quote from two other companies that felt generic. Think Green came in with a structure that actually fit the roofline of the house. Solid craftsmanship and the follow-up warranty call was a nice touch.'
      }
    ],
    googleReviews: {
      rating: '4.7',
      count: '43',
      platform: 'Google',
      profileUrl: reviewSourceUrl,
      snapshotDate: 'Last updated April 2026'
    },
    trustAssets: {
      licenseVerifyUrl: 'https://roc.az.gov/contractor-search?combined=157201',
      bondVerifyUrl: '',
      licenseNumbers: ['157201 CR-21', '304902 B-4'],
      licensePrompt: 'Homeowners can verify Think Green Design | Build Landscape through the official Arizona ROC contractor search using the license numbers shown below.',
      bondPrompt: 'Bond and insurance documentation is provided during project review so you can review current coverage before project start.',
      insuranceStatement: 'Current insurance and bonding documentation is available during project review for full transparency.',
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
      copy: 'Financing options may be available for qualified projects. Ask about payment plans during your free quote.',
      ctaLabel: 'Ask About Financing',
      ctaHref: '/free-consultation?source=financing_inquiry'
    },
    analytics: {
      ga4MeasurementId: 'G-B85D2Y2858'
    }
  };
});
