import type {
  AnalysisResult,
  EvidenceStrength,
  FollowUpQuestion,
  OptimizeStyle,
  UserInput,
} from "@/types/resume";

const OPTIMIZATION_OBJECTIVE = `【唯一优化目标：更高匹配度、更强专业性】
1. 优先强化与目标 JD 核心职责、硬性要求和高权重关键词直接相关的真实证据
2. 使用准确、专业、简洁的岗位语言，突出个人行动、方法、业务场景和可核实结果
3. 删除空泛、自评式、口语化和低相关表达，避免关键词堆砌与生硬技术植入
4. 不得为提高匹配度虚构经历、职责、工具、数据或能力层级；缺失能力不得伪装成已有经验
5. 优化后的内容应便于招聘者快速识别岗位匹配点，同时保持事实边界清晰`;

const ANALYSIS_JSON_SCHEMA = `{
  "jdAnalysis": {
    "responsibilities": string[],
    "hardRequirements": string[],
    "implicitRequirements": string[],
    "keywords": string[],
    "idealCandidate": string,
    "coreCompetencies": [{ "name": string, "importance": "high"|"medium"|"low", "description": string }]
  },
  "diagnosis": {
    "overallScore": number,
    "dimensionScores": [{ "dimension": string, "score": number, "comment": string }],
    "mainIssues": string[],
    "prioritySuggestions": string[]
  },
  "matchItems": [{
    "jdRequirement": string,
    "resumeEvidence": string,
    "evidenceStrength": "strong"|"medium"|"weak"|"none",
    "needsSupplement": boolean,
    "optimizationSuggestion": string
  }],
  "followUpQuestions": [{
    "id": string,
    "question": string,
    "purpose": string,
    "userAnswer": "",
    "generatedBullet": ""
  }],
  "optimizedItems": [{
    "id": string,
    "section": string,
    "before": string,
    "after": string,
    "reason": string,
    "riskWarning": string
  }],
  "finalResume": {
    "template": "experienced"|"campus",
    "personalInfo": { "name": string, "email": string, "phone": string, "location": string },
    "jobIntent": string,
    "summary": string,
    "coreSkills": string[],
    "workExperience": [{ "company": string, "role": string, "period": string, "bullets": string[] }],
    "projectExperience": [{ "name": string, "role": string, "period": string, "bullets": string[] }],
    "campusExperience": [{ "organization": string, "role": string, "period": string, "bullets": string[] }],
    "awardsAndCertificates": string[],
    "skillsAndTools": string[],
    "education": { "school": string, "degree": string, "period": string }
  },
  "interviewPrep": {
    "likelyQuestions": [{ "question": string, "suggestedAnswer": string, "evidenceNeeded": string[] }],
    "evidenceToPrepare": string[],
    "possibleExaggerations": string[],
    "dataToSupplement": string[],
    "selfIntroduction": string
  }
}`;

export const RESUME_AGENT_SYSTEM_PROMPT = `你是「简历专家」，一位 JD 定制简历优化 Agent。
你的任务是基于目标岗位 JD 与用户原始简历，输出结构化 JSON 分析结果。
要求：
1. 所有内容使用中文
2. 分析必须基于用户提供的 JD 与简历，不得编造无法从材料推断的虚假经历
3. 对缺失证据要明确标注 needsSupplement 或 evidenceStrength 为 weak/none
4. followUpQuestions 生成 5-10 条，id 格式 fu-1, fu-2...
5. optimizedItems 通常生成 5 条左右，id 格式 opt-1, opt-2...；真实材料不足时允许更少，不得为凑数量虚构或重复内容
6. interviewPrep.likelyQuestions 恰好 10 条
7. overallScore 与各 dimensionScores.score 必须是 0-100 范围内的整数；即使证据不足也必须给出保守评分，不得省略或返回 null
8. 当前任务指定的所有顶层字段、嵌套字段和数组元素字段均为必填项，任何情况下都不得省略或返回 null
9. 没有内容的数组返回 []，无法从材料确定的字符串返回 ""，但字段本身必须保留
10. 只输出一个合法 JSON 对象，不要 markdown 代码块、解释、思考过程或前后缀文本
11. 不得增加 result、data、analysis、output 等额外包裹层
12. 输出前逐项检查任务列出的所有必填字段，确认完整后再输出`;

function buildRequiredJsonRules(requiredFields: string[]): string {
  return `【强制输出契约】
- 以下字段全部为必填项，任何情况下都不得省略或返回 null：
${requiredFields.map((field) => `  - ${field}`).join("\n")}
- 数组没有内容时返回 []；字符串无法确定时返回 ""；数值和布尔值必须返回符合要求的有效值
- 只允许输出一个 JSON 对象，不得添加 result、data、analysis、output 等包裹层
- 不得输出 Markdown、解释文字或思考过程
- 下方内容是合法 JSON 结构示例，必须用用户材料生成真实内容，不得照抄示例值
- 输出前逐项自检上述字段；只有全部存在且 JSON 合法后才能输出`;
}

const ANALYSIS_CORE_SCHEMA = `{
  "jdAnalysis": {
    "responsibilities": string[],
    "hardRequirements": string[],
    "implicitRequirements": string[],
    "keywords": string[],
    "idealCandidate": string,
    "coreCompetencies": [{ "name": string, "importance": "high"|"medium"|"low", "description": string }]
  },
  "diagnosis": {
    "overallScore": number,
    "dimensionScores": [{ "dimension": string, "score": number, "comment": string }],
    "mainIssues": string[],
    "prioritySuggestions": string[]
  },
  "matchItems": [{
    "jdRequirement": string,
    "resumeEvidence": string,
    "evidenceStrength": "strong"|"medium"|"weak"|"none",
    "needsSupplement": boolean,
    "optimizationSuggestion": string
  }],
  "followUpQuestions": [{
    "id": string,
    "question": string,
    "purpose": string,
    "userAnswer": "",
    "generatedBullet": ""
  }]
}`;

const ANALYSIS_OUTPUT_SCHEMA = `{
  "optimizedItems": [{
    "id": string,
    "section": string,
    "before": string,
    "after": string,
    "reason": string,
    "riskWarning": string
  }],
  "finalResume": {
    "template": "experienced"|"campus",
    "personalInfo": { "name": string, "email": string, "phone": string, "location": string },
    "jobIntent": string,
    "summary": string,
    "coreSkills": string[],
    "workExperience": [{ "company": string, "role": string, "period": string, "bullets": string[] }],
    "projectExperience": [{ "name": string, "role": string, "period": string, "bullets": string[] }],
    "campusExperience": [{ "organization": string, "role": string, "period": string, "bullets": string[] }],
    "awardsAndCertificates": string[],
    "skillsAndTools": string[],
    "education": { "school": string, "degree": string, "period": string }
  },
  "interviewPrep": {
    "likelyQuestions": [{ "question": string, "suggestedAnswer": string, "evidenceNeeded": string[] }],
    "evidenceToPrepare": string[],
    "possibleExaggerations": string[],
    "dataToSupplement": string[],
    "selfIntroduction": string
  }
}`;

function buildInputContext(input: UserInput): string {
  return `【目标岗位】${input.targetRole}
【行业】${input.industry}
【公司类型】${input.companyType}
【求职阶段】${input.jobStage}
【希望突出能力】${input.highlightSkills || "无"}

【目标 JD】
${input.jobDescription}

【原始简历】
${input.originalResume}

【补充信息】
${input.additionalInfo || "无"}`;
}

const FOLLOW_UP_EVIDENCE_ROUTING_RULES = `【追问证据使用边界】
1. 必须读取并判断每条追问回答，但“必须读取”不等于“必须写入简历”
2. 只有用户明确描述真实场景、个人行动、实际使用方法或结果的实践证据，才能写入工作、实习、项目或校园经历，并且必须与该经历类型语义匹配
3. 仅表示了解、学习过、能够解释某个概念、原理或工具的知识证据，只能写入核心能力或技能工具，不得写入任何经历栏目
4. 不得将“了解、学习、知道、接触过”升级为“应用、搭建、优化、落地、负责、推动、实现”等实践表述
5. 只有用户明确说明在某个既有项目中实际使用了该知识或工具，且逻辑与原项目一致时，才能将其合并到该项目；不得为了匹配 JD 生硬插入技术名词
6. 用户明确表示不了解、没有使用过、无法确认或未回答的内容，不得写入简历
7. 知识掌握程度必须忠于用户原话，严格区分“了解”“熟悉”“掌握”“实际使用”
8. 每条信息必须放入语义匹配的栏目；无法确定合理栏目时不采用，不得强行安置
9. 示例：用户只回答“了解 Transformer 和多头注意力机制”时，可以在“技能工具”中写“了解 Transformer 与多头注意力机制基本原理”；禁止写成“在某项目中利用多头注意力优化 LLM”`;

function buildFollowUpEvidence(followUpQuestions: FollowUpQuestion[]): string {
  const answeredQuestions = followUpQuestions.filter(
    (item) => item.userAnswer.trim() || item.generatedBullet.trim()
  );

  if (answeredQuestions.length === 0) return "";

  return `【追问补充信息】
以下是用户在初始分析后补充的信息。必须逐条判断其证据类型和适用栏目，不要求全部写入简历；生成的 bullet 只能作为表达参考，事实和能力程度以用户回答为准。
${answeredQuestions
  .map(
    (item, index) => `追问 ${index + 1}：${item.question}
追问目的：${item.purpose}
用户回答：${item.userAnswer || "未填写"}
已生成 Bullet：${item.generatedBullet || "未生成"}`
  )
  .join("\n\n")}

${FOLLOW_UP_EVIDENCE_ROUTING_RULES}`;
}

function buildResumeTemplateSectionRules(input: UserInput): string {
  return input.jobStage === "校招"
    ? `【校招模板栏目分流】
- 不生成“职业摘要”优化项
- section 只能使用“教育背景”“专业能力”“实习经历”“项目经历”“校园经历”“获奖证书”“技能工具”之一
- 公司实习放“实习经历”；课程/竞赛/科研/个人项目放“项目经历”；学生组织、社团、志愿和班级职务放“校园经历”
- 不得把校园经历包装成工作或实习经历`
    : `【社会招聘模板栏目分流】
- section 只能使用“职业摘要”“核心能力”“工作经历”“项目经历”“技能工具”“教育背景”之一
- 不生成“校园经历”或“获奖证书”优化项`;
}

export function buildAnalyzeCorePrompt(input: UserInput): string {
  return `请完成 JD 解析（第一部分）。
${buildInputContext(input)}

${buildRequiredJsonRules([
  "jdAnalysis",
  "jdAnalysis.responsibilities",
  "jdAnalysis.hardRequirements",
  "jdAnalysis.implicitRequirements",
  "jdAnalysis.keywords",
  "jdAnalysis.idealCandidate",
  "jdAnalysis.coreCompetencies",
  "jdAnalysis.coreCompetencies[].name",
  "jdAnalysis.coreCompetencies[].importance",
  "jdAnalysis.coreCompetencies[].description",
])}

输出结构示例：
{
  "jdAnalysis": {
    "responsibilities": ["负责核心产品规划与迭代"],
    "hardRequirements": ["具备相关岗位经验"],
    "implicitRequirements": ["能够推动跨团队协作"],
    "keywords": ["产品规划", "数据驱动"],
    "idealCandidate": "具备相关行业经验并能独立推动项目落地的候选人",
    "coreCompetencies": [
      {
        "name": "产品规划",
        "importance": "high",
        "description": "能够完成从需求分析到产品落地的完整工作"
      }
    ]
  }
}`;
}

export function buildAnalyzeDiagnosisPrompt(input: UserInput): string {
  return `请完成简历诊断、匹配分析、经历追问（第二部分）。
${buildInputContext(input)}

${buildRequiredJsonRules([
  "diagnosis",
  "diagnosis.overallScore（0-100 整数，核心必返字段）",
  "diagnosis.dimensionScores",
  "diagnosis.dimensionScores[].dimension",
  "diagnosis.dimensionScores[].score（0-100 整数）",
  "diagnosis.dimensionScores[].comment",
  "diagnosis.mainIssues",
  "diagnosis.prioritySuggestions",
  "matchItems",
  "matchItems[].jdRequirement",
  "matchItems[].resumeEvidence",
  "matchItems[].evidenceStrength",
  "matchItems[].needsSupplement",
  "matchItems[].optimizationSuggestion",
  "followUpQuestions",
  "followUpQuestions[].id",
  "followUpQuestions[].question",
  "followUpQuestions[].purpose",
  "followUpQuestions[].userAnswer",
  "followUpQuestions[].generatedBullet",
])}

即使简历证据不足，也必须根据已有证据给出保守的 overallScore；证据不足应通过较低评分、mainIssues、evidenceStrength 和 needsSupplement 表达，绝不能省略 diagnosis 或 overallScore。

输出结构示例：
{
  "diagnosis": {
    "overallScore": 65,
    "dimensionScores": [
      {
        "dimension": "核心职责匹配",
        "score": 70,
        "comment": "具备相关经验，但缺少部分关键证据"
      }
    ],
    "mainIssues": ["缺少目标岗位核心能力的直接项目证据"],
    "prioritySuggestions": ["补充项目范围、个人贡献和可验证结果"]
  },
  "matchItems": [
    {
      "jdRequirement": "具备核心项目落地经验",
      "resumeEvidence": "简历中存在相关经历，但缺少结果数据",
      "evidenceStrength": "weak",
      "needsSupplement": true,
      "optimizationSuggestion": "补充项目目标、个人行动和量化结果"
    }
  ],
  "followUpQuestions": [
    {
      "id": "fu-1",
      "question": "该项目中你的具体职责和最终结果是什么？",
      "purpose": "补充项目落地证据",
      "userAnswer": "",
      "generatedBullet": ""
    }
  ]
}

要求：followUpQuestions 5-7 条，id 为 fu-1...；matchItems 6-8 条。`;
}

export function buildAnalyzeOutputPrompt(
  input: UserInput,
  _optimizeStyle: OptimizeStyle,
  coreSummary: string
): string {
  return `请完成简历优化项（第三部分 A）。
${OPTIMIZATION_OBJECTIVE}

${buildInputContext(input)}

${coreSummary ? `【前序分析摘要】\n${coreSummary}\n` : ""}
${buildResumeTemplateSectionRules(input)}
${buildRequiredJsonRules([
  "optimizedItems",
  "optimizedItems[].id",
  "optimizedItems[].section",
  "optimizedItems[].before",
  "optimizedItems[].after",
  "optimizedItems[].reason",
  "optimizedItems[].riskWarning",
])}

输出结构示例：
{
  "optimizedItems": [
    {
      "id": "opt-1",
      "section": "${input.jobStage === "校招" ? "项目经历" : "职业摘要"}",
      "before": "原始表达",
      "after": "基于真实材料优化后的表达",
      "reason": "突出与目标岗位相关的能力和证据",
      "riskWarning": "需确认表述与实际经历一致"
    }
  ]
}

要求：optimizedItems 5-6 条，id 为 opt-1...。只生成 optimizedItems，不要生成 finalResume。`;
}

export function buildAnalyzeFinalResumePrompt(
  input: UserInput,
  _optimizeStyle: OptimizeStyle,
  coreSummary: string,
  optimizedItems: AnalysisResult["optimizedItems"],
  followUpQuestions: FollowUpQuestion[] = []
): string {
  const isCampusTemplate = input.jobStage === "校招";
  const template = isCampusTemplate ? "campus" : "experienced";
  const templateRules = isCampusTemplate
    ? `【校招模板规则】
1. template 必须为 "campus"
2. 不生成职业摘要，summary 必须返回空字符串 ""
3. 页面栏目顺序为：求职意向、教育背景、专业能力、实习经历（如有）、项目经历、校园经历、获奖证书、技能工具
4. workExperience 只放真实实习经历；没有实习时返回 []，不得把校园活动伪装成实习
5. campusExperience 放学生组织、社团、志愿活动、班级职务等真实校园经历，建议 1-3 段，每段 1-3 条 bullets
6. projectExperience 优先保留课程项目、竞赛项目、科研项目和个人项目，最多 4 个，每个 2-3 条 bullets
7. awardsAndCertificates 只列真实奖项、竞赛名次、奖学金或证书；没有则返回 []
8. coreSkills 保留 4-6 项；经历按时间倒序排列；正文总长度控制在约 1000-1400 个中文字符
9. 不得为了填满一页虚构实习、校园职务、奖项、项目成果或量化数据`
    : `【社会招聘模板规则】
1. template 必须为 "experienced"
2. 栏目顺序为：求职意向、职业摘要、核心能力、工作经历、项目经历、技能工具、教育背景
3. 职业摘要控制在 80-120 个中文字符，只概括定位、相关经验与核心优势
4. coreSkills 保留 5-8 项；工作经历按时间倒序排列，每段保留 2-4 条 bullets
5. projectExperience 最多 3 个，每个保留 2-3 条 bullets
6. campusExperience 和 awardsAndCertificates 返回 []，不在社会招聘模板中新增校园栏目
7. 正文总长度控制在约 1200-1600 个中文字符`;

  return `请生成完整最终简历（第三部分 B）。
${OPTIMIZATION_OBJECTIVE}
根据求职阶段“${input.jobStage}”，本次必须使用 ${template} 模板。

${buildInputContext(input)}

${coreSummary ? `【前序分析摘要】\n${coreSummary}\n` : ""}
【已生成的优化项】
${JSON.stringify(optimizedItems, null, 2)}

${buildFollowUpEvidence(followUpQuestions)}

生成最终简历时必须以原始简历事实为基础，并将适用的优化项放入其标注的对应栏目。不得虚构原始材料中不存在的公司、学校、项目、职责、校园职务、奖项、成果或量化数据；不得把标注为核心能力或技能工具的知识类优化项改写进经历栏目。

【单页长度与格式要求】
1. 以常规 A4 单页中文简历为目标；JSON 字段名和结构字符不计入正文长度
2. 如果真实经历不足，允许短于一页，不得为填满篇幅虚构、重复或无依据扩写；如果经历较多，优先保留与目标 JD 最相关、证据最充分、结果最明确的内容，压缩低相关内容
3. 每条经历 bullet 控制在 35-60 个中文字符，优先使用“行动 + 方法/场景 + 真实结果”的表达
4. skillsAndTools 保留 6-12 项，只列真实出现或能从材料直接确认的技能与工具
5. 各字段只输出纯文本，不得在字符串中加入 Markdown 标题、表格、代码块或额外编号；不得增加规定结构之外的栏目
6. 完整输出 finalResume JSON 后立即结束，不得重复简历内容或追加解释

${templateRules}

${buildRequiredJsonRules([
  "finalResume",
  "finalResume.template",
  "finalResume.personalInfo",
  "finalResume.personalInfo.name",
  "finalResume.personalInfo.email",
  "finalResume.personalInfo.phone",
  "finalResume.personalInfo.location",
  "finalResume.jobIntent",
  "finalResume.summary",
  "finalResume.coreSkills",
  "finalResume.workExperience",
  "finalResume.workExperience[].company",
  "finalResume.workExperience[].role",
  "finalResume.workExperience[].period",
  "finalResume.workExperience[].bullets",
  "finalResume.projectExperience",
  "finalResume.projectExperience[].name",
  "finalResume.projectExperience[].role",
  "finalResume.projectExperience[].period",
  "finalResume.projectExperience[].bullets",
  "finalResume.campusExperience",
  "finalResume.campusExperience[].organization",
  "finalResume.campusExperience[].role",
  "finalResume.campusExperience[].period",
  "finalResume.campusExperience[].bullets",
  "finalResume.awardsAndCertificates",
  "finalResume.skillsAndTools",
  "finalResume.education",
  "finalResume.education.school",
  "finalResume.education.degree",
  "finalResume.education.period",
])}

输出结构示例：
{
  "finalResume": {
    "template": "${template}",
    "personalInfo": {
      "name": "候选人姓名",
      "email": "候选人邮箱",
      "phone": "候选人电话",
      "location": "所在城市"
    },
    "jobIntent": "目标岗位",
    "summary": "${isCampusTemplate ? "" : "基于真实简历材料生成的职业摘要"}",
    "coreSkills": ["${isCampusTemplate ? "专业能力一" : "核心能力一"}", "${isCampusTemplate ? "专业能力二" : "核心能力二"}"],
    "workExperience": [
      {
        "company": "${isCampusTemplate ? "实习单位" : "公司名称"}",
        "role": "${isCampusTemplate ? "实习岗位" : "岗位名称"}",
        "period": "${isCampusTemplate ? "实习时间" : "任职时间"}",
        "bullets": ["基于真实${isCampusTemplate ? "实习" : "工作"}经历优化后的成果"]
      }
    ],
    "projectExperience": [
      {
        "name": "项目名称",
        "role": "项目角色",
        "period": "项目时间",
        "bullets": ["基于真实经历优化后的项目成果"]
      }
    ],
    "campusExperience": ${isCampusTemplate ? `[
      {
        "organization": "学生组织或社团",
        "role": "校园角色",
        "period": "参与时间",
        "bullets": ["基于真实校园经历生成的个人贡献"]
      }
    ]` : "[]"},
    "awardsAndCertificates": ${isCampusTemplate ? `["真实奖项或证书"]` : "[]"},
    "skillsAndTools": ["技能或工具"],
    "education": {
      "school": "学校名称",
      "degree": "学历与专业",
      "period": "就读时间"
    }
  }
}

只生成 finalResume，不要生成 optimizedItems、分析或面试准备内容。`;
}

export function buildFinalResumeScorePrompt(
  input: UserInput,
  finalResume: AnalysisResult["finalResume"],
  diagnosis: AnalysisResult["diagnosis"]
): string {
  return `请根据目标 JD 对优化后的最终简历重新进行匹配度评分。

${buildInputContext(input)}

【优化后的最终简历】
${JSON.stringify(finalResume, null, 2)}

【评分一致性要求】
1. 使用与原始简历诊断相同的评价口径，重点评估 JD 硬性要求、核心职责、关键词和证据强度
2. 原始诊断维度仅用于保持评价口径一致，不得直接沿用原分数：
${JSON.stringify(diagnosis.dimensionScores, null, 2)}
3. 只认可最终简历中有明确事实依据的内容；不得因为措辞更华丽而虚增分数
4. 最终简历仍缺失的硬性条件必须继续扣分
5. overallScore 必须是 0-100 范围内的整数，任何情况下不得省略或返回 null

${buildRequiredJsonRules(["overallScore（0-100 整数，核心必返字段）"])}

输出结构示例：
{
  "overallScore": 72
}`;
}

export function buildAnalyzeInterviewPrompt(
  input: UserInput,
  coreSummary: string,
  finalResume: AnalysisResult["finalResume"],
  optimizedItems: AnalysisResult["optimizedItems"],
  followUpQuestions: FollowUpQuestion[] = []
): string {
  return `请完成面试准备（第四部分）。
${buildInputContext(input)}

${coreSummary ? `【前序分析摘要】\n${coreSummary}\n` : ""}
【优化后的最终简历——面试准备的唯一简历基准】
${JSON.stringify(finalResume, null, 2)}

【已采用的简历优化项与事实风险】
${JSON.stringify(optimizedItems, null, 2)}

${buildFollowUpEvidence(followUpQuestions)}

【面试准备信息流约束】
1. 所有面试问题、参考回答、自我介绍和证据准备必须针对上方“优化后的最终简历”生成
2. 原始简历仅用于核实事实边界，不得围绕最终简历已经删除的内容设计核心问题或参考回答
3. 最终简历中新加入或强化的内容必须纳入可能追问、证据准备和夸大风险检查
4. suggestedAnswer 必须与最终简历措辞、能力层级和事实范围一致，不得添加最终简历及真实补充证据中不存在的经历或结果
5. 如优化项包含 riskWarning，应将相关核实点体现到 evidenceNeeded 或 possibleExaggerations
6. selfIntroduction 必须基于最终简历重新组织，不得直接复用原始简历摘要

${buildRequiredJsonRules([
  "interviewPrep",
  "interviewPrep.likelyQuestions",
  "interviewPrep.likelyQuestions[].question",
  "interviewPrep.likelyQuestions[].suggestedAnswer",
  "interviewPrep.likelyQuestions[].evidenceNeeded",
  "interviewPrep.evidenceToPrepare",
  "interviewPrep.possibleExaggerations",
  "interviewPrep.dataToSupplement",
  "interviewPrep.selfIntroduction",
])}

输出结构示例：
{
  "interviewPrep": {
    "likelyQuestions": [
      {
        "question": "请介绍一个与目标岗位相关的项目",
        "suggestedAnswer": "基于真实经历说明项目背景、个人行动和结果",
        "evidenceNeeded": ["项目文档", "结果数据"]
      }
    ],
    "evidenceToPrepare": ["关键项目的过程材料和数据口径"],
    "possibleExaggerations": ["需要核实个人贡献范围的表达"],
    "dataToSupplement": ["项目结果的统计口径"],
    "selfIntroduction": "基于真实简历与目标岗位生成的自我介绍"
  }
}

要求：likelyQuestions 恰好 10 条。`;
}

export function buildOptimizeUserPrompt(
  input: UserInput,
  _style: OptimizeStyle,
  followUpQuestions: FollowUpQuestion[] = []
): string {
  return `请基于以下材料重新生成 optimizedItems。只生成有真实依据且能改善简历的信息，通常 3-6 条；材料不足时允许更少，不得为凑数量拆分、重复或强行插入追问信息。

${OPTIMIZATION_OBJECTIVE}

【目标岗位】${input.targetRole}
【目标 JD】
${input.jobDescription}

【原始简历】
${input.originalResume}

【补充信息】
${input.additionalInfo || "无"}

${buildFollowUpEvidence(followUpQuestions)}

${buildResumeTemplateSectionRules(input)}

生成每条 optimizedItem 前必须先确定 section，并严格遵守模板栏目分流和追问证据使用边界。

${buildRequiredJsonRules([
  "optimizedItems",
  "optimizedItems[].id",
  "optimizedItems[].section",
  "optimizedItems[].before",
  "optimizedItems[].after",
  "optimizedItems[].reason",
  "optimizedItems[].riskWarning",
])}

输出结构示例：
{
  "optimizedItems": [
    {
      "id": "opt-1",
      "section": "工作经历",
      "before": "原始表达",
      "after": "按指定风格优化且忠于事实的表达",
      "reason": "说明本次修改的目标",
      "riskWarning": "说明需要用户核实的事实边界"
    }
  ]
}`;
}

export function buildFollowUpBulletPrompt(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string
): string {
  return `请先判断用户的追问回答属于“实践证据”“知识掌握”还是“无可用证据”，再生成一条忠于事实的简历表达。
要求：
1. 实践证据：只有回答明确包含真实场景和个人行动时，才能使用“动作 + 方法/场景 + 真实结果（如有）”的经历 bullet
2. 知识掌握：如果回答只表示了解、学习过或能够解释概念，只返回适合“技能工具”栏目的简短能力短语，不得虚构项目使用、优化动作或成果
3. 无可用证据：如果用户表示不了解、没有使用过、无法确认或回答没有有效信息，bullet 返回空字符串
4. 不得将“了解、学习、知道、接触过”升级为“应用、搭建、优化、落地、负责、推动、实现”
5. 不要夸大，不要引号包裹，只输出 JSON

【目标岗位】${input.targetRole}
【追问目的】${purpose}
【追问】${question}
【用户回答】${userAnswer}

${buildRequiredJsonRules(["bullet"])}

输出结构示例：
{ "bullet": "忠于用户真实回答和能力程度的简历表达" }`;
}

const EVIDENCE_STRENGTHS: EvidenceStrength[] = ["strong", "medium", "weak", "none"];

export function normalizeAnalysisResult(raw: AnalysisResult, input?: UserInput): AnalysisResult {
  return {
    jdAnalysis: {
      responsibilities: raw.jdAnalysis?.responsibilities ?? [],
      hardRequirements: raw.jdAnalysis?.hardRequirements ?? [],
      implicitRequirements: raw.jdAnalysis?.implicitRequirements ?? [],
      keywords: raw.jdAnalysis?.keywords ?? [],
      idealCandidate: raw.jdAnalysis?.idealCandidate ?? "",
      coreCompetencies: (raw.jdAnalysis?.coreCompetencies ?? []).map((item) => ({
        name: item.name ?? "",
        importance: item.importance ?? "medium",
        description: item.description ?? "",
      })),
    },
    diagnosis: {
      overallScore: clampScore(raw.diagnosis?.overallScore ?? 0),
      dimensionScores: (raw.diagnosis?.dimensionScores ?? []).map((item) => ({
        dimension: item.dimension ?? "",
        score: clampScore(item.score ?? 0),
        comment: item.comment ?? "",
      })),
      mainIssues: raw.diagnosis?.mainIssues ?? [],
      prioritySuggestions: raw.diagnosis?.prioritySuggestions ?? [],
    },
    matchItems: (raw.matchItems ?? []).map((item) => ({
      jdRequirement: item.jdRequirement ?? "",
      resumeEvidence: item.resumeEvidence ?? "",
      evidenceStrength: EVIDENCE_STRENGTHS.includes(item.evidenceStrength)
        ? item.evidenceStrength
        : "none",
      needsSupplement: Boolean(item.needsSupplement),
      optimizationSuggestion: item.optimizationSuggestion ?? "",
    })),
    followUpQuestions: (raw.followUpQuestions ?? []).map((item, index) => ({
      id: item.id || `fu-${index + 1}`,
      question: item.question ?? "",
      purpose: item.purpose ?? "",
      userAnswer: item.userAnswer ?? "",
      generatedBullet: item.generatedBullet ?? "",
    })),
    optimizedItems: (raw.optimizedItems ?? []).map((item, index) => ({
      id: item.id || `opt-${index + 1}`,
      section: item.section ?? "",
      before: item.before ?? "",
      after: item.after ?? "",
      reason: item.reason ?? "",
      riskWarning: item.riskWarning ?? "",
    })),
    finalResume: {
      template: input?.jobStage === "校招" ? "campus" : "experienced",
      personalInfo: {
        name: raw.finalResume?.personalInfo?.name ?? "",
        email: raw.finalResume?.personalInfo?.email ?? "",
        phone: raw.finalResume?.personalInfo?.phone ?? "",
        location: raw.finalResume?.personalInfo?.location ?? "",
      },
      jobIntent: raw.finalResume?.jobIntent || (input ? `${input.targetRole} | ${input.industry}` : ""),
      summary: raw.finalResume?.summary ?? "",
      coreSkills: raw.finalResume?.coreSkills ?? [],
      workExperience: raw.finalResume?.workExperience ?? [],
      projectExperience: raw.finalResume?.projectExperience ?? [],
      campusExperience: (raw.finalResume?.campusExperience ?? []).map((item) => ({
        organization: item.organization ?? "",
        role: item.role ?? "",
        period: item.period ?? "",
        bullets: item.bullets ?? [],
      })),
      awardsAndCertificates: raw.finalResume?.awardsAndCertificates ?? [],
      skillsAndTools: raw.finalResume?.skillsAndTools ?? [],
      education: raw.finalResume?.education ?? { school: "", degree: "", period: "" },
    },
    finalResumeScore: clampScore(
      raw.finalResumeScore ?? raw.diagnosis?.overallScore ?? 0
    ),
    interviewPrep: {
      likelyQuestions: raw.interviewPrep?.likelyQuestions ?? [],
      evidenceToPrepare: raw.interviewPrep?.evidenceToPrepare ?? [],
      possibleExaggerations: raw.interviewPrep?.possibleExaggerations ?? [],
      dataToSupplement: raw.interviewPrep?.dataToSupplement ?? [],
      selfIntroduction: raw.interviewPrep?.selfIntroduction ?? "",
    },
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function normalizeOptimizedItems(
  items: AnalysisResult["optimizedItems"]
): AnalysisResult["optimizedItems"] {
  return (items ?? []).map((item, index) => ({
    id: item.id || `opt-${index + 1}`,
    section: item.section ?? "",
    before: item.before ?? "",
    after: item.after ?? "",
    reason: item.reason ?? "",
    riskWarning: item.riskWarning ?? "",
  }));
}
