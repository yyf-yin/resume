"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/shared/ui-helpers";
import { useResumeStore } from "@/store/resume-store";
import {
  discardPendingResumeAnalysis,
  getPendingResumeAnalysisInput,
  hasPendingResumeAnalysis,
  runResumeAnalysis,
} from "@/services/ai/resumeAgent";
import type { CompanyType, JobStage } from "@/types/resume";

export function InputStep() {
  const [hasPendingAnalysis, setHasPendingAnalysis] = useState(false);
  const {
    userInput,
    setUserInput,
    loadExampleData,
    isAnalyzing,
    analysisResult,
    analysisError,
    setAnalyzing,
    setAnalysisResult,
    resetAnalysisProgress,
    setAnalysisError,
    setCurrentStep,
    exampleMode,
  } = useResumeStore();

  useEffect(() => {
    const pendingInput = getPendingResumeAnalysisInput();
    if (pendingInput) setUserInput(pendingInput);
    setHasPendingAnalysis(hasPendingResumeAnalysis());
  }, [setUserInput]);

  const handleAnalyze = async (resumePending = false) => {
    const input = resumePending ? getPendingResumeAnalysisInput() ?? userInput : userInput;
    if (!input.targetRole || !input.jobDescription || !input.originalResume) {
      return;
    }
    if (resumePending) setUserInput(input);
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await runResumeAnalysis(
        input,
        "professional-match",
        exampleMode,
        resumePending
      );
      setHasPendingAnalysis(false);
      setAnalysisResult(result, "professional-match");
      setCurrentStep("jd-analysis");
    } catch (error) {
      setHasPendingAnalysis(hasPendingResumeAnalysis());
      setAnalysisError(error instanceof Error ? error.message : "分析失败，请稍后重试");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRestart = () => {
    if (!window.confirm("是否确认放弃当前进度重新开始")) return;
    discardPendingResumeAnalysis();
    setHasPendingAnalysis(false);
    resetAnalysisProgress();
  };

  const canAnalyze =
    userInput.targetRole.trim() &&
    userInput.jobDescription.trim() &&
    userInput.originalResume.trim();
  const hasAnalysisProgress = hasPendingAnalysis || analysisResult !== null;
  const isInputLocked = isAnalyzing || hasAnalysisProgress;

  return (
    <div>
      <SectionTitle
        title="输入材料"
        description="填写目标岗位信息与原始简历，Agent 将基于 JD 进行定制分析与优化"
      />

      <div className="mb-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={loadExampleData}
          disabled={exampleMode || isInputLocked}
        >
          <Wand2 className="h-3.5 w-3.5" />
          使用示例数据
        </Button>
        {hasAnalysisProgress ? (
          <>
            <Button
              size="sm"
              onClick={() => {
                if (analysisResult) {
                  setCurrentStep("jd-analysis");
                } else {
                  void handleAnalyze(true);
                }
              }}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  继续分析
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestart}
              disabled={isAnalyzing}
            >
              重新开始
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => void handleAnalyze(false)}
            disabled={!canAnalyze || isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                开始分析
              </>
            )}
          </Button>
        )}
      </div>

      {analysisError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {analysisError}
        </div>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">目标岗位信息</CardTitle>
            <CardDescription>帮助 Agent 理解你的求职方向</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetRole">目标岗位</Label>
              <Input
                id="targetRole"
                placeholder="如：AI 产品经理"
                value={userInput.targetRole}
                disabled={exampleMode || isInputLocked}
                onChange={(e) => setUserInput({ targetRole: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">行业</Label>
              <Input
                id="industry"
                placeholder="如：企业服务 / SaaS"
                value={userInput.industry}
                disabled={exampleMode || isInputLocked}
                onChange={(e) => setUserInput({ industry: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>公司类型</Label>
              <Select
                value={userInput.companyType}
                disabled={exampleMode || isInputLocked}
                onValueChange={(v) => setUserInput({ companyType: v as CompanyType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="大厂">大厂</SelectItem>
                  <SelectItem value="中型公司">中型公司</SelectItem>
                  <SelectItem value="创业公司">创业公司</SelectItem>
                  <SelectItem value="外企">外企</SelectItem>
                  <SelectItem value="国企">国企</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>求职阶段</Label>
              <Select
                value={userInput.jobStage}
                disabled={exampleMode || isInputLocked}
                onValueChange={(v) => setUserInput({ jobStage: v as JobStage })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="校招">校招</SelectItem>
                  <SelectItem value="社招-初级">社招-初级</SelectItem>
                  <SelectItem value="社招-中级">社招-中级</SelectItem>
                  <SelectItem value="社招-高级">社招-高级</SelectItem>
                  <SelectItem value="转行">转行</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="highlightSkills">希望突出的能力</Label>
              <Input
                id="highlightSkills"
                placeholder="如：AI 产品规划、数据驱动、ToB 需求分析"
                value={userInput.highlightSkills}
                disabled={exampleMode || isInputLocked}
                onChange={(e) => setUserInput({ highlightSkills: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">目标 JD</CardTitle>
            <CardDescription>粘贴完整岗位描述，Agent 将解析职责与要求</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[200px] font-mono text-xs leading-relaxed"
              placeholder="粘贴岗位 JD..."
              value={userInput.jobDescription}
              disabled={exampleMode || isInputLocked}
              onChange={(e) => setUserInput({ jobDescription: e.target.value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">原始简历</CardTitle>
            <CardDescription>粘贴当前简历全文</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[240px] font-mono text-xs leading-relaxed"
              placeholder={"粘贴简历内容...\n请粘贴单页简历，简历过长可能会导致信息丢失"}
              value={userInput.originalResume}
              disabled={exampleMode || isInputLocked}
              onChange={(e) => setUserInput({ originalResume: e.target.value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">补充信息（可选）</CardTitle>
            <CardDescription>项目细节、转型动机、特殊说明等</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[100px] text-sm"
              placeholder="补充 Agent 需要了解的信息..."
              value={userInput.additionalInfo}
              disabled={exampleMode || isInputLocked}
              onChange={(e) => setUserInput({ additionalInfo: e.target.value })}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
