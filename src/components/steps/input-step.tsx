"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import { Eye, FileText, Loader2, Sparkles, Upload, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedResumeText, setUploadedResumeText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [processingFileName, setProcessingFileName] = useState<string | null>(null);
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

  useEffect(() => {
    const preventFileNavigation = (event: globalThis.DragEvent) => {
      if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) {
        event.preventDefault();
      }
    };

    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

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
  const uploadDisabled = exampleMode || isInputLocked || isParsingResume;

  const parseResumeFile = async (file: File) => {
    setUploadError(null);
    setProcessingFileName(file.name);
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "pdf" && extension !== "docx") {
      setUploadError("仅支持 PDF 和 DOCX 文件");
      setProcessingFileName(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("文件不能超过 10MB");
      setProcessingFileName(null);
      return;
    }

    setIsParsingResume(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/resume/parse", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
        fileName?: string;
      };
      if (!response.ok || !payload.text) {
        throw new Error(payload.error || `文件解析失败（${response.status}）`);
      }
      setUserInput({ originalResume: payload.text });
      setUploadedFileName(payload.fileName || file.name);
      setUploadedResumeText(payload.text);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "文件解析失败");
    } finally {
      setIsParsingResume(false);
      setProcessingFileName(null);
    }
  };

  const handleResumeUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void parseResumeFile(file);
  };

  const handleResumeDrop = (event: DragEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingResume(false);
    if (uploadDisabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void parseResumeFile(file);
  };

  return (
    <div>
      <SectionTitle
        title="输入材料"
        description="填写目标岗位信息与原始简历，Agent 将基于 JD 进行定制分析与优化"
      />

      <div className="mb-4 flex flex-wrap gap-2">
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
                  <SelectItem value="校招">校招/实习</SelectItem>
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
              className="min-h-[160px] font-mono text-xs leading-relaxed sm:min-h-[200px]"
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
            <CardDescription>粘贴简历全文，或上传 PDF / Word 文档自动提取</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={`relative flex min-h-28 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors focus-within:ring-2 focus-within:ring-neutral-400 focus-within:ring-offset-2 ${
                isDraggingResume
                  ? "border-neutral-900 bg-neutral-100"
                  : "border-neutral-300 bg-neutral-50 hover:border-neutral-500 hover:bg-neutral-100"
              } ${uploadDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              <input
                id="resume-file-upload"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className={`absolute inset-0 z-10 h-full w-full opacity-0 ${
                  uploadDisabled ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                aria-label="选择或拖入简历文件"
                disabled={uploadDisabled}
                onChange={handleResumeUpload}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (!uploadDisabled) setIsDraggingResume(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = uploadDisabled ? "none" : "copy";
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDraggingResume(false);
                }}
                onDrop={handleResumeDrop}
              />
              {isParsingResume ? (
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-neutral-600" />
              ) : (
                <Upload className="mb-2 h-6 w-6 text-neutral-600" />
              )}
              <span className="text-sm font-medium">
                {isParsingResume
                  ? `已接收 ${processingFileName ?? "文件"}，正在解析...`
                  : isDraggingResume
                    ? "松开鼠标上传"
                    : "点击选择，或将简历拖到这里"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                支持 PDF、DOCX，最大 10MB
              </span>
            </div>
            {uploadedFileName && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <FileText className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate">已提取：{uploadedFileName}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  预览
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  aria-label="清除已上传简历"
                  disabled={isInputLocked}
                  onClick={() => {
                    setUploadedFileName(null);
                    setUploadedResumeText("");
                    setPreviewOpen(false);
                    setUploadError(null);
                    setUserInput({ originalResume: "" });
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {uploadError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {uploadError}
              </div>
            )}
            <Textarea
              className="min-h-[180px] font-mono text-xs leading-relaxed sm:min-h-[240px]"
              placeholder={"粘贴简历内容...\n请粘贴单页简历，简历过长可能会导致信息丢失"}
              value={userInput.originalResume}
              disabled={exampleMode || isInputLocked || isParsingResume}
              onChange={(e) => {
                setUserInput({ originalResume: e.target.value });
                if (uploadedFileName) {
                  setUploadedFileName(null);
                  setUploadedResumeText("");
                }
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-h-[92dvh] max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8">
                <FileText className="h-5 w-5" />
                文档预览
              </DialogTitle>
              <DialogDescription className="break-all">
                {uploadedFileName} · 已提取 {uploadedResumeText.length.toLocaleString()} 个字符
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto rounded-md border bg-neutral-50 p-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-neutral-800">
                {uploadedResumeText}
              </pre>
            </div>
          </DialogContent>
        </Dialog>

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
