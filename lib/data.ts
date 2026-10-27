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
      'Snap a meal and Flux Vision boxes every food on the plate with its calories and macros: adjust the portions, log it in one tap, or share the annotated photo. Dr. Flux, an AI nutritionist, answers from your live targets and the published research, and logs a meal from one sentence. Pick a goal, a diet method and a cycle, and Flux builds the whole plan: every day’s targets, training and meals on one calendar.',
    tech: ['React 19', 'Gemini Vision', 'Tailwind CSS 4', 'TDEE Modeling', 'Mifflin-St Jeor'],
    link: 'https://flux-fox-1121.vercel.app/',
    image: '/images/projects/flux-nutrition/showcase.jpg',
    video: '/videos/flux-nutrition.mp4',
    gallery: [
      { src: '/images/projects/flux-nutrition/showcase.jpg', caption: 'Snap, ask, plan: Flux Vision, Dr. Flux and the day’s plan' },
      { src: '/images/projects/flux-nutrition/vision.jpg', caption: 'Flux Vision: every food boxed with its macros, and the annotated photo ready to share' },
      { src: '/images/projects/flux-nutrition/coach.jpg', caption: 'Dr. Flux: evidence-based answers from your live macros, and meals logged from one sentence' },
      { src: '/images/projects/flux-nutrition/plan.jpg', caption: 'Diet plans: four choices build the plan, and every day’s targets, training and meals follow' },
    ],
    highlights: ['Food detection with bounding boxes, shareable as one photo', 'An AI nutritionist that cites the research and knows your day', 'A full diet plan from a goal, a method and a cycle'],
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
    link: 'https://flux-path-fox-1121.vercel.app/',
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
      'An AI career agent that knows your whole record (profile, applications and market fit) tells you which jobs to chase today and how to pitch yourself. Astro’s daily list arrives ranked by match; every job gets its own résumé, cover letter and ready answers, and the Flux Autofill extension fills in the application. Each résumé mirrors the posting’s keywords using only your true facts, and is checked against the job with a match score, its gaps and fixes.',
    tech: ['React 19', 'Gemini AI', 'D3.js', 'Supabase', 'Express', 'Chrome Extension'],
    link: 'https://flux-career-cyan.vercel.app/',
    image: '/images/projects/flux-career/cover.jpg',
    video: '/videos/flux-career.mp4',
    gallery: [
      { src: '/images/projects/flux-career/cover.jpg', caption: 'Career Intel and the AI career agent, side by side' },
      { src: '/images/projects/flux-career/planner.jpg', caption: 'The AI career planner: where you fit, what it pays, and what to do today' },
      { src: '/images/projects/flux-career/apply.jpg', caption: 'Apply: today’s jobs ranked, answers written, one tap to apply' },
      { src: '/images/projects/flux-career/documents.jpg', caption: 'A tailored résumé and cover letter for every posting, checked against the job' },
    ],
    highlights: ['An AI career agent that plans your search from your real record', 'A daily apply queue: ranked jobs, ready answers, autofill', 'A résumé and cover letter per job, scored against the posting'],
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
    link: 'https://flux-finance-ivory.vercel.app/',
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
    id: 'eclipse',
    title: 'Eclipse',
    subtitle: 'A JRPG of Light and Shadow',
    description: 'In a world woven from light and shadow, explore the many stories hidden within.',
    tech: [],
    image: '/images/projects/eclipse/cover.jpg',
    gallery: [
      { src: '/images/projects/eclipse/cover.jpg' },
      { src: '/images/projects/eclipse/scene.jpg' },
      { src: '/images/projects/eclipse/dialogue.jpg' },
    ],
    highlights: [],
    color: '#C9A84C',
    gridHeight: 420,
  },
  {
    id: 'flux-glow',
    title: 'Flux Glow',
    subtitle: 'AI Photo Retouching Studio',
    description:
      'A beauty camera that runs entirely in the browser. MediaPipe’s 478-point face mesh drives frequency-separation skin smoothing and 3D relighting, 26 face-shape controls built as bounded local mesh transforms (so even ±100 stays natural), one-tap Looks like Baby Face and Chiseled, face-tracked 3D AR effects — shell-rendered fur ears, face-conforming masks and modeled eyewear lit by light estimated from the photo — and stickers, emoji and text on the finished photo — live or on a still, every pixel processed on-device.',
    tech: ['React 19', 'MediaPipe', 'Canvas API', 'TypeScript', 'Vite'],
    link: 'https://flux-glow.vercel.app/',
    image: '/images/projects/flux-glow/cover.jpg',
    gallery: [
      { src: '/images/projects/flux-glow/cover.jpg', caption: 'Before and after — smoothing, whitening and the Peach filter, on-device' },
      { src: '/images/projects/flux-glow/compare.jpg', caption: 'Hold to compare — the original and the retouch, side by side' },
      { src: '/images/projects/flux-glow/effects.jpg', caption: '3D AR effects — a glossy cowl, plush fur ears and acetate shades, lit by your own scene' },
      { src: '/images/projects/flux-glow/create.jpg', caption: 'One-tap Looks, stickers and text, and per-feature Shape tabs' },
      { src: '/images/projects/flux-glow/panels.jpg', caption: 'Beauty, Shape and Filter — every adjustment previewed live' },
    ],
    highlights: ['26 shape controls that stay natural even at the extremes', 'Looks, AR effects and stickers previewed on your own face', 'Fully on-device — nothing is ever uploaded'],
    color: '#D4AF37',
    gridHeight: 480,
  },
  {
    id: 'flux-scribe',
    title: 'Flux Scribe',
    subtitle: 'AI Meeting Minutes & Q&A',
    description:
      'Record a meeting or upload a recording and get back who said what. Audio is encoded to compact MP3 on-device, then transcribed in a single Gemini pass that separates speakers, timestamps every turn and keeps the original language. Minutes, action items and a chat assistant all run on the text transcript, so a meeting is paid for once, and every answer cites the moment it came from.',
    tech: ['React 19', 'Gemini API', 'Web Audio / AudioWorklet', 'Vercel Functions', 'IndexedDB'],
    link: 'https://flux-scribe-otzr.vercel.app/',
    image: '/images/projects/flux-scribe/cover.jpg',
    gallery: [
      { src: '/images/projects/flux-scribe/cover.jpg', caption: 'Speaker-separated transcript beside AI-written minutes and action items' },
      { src: '/images/projects/flux-scribe/ask.jpg', caption: 'Ask the meeting — answers cite timestamps you can jump to' },
      { src: '/images/projects/flux-scribe/record.jpg', caption: 'Record live or upload a file — encoded on-device as you go' },
    ],
    highlights: ['Speaker diarization with one-tap renaming', 'Minutes, decisions and action items with owners', 'AI Q&A with clickable timestamp citations'],
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
