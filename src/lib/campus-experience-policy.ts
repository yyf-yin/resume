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
    selectionRule: "优先保留与目标岗位相关、个人行动明确且有真实结果的校园经历",
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
    allowed: false,
    maxEntries: 0,
    placement: "hidden",
    sectionLabel: "补充经历",
    selectionRule: "职业经历应作为主要证据，不使用校园活动填充简历",
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

  return `【校园经历使用策略】
- 当前求职阶段：${jobStage}
- 是否允许使用：${policy.allowed ? "允许按条件使用" : "不使用"}
- 最多保留：${policy.maxEntries} 段
- 展示定位：${policy.placement === "primary" ? "主要经历栏目" : policy.placement === "supplementary" ? "职业经历之后的补充栏目" : "隐藏"}
- 筛选规则：${policy.selectionRule}
- 经历优先级始终为：相关工作经历 > 相关实习经历 > 相关项目经历 > 相关校园经历
- 学生组织、社团、志愿活动和班级职务只能写入校园/补充经历，不得包装成工作、实习或商业项目
- 只有包含真实个人行动，并能补充目标岗位能力证据的校园经历才可保留；仅有组织名称、头衔或“参加过”的内容应先追问，无法补足时删除
- 不得为了填满一页虚构活动规模、成员人数、预算、排名、数据或成果`;
}
