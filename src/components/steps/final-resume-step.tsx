"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";

interface ResumeEntry {
  name: string;
  role: string;
  period: string;
  bullets: string[];
}

function EntrySection({ title, entries }: { title: string; entries: ResumeEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-5">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-400">
        {title}
      </h4>
      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={`${entry.name}-${entry.period}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">
                {entry.name} · {entry.role}
              </p>
              <span className="text-xs text-neutral-400">{entry.period}</span>
            </div>
            <ul className="mt-2 space-y-1">
              {entry.bullets.map((bullet, index) => (
                <li key={index} className="flex gap-2 text-sm text-neutral-600">
                  <span className="text-neutral-300">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function EducationSection({
  education,
}: {
  education: { school: string; degree: string; period: string };
}) {
  return (
    <section className="mb-5">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
        教育背景
      </h4>
      <p className="text-sm">
        {education.school} · {education.degree} · {education.period}
      </p>
    </section>
  );
}

function SkillsSection({ title, skills }: { title: string; skills: string[] }) {
  if (skills.length === 0) return null;

  return (
    <section className="mb-5">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
        {title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <Badge key={skill} variant="secondary" className="font-normal">
            {skill}
          </Badge>
        ))}
      </div>
    </section>
  );
}

export function FinalResumeStep() {
  const { analysisResult, setCurrentStep } = useResumeStore();

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const { finalResume } = analysisResult;
  const { personalInfo } = finalResume;
  const isCampusTemplate = finalResume.template === "campus";
  const workEntries = finalResume.workExperience.map((item) => ({
    name: item.company,
    role: item.role,
    period: item.period,
    bullets: item.bullets,
  }));
  const projectEntries = finalResume.projectExperience.map((item) => ({
    name: item.name,
    role: item.role,
    period: item.period,
    bullets: item.bullets,
  }));
  const campusEntries = finalResume.campusExperience.map((item) => ({
    name: item.organization,
    role: item.role,
    period: item.period,
    bullets: item.bullets,
  }));
  const showCampusExperience = campusEntries.length > 0;

  return (
    <div>
      <SectionTitle
        title="最终简历"
        description="基于分析与优化生成的完整简历"
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">{personalInfo.name}</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {personalInfo.email} · {personalInfo.phone} · {personalInfo.location}
            </p>
          </div>

          <Separator className="my-4" />

          <section className="mb-5">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              求职意向
            </h4>
            <p className="text-sm">{finalResume.jobIntent}</p>
          </section>

          {isCampusTemplate && <EducationSection education={finalResume.education} />}

          {!isCampusTemplate && finalResume.summary && (
            <section className="mb-5">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
                职业摘要
              </h4>
              <p className="text-sm leading-relaxed text-neutral-700">{finalResume.summary}</p>
            </section>
          )}

          <SkillsSection
            title={isCampusTemplate ? "专业能力" : "核心能力"}
            skills={finalResume.coreSkills}
          />

          <EntrySection
            title={isCampusTemplate ? "实习经历" : "工作经历"}
            entries={workEntries}
          />

          <EntrySection title="项目经历" entries={projectEntries} />

          {showCampusExperience && <EntrySection title="校园经历" entries={campusEntries} />}

          {isCampusTemplate && finalResume.awardsAndCertificates.length > 0 && (
            <section className="mb-5">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
                获奖证书
              </h4>
              <ul className="space-y-1">
                {finalResume.awardsAndCertificates.map((award) => (
                  <li key={award} className="flex gap-2 text-sm text-neutral-600">
                    <span className="text-neutral-300">•</span>
                    <span>{award}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-5">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              技能工具
            </h4>
            <p className="text-sm text-neutral-600">{finalResume.skillsAndTools.join(" · ")}</p>
          </section>

          {!isCampusTemplate && <EducationSection education={finalResume.education} />}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep("interview")}>
          下一步：面试准备
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
