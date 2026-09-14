import type {
  EvidenceDimension,
  ExperienceAssessment,
  ExperienceType,
  FinalResume,
  FollowUpQuestion,
  JobStage,
} from "@/types/resume";

const EXPERIENCE_TYPES: ExperienceType[] = [
  "work",
  "internship",
  "project",
  "campus",
  "skill",
  "other",
];

const EVIDENCE_DIMENSIONS: EvidenceDimension[] = [
  "role",
  "action",
  "scale",
  "challenge",
  "collaboration",
  "result",
  "other",
];

function normalizeKey(value: string): string {
  return value.replace(/[\s·|｜/\\—–_-]+/g, "").toLowerCase();
}

function normalizeBullets(bullets: string[] | undefined): string[] {
  return (bullets ?? []).map((item) => item.trim()).filter(Boolean);
}

export function normalizeExperienceAssessments(
  assessments: ExperienceAssessment[] = [],
  jobStage?: JobStage
): ExperienceAssessment[] {
  const usedIds = new Set<string>();

  return assessments
    .map((item, index) => {
      const experienceType = EXPERIENCE_TYPES.includes(item.experienceType)
        ? item.experienceType
        : "other";
      let experienceId = item.experienceId?.trim() || `exp-${index + 1}`;
      if (usedIds.has(experienceId)) experienceId = `${experienceId}-${index + 1}`;
      usedIds.add(experienceId);

      const suggestedAction =
        jobStage === "校招" || item.suggestedAction !== "removal_candidate"
          ? "retain"
          : "removal_candidate";
      const userDecision =
        jobStage === "校招"
          ? "retain"
          : item.userDecision === "remove" || item.userDecision === "retain"
            ? item.userDecision
            : suggestedAction === "removal_candidate"
              ? "pending"
              : "retain";

      return {
        experienceId,
        experienceType,
        experienceTitle: item.experienceTitle?.trim() ?? "",
        organization: item.organization?.trim() ?? "",
        role: item.role?.trim() ?? "",
        period: item.period?.trim() ?? "",
        originalBullets: normalizeBullets(item.originalBullets),
        directRelevance: ["high", "medium", "low"].includes(item.directRelevance)
          ? item.directRelevance
          : "low",
        transferableValue: ["high", "medium", "low"].includes(item.transferableValue)
          ? item.transferableValue
          : "medium",
        evidenceCompleteness: ["complete", "partial", "weak"].includes(
          item.evidenceCompleteness
        )
          ? item.evidenceCompleteness
          : "partial",
        missingDimensions: (item.missingDimensions ?? []).filter((dimension) =>
          EVIDENCE_DIMENSIONS.includes(dimension)
        ),
        suggestedAction,
        removalReason:
          suggestedAction === "removal_candidate" ? item.removalReason?.trim() ?? "" : "",
        userDecision,
      } satisfies ExperienceAssessment;
    })
    .filter(
      (item) =>
        item.experienceTitle || item.organization || item.role || item.originalBullets.length > 0
    );
}

const FOLLOW_UP_TEMPLATES: Record<
  EvidenceDimension,
  (title: string) => { question: string; purpose: string }
> = {
  role: (title) => ({
    question: `在“${title}”中，你的职责边界和个人独立贡献分别是什么？哪些决定或交付由你直接负责？`,
    purpose: "补充个人角色与贡献边界",
  }),
  action: (title) => ({
    question: `在“${title}”中，你具体采取了哪些步骤、方法或工具？请按实际执行过程说明。`,
    purpose: "补充可验证的具体行动",
  }),
  scale: (title) => ({
    question: `“${title}”实际持续多久、覆盖多少人或场次、完成多少内容或交付物？请提供能够确认的真实统计口径。`,
    purpose: "补充经历规模与量化口径",
  }),
  challenge: (title) => ({
    question: `“${title}”中最关键的限制或难点是什么？你采取了什么办法解决？`,
    purpose: "补充关键难点与解决过程",
  }),
  collaboration: (title) => ({
    question: `“${title}”涉及哪些协作对象？你如何分工、沟通并推动关键事项完成？`,
    purpose: "补充团队协作与推动过程",
  }),
  result: (title) => ({
    question: `“${title}”最终产生了什么真实结果？请尽量提供覆盖人数、完成率、增长变化、效率、排名、满意度或反馈数量等可核实数据；没有数字时说明交付、采用或正式反馈。`,
    purpose: "补充可量化或可验证的真实成果",
  }),
  other: (title) => ({
    question: `“${title}”还有哪些能够证明个人能力的具体事实、交付物或反馈？`,
    purpose: "补充经历证据",
  }),
};

/** Adds deterministic fallback questions when the model leaves an assessed gap uncovered. */
export function ensureFollowUpCoverage(
  questions: FollowUpQuestion[] = [],
  assessments: ExperienceAssessment[] = [],
  jobStage: JobStage
): FollowUpQuestion[] {
  const normalizedAssessments = normalizeExperienceAssessments(assessments, jobStage);
  const assessmentById = new Map(
    normalizedAssessments.map((item) => [item.experienceId, item])
  );
  const result = questions.filter((question) => {
    if (question.experienceId === "campus-discovery") return jobStage === "校招";
    if (!question.experienceId) return false;
    const assessment = assessmentById.get(question.experienceId);
    return Boolean(assessment && assessment.evidenceCompleteness !== "complete");
  });
  const usedIds = new Set(result.map((item) => item.id));
  let fallbackIndex = 1;

  normalizedAssessments.forEach((assessment) => {
    if (["skill", "other"].includes(assessment.experienceType)) return;
    if (assessment.evidenceCompleteness === "complete") return;

    const current = result.filter(
      (item) => item.experienceId === assessment.experienceId
    );
    const desiredCount =
      assessment.evidenceCompleteness === "weak"
        ? Math.min(3, Math.max(1, assessment.missingDimensions.length))
        : Math.min(2, Math.max(1, assessment.missingDimensions.length));
    const socialRemovalLimit =
      jobStage !== "校招" && assessment.suggestedAction === "removal_candidate"
        ? Math.min(desiredCount, 2)
        : desiredCount;
    if (current.length >= socialRemovalLimit) return;

    const usedDimensions = new Set(current.map((item) => item.evidenceDimension));
    const preferredDimensions = [
      ...assessment.missingDimensions,
      "action",
      "result",
      "scale",
      "collaboration",
      "challenge",
      "role",
    ].filter(
      (dimension, index, all): dimension is EvidenceDimension =>
        EVIDENCE_DIMENSIONS.includes(dimension as EvidenceDimension) &&
        all.indexOf(dimension) === index
    );

    for (const dimension of preferredDimensions) {
      if (current.length >= socialRemovalLimit) break;
      if (usedDimensions.has(dimension)) continue;
      const template = FOLLOW_UP_TEMPLATES[dimension](
        assessment.experienceTitle || assessment.organization || assessment.role
      );
      let id = `fu-fallback-${fallbackIndex++}`;
      while (usedIds.has(id)) id = `fu-fallback-${fallbackIndex++}`;
      usedIds.add(id);
      usedDimensions.add(dimension);
      const question: FollowUpQuestion = {
        id,
        experienceId: assessment.experienceId,
        experienceType: assessment.experienceType,
        experienceTitle: assessment.experienceTitle,
        evidenceDimension: dimension,
        question: template.question,
        purpose: template.purpose,
        userAnswer: "",
        generatedBullet: "",
      };
      result.push(question);
      current.push(question);
    }
  });

  return result;
}

function shouldRemove(assessment: ExperienceAssessment, jobStage: JobStage): boolean {
  return jobStage !== "校招" && assessment.userDecision === "remove";
}

function assessmentKey(assessment: ExperienceAssessment): string {
  return normalizeKey(
    `${assessment.organization}${assessment.experienceTitle}${assessment.role}`
  );
}

function entryKey(entry: { organization?: string; company?: string; name?: string; role: string }) {
  return normalizeKey(`${entry.organization ?? entry.company ?? entry.name ?? ""}${entry.role}`);
}

function isSameExperience(
  entry: { sourceExperienceId?: string; organization?: string; company?: string; name?: string; role: string },
  assessment: ExperienceAssessment
): boolean {
  if (entry.sourceExperienceId === assessment.experienceId) return true;
  const sourceKey = assessmentKey(assessment);
  const finalKey = entryKey(entry);
  return Boolean(sourceKey && finalKey && (sourceKey.includes(finalKey) || finalKey.includes(sourceKey)));
}

function restoreOriginalBullets(generated: string[], original: string[]): string[] {
  const normalizedGenerated = normalizeBullets(generated);
  const normalizedOriginal = normalizeBullets(original);
  if (normalizedOriginal.length === 0) return normalizedGenerated;
  if (normalizedGenerated.length === 0) return normalizedOriginal;

  const generatedLength = normalizedGenerated.join("").length;
  const originalLength = normalizedOriginal.join("").length;
  if (generatedLength >= originalLength * 0.65) return normalizedGenerated;

  const combined = [...normalizedGenerated];
  for (const bullet of normalizedOriginal) {
    if (combined.length >= 3) break;
    const key = normalizeKey(bullet);
    if (!combined.some((item) => normalizeKey(item).includes(key) || key.includes(normalizeKey(item)))) {
      combined.push(bullet);
    }
  }
  return combined;
}

/**
 * Enforces user-owned removal decisions after LLM generation. Campus recruiting
 * keeps every inventoried experience; social recruiting removes only entries the
 * user explicitly approved and restores anything the model omitted on its own.
 */
export function enforceExperienceRetention(
  resume: FinalResume,
  assessments: ExperienceAssessment[] = [],
  jobStage: JobStage
): FinalResume {
  const normalized = normalizeExperienceAssessments(assessments, jobStage);
  const retained = normalized.filter((item) => !shouldRemove(item, jobStage));
  const removed = normalized.filter((item) => shouldRemove(item, jobStage));

  const workExperience = (resume.workExperience ?? [])
    .filter(
      (entry) =>
        !removed.some(
          (item) =>
            ["work", "internship"].includes(item.experienceType) &&
            isSameExperience(entry, item)
        )
    )
    .map((entry) => {
      const source = retained.find(
        (item) => ["work", "internship"].includes(item.experienceType) && isSameExperience(entry, item)
      );
      return source
        ? {
            ...entry,
            sourceExperienceId: source.experienceId,
            bullets: restoreOriginalBullets(entry.bullets, source.originalBullets),
          }
        : entry;
    });
  const projectExperience = (resume.projectExperience ?? [])
    .filter(
      (entry) =>
        !removed.some(
          (item) => item.experienceType === "project" && isSameExperience(entry, item)
        )
    )
    .map((entry) => {
      const source = retained.find(
        (item) => item.experienceType === "project" && isSameExperience(entry, item)
      );
      return source
        ? {
            ...entry,
            sourceExperienceId: source.experienceId,
            bullets: restoreOriginalBullets(entry.bullets, source.originalBullets),
          }
        : entry;
    });
  const campusExperience = (resume.campusExperience ?? [])
    .filter(
      (entry) =>
        !removed.some(
          (item) => item.experienceType === "campus" && isSameExperience(entry, item)
        )
    )
    .map((entry) => {
      const source = retained.find(
        (item) => item.experienceType === "campus" && isSameExperience(entry, item)
      );
      return source
        ? {
            ...entry,
            sourceExperienceId: source.experienceId,
            bullets: restoreOriginalBullets(entry.bullets, source.originalBullets),
          }
        : entry;
    });

  retained.forEach((item) => {
    if (["work", "internship"].includes(item.experienceType)) {
      if (!workExperience.some((entry) => isSameExperience(entry, item))) {
        workExperience.push({
          sourceExperienceId: item.experienceId,
          company: item.organization || item.experienceTitle,
          role: item.role,
          period: item.period,
          bullets: item.originalBullets,
        });
      }
    } else if (item.experienceType === "project") {
      if (!projectExperience.some((entry) => isSameExperience(entry, item))) {
        projectExperience.push({
          sourceExperienceId: item.experienceId,
          name: item.experienceTitle || item.organization,
          role: item.role,
          period: item.period,
          bullets: item.originalBullets,
        });
      }
    } else if (item.experienceType === "campus") {
      if (!campusExperience.some((entry) => isSameExperience(entry, item))) {
        campusExperience.push({
          sourceExperienceId: item.experienceId,
          organization: item.organization || item.experienceTitle,
          role: item.role,
          period: item.period,
          bullets: item.originalBullets,
        });
      }
    }
  });

  return { ...resume, workExperience, projectExperience, campusExperience };
}
