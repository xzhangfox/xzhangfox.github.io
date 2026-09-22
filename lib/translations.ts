export type Language = 'en' | 'zh'

export interface Dict {
  nav: {
    name: string
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
    liveBadgeOverview: string
    liveBadgeEntered: string
    hudLabel: string
    comingSoon: string
    moreSoonTitle: string
    moreSoonDesc: string
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
      name: 'Xi Zhang',
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
      bioSuffix:
        'product suite: AI-powered platforms spanning career intelligence, financial management, metabolic tracking, Bazi/Ziwei astrology, and market bubble monitoring.',
      stats: [
        { value: '5+', label: 'Years Experience', sub: 'at Stout' },
        { value: '5', label: 'AI Platforms', sub: 'Built & Shipped' },
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
      headingPost: ' Galaxy',
      subDesc:
        'AI-powered platforms built from scratch — each solving a different domain with the same design language and engineering standard.',
      liveBadgeOverview: 'Every planet is live — click to explore',
      liveBadgeEntered: 'Click a craft or badge for details',
      hudLabel: 'Project Intel',
      comingSoon: 'Coming soon',
      moreSoonTitle: 'More in the works',
      moreSoonDesc: 'New builds land here as they ship.',
      items: [
        {
          subtitle: 'AI Dietary & Metabolic Tracker',
          description:
            'Snap a photo and Gemini Vision draws a bounding box around every item on your plate, gram by gram. “Dr. Flux,” an AI nutritionist, reads your live macro telemetry and calorie budget to coach you in real time — backed by real TDEE/PSMF metabolic math, not guesswork.',
          highlights: ['Vision AI turns one photo into a full macro breakdown', '“Dr. Flux” AI coach reads your live telemetry', 'Real TDEE/PSMF metabolic math, not guesswork'],
        },
        {
          subtitle: 'Bazi & Ziwei Astrology Engine',
          description:
            'Six reading systems — Bazi, Ziwei, Tarot, Face Reading, Human Design, and a three-lens Affinity Reading — all running on deterministic Chinese-astrology math (real planetary positions, not LLM guesses), with a live 3D star chart and “The Chartkeeper,” an AI that reads your actual computed chart. Invite a friend to a blind, 60-second Mirror Draw before it scores your compatibility.',
          highlights: ['Six reading systems on one real-time 3D star chart', 'Deterministic Bazi + Ziwei — real astronomy, not AI guesses', 'Two-person Mirror Draw before your Affinity Reading'],
        },
        {
          subtitle: 'AI Career Intelligence Platform',
          description:
            'A force-directed D3 graph maps your next five job titles by real market gravity, a world map plots where they’re hiring, and an AI match engine scores your resume against a live job description — then rewrites the resume and cover letter for you, on a multi-model pipeline with automatic fallback routing.',
          highlights: ['D3 force graph of your real career trajectory', 'AI ATS match scoring plus a full resume rewrite', '40% lower AI latency via smart model fallback'],
        },
        {
          subtitle: 'AI Financial Management Platform',
          description:
            'Snap a receipt and Gemini Flash itemizes it straight into your ledger — no manual entry. A resource-allocation donut and a velocity trend chart track spend in real time, a full calendar heat-maps every day’s total, and a Google Search-grounded feed keeps market data current to the second.',
          highlights: ['Receipt photo to itemized ledger, zero typing', 'Real-time resource-allocation and velocity charts', 'Google Search-grounded, sub-second market data'],
        },
        {
          subtitle: 'AI Bubble Monitor',
          description:
            'A composite bubble-score gauge distills 7 percentile-ranked indicators across the Dalio, Shiller, and Minsky frameworks into one daily read — zero lookahead, fully automated, with an interactive trailing-history chart showing exactly how today’s score got there.',
          highlights: ['7 indicators, 3 frameworks, one daily score', 'Zero-lookahead scoring — no hindsight bias', 'Fully automated, self-updating pipeline'],
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
      name: '张汐',
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
      bioSuffix: '产品套件：涵盖职业发展、财务管理、代谢追踪、八字紫微命理与市场泡沫监测的 AI 平台。',
      stats: [
        { value: '5+', label: '工作年限', sub: '就职于 Stout' },
        { value: '5', label: 'AI 平台', sub: '已构建并上线' },
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
      headingPost: ' 星系',
      subDesc: '从零构建的 AI 驱动平台 —— 各自解决不同领域的问题，却共享同一套设计语言与工程标准。',
      liveBadgeOverview: '每颗星球都已上线 —— 点击探索',
      liveBadgeEntered: '点击飞行器或图标查看详情',
      hudLabel: '项目情报',
      comingSoon: '即将上线',
      moreSoonTitle: '更多项目开发中',
      moreSoonDesc: '新项目上线后会陆续加入这里。',
      items: [
        {
          subtitle: 'AI 饮食与代谢追踪应用',
          description:
            '拍一张照片，Gemini Vision 就能给餐盘里的每样食物画出识别框，精确到克。AI 营养师"Dr. Flux"实时读取你的宏量营养素和热量缺口数据，给出即时建议 —— 背后是真正的 TDEE/PSMF 代谢数学模型，而非凭空猜测。',
          highlights: ['拍照即出完整宏量营养分析', 'AI 教练 "Dr. Flux" 读取实时数据给建议', 'Mifflin-St Jeor TDEE/PSMF 代谢建模'],
        },
        {
          subtitle: '八字与紫微命理引擎',
          description:
            '八字、紫微、塔罗、面相、人类图，外加融合八字+星座+MBTI 三重视角的缘分分析 —— 六套命理系统运行在确定性的中式命理演算之上（基于真实天文历法，而非 AI 瞎猜），搭配实时 3D 星图和会读取你真实命盘数据的 AI 助手"玄机子"。想看缘分分析前，还能先和好友玩一局盲画 60 秒的「镜像共绘」小游戏。',
          highlights: ['六套命理系统，一张实时 3D 星图', '确定性八字 + 紫微排盘 —— 真天文历法而非 AI 猜测', '缘分分析前先来一局双人镜像共绘'],
        },
        {
          subtitle: 'AI 求职智能平台',
          description:
            'D3 力导向图谱按真实市场引力展示你的下五个职业方向，世界地图标出各地招聘热点，AI 匹配引擎将简历与真实职位描述对比打分 —— 然后直接帮你重写简历和求职信，背后是带自动故障转移的多模型 AI 流水线。',
          highlights: ['D3 力导向图谱展示真实职业路径', 'AI ATS 匹配评分 + 简历/求职信重写', '智能模型故障转移，AI 延迟降低 40%'],
        },
        {
          subtitle: 'AI 财务管理平台',
          description:
            '拍一张收据，Gemini Flash 直接把它拆解记入账本 —— 无需手动录入。资源分配环形图和资金流速曲线实时追踪支出，完整日历以热力图形式展示每日总额，基于 Google 搜索实时校准的市场数据精确到秒。',
          highlights: ['收据拍照秒变账本条目，零手动录入', '实时资源分配环形图 + 流速曲线', 'Google 搜索实时校准的秒级市场数据'],
        },
        {
          subtitle: 'AI 泡沫监测仪',
          description:
            '一个复合泡沫评分仪表盘，把达里欧、席勒与明斯基三套框架下的 7 项百分位指标浓缩成每日一个分数 —— 零前瞻偏差，全自动运行，配合可交互的历史走势图，清楚展示今天的分数是如何算出来的。',
          highlights: ['7 项指标、3 套框架，浓缩成每日一个分数', '零前瞻评分 —— 杜绝事后诸葛亮', '全自动、自我更新的数据流水线'],
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
