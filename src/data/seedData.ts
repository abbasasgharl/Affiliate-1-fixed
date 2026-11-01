import type {
  AffiliateProgram,
  ClickRecord,
  AdminUser,
  NotificationSettings,
  NotificationLog,
  UserReview,
  ContactMessage
} from '../types.ts';

export const INITIAL_ADMIN_USERS: AdminUser[] = [
  {
    id: 'usr_super_1',
    email: 'admin@example.com',
    name: 'Owner',
    role: 'super_admin',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    last_login: new Date().toISOString()
  },
  {
    id: 'usr_editor_1',
    email: 'editor@affiliateos.io',
    name: 'Sarah Chen',
    role: 'editor',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    last_login: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];

export const INITIAL_PROGRAMS: AffiliateProgram[] = [
  {
    id: 'prog_nexcess',
    name: 'Nexcess Managed Hosting',
    category: 'Hosting & Cloud',
    logo_url: 'https://www.google.com/s2/favicons?domain=nexcess.net&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://nexcess.partnerlinks.io/4vrh52x6mmhd',
    cloaked_slug: 'nexcess',
    referral_perk: 'Special Deal: Up to 55% Off Managed WordPress & WooCommerce + Free Migrations',
    cta_label: 'Claim 55% Off Nexcess Deal',
    ai_generated_pick: "Top Cloud Host ★ 4.9/5 — Enterprise-grade auto-scaling WordPress & WooCommerce hosting with built-in CDN & staging",
    ai_description: 'High-performance managed cloud hosting built on Liquid Web infrastructure. Engineered for speed with automated plugin testing, built-in edge CDN, and unlimited email accounts.',
    ai_brief: 'Nexcess is the gold standard for managed WordPress, WooCommerce, and Magento hosting. Unlike budget shared hosts that crash during traffic surges, Nexcess includes automatic concurrency scaling, Redis caching, and automated nightly backups so your site never goes down.',
    commission_type: 'flat',
    commission_value: '$150 Bounty Per Customer',
    cookie_duration_days: 90,
    average_payout: '$150/sale',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 152,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Auto-scaling architecture absorbs traffic surges without downtime or extra fees',
      'Visual plugin regression testing and 1-click staging environments',
      'Free white-glove site migrations, free SSL, and 24/7/365 WordPress expert support'
    ],
    target_audience: 'WordPress site owners, WooCommerce store merchants, agencies, and web developers',
    tags: ['Hosting', 'WordPress', 'WooCommerce', 'Cloud', 'E-Commerce'],
    featured: true,
    date_added: '2026-10-01T12:00:00.000Z'
  },
  {
    id: 'prog_plesk',
    name: 'Plesk WebOps & Server Platform',
    category: 'Hosting & Cloud',
    logo_url: 'https://www.google.com/s2/favicons?domain=plesk.com&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://try.plesk.com/o6zei4h4u2bm',
    cloaked_slug: 'plesk',
    referral_perk: 'Special Deal: Save 8% Off Yearly Licenses + Free Trial',
    cta_label: 'Claim 8% Off Plesk Deal',
    ai_generated_pick: "Editor's Choice ★ 4.9/5 — The industry-standard WebOps control panel powering 380,000+ servers worldwide",
    ai_description: 'Compare Plesk hosting & server management plans and find the best fit for your needs. Automated WordPress Toolkit, security patching, Docker, and multi-cloud VPS management.',
    ai_brief: 'Plesk is the undisputed leading WebOps hosting platform for sysadmins, agencies, and web developers. It automates security hardening, server monitoring, DNS, and staging environments, making server orchestration effortless.',
    commission_type: 'recurring',
    commission_value: '20% Recurring Share',
    cookie_duration_days: 90,
    average_payout: '$80 - $240/license',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 140,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Comprehensive WebOps control panel for Linux & Windows servers',
      'Automated WordPress Toolkit with 1-click cloning, staging, and mass-updates',
      'Integrated security advisor, automated SSL issuance, and complete Docker support'
    ],
    target_audience: 'Web developers, digital agencies, sysadmins, and hosting providers',
    tags: ['Hosting', 'Plesk', 'Server', 'WebOps', 'Cloud', 'WordPress'],
    featured: true,
    date_added: '2026-10-01T12:15:00.000Z'
  },
  {
    id: 'prog_cursor_ai',
    name: 'Cursor AI',
    category: 'AI Tools',
    logo_url: 'https://www.google.com/s2/favicons?domain=cursor.com&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://cursor.com/?ref=affiliateos_vip',
    cloaked_slug: 'cursor',
    referral_perk: 'Free Pro Trial • 2 Weeks Unlimited Claude 3.5 Sonnet',
    cta_label: 'Try Cursor Free',
    ai_generated_pick: "Editor's Choice ★ 4.9/5 — The unrivaled AI code editor turning devs into 10x builders",
    ai_description: 'An intelligent VS Code fork powered by Claude 3.5 Sonnet and custom indexing. Autocompletes multi-file diffs and predicts your next edit with surgical precision.',
    ai_brief: 'Cursor is the premier AI-first code editor used by engineers at Stripe, OpenAI, and mid-market SaaS companies. For affiliates, developer tooling has explosive word-of-mouth conversion and exceptional 12-month retention rates.',
    commission_type: 'recurring',
    commission_value: '25% Recurring (1 Year)',
    cookie_duration_days: 60,
    average_payout: '$60 - $180/user',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 184,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Multi-line and whole-repo semantic codebase indexing',
      'Supports Claude 3.5 Sonnet, GPT-4o, and local models',
      'Fast keyboard shortcuts and seamless VS Code migration'
    ],
    target_audience: 'Software engineers, CTOs, technical founders, and coding students',
    tags: ['AI', 'Developer Tools', 'SaaS', 'Productivity'],
    featured: true,
    date_added: '2026-09-12T10:00:00.000Z'
  },
  {
    id: 'prog_notion',
    name: 'Notion Plus & AI',
    category: 'Productivity',
    logo_url: 'https://www.google.com/s2/favicons?domain=notion.so&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://affiliate.notion.so/track?partner=affiliateos',
    cloaked_slug: 'notion',
    referral_perk: 'Free Unlimited Workspace + $20 AI Writing Credits',
    cta_label: 'Start Notion Free',
    ai_generated_pick: 'Top Pick ★ 4.8/5 — The all-in-one connected workspace powering 30M+ teams worldwide',
    ai_description: 'Seamlessly merges docs, wikis, project management, and generative AI into one customizable interface. High conversion from free tiers into paid Plus and Business plans.',
    ai_brief: 'Notion offers one of the most recognizable brands in productivity software. With native AI add-ons and enterprise expansion, affiliate referrals frequently upgrade to high-tier multi-seat annual subscriptions.',
    commission_type: 'recurring',
    commission_value: '50% of 1st Year Payments',
    cookie_duration_days: 90,
    average_payout: '$120/seat',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 142,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Industry-standard productivity platform with 35M+ users',
      'Generous free tier with instant collaboration',
      'Powerful AI assistant built into every doc and database'
    ],
    target_audience: 'Project managers, remote teams, startup operators, creators',
    tags: ['Workspace', 'Collaboration', 'Productivity', 'Notes'],
    featured: true,
    date_added: '2026-09-15T14:20:00.000Z'
  },
  {
    id: 'prog_semrush',
    name: 'Semrush Pro',
    category: 'Marketing',
    logo_url: 'https://www.google.com/s2/favicons?domain=semrush.com&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://www.semrush.com/partner/?utm_source=affiliateos_hub',
    cloaked_slug: 'semrush',
    referral_perk: 'Exclusive 14-Day Free Pro Trial ($139.95 Value)',
    cta_label: 'Claim Free Semrush Trial',
    ai_generated_pick: 'Gold Tier ★ 4.7/5 — The undisputed enterprise benchmark for SEO, keyword intel, and PPC tracking',
    ai_description: 'Comprehensive digital marketing intelligence suite featuring 25 billion keywords and backlink auditing. Generous trial sign-up bonus.',
    ai_brief: 'Semrush is an affiliate heavyweight. With high-ticket pricing ($139.95 to $499.95/month), affiliates earn strong payouts while users get access to the most authoritative SEO keyword database.',
    commission_type: 'flat',
    commission_value: '$200 Flat + $10 Trial',
    cookie_duration_days: 120,
    average_payout: '$200/subscription',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 210,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Access to 25+ billion verified keywords and competitor analytics',
      'Instant backlink audit and technical site health checks',
      'Exclusive 14-day extended free trial for referred users'
    ],
    target_audience: 'Digital marketers, SEO specialists, agency owners, content creators',
    tags: ['SEO', 'Marketing', 'Analytics', 'Enterprise'],
    featured: true,
    date_added: '2026-09-18T08:15:00.000Z'
  },
  {
    id: 'prog_shopify',
    name: 'Shopify Plus',
    category: 'E-Commerce',
    logo_url: 'https://www.google.com/s2/favicons?domain=shopify.com&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1556742049-0a67e557224f?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://shopify.pxf.io/c/affiliateos_partner',
    cloaked_slug: 'shopify',
    referral_perk: 'Launch for $1/Month for Your First 3 Months',
    cta_label: 'Claim $1 Shopify Deal',
    ai_generated_pick: 'Powerhouse ★ 4.8/5 — The gold standard commerce engine powering billions in online retail',
    ai_description: 'Complete e-commerce infrastructure supporting everything from weekend dropshippers to Fortune 500 retail giants.',
    ai_brief: 'Shopify is synonymous with modern digital commerce. Its $150 flat bounty for paid store plans converts reliably across entrepreneurship, dropshipping, and brand-building content.',
    commission_type: 'flat',
    commission_value: '$150 Flat Bounty',
    cookie_duration_days: 30,
    average_payout: '$150/merchant',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 165,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Special $1/month introductory deal for referred merchants',
      'Thousands of high-converting storefront templates & checkout apps',
      'Reliable payment gateways and built-in order management'
    ],
    target_audience: 'Online store founders, DTC entrepreneurs, boutique retailers',
    tags: ['E-Commerce', 'Retail', 'Payments', 'SaaS'],
    featured: false,
    date_added: '2026-09-20T11:45:00.000Z'
  },
  {
    id: 'prog_supabase',
    name: 'Supabase Pro',
    category: 'SaaS & Dev',
    logo_url: 'https://www.google.com/s2/favicons?domain=supabase.com&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://supabase.com/pricing?ref=affiliateos_dev',
    cloaked_slug: 'supabase',
    referral_perk: 'Free Tier with 2 Full Postgres Databases + $25 Cloud Credit',
    cta_label: 'Launch Supabase Free',
    ai_generated_pick: "Dev Darling ★ 4.9/5 — The open-source Firebase alternative engineers actually love using",
    ai_description: 'Instant Postgres database with realtime subscriptions, row level security, auth, edge functions, and vector embeddings for AI apps.',
    ai_brief: 'Supabase has achieved near-universal developer acclaim. With developer teams rapidly building AI wrappers and SaaS products, promoting Supabase Pro plans brings steady high-LTV revenue share.',
    commission_type: 'recurring',
    commission_value: '20% Recurring (Lifetime)',
    cookie_duration_days: 60,
    average_payout: '$45 - $300/mo',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 195,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Dedicated Postgres database with built-in pgvector for LLMs',
      'Zero vendor lock-in with open-source foundation',
      'Instant Auth, Storage, Edge Functions, and Realtime sync'
    ],
    target_audience: 'Full-stack developers, indie hackers, AI engineers',
    tags: ['PostgreSQL', 'Developer Tools', 'Database', 'Open Source'],
    featured: false,
    date_added: '2026-09-28T09:30:00.000Z'
  },
  {
    id: 'prog_elevenlabs',
    name: 'ElevenLabs Voice AI',
    category: 'AI Tools',
    logo_url: 'https://www.google.com/s2/favicons?domain=elevenlabs.io&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://elevenlabs.io/?ref=affiliateos_audio',
    cloaked_slug: 'elevenlabs',
    referral_perk: '10,000 Free Voice Characters Generated Monthly',
    cta_label: 'Generate Voice Free',
    ai_generated_pick: 'Audio Leader ★ 4.9/5 — Hyper-realistic voice synthesis and voice cloning for media production',
    ai_description: 'Industry-leading neural speech generation supporting 32 languages with emotional inflection. Unbeatable audio fidelity for audiobooks, dubbing, and video voiceovers.',
    ai_brief: 'ElevenLabs has dominated generative audio. Content creators, video editors, and game developers love their realistic pacing. Conversion rates are high from their interactive free tier.',
    commission_type: 'recurring',
    commission_value: '22% Recurring (1 Year)',
    cookie_duration_days: 45,
    average_payout: '$35 - $110/mo',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 220,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Unmatched voice cloning accuracy and low-latency API',
      'Studio quality text-to-speech with natural human breaths and pauses',
      'Generous free monthly character quota for new accounts'
    ],
    target_audience: 'Podcasters, YouTubers, video producers, game developers',
    tags: ['AI', 'Voice', 'Audio', 'Content Creation'],
    featured: false,
    date_added: '2026-09-30T16:10:00.000Z'
  },
  {
    id: 'prog_crypto_ledger',
    name: 'Ledger Nano X Hardware Wallet',
    category: 'Finance & Crypto',
    logo_url: 'https://www.google.com/s2/favicons?domain=ledger.com&sz=128',
    banner_url: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=800&auto=format&fit=crop&q=80',
    original_link: 'https://shop.ledger.com/?r=affiliateos_partner_crypto',
    cloaked_slug: 'ledger',
    referral_perk: 'Free Secure Shipping + $10 Bitcoin Voucher On Orders',
    cta_label: 'Get Ledger Hardware',
    ai_generated_pick: 'Security Benchmark ★ 4.6/5 — The industry flagship offline crypto vault with Bluetooth & iOS support',
    ai_description: 'Military-grade secure element chip protecting private keys for 5,500+ digital assets and Web3 tokens. Direct 10% commission paid in Bitcoin or EUR.',
    ai_brief: 'Hardware wallets see massive surge whenever crypto volatility spikes. Ledger is the recognized household brand with top-tier physical manufacturing and high-ticket accessory bundles.',
    commission_type: 'percentage',
    commission_value: '10% Per Hardware Sale',
    cookie_duration_days: 30,
    average_payout: '$18 - $40/unit',
    status: 'active',
    health_status: 'healthy',
    last_http_code: 200,
    last_response_time_ms: 250,
    last_checked: new Date().toISOString(),
    key_selling_points: [
      'Certified Secure Element (CC EAL5+) military-grade chip',
      'Bluetooth connectivity to manage assets via iPhone & Android',
      'Protects NFTs, tokens, and major cryptocurrencies offline'
    ],
    target_audience: 'Crypto investors, Web3 developers, privacy advocates',
    tags: ['Hardware', 'Crypto', 'Security', 'Finance'],
    featured: false,
    date_added: '2026-09-22T13:00:00.000Z'
  }
];

export const INITIAL_NOTIFICATION_SETTINGS: NotificationSettings = {
  enable_email: true,
  alert_email: 'admin@example.com',
  enable_telegram: true,
  telegram_bot_token: '',
  telegram_chat_id: '@affiliateos_alerts_vip',
  enable_webhook: true,
  webhook_url: 'https://api.affiliateos.io/hooks/clicks/live',
  rate_limit_mode: 'instant',
  min_clicks_threshold: 1,
  alert_on_broken_link: true
};

export const generateInitialClicks = (): ClickRecord[] => {
  const referrers = [
    { url: 'https://google.com/search?q=best+ai+code+editors', domain: 'google.com' },
    { url: 'https://twitter.com/dev_influencer/status/982173', domain: 'x.com' },
    { url: 'https://reddit.com/r/webdev/comments/cursor_review', domain: 'reddit.com' },
    { url: 'https://news.ycombinator.com/item?id=389128', domain: 'news.ycombinator.com' },
    { url: 'https://youtube.com/watch?v=cursor_tutorial', domain: 'youtube.com' },
    { url: 'https://linkedin.com/feed/update/saas_picks', domain: 'linkedin.com' },
    { url: 'https://affiliateos-newsletter.beehiiv.com/p/top-tools', domain: 'newsletter' },
    { url: 'direct', domain: 'direct' }
  ];

  const devices: ('desktop' | 'mobile' | 'tablet')[] = ['desktop', 'desktop', 'desktop', 'mobile', 'mobile', 'tablet'];
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  ];

  const activePrograms = INITIAL_PROGRAMS.filter(p => p.status === 'active');
  const clicks: ClickRecord[] = [];
  const now = Date.now();

  for (let i = 0; i < 165; i++) {
    const hoursAgo = Math.floor(Math.random() * (24 * 7));
    const timestamp = new Date(now - hoursAgo * 3600000 - Math.random() * 3600000).toISOString();
    const prog = activePrograms[Math.floor(Math.random() * activePrograms.length)];
    const ref = referrers[Math.floor(Math.random() * referrers.length)];
    const dev = devices[Math.floor(Math.random() * devices.length)];
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

    clicks.push({
      id: `clk_${now - hoursAgo * 1000}_${i}`,
      program_id: prog.id,
      program_name: prog.name,
      cloaked_slug: prog.cloaked_slug,
      timestamp,
      ip_hash: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8${i % 99}`,
      user_agent: ua,
      referrer_url: ref.url,
      referrer_domain: ref.domain,
      device_type: dev,
      browser: ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : 'Safari',
      country: ['US', 'DE', 'GB', 'CA', 'IN', 'AU', 'FR'][i % 7]
    });
  }

  return clicks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const INITIAL_NOTIFICATIONS: NotificationLog[] = [
  {
    id: 'notif_1',
    program_id: 'prog_cursor_ai',
    program_name: 'Cursor AI',
    channel: 'telegram',
    sent_status: 'sent',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    message: '🚀 Referral Click: Cursor AI (/go/cursor) | Source: google.com | Device: Desktop'
  },
  {
    id: 'notif_2',
    program_id: 'prog_semrush',
    program_name: 'Semrush Pro',
    channel: 'webhook',
    sent_status: 'sent',
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    message: '⚡ Webhook Dispatched: Semrush Pro referral link clicked from x.com'
  },
  {
    id: 'notif_3',
    program_id: 'prog_notion',
    program_name: 'Notion Plus & AI',
    channel: 'email',
    sent_status: 'sent',
    timestamp: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
    message: '✉️ Click Alert: Notion Plus & AI (/go/notion) | Source: newsletter'
  }
];

export const INITIAL_REVIEWS: UserReview[] = [
  {
    id: 'rev_1',
    program_id: 'prog_nexcess',
    program_name: 'Nexcess Managed Hosting',
    user_name: 'Elena Rostova',
    rating: 5,
    title: 'WooCommerce speed improved dramatically',
    comment: 'Our online store used to crash during promotional sales. Switched to Nexcess and our checkout page load dropped below 500ms. The auto-scaling is real.',
    timestamp: new Date(Date.now() - 3600000 * 36).toISOString(),
    verified: true,
    status: 'approved'
  },
  {
    id: 'rev_2',
    program_id: 'prog_plesk',
    program_name: 'Plesk WebOps & Server Platform',
    user_name: 'Marcus Vance',
    rating: 5,
    title: 'Indispensable for managing client VPS instances',
    comment: 'Managing 12 VPS instances used to take up my whole weekend. The WordPress Toolkit and automated staging in Plesk saved our agency hundreds of hours.',
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    verified: true,
    status: 'approved'
  },
  {
    id: 'rev_3',
    program_id: 'prog_cursor_ai',
    program_name: 'Cursor AI',
    user_name: 'David Lin',
    rating: 5,
    title: 'The best AI code editor by a mile',
    comment: 'Cursor with Claude 3.5 Sonnet understands my whole repo effortlessly. It is 5x better than GitHub Copilot for multi-file refactoring.',
    timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
    verified: true,
    status: 'approved'
  },
  {
    id: 'rev_4',
    program_id: 'prog_notion',
    program_name: 'Notion Plus & AI',
    user_name: 'Sarah Jennings',
    rating: 5,
    title: 'Replaced 4 different apps for our remote team',
    comment: 'We consolidated wikis, product specs, and roadmaps in Notion Plus. The AI Q&A search over all company docs is a game changer.',
    timestamp: new Date(Date.now() - 3600000 * 96).toISOString(),
    verified: true,
    status: 'approved'
  }
];

export const INITIAL_MESSAGES: ContactMessage[] = [
  {
    id: 'msg_1',
    name: 'David Miller',
    email: 'david.m@techagency.co',
    subject: 'Question on Nexcess vs Plesk for high-traffic agency',
    message: 'Hi Abbas, great directory. We have 40 client sites and are deciding between Nexcess managed cloud and self-managed VPS with Plesk. Which would you recommend?',
    program_id: 'prog_nexcess',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: 'unread'
  },
  {
    id: 'msg_2',
    name: 'Rachel Adams',
    email: 'rachel@saasventures.io',
    subject: 'Partner promotion submission',
    message: 'Hello, we would love to submit our AI audio software to your directory with an exclusive 30% referral discount for your audience.',
    timestamp: new Date(Date.now() - 3600000 * 22).toISOString(),
    status: 'read'
  }
];
