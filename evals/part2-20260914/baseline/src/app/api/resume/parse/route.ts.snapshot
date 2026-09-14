import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 100_000;

function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function isPdf(bytes: Uint8Array) {
  return bytes.length >= 4 && new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF";
}

function isZip(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择要上传的简历文件" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "上传的文件为空" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "文件不能超过 10MB" }, { status: 413 });
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "pdf" && extension !== "docx") {
      return NextResponse.json({ error: "仅支持 PDF 和 DOCX 文件" }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (extension === "pdf") {
      if (!isPdf(buffer)) {
        return NextResponse.json({ error: "文件内容不是有效的 PDF" }, { status: 415 });
      }
      const parser = new PDFParse({ data: buffer });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else {
      if (!isZip(buffer)) {
        return NextResponse.json({ error: "文件内容不是有效的 DOCX" }, { status: 415 });
      }
      text = (await mammoth.extractRawText({ buffer })).value;
    }

    const normalizedText = normalizeText(text);
    if (normalizedText.length < 20) {
      return NextResponse.json(
        { error: "未能提取到有效文字；如果是扫描版 PDF，请先进行 OCR 后再上传" },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: normalizedText, fileName: file.name });
  } catch (error) {
    console.error("Resume parsing failed", error);
    return NextResponse.json(
      { error: "文件解析失败，请确认文件未损坏或未设置密码" },
      { status: 422 }
    );
  }
}
