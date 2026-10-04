export const personalInfo = {
  name: 'Xi Zhang',
  title: 'AI Engineer',
  location: 'Irvine, CA',
  email: 'xzhangfox@gmail.com',
  phone: '(619) 408-8347',
  linkedin: 'https://linkedin.com/in/xzhangfox',
  github: 'https://github.com/xzhangfox',
  summary:
    'I architect AI systems that turn raw data into intelligence — from LLM orchestration and RAG pipelines to full-stack platforms that scale. 5+ years building at the intersection of machine learning and product engineering.',
}

export interface GalleryShot {
  src: string
  caption?: string
}

export interface Project {
  id: string
  title: string
  subtitle: string
  description: string
  tech: string[]
  link?: string
  image: string
  video?: string
  gallery: GalleryShot[]
  highlights: string[]
  color: string
  gridHeight: number
}

export const projects: Project[] = [
  {
    id: 'flux-nutrition',
    title: 'Flux Nutrition',
    subtitle: 'AI Dietary & Metabolic Tracker',
    description:
      'Snap a photo and Gemini Vision draws a bounding box around every item on your plate, gram by gram. “Dr. Flux,” an AI nutritionist, reads your live macro telemetry and calorie budget to coach you in real time — backed by real TDEE/PSMF metabolic math, not guesswork.',
    tech: ['React 19', 'Gemini Vision', 'Tailwind CSS 4', 'TDEE Modeling', 'Mifflin-St Jeor'],
    link: 'https://flux-nutrition-61764787893.us-west1.run.app/#/dashboard',
    image: '/images/projects/flux-nutrition/showcase.jpg',
    video: '/videos/flux-nutrition.mp4',
    gallery: [
      { src: '/images/projects/flux-nutrition/showcase.jpg', caption: 'Flux Vision and Dr. Flux — snap a meal, then ask your AI nutritionist' },
      { src: '/images/flux-nutrition.png', caption: 'Flux Vision — snap a meal, get instant bounding-box analysis' },
      { src: '/images/projects/flux-nutrition/dashboard.png', caption: 'Macro rings and a 7-day temporal trend, live' },
      { src: '/images/projects/flux-nutrition/ai-nutritionist.png', caption: 'Dr. Flux — an AI nutritionist reading your real-time telemetry' },
    ],
    highlights: ['Vision AI turns one photo into a full macro breakdown', '“Dr. Flux” AI coach reads your live telemetry', 'Real TDEE/PSMF metabolic math, not guesswork'],
    color: '#B8973E',
    gridHeight: 420,
  },
  {
    id: 'flux-path',
    title: 'Flux Path',
    subtitle: 'Bazi & Ziwei Astrology Engine',
    description:
      'Six reading systems — Bazi, Ziwei, Tarot, Face Reading, Human Design, and a three-lens Affinity Reading — all running on deterministic Chinese-astrology math (real planetary positions, not LLM guesses), with a live 3D star chart and “The Chartkeeper,” an AI that reads your actual computed chart. Invite a friend to a blind, 60-second Mirror Draw before it scores your compatibility.',
    tech: ['Next.js', 'React Three Fiber', 'Astronomy Engine', 'Claude API', 'Gemini AI', 'Zustand'],
    link: 'https://parallax-nine-taupe.vercel.app/',
    image: '/images/projects/flux-path/showcase.jpg',
    video: '/videos/flux-path.mp4',
    gallery: [
      { src: '/images/projects/flux-path/showcase.jpg', caption: 'A live star field, the Ziwei palace chart and the Bazi overview' },
      { src: '/images/projects/flux-path/tarot-draw.png', caption: 'Past · Present · Future — draw your spread' },
      { src: '/images/projects/flux-path/tarot-ask.png', caption: 'The Diviner — ask the cards your question' },
      { src: '/images/projects/flux-path/face-analysis.png', caption: 'Face Reading — Twelve Palaces mapped onto your own photo' },
      { src: '/images/projects/flux-path/bazi-overview.png', caption: 'Bazi Overview — Five-Element balance, strength, and pattern at a glance' },
      { src: '/images/projects/flux-path/human-design.png', caption: 'Human Design — your BodyGraph, Type, Strategy, and Authority' },
      { src: '/images/projects/flux-path/affinity-mbti.png', caption: 'Affinity Reading — MBTI woven into the compatibility portrait' },
      { src: '/images/projects/flux-path/mirror-draw.png', caption: 'Mirror Draw — a blind, 60-second co-drawing game for two' },
      { src: '/images/projects/flux-path/ai-assistant.png', caption: 'The Chartkeeper — an AI assistant that reads your chart with you' },
    ],
    highlights: ['Six reading systems on one real-time 3D star chart', 'Deterministic Bazi + Ziwei — real astronomy, not AI guesses', 'Two-person Mirror Draw before your Affinity Reading'],
    color: '#8B7FD1',
    gridHeight: 540,
  },
  {
    id: 'flux-career',
    title: 'Flux Career',
    subtitle: 'AI Career Intelligence Platform',
    description:
      'Career Intel turns your profile into a living market map: a constellation where every recommended role orbits you at the distance its match sets, a match × salary bubble chart sized by live openings, and a world map of hiring hubs. Paste any job description and the AI match engine scores your resume against it, then rewrites the resume and cover letter — and one click exports your whole profile as a designed PDF.',
    tech: ['React 19', 'Gemini AI', 'D3.js', 'Supabase', 'Express', 'NLP'],
    link: 'https://flux-career-367989884274.us-west1.run.app/',
    image: '/images/projects/flux-career/cover.jpg',
    video: '/videos/flux-career.mp4',
    gallery: [
      { src: '/images/projects/flux-career/cover.jpg', caption: 'Career Intel — every role orbits you at the distance its match sets' },
      { src: '/images/projects/flux-career/market.jpg', caption: 'Market — match × salary, sized by live openings, with a ranked leaderboard' },
      { src: '/images/projects/flux-career/hubs.jpg', caption: 'Hiring hubs — openings aggregated by city, worldwide' },
      { src: '/images/projects/flux-career/strategy.jpg', caption: 'Strategy — paste a job description, get a tailored resume and match analysis' },
      { src: '/images/projects/flux-career/mobile.jpg', caption: 'Built for the phone too — Intel, analysis and resume a tab apart' },
    ],
    highlights: ['Constellation, market and hiring-hub views of your fit', 'AI match scoring plus a tailored resume and cover letter', 'One-click PDF dossier of your entire profile'],
    color: '#C9A84C',
    gridHeight: 380,
  },
  {
    id: 'flux-finance',
    title: 'Flux Finance',
    subtitle: 'AI Financial Management Platform',
    description:
      'Snap a receipt and Gemini Flash itemizes it straight into your ledger — no manual entry. A resource-allocation donut and a velocity trend chart track spend in real time, a full calendar heat-maps every day’s total, and a Google Search-grounded feed keeps market data current to the second.',
    tech: ['React 19', 'Gemini Flash', 'Recharts', 'Google Search API', 'Supabase'],
    link: 'https://flux-finance-1093821759886.us-west1.run.app/',
    image: '/images/projects/flux-finance/cover.jpg',
    video: '/videos/flux-finance.mp4',
    gallery: [
      { src: '/images/projects/flux-finance/cover.jpg', caption: 'Expenditure and spend trend, on frosted glass' },
      { src: '/images/projects/flux-finance/screens.jpg', caption: 'Split bills, the dashboard and your commitments, on the phone' },
      { src: '/images/projects/flux-finance/profile.jpg', caption: 'Profile — recurring commitments, four app themes and the rest of the Flux family' },
    ],
    highlights: ['Receipt photo to itemized ledger, zero typing', 'Real-time resource-allocation and velocity charts', 'Google Search-grounded, sub-second market data'],
    color: '#D4A843',
    gridHeight: 440,
  },
  {
    id: 'financial-tracker',
    title: 'Financial Tracker',
    subtitle: 'AI Bubble Monitor',
    description:
      'A composite bubble-score gauge distills 7 percentile-ranked indicators across the Dalio, Shiller, and Minsky frameworks into one daily read — zero lookahead, fully automated, with an interactive trailing-history chart showing exactly how today’s score got there.',
    tech: ['Next.js', 'Framer Motion', 'Yahoo Finance API', 'GitHub Actions', 'Inline SVG charts'],
    link: 'https://ai-bubble-monitor-delta.vercel.app',
    image: '/images/projects/financial-tracker/showcase.jpg',
    gallery: [
      { src: '/images/projects/financial-tracker/showcase.jpg', caption: 'The composite gauge, its seven indicators and the trailing history' },
      { src: '/images/projects/financial-tracker/indicators.jpg', caption: '7 indicators across 3 bubble frameworks' },
      { src: '/images/projects/financial-tracker/trend.jpg', caption: 'Interactive trailing-history trend chart' },
    ],
    highlights: ['7 indicators, 3 frameworks, one daily score', 'Zero-lookahead scoring — no hindsight bias', 'Fully automated, self-updating pipeline'],
    color: '#D4A843',
    gridHeight: 480,
  },
  {
    id: 'flux-mythos',
    title: 'Flux Mythos',
    subtitle: 'TBD',
    description: 'Details to be announced.',
    tech: ['TBD'],
    image: '/images/projects/flux-mythos/tbd-placeholder.svg',
    gallery: [{ src: '/images/projects/flux-mythos/tbd-placeholder.svg' }],
    highlights: [],
    color: '#C9A84C',
    gridHeight: 420,
  },
  {
    id: 'flux-glow',
    title: 'Flux Glow',
    subtitle: 'AI Photo Retouching Studio',
    description:
      'A beauty camera that runs entirely in the browser. MediaPipe’s 478-point face mesh drives frequency-separation skin smoothing, whitening, blemish and wrinkle removal, mesh-based face shaping, and film-style filters previewed on your own face — live from the camera or on a photo, with hold-to-compare, and every pixel processed on-device.',
    tech: ['React 19', 'MediaPipe', 'Canvas API', 'TypeScript', 'Vite'],
    link: 'https://flux-glow-f60xl28cu-fox-1121.vercel.app/',
    image: '/images/projects/flux-glow/cover.jpg',
    gallery: [
      { src: '/images/projects/flux-glow/cover.jpg', caption: 'Before and after — smoothing, whitening and the Peach filter, on-device' },
      { src: '/images/projects/flux-glow/compare.jpg', caption: 'Hold to compare — the original and the retouch, side by side' },
      { src: '/images/projects/flux-glow/panels.jpg', caption: 'Beauty, Shape and Filter — every adjustment previewed live' },
    ],
    highlights: ['Frequency-separation smoothing, not a flat blur', 'Face-mesh shaping and filters previewed on your own face', 'Fully on-device — nothing is ever uploaded'],
    color: '#D4AF37',
    gridHeight: 480,
  },
]

export const skillCategories = [
  {
    label: 'Languages',
    skills: ['Python', 'SQL', 'R', 'JavaScript', 'TypeScript', 'HTML', 'CSS'],
  },
  {
    label: 'AI & Machine Learning',
    skills: [
      'Azure OpenAI',
      'RAG Architecture',
      'LangChain',
      'LangGraph',
      'Prompt Engineering',
      'Semantic Search',
      'FAISS',
      'Scikit-learn',
      'TensorFlow',
      'PyTorch',
      'Causal Inference',
      'Time Series',
    ],
  },
  {
    label: 'Full-Stack & Backend',
    skills: ['React 19', 'Vite', 'Node.js', 'Express', 'Flask', 'Quart', 'REST APIs', 'SSE', 'SQLAlchemy', 'Pydantic'],
  },
  {
    label: 'Data & Databases',
    skills: ['PostgreSQL', 'Supabase', 'SQL Server', 'Azure Cosmos DB', 'Gremlin Graph DB', 'Redis', 'MongoDB', 'Pandas', 'NumPy'],
  },
  {
    label: 'Cloud & Infrastructure',
    skills: ['Azure Form Recognizer', 'Azure AI Search', 'Azure Blob', 'Azure Functions', 'Azure AD/OAuth', 'Docker', 'Git', 'CI/CD', 'Microservices'],
  },
]

export const experience = {
  company: 'Stout',
  role: 'Associate, Digital & Data Analyst',
  location: 'Irvine, CA',
  period: 'May 2021 – Present',
  bullets: [
    {
      title: 'Enterprise AI Analytics Platform',
      desc: 'Architected LLM orchestration with schema-grounded NL-to-SQL pipeline and Cosmos Gremlin graph queries, processing up to 5 governed tool calls per interaction.',
    },
    {
      title: 'Document Intelligence & RAG',
      desc: 'Engineered adaptive RAG platform with dynamic query routing and 95K token context budgeting. Built LangGraph map-reduce summarization managing 25K-token chunks.',
    },
    {
      title: 'Scenario Optimization Platform',
      desc: 'Full-stack application (Flask, JavaScript, SQL Server) reducing manual orchestration across a 9-step pipeline with integrated OpenAI function-calling and RAG.',
    },
    {
      title: 'Data Pipelines & Infrastructure',
      desc: 'Azure Functions ingestion supporting 50+ files/project. Concurrent app scaled to 100 Waitress threads, authenticated via Azure AD OAuth/OpenID Connect.',
    },
    {
      title: 'Valuation & Pricing Research',
      desc: 'Automated digital-asset valuation workflow with multi-model pricing (Random Forest, SVR, Ridge/Lasso) delivering scenario-based financial models.',
    },
    {
      title: 'Business Intelligence & Telemetry',
      desc: 'Power BI Prompt Intelligence Dashboard tracking engagement and funnel conversions. CI/CD pipelines via Azure DevOps with comprehensive exception handling.',
    },
  ],
}

export const education = [
  {
    school: 'The George Washington University',
    degree: 'Master of Science',
    field: 'Data Science',
    year: 'Dec 2020',
    location: 'Washington, D.C.',
    short: 'GWU',
  },
  {
    school: 'University of California, San Diego',
    degree: 'Bachelor of Science',
    field: 'Economics',
    year: 'Dec 2017',
    location: 'San Diego, CA',
    short: 'UCSD',
  },
]
