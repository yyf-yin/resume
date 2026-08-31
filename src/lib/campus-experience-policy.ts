import type { JobStage } from "@/types/resume";

export type CampusExperiencePlacement = "primary" | "supplementary" | "hidden";

export interface CampusExperiencePolicy {
  allowed: boolean;
  maxEntries: number;
  placement: CampusExperiencePlacement;
  sectionLabel: "校园经历" | "补充经历";
  selectionRule: string;
}

const POLICIES: Record<JobStage, CampusExperiencePolicy> = {
  校招: {
    allowed: true,
    maxEntries: 3,
    placement: "primary",
    sectionLabel: "校园经历",
    selectionRule:
      "默认保留全部真实校园经历；直接相关经历突出岗位能力，非对口经历提炼团队协作、沟通表达、组织协调、语言、执行、领导力、学习和结果意识等可迁移能力",
  },
  "社招-初级": {
    allowed: true,
    maxEntries: 2,
    placement: "supplementary",
    sectionLabel: "校园经历",
    selectionRule:
      "当工作或实习经历较少、岗位能力证据不足时，补充最近且与目标岗位相关的校园经历；职业证据充分时仅保留高度相关且成果突出的经历",
  },
  "社招-中级": {
    allowed: true,
    maxEntries: 1,
    placement: "supplementary",
    sectionLabel: "补充经历",
    selectionRule:
      "默认优先使用职业经历；只有职业证据明显不足且校园经历与目标岗位高度相关、成果突出时才保留一段",
  },
  "社招-高级": {
    allowed: true,
    maxEntries: 1,
    placement: "supplementary",
    sectionLabel: "补充经历",
    selectionRule:
      "职业经历应作为主要证据；校园经历通常建议移除，但必须向用户说明理由，只有用户明确同意后才能删除",
  },
  转行: {
    allowed: true,
    maxEntries: 2,
    placement: "supplementary",
    sectionLabel: "补充经历",
    selectionRule:
      "当校园经历能够证明目标岗位所需的可迁移能力或直接实践时保留，且必须明确标注真实校园身份",
  },
};

export function getCampusExperiencePolicy(jobStage: JobStage): CampusExperiencePolicy {
  return POLICIES[jobStage];
}

export function buildCampusExperiencePolicyPrompt(jobStage: JobStage): string {
  const policy = getCampusExperiencePolicy(jobStage);

  const priorityRule =
    jobStage === "校招"
      ? "岗位直接相关经历 > 能证明通用能力的实习、项目和校园经历 > 其他真实经历；直接相关性低不能单独作为删除理由"
      : "相关工作经历 > 相关实习经历 > 相关项目经历 > 能补充职业证据的校园经历";

  return `【校园经历使用策略】
- 当前求职阶段：${jobStage}
- 是否允许使用：${policy.allowed ? "允许按条件使用" : "不使用"}
- 建议最多展示：${policy.maxEntries} 段（用户拒绝删除时可超过此建议数量）
- 展示定位：${policy.placement === "primary" ? "主要经历栏目" : policy.placement === "supplementary" ? "职业经历之后的补充栏目" : "隐藏"}
- 筛选规则：${policy.selectionRule}
- 经历优先级：${priorityRule}
- 学生组织、社团、志愿活动和班级职务只能写入校园/补充经历，不得包装成工作、实习或商业项目
- ${jobStage === "校招" ? "校园经历内容薄弱时应优先追问并保留原始事实，不得仅因不对口或暂时缺少成果而自动删除" : "只有能够补充目标岗位职业证据的校园经历才建议保留；如建议删除，必须说明理由并取得用户明确同意，用户拒绝或未操作时继续保留"}
- 成果应尽量基于真实口径量化，包括覆盖人数、活动场次、内容数量、完成率、增长变化、周期、成本、排名、满意度或正式反馈；没有可靠数字时使用可验证的定性结果，不得诱导或编造量化数据
- 不得为了填满一页虚构活动规模、成员人数、预算、排名、数据或成果`;
}
