export type Language = 'en' | 'zh'

export interface Dict {
  nav: {
    about: string
    experience: string
    projects: string
    contact: string
    resume: string
    langToggle: string
  }
  hero: {
    badge: string
    titles: string[]
    description: string
    viewProjects: string
    getInTouch: string
    scroll: string
  }
  about: {
    sectionLabel: string
    title: string
    headingPre: string
    headingGold: string
    headingMid: string
    headingWhite: string
    summary: string
    bioPre: string
    bioFlux: string
    bioSuffix: string
    stats: { value: string; label: string; sub: string }[]
  }
  experience: {
    sectionLabel: string
    headingLine1: string
    headingGold: string
    subDesc: string
    currentBadge: string
    role: string
    bullets: { title: string; desc: string }[]
  }
  skills: {
    sectionLabel: string
    headingPre: string
    headingGold: string
    subDesc: string
    categoryLabels: Record<string, string>
  }
  projects: {
    sectionLabel: string
    headingPre: string
    headingGold: string
    headingPost: string
    subDesc: string
    liveBadge: string
    items: { subtitle: string; description: string; highlights: string[] }[]
  }
  education: {
    sectionLabel: string
    headingPre: string
    headingGold: string
    items: { school: string; degree: string; field: string }[]
  }
  contact: {
    sectionLabel: string
    heading1: string
    headingGold: string
    description: string
    copyLabel: string
    copiedLabel: string
    builtWith: string
    visitsLabel: string
    modal: {
      analyticsLabel: string
      title: string
      total: string
      today: string
      dailyAvg: string
      last14Days: string
    }
  }
}

export const translations: Record<Language, Dict> = {
  en: {
    nav: {
      about: 'About',
      experience: 'Experience',
      projects: 'Projects',
      contact: 'Contact',
      resume: 'Resume',
      langToggle: '中文',
    },
    hero: {
      badge: 'Irvine, CA · Available for opportunities',
      titles: ['Full-Stack Data Scientist', 'AI Systems Engineer', 'LLM Platform Architect', 'Full-Stack Data Scientist'],
      description:
        'Building AI systems that bridge intelligence with enterprise-grade platforms — from RAG pipelines to full-stack products that scale.',
      viewProjects: 'View Projects',
      getInTouch: 'Get In Touch',
      scroll: 'scroll',
    },
    about: {
      sectionLabel: '01 · About',
      title: 'Full-Stack Data Scientist',
      headingPre: 'Where ',
      headingGold: 'artificial intelligence',
      headingMid: ' meets ',
      headingWhite: 'scalable engineering.',
      summary:
        'I architect AI systems that turn raw data into intelligence — from LLM orchestration and RAG pipelines to full-stack platforms that scale. 5+ years building at the intersection of machine learning and product engineering.',
      bioPre:
        "At Stout, I've architected enterprise AI platforms that process thousands of governed LLM interactions daily — blending RAG pipelines, graph databases, and full-stack delivery. Outside of work, I ship the",
      bioFlux: 'Flux',
      bioSuffix: 'product suite: AI-powered platforms for career intelligence, financial management, and metabolic tracking.',
      stats: [
        { value: '5+', label: 'Years Experience', sub: 'at Stout' },
        { value: '3', label: 'AI Platforms', sub: 'Built & Shipped' },
        { value: '∞', label: 'Tokens Processed', sub: 'in production' },
      ],
    },
    experience: {
      sectionLabel: '02 · Experience',
      headingLine1: 'Professional',
      headingGold: 'Experience',
      subDesc:
        '5+ years of enterprise AI development, data science, and full-stack engineering in fast-moving, high-impact environments.',
      currentBadge: 'Current',
      role: 'Associate, Digital & Data Analyst',
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
    },
    skills: {
      sectionLabel: '03 · Technical Skills',
      headingPre: 'Tech',
      headingGold: 'Stack',
      subDesc: 'A deep toolkit spanning AI/ML research, production systems, full-stack development, and cloud infrastructure.',
      categoryLabels: {
        Languages: 'Languages',
        'AI & Machine Learning': 'AI & Machine Learning',
        'Full-Stack & Backend': 'Full-Stack & Backend',
        'Data & Databases': 'Data & Databases',
        'Cloud & Infrastructure': 'Cloud & Infrastructure',
      },
    },
    projects: {
      sectionLabel: '04 · Projects',
      headingPre: 'The',
      headingGold: 'Flux',
      headingPost: ' Suite',
      subDesc:
        'Three AI-powered platforms built from scratch — each solving a different domain with the same design language and engineering standard.',
      liveBadge: 'All platforms live',
      items: [
        {
          subtitle: 'AI Dietary & Metabolic Tracker',
          description:
            'Multimodal Vision AI food logging with bounding box analytics, mathematical metabolic modeling (TDEE/PSMF), and 60fps data dashboards.',
          highlights: ['Real-time Vision AI logging', 'Custom metabolic engines', '60fps on data dashboards'],
        },
        {
          subtitle: 'Bazi & Ziwei Astrology Engine',
          description:
            'Deterministic Bazi (Four Pillars) and Ziwei Doushu charting engine with real-time 3D celestial visualization and an AI assistant for interpretation — no LLM guesswork on the math.',
          highlights: ['Deterministic Bazi + Ziwei calculations', '3D interactive star chart', 'AI-powered chart interpretation'],
        },
        {
          subtitle: 'AI Career Intelligence Platform',
          description:
            'Multi-model AI system with smart fallback routing, ATS match-scoring via NLP entity extraction, and geospatial job market visualization.',
          highlights: ['40% reduction in AI latency', 'PDF/DOCX NLP extraction', 'D3.js geospatial maps'],
        },
        {
          subtitle: 'AI Financial Management Platform',
          description:
            'Vision AI receipt intelligence pipeline, real-time equity dashboard with Google Search Grounding, and optimized Recharts data visualization.',
          highlights: ['90% reduction in manual entry', 'Sub-second market data', '40% render speed gain'],
        },
      ],
    },
    education: {
      sectionLabel: '05 · Education',
      headingPre: 'Academic',
      headingGold: 'Background',
      items: [
        { school: 'The George Washington University', degree: 'Master of Science', field: 'Data Science' },
        { school: 'University of California, San Diego', degree: 'Bachelor of Science', field: 'Economics' },
      ],
    },
    contact: {
      sectionLabel: '06 · Contact',
      heading1: "Let's",
      headingGold: 'Connect',
      description: 'Open to new opportunities, collaborations, and interesting conversations about AI, data, and products.',
      copyLabel: 'Copy',
      copiedLabel: '✓ Copied!',
      builtWith: 'Built with Next.js',
      visitsLabel: 'Visits',
      modal: {
        analyticsLabel: 'Analytics',
        title: 'Visit History',
        total: 'Total',
        today: 'Today',
        dailyAvg: 'Daily avg',
        last14Days: 'Last 14 days',
      },
    },
  },
  zh: {
    nav: {
      about: '关于',
      experience: '工作经历',
      projects: '项目作品',
      contact: '联系方式',
      resume: '简历',
      langToggle: 'EN',
    },
    hero: {
      badge: '美国尔湾 · 欢迎交流合作机会',
      titles: ['全栈数据科学家', 'AI 系统工程师', 'LLM 平台架构师', '全栈数据科学家'],
      description: '构建连接智能与企业级平台的 AI 系统 —— 从 RAG 检索增强管道到可扩展的全栈产品。',
      viewProjects: '查看项目',
      getInTouch: '联系我',
      scroll: '下滑',
    },
    about: {
      sectionLabel: '01 · 关于我',
      title: '全栈数据科学家',
      headingPre: '',
      headingGold: '人工智能',
      headingMid: ' 与 ',
      headingWhite: '可扩展工程的完美结合。',
      summary:
        '我设计能将原始数据转化为智能的 AI 系统 —— 从大语言模型编排、RAG 检索增强管道，到可扩展的全栈平台。5 年多以来，一直在机器学习与产品工程的交汇处构建产品。',
      bioPre: '在 Stout，我构建了每天处理数千次受管控 LLM 交互的企业级 AI 平台 —— 融合 RAG 管道、图数据库与全栈交付。工作之外，我打造了',
      bioFlux: 'Flux',
      bioSuffix: '产品套件：面向职业发展、财务管理和代谢追踪的 AI 平台。',
      stats: [
        { value: '5+', label: '工作年限', sub: '就职于 Stout' },
        { value: '3', label: 'AI 平台', sub: '已构建并上线' },
        { value: '∞', label: '处理 Token 数', sub: '生产环境中' },
      ],
    },
    experience: {
      sectionLabel: '02 · 工作经历',
      headingLine1: '职业',
      headingGold: '经历',
      subDesc: '5 年多企业级 AI 开发、数据科学与全栈工程经验，深耕高速迭代、高影响力的团队环境。',
      currentBadge: '在职',
      role: '助理，数字与数据分析师',
      bullets: [
        {
          title: '企业级 AI 分析平台',
          desc: '设计基于 Schema 约束的自然语言转 SQL 管道与 Cosmos Gremlin 图查询的 LLM 编排架构，单次交互最多处理 5 次受管控的工具调用。',
        },
        {
          title: '文档智能与 RAG',
          desc: '构建具备动态查询路由与 9.5 万 token 上下文预算管理的自适应 RAG 平台，并开发基于 LangGraph 的 Map-Reduce 摘要系统，处理 2.5 万 token 的文本分块。',
        },
        {
          title: '场景优化平台',
          desc: '基于 Flask、JavaScript、SQL Server 的全栈应用，集成 OpenAI Function Calling 与 RAG，减少 9 步流程中的人工协调工作。',
        },
        {
          title: '数据管道与基础设施',
          desc: '基于 Azure Functions 的数据摄取系统，支持每个项目 50+ 文件；应用并发扩展至 100 个 Waitress 线程，并通过 Azure AD OAuth / OpenID Connect 完成身份认证。',
        },
        {
          title: '估值与定价研究',
          desc: '自动化数字资产估值流程，结合随机森林、SVR、岭回归/Lasso 等多模型定价方法，交付基于场景的财务模型。',
        },
        {
          title: '商业智能与遥测',
          desc: '构建 Power BI Prompt Intelligence 仪表盘，追踪用户参与度与转化漏斗；通过 Azure DevOps 搭建 CI/CD 流水线，并完善异常处理机制。',
        },
      ],
    },
    skills: {
      sectionLabel: '03 · 技术技能',
      headingPre: '技术',
      headingGold: '栈',
      subDesc: '涵盖 AI/ML 研究、生产系统、全栈开发与云基础设施的深厚技术工具箱。',
      categoryLabels: {
        Languages: '编程语言',
        'AI & Machine Learning': 'AI 与机器学习',
        'Full-Stack & Backend': '全栈与后端',
        'Data & Databases': '数据与数据库',
        'Cloud & Infrastructure': '云与基础设施',
      },
    },
    projects: {
      sectionLabel: '04 · 项目作品',
      headingPre: '',
      headingGold: 'Flux',
      headingPost: ' 套件',
      subDesc: '三款从零构建的 AI 驱动平台 —— 各自解决不同领域的问题，却共享同一套设计语言与工程标准。',
      liveBadge: '全部平台已上线',
      items: [
        {
          subtitle: 'AI 饮食与代谢追踪应用',
          description: '多模态视觉 AI 食物记录，具备目标检测分析、TDEE/PSMF 代谢数学建模，以及 60fps 流畅数据仪表盘。',
          highlights: ['实时视觉 AI 记录', '自定义代谢计算引擎', '仪表盘 60fps 流畅体验'],
        },
        {
          subtitle: '八字与紫微命理引擎',
          description: '确定性的八字与紫微斗数排盘引擎，结合实时 3D 星图可视化与 AI 智能解读助手 —— 命理计算全部基于传统公式，而非 AI 猜测。',
          highlights: ['确定性八字 + 紫微排盘', '3D 交互式星图', 'AI 智能命盘解读'],
        },
        {
          subtitle: 'AI 求职智能平台',
          description: '多模型 AI 系统，具备智能故障转移路由、基于 NLP 实体抽取的 ATS 匹配评分，以及地理空间职位市场可视化。',
          highlights: ['AI 延迟降低 40%', 'PDF/DOCX 简历 NLP 解析', 'D3.js 地理空间地图'],
        },
        {
          subtitle: 'AI 财务管理平台',
          description: '基于视觉 AI 的收据智能识别管道、结合 Google 搜索实时数据的股票仪表盘，以及优化的 Recharts 数据可视化。',
          highlights: ['人工录入减少 90%', '秒级以内的市场数据', '渲染速度提升 40%'],
        },
      ],
    },
    education: {
      sectionLabel: '05 · 教育背景',
      headingPre: '学术',
      headingGold: '背景',
      items: [
        { school: '乔治·华盛顿大学', degree: '理学硕士', field: '数据科学' },
        { school: '加州大学圣地亚哥分校', degree: '理学学士', field: '经济学' },
      ],
    },
    contact: {
      sectionLabel: '06 · 联系方式',
      heading1: '让我们',
      headingGold: '联系',
      description: '欢迎新的工作机会、合作，以及关于 AI、数据与产品的有趣交流。',
      copyLabel: '复制',
      copiedLabel: '✓ 已复制!',
      builtWith: '基于 Next.js 构建',
      visitsLabel: '访问量',
      modal: {
        analyticsLabel: '访问分析',
        title: '访问记录',
        total: '总访问量',
        today: '今日',
        dailyAvg: '日均',
        last14Days: '最近 14 天',
      },
    },
  },
}
