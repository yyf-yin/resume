"use client";

import {
  Lightbulb,
  Loader2,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import { generatePerfectionPlan } from "@/services/ai/resumeAgent";
import { useResumeStore } from "@/store/resume-store";

export function PerfectionStep() {
  const {
    analysisResult,
    userInput,
    perfectionPlan,
    isGeneratingPerfection,
    perfectionError,
    exampleMode,
    setPerfectionPlan,
    setGeneratingPerfection,
    setPerfectionError,
  } = useResumeStore();

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const weakMatches = analysisResult.matchItems.filter(
    (item) =>
      item.needsSupplement || item.evidenceStrength === "weak" || item.evidenceStrength === "none"
  );
  const resumeWeaknesses = Array.from(
    new Set(
      weakMatches.length > 0
        ? weakMatches.map((item) => item.jdRequirement)
        : analysisResult.diagnosis.mainIssues
    )
  );

  const handleGenerate = async () => {
    setGeneratingPerfection(true);
    setPerfectionError(null);
    try {
      const plan = await generatePerfectionPlan(
        userInput,
        analysisResult.diagnosis,
        analysisResult.matchItems,
        analysisResult.followUpQuestions,
        exampleMode
      );
      setPerfectionPlan(plan);
    } catch (error) {
      setPerfectionError(error instanceof Error ? error.message : "补强建议生成失败，请稍后重试");
    } finally {
      setGeneratingPerfection(false);
    }
  };

  const priorityMeta = {
    high: { label: "高优先度", variant: "danger" as const },
    medium: { label: "中优先度", variant: "warning" as const },
    low: { label: "低优先度", variant: "secondary" as const },
  };

  return (
    <div>
      <SectionTitle
        title="精益求精"
        description="针对简历弱项，获得补强建议"
      />

      <Card className="mb-6">
        <CardContent className="py-5">
          <p className="mb-3 text-sm font-medium text-neutral-900">当前简历弱项：</p>
          <ul className="mb-5 space-y-2">
            {resumeWeaknesses.map((weakness) => (
              <li key={weakness} className="flex gap-2 text-sm text-neutral-600">
                <span className="text-neutral-300">•</span>
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
          <p className="mb-4 text-sm text-neutral-700">
            补强后简历会有更强竞争力，立刻生成专属补强建议
          </p>
          <Button size="sm" onClick={handleGenerate} disabled={isGeneratingPerfection}>
            {isGeneratingPerfection ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                生成中...
              </>
            ) : perfectionPlan ? (
              <>
                <RotateCw className="h-3.5 w-3.5" />
                重新生成专属补强建议
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                生成专属补强建议
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {perfectionError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {perfectionError}
        </div>
      )}

      {perfectionPlan && (
        <>
          <Card className="mb-4 border-emerald-200 bg-emerald-50/30">
            <CardContent className="py-4">
              <p className="text-sm leading-relaxed text-neutral-700">{perfectionPlan.summary}</p>
            </CardContent>
          </Card>

          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-semibold">补强建议</h3>
            <Badge variant="secondary" className="font-normal">
              {perfectionPlan.recommendations.length} 项
            </Badge>
          </div>
          <div className="mb-6 grid gap-4">
            {perfectionPlan.recommendations.map((recommendation) => {
              const priority = priorityMeta[recommendation.priority];

              return (
              <Card key={recommendation.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="mb-1 text-xs text-neutral-400">针对弱项：{recommendation.targetGap}</p>
                      <CardTitle className="text-base">{recommendation.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline">{recommendation.category}</Badge>
                      <Badge variant={priority.variant}>{priority.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-neutral-500">建议</p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {recommendation.suggestion}
                    </p>
                  </div>
                  <div className="rounded-md bg-neutral-50 p-3">
                    <p className="mb-1 text-xs font-medium text-neutral-500">推荐理由</p>
                    <p className="text-sm leading-relaxed text-neutral-600">
                      {recommendation.reason}
                    </p>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
