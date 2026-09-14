import type {
  FollowUpQuestion,
  MatchItem,
  PerfectionPlan,
  ResumeDiagnosis,
  UserInput,
} from "@/types/resume";

export const PERFECTION_SYSTEM_PROMPT = `你是资深职业发展顾问。
你的任务是根据候选人与目标岗位之间仍然薄弱的匹配点，提供可供用户自行判断的补强建议。
要求：
1. 所有内容使用中文，只输出合法 JSON
2. 优先处理 evidenceStrength 为 weak/none 或 needsSupplement 为 true 的差距
3. 项目必须能由一人完成，不依赖公司内部权限、真实客户或多人团队
4. 建议可以包含个人项目、自学知识点或证据补充方向，但不得把练习项目包装成商业经历
5. 不编造用户已经具备的经历、成果或量化数据
6. 仅提供相互独立的建议、优先度评级和推荐理由；优先度只表示对简历竞争力的潜在价值，不代表执行顺序或替用户选择
7. 严禁制定计划或替用户做决定：不得给出时间周期、截止日期、日程、阶段、先后顺序、行动路线、实施步骤、任务清单或“必须选择/应该先做”的结论
8. 使用“可以考虑”“可作为选项”等中性建议语气，明确是否采纳、何时开展及如何执行均由用户自行决定
9. 推荐 5-8 项；每项只包含建议名称、类别、目标弱项、建议内容、优先度和理由
10. plan 及任务指定的所有嵌套字段均为必填项，不得省略或返回 null
11. 没有内容的数组返回 []，无法确定的字符串返回 ""，但字段必须保留
12. 只输出一个合法 JSON 对象，不得添加 result、data、analysis、output 等额外包裹层
13. 不得输出 Markdown、解释文字或思考过程；输出前必须逐项检查全部必填字段及越界内容`;

export function buildPerfectionPrompt(
  input: UserInput,
  diagnosis: ResumeDiagnosis,
  matchItems: MatchItem[],
  followUpQuestions: FollowUpQuestion[] = []
): string {
  const weakItems = matchItems.filter(
    (item) => item.needsSupplement || item.evidenceStrength === "weak" || item.evidenceStrength === "none"
  );
  const answeredQuestions = followUpQuestions.filter(
    (item) => item.userAnswer.trim() || item.generatedBullet.trim()
  );

  return `请为以下候选人生成“精益求精”补强建议。

【目标岗位】${input.targetRole}
【行业】${input.industry || "未填写"}
【公司类型】${input.companyType}
【求职阶段】${input.jobStage}
【希望突出能力】${input.highlightSkills || "未填写"}

【整体匹配度】${diagnosis.overallScore}/100
【主要问题】
${diagnosis.mainIssues.map((item) => `- ${item}`).join("\n") || "- 无"}

【优先建议】
${diagnosis.prioritySuggestions.map((item) => `- ${item}`).join("\n") || "- 无"}

【仍需补足的匹配点】
${weakItems
  .map(
    (item) =>
      `- JD要求：${item.jdRequirement}\n  当前证据：${item.resumeEvidence || "无"}\n  证据强度：${item.evidenceStrength}\n  优化建议：${item.optimizationSuggestion}`
  )
  .join("\n") || "- 未识别到明确弱项，请根据诊断建议补强"}

【追问补充信息】
${answeredQuestions.length > 0
  ? answeredQuestions
      .map(
        (item, index) => `追问 ${index + 1}：${item.question}
追问目的：${item.purpose}
用户回答：${item.userAnswer || "未填写"}
已生成 Bullet：${item.generatedBullet || "未生成"}`
      )
      .join("\n\n")
  : "无已填写的追问信息"}

追问信息是用户对初始简历的最新补充证据，判断弱项时必须优先参考：
- 用户已明确证明具备的基础知识或实践，不得再作为“从零学习”内容推荐
- 如果已有实践但证据深度不足，只能推荐进阶深化、量化验证或表达补充，并说明仍需加强的具体部分
- 必须区分“能力缺失”和“原始简历未写明但追问已补充”

【强制输出契约】
以下字段全部为必填项，任何情况下都不得省略或返回 null：
- plan
- plan.summary
- plan.recommendations
- plan.recommendations[].id、title、category、targetGap、suggestion、priority、reason

category 只能为“项目实践”“知识学习”“证据补充”之一；priority 只能为 high、medium、low 之一。
summary 只能概括建议依据，并明确“建议仅供参考，由用户自行决定是否采纳”，不得出现计划、步骤、周期或替用户选择的表述。
recommendations 中每一项都是独立选项，不得暗示执行顺序，不得包含时间安排、行动步骤或强制性决定。

数组没有内容时返回 []，字符串无法确定时返回 ""。只输出一个 JSON 对象，不得添加额外包裹层。输出前逐项自检所有字段。
下方是合法 JSON 结构示例，必须根据用户材料生成真实内容，不得照抄示例值：
{
  "plan": {
    "summary": "以下建议基于当前简历弱项，仅供参考，由用户自行决定是否采纳。",
    "recommendations": [
      {
        "id": "recommendation-1",
        "title": "可供考虑的补强方向",
        "category": "项目实践",
        "targetGap": "该建议针对的简历弱项",
        "suggestion": "可以考虑独立完成一个能够形成真实证据的小型项目。",
        "priority": "high",
        "reason": "该弱项与目标岗位核心要求直接相关，当前简历证据较弱。"
      }
    ]
  }
}`;
}

export function normalizePerfectionPlan(raw: PerfectionPlan): PerfectionPlan {
  const categories = ["项目实践", "知识学习", "证据补充"] as const;
  const priorities = ["high", "medium", "low"] as const;

  return {
    summary: raw?.summary ?? "",
    recommendations: (raw?.recommendations ?? []).map((item, index) => ({
      id: item.id || `recommendation-${index + 1}`,
      title: item.title ?? "",
      category: categories.includes(item.category) ? item.category : "证据补充",
      targetGap: item.targetGap ?? "",
      suggestion: item.suggestion ?? "",
      priority: priorities.includes(item.priority) ? item.priority : "medium",
      reason: item.reason ?? "",
    })),
  };
}
