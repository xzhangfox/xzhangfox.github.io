export const personalInfo = {
  name: 'Xi Zhang',
  title: 'Full-Stack Data Scientist',
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
    image: '/images/flux-nutrition.png',
    video: '/videos/flux-nutrition.mp4',
    gallery: [
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
    image: '/images/projects/flux-path/tarot-draw.png',
    video: '/videos/flux-path.mp4',
    gallery: [
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
      'A force-directed D3 graph maps your next five job titles by real market gravity, a world map plots where they’re hiring, and an AI match engine scores your resume against a live job description — then rewrites the resume and cover letter for you, on a multi-model pipeline with automatic fallback routing.',
    tech: ['React 19', 'Gemini AI', 'D3.js', 'Supabase', 'Express', 'NLP'],
    link: 'https://flux-career-367989884274.us-west1.run.app/',
    image: '/images/flux-career.png',
    video: '/videos/flux-career.mp4',
    gallery: [
      { src: '/images/flux-career.png', caption: 'Career Intel — a force-directed graph of your next roles' },
      { src: '/images/projects/flux-career/job-market-map.png', caption: 'Global job hotspots, mapped by role and demand' },
      { src: '/images/projects/flux-career/match-analysis.png', caption: 'Match Analysis — AI ATS scoring against a real job description' },
    ],
    highlights: ['D3 force graph of your real career trajectory', 'AI ATS match scoring plus a full resume rewrite', '40% lower AI latency via smart model fallback'],
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
    image: '/images/flux-finance.png',
    video: '/videos/flux-finance.mp4',
    gallery: [
      { src: '/images/flux-finance.png', caption: 'Resource Allocation and spend Velocity, at a glance' },
      { src: '/images/projects/flux-finance/history.png', caption: 'A full spending calendar, color-coded by day' },
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
    image: '/images/projects/financial-tracker/cover.png',
    gallery: [
      { src: '/images/projects/financial-tracker/cover.png', caption: 'Composite bubble score gauge' },
      { src: '/images/projects/financial-tracker/indicators.png', caption: '7 indicators across 3 bubble frameworks' },
      { src: '/images/projects/financial-tracker/trend.png', caption: 'Interactive trailing-history trend chart' },
    ],
    highlights: ['7 indicators, 3 frameworks, one daily score', 'Zero-lookahead scoring — no hindsight bias', 'Fully automated, self-updating pipeline'],
    color: '#4ADE80',
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
