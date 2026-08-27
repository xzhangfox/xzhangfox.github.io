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

export const projects = [
  {
    id: 'flux-nutrition',
    title: 'Flux Nutrition',
    subtitle: 'AI Dietary & Metabolic Tracker',
    description:
      'Multimodal Vision AI food logging with bounding box analytics, mathematical metabolic modeling (TDEE/PSMF), and 60fps data dashboards.',
    tech: ['React 19', 'Gemini Vision', 'Tailwind CSS 4', 'TDEE Modeling', 'Mifflin-St Jeor'],
    link: 'https://flux-nutrition-61764787893.us-west1.run.app/#/dashboard',
    image: '/images/flux-nutrition.png',
    video: '/videos/flux-nutrition.mp4',
    highlights: ['Real-time Vision AI logging', 'Custom metabolic engines', '60fps on data dashboards'],
    color: '#B8973E',
  },
  {
    id: 'flux-path',
    title: 'Flux Path',
    subtitle: 'Bazi & Ziwei Astrology Engine',
    description:
      'Deterministic Bazi (Four Pillars) and Ziwei Doushu charting engine with real-time 3D celestial visualization and an AI assistant for interpretation — no LLM guesswork on the math.',
    tech: ['Next.js', 'React Three Fiber', 'Astronomy Engine', 'Claude API', 'Gemini AI', 'Zustand'],
    link: 'https://parallax-nine-taupe.vercel.app/',
    image: '/images/flux-path.png',
    video: '/videos/flux-path.mp4',
    highlights: ['Deterministic Bazi + Ziwei calculations', '3D interactive star chart', 'AI-powered chart interpretation'],
    color: '#8B7FD1',
  },
  {
    id: 'flux-career',
    title: 'Flux Career',
    subtitle: 'AI Career Intelligence Platform',
    description:
      'Multi-model AI system with smart fallback routing, ATS match-scoring via NLP entity extraction, and geospatial job market visualization.',
    tech: ['React 19', 'Gemini AI', 'D3.js', 'Supabase', 'Express', 'NLP'],
    link: 'https://flux-career-367989884274.us-west1.run.app/',
    image: '/images/flux-career.png',
    video: '/videos/flux-career.mp4',
    highlights: ['40% reduction in AI latency', 'PDF/DOCX NLP extraction', 'D3.js geospatial maps'],
    color: '#C9A84C',
  },
  {
    id: 'flux-finance',
    title: 'Flux Finance',
    subtitle: 'AI Financial Management Platform',
    description:
      'Vision AI receipt intelligence pipeline, real-time equity dashboard with Google Search Grounding, and optimized Recharts data visualization.',
    tech: ['React 19', 'Gemini Flash', 'Recharts', 'Google Search API', 'Supabase'],
    link: 'https://flux-finance-1093821759886.us-west1.run.app/',
    image: '/images/flux-finance.png',
    video: '/videos/flux-finance.mp4',
    highlights: ['90% reduction in manual entry', 'Sub-second market data', '40% render speed gain'],
    color: '#D4A843',
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
