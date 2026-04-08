import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PromptSettings } from "@/lib/types/prompt-settings";

const dataDir = path.join(process.cwd(), "data");
const settingsFile = path.join(dataDir, "prompt-settings.json");
let promptSettingsStorageAvailable: boolean | null = null;
let memoryPromptSettings: PromptSettings | null = null;

export function buildDefaultPromptSettings(): PromptSettings {
  return {
    systemRole:
      "你是一位资历深厚的高级教师兼教研助手。请根据输入信息生成可直接打印或发给学生使用的讲义型备课包。输出必须具体、可执行，不能只是概要提纲，要像经验丰富的名师在亲自备课。",
    lectureRequirements:
      "知识讲义必须写成篇幅适中、拒绝废话、逻辑严密的深度讲义，字数要克制，重点是把底层逻辑讲明白。必须严格按以下结构输出：1. 启发式引入：用 2-3 句话的生活实例或启发式提问开场，严禁直接给定义，目标是让学生先明白为什么要学这个知识点。2. 逻辑剥笋流程图：输出一段 mermaid graph TD 代码，清晰展示从核心痛点问题到推导步骤再到核心公式或结论生成的路径。3. 核心知识点深度对照表：使用 Markdown 表格，列为“核心概念 | 深度解析（为什么） | 名师大白话（怎么用）”，拒绝照抄教科书原话，要体现二次消化。4. 变式眼预警：使用引用块 > 输出，指出这个知识点在题目里的伪装手段、常见陷阱或变式马甲，让学生能一眼识别。",
    exerciseRequirements:
      "课堂练习要比输入数量更充足，题目要具体，像真实补习题。题目难度要有层次，包含基础巩固、变式训练和综合应用。",
    homeworkRequirements:
      "课后作业必须是具体习题，不能只写复习建议。每道题都要有明确题干，并给出对应参考答案，便于老师课后讲评。",
    parentFeedbackRequirements:
      "家长反馈必须固定包含：本次学习内容、学生掌握情况、当前存在的具体问题、回家复习建议/下一步安排。语气要像老师真实发给家长的话，具体、自然、可执行。",
    outputRequirements:
      "必须覆盖课堂目标、知识点总结、重点难点、讲解提纲、例题、当堂练习、课后作业、答案解析、家长反馈。所有内容都要具体、可落地，不要口号化。知识讲义部分允许使用 Markdown、表格和 Mermaid 代码块来提升可读性，但仍要保持清晰、适中、可打印。防注水、防重复红线补充：在模块6答案解析的[满分范式]中，严禁使用抽象字母公式（如 |x2-x1| ）进行概括，必须针对模块4课堂练习中的第1题，输出一份带具体数字、完整步骤、有“解”有“答”的真实考场满分作答范式，让学生可以直接模仿书写。",
    extraInstructions:
      "如果学科是数学，要保证题目条件完整、答案准确；如果学科是英语，要兼顾词汇、句型、语法与训练题；如果学科是语文，要兼顾知识点讲解、阅读表达和练习素材。",
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultPromptSettings(): PromptSettings {
  return buildDefaultPromptSettings();
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function ensureSettingsFile(): Promise<boolean> {
  if (promptSettingsStorageAvailable === false) {
    return false;
  }

  try {
    await mkdir(dataDir, { recursive: true });

    try {
      await readFile(settingsFile, "utf-8");
    } catch {
      await writeFile(
        settingsFile,
        JSON.stringify(buildDefaultPromptSettings(), null, 2),
        "utf-8",
      );
    }

    promptSettingsStorageAvailable = true;
    return true;
  } catch {
    promptSettingsStorageAvailable = false;
    return false;
  }
}

export async function readPromptSettings(): Promise<PromptSettings> {
  const storageAvailable = await ensureSettingsFile();

  if (!storageAvailable) {
    return memoryPromptSettings ?? buildDefaultPromptSettings();
  }

  try {
    const content = await readFile(settingsFile, "utf-8");
    const parsed = JSON.parse(content) as Partial<PromptSettings>;
    const fallback = buildDefaultPromptSettings();

    const normalized = {
      systemRole: normalizeText(parsed.systemRole, fallback.systemRole),
      lectureRequirements: normalizeText(parsed.lectureRequirements, fallback.lectureRequirements),
      exerciseRequirements: normalizeText(
        parsed.exerciseRequirements,
        fallback.exerciseRequirements,
      ),
      homeworkRequirements: normalizeText(
        parsed.homeworkRequirements,
        fallback.homeworkRequirements,
      ),
      parentFeedbackRequirements: normalizeText(
        parsed.parentFeedbackRequirements,
        fallback.parentFeedbackRequirements,
      ),
      outputRequirements: normalizeText(
        parsed.outputRequirements,
        fallback.outputRequirements,
      ),
      extraInstructions: normalizeText(parsed.extraInstructions, fallback.extraInstructions),
      updatedAt: normalizeText(parsed.updatedAt, fallback.updatedAt),
    };

    memoryPromptSettings = normalized;
    return normalized;
  } catch {
    return memoryPromptSettings ?? buildDefaultPromptSettings();
  }
}

export async function writePromptSettings(input: PromptSettings): Promise<void> {
  memoryPromptSettings = input;

  const storageAvailable = await ensureSettingsFile();
  if (!storageAvailable) {
    return;
  }

  try {
    await writeFile(settingsFile, JSON.stringify(input, null, 2), "utf-8");
  } catch {
    promptSettingsStorageAvailable = false;
  }
}
