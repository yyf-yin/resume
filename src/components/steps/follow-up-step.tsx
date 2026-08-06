"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, SectionTitle } from "@/components/shared/ui-helpers";
import {
  generateFollowUpBullet,
  regenerateOptimizedItems,
} from "@/services/ai/resumeAgent";
import { useResumeStore } from "@/store/resume-store";

const EXPERIENCE_TYPE_LABELS = {
  work: "工作经历",
  internship: "实习经历",
  project: "项目经历",
  campus: "校园经历",
  skill: "技能能力",
  other: "补充信息",
} as const;

const EVIDENCE_DIMENSION_LABELS = {
  role: "个人角色",
  action: "具体行动",
  scale: "经历规模",
  challenge: "关键难点",
  collaboration: "协作过程",
  result: "真实结果",
  other: "证据补充",
} as const;

export function FollowUpStep() {
  const {
    analysisResult,
    userInput,
    optimizeStyle,
    exampleMode,
    updateFollowUpAnswer,
    setFollowUpBullet,
    setAnalysisResult,
    setCurrentStep,
  } = useResumeStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isSyncingFollowUps, setIsSyncingFollowUps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!analysisResult) {
    return <EmptyState message="请先完成输入材料并开始分析" />;
  }

  const { followUpQuestions } = analysisResult;

  const handleGenerateBullet = async (id: string) => {
    const question = followUpQuestions.find((q) => q.id === id);
    if (!question?.userAnswer.trim()) return;

    setLoadingId(id);
    setError(null);
    try {
      const bullet = await generateFollowUpBullet(
        userInput,
        question.question,
        question.purpose,
        question.userAnswer,
        exampleMode
      );
      setFollowUpBullet(id, bullet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bullet 生成失败");
    } finally {
      setLoadingId(null);
    }
  };

  const handleContinue = async () => {
    const hasFollowUpEvidence = followUpQuestions.some(
      (question) => question.userAnswer.trim() || question.generatedBullet.trim()
    );

    if (!hasFollowUpEvidence) {
      setCurrentStep("optimize");
      return;
    }

    setIsSyncingFollowUps(true);
    setError(null);
    try {
      const { optimizedItems, finalResume, finalResumeScore, interviewPrep } =
        await regenerateOptimizedItems(
          userInput,
          optimizeStyle,
          analysisResult.diagnosis,
          followUpQuestions,
          exampleMode
        );
      setAnalysisResult(
        { ...analysisResult, optimizedItems, finalResume, finalResumeScore, interviewPrep },
        optimizeStyle
      );
      setCurrentStep("optimize");
    } catch (err) {
      setError(err instanceof Error ? err.message : "追问信息同步失败");
    } finally {
      setIsSyncingFollowUps(false);
    }
  };

  return (
    <div>
      <SectionTitle
        title="经历追问"
        description="Agent 针对能力缺口和缺少成果的经历生成最多 10 个追问，填写回答后可生成简历 bullet"
      />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 space-y-4">
        {followUpQuestions.map((q, index) => (
          <Card key={q.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-400">
                      追问 {index + 1}
                    </span>
                    <Badge variant="outline" className="font-normal">
                      {q.purpose}
                    </Badge>
                    {q.experienceType && (
                      <Badge variant="secondary" className="font-normal">
                        {EXPERIENCE_TYPE_LABELS[q.experienceType]}
                        {q.experienceTitle ? ` · ${q.experienceTitle}` : ""}
                      </Badge>
                    )}
                    {q.evidenceDimension && (
                      <Badge variant="secondary" className="font-normal">
                        {EVIDENCE_DIMENSION_LABELS[q.evidenceDimension]}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug">{q.question}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`answer-${q.id}`}>你的回答</Label>
                <Textarea
                  id={`answer-${q.id}`}
                  className="min-h-[80px] text-sm"
                  placeholder="填写具体经历、数据和方法..."
                  value={q.userAnswer}
                  onChange={(e) => updateFollowUpAnswer(q.id, e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!q.userAnswer.trim() || loadingId === q.id}
                onClick={() => handleGenerateBullet(q.id)}
              >
                {loadingId === q.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    生成简历 bullet
                  </>
                )}
              </Button>
              {q.generatedBullet && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="mb-1 text-xs font-medium text-emerald-700">生成的 bullet</p>
                  <p className="text-sm leading-relaxed text-neutral-700">{q.generatedBullet}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={isSyncingFollowUps || loadingId !== null}
          onClick={handleContinue}
        >
          {isSyncingFollowUps ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              正在同步追问信息...
            </>
          ) : (
            <>
              下一步：简历优化
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
