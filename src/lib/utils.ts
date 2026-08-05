import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatResumeAsText(resume: import("@/types/resume").FinalResume): string {
  const lines: string[] = [];
  const isCampusTemplate = resume.template === "campus";
  const pushEducation = () => {
    lines.push("教育背景");
    lines.push(`${resume.education.school} | ${resume.education.degree} | ${resume.education.period}`);
    lines.push("");
  };
  const pushEntries = (
    title: string,
    entries: Array<{ name: string; role: string; period: string; bullets: string[] }>
  ) => {
    if (entries.length === 0) return;
    lines.push(title);
    entries.forEach((entry) => {
      lines.push(`${entry.name} | ${entry.role} | ${entry.period}`);
      entry.bullets.forEach((bullet) => lines.push(`  • ${bullet}`));
      lines.push("");
    });
  };

  lines.push(resume.personalInfo.name);
  lines.push(
    `${resume.personalInfo.email} | ${resume.personalInfo.phone} | ${resume.personalInfo.location}`
  );
  lines.push("");
  lines.push(`求职意向：${resume.jobIntent}`);
  lines.push("");

  if (isCampusTemplate) {
    pushEducation();
  } else if (resume.summary) {
    lines.push("职业摘要");
    lines.push(resume.summary);
    lines.push("");
  }

  lines.push(isCampusTemplate ? "专业能力" : "核心能力");
  resume.coreSkills.forEach((s) => lines.push(`• ${s}`));
  lines.push("");

  pushEntries(
    isCampusTemplate ? "实习经历" : "工作经历",
    resume.workExperience.map((item) => ({ ...item, name: item.company }))
  );
  pushEntries("项目经历", resume.projectExperience);

  if (isCampusTemplate) {
    pushEntries(
      "校园经历",
      resume.campusExperience.map((item) => ({ ...item, name: item.organization }))
    );
    if (resume.awardsAndCertificates.length > 0) {
      lines.push("获奖证书");
      resume.awardsAndCertificates.forEach((award) => lines.push(`• ${award}`));
      lines.push("");
    }
  }

  lines.push("技能工具");
  lines.push(resume.skillsAndTools.join(" · "));
  lines.push("");

  if (!isCampusTemplate) pushEducation();

  return lines.join("\n").trim();
}
