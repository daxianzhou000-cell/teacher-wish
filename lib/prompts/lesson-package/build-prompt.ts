import { coreGuardrailsPrompt } from "@/lib/prompts/core/guardrails";
import { globalBasePrompt } from "@/lib/prompts/core/global-base";
import { outputStructure } from "@/lib/prompts/core/output-structure";
import { antiParallelismPatch } from "@/lib/prompts/patches/anti-parallelism";
import { antiRepetitionPatch } from "@/lib/prompts/patches/anti-repetition";
import { fullAnswerPatch } from "@/lib/prompts/patches/full-answer";
import { taskRouting } from "@/lib/prompts/routing/task-routing";
import { buildGradeRoutingPrompt } from "@/lib/prompts/routing/grade-routing";
import { buildSubjectRoutingPrompt } from "@/lib/prompts/routing/subject-routing";
import type { LessonPackagePrompt } from "@/lib/prompts/lesson-package/types";
import type { GenerateRequest } from "@/lib/types/lesson-package";

function buildTaskVariables(input: GenerateRequest) {
  const studentLevel = input.studentLevel || "中等";
  const duration = input.duration || 90;
  const lessonStyle = input.lessonStyle || "常规提升";

  return [
    "# 动态输入变量",
    `- 当前年级：${input.grade}`,
    `- 当前科目：${input.subject}`,
    `- 当前主题：${input.topic}`,
    `- 学生水平：${studentLevel}`,
    `- 课程时长：${duration} 分钟`,
    `- 课程风格：${lessonStyle}`,
  ].join("\n");
}

function buildStageTestContext(input: GenerateRequest) {
  if (input.mode !== "stage_test" || !input.stageTestContext) {
    return "";
  }

  return [
    "# 阶段测试上下文",
    `- 测试名称：${input.stageTestContext.testName?.trim() || `${input.topic}阶段测试`}`,
    `- 勾选知识点：${input.stageTestContext.selectedTopics.join("、")}`,
    `- 检测风格：${input.stageTestContext.masteryBias ?? "均衡检测"}`,
    `- 总题量：${input.stageTestContext.totalQuestionCount ?? 12} 题`,
  ].join("\n");
}

function buildJsonFieldContract(input: GenerateRequest) {
  const isMathLike = ["数学", "物理", "化学"].includes(input.subject);
  const lessonPackageFieldContract = [
    "lessonPackage 字段要求如下：",
    isMathLike
      ? "- overview：必须写成真正可讲的学科讲义，至少包含【概念定义】【核心规则或本质解释】【标准方法或固定步骤】【易错点提醒】，不能只写导语或课程说明。"
      : "- overview：必须写成真正可讲的课堂讲义正文，不能只写导语或摘要。",
    "- keyPoints：2-4 条重点内容，简洁明确。",
    "- difficulties：2-4 条难点提醒，聚焦学生易错处。",
    "- examples：至少 2 道例题；每道都必须包含 title、question、thinkingBreakpoint、process、perfectAnswer，不能只给裸题。",
    "- classExercises：4-6 道课堂练习，每道必须有 question 和 answer。",
    "- homework：6-10 道课后练习，每道必须有 question 和 answer。",
    "- answerAnalysis：只解析课堂练习、课后练习和小测收尾；不得重复完整解析例题示范，不得重写知识讲义、难点提醒、提分建议。",
    "- improvementTips：3-6 条具体提分建议，必须写“先看什么、先想什么、如何避免错”。",
    "- quickQuiz：2-3 道小测收尾，每道必须有 question 和 answer。",
  ];

  if (input.mode === "stage_test") {
    return [
      "# 最终输出字段契约",
      "你必须只输出一个 JSON 对象，不要输出 Markdown 标题、说明文字或额外包装。",
      "当前任务是阶段测试，不是单课讲义；不要输出 lesson_package 的 8 个模块内容。",
      "顶层字段只能包含：title, topicsCovered, testDirections, questions, answerAnalysis。",
      "- title：测试标题。",
      "- topicsCovered：必须覆盖 selectedTopics 中的全部知识点，长度保持 2-6。",
      "- testDirections：2-4 条测试说明。",
      "- questions：12-15 道题；每道题只能包含 type 和 prompt，不要在题目区写答案或解析。",
      "- answerAnalysis：与 questions 一一对应；每条必须包含 questionIndex、answer、analysis。",
      "- analysis 必须是简洁但有用的解题说明，不要只写最终答案，也不要写成长篇讲义。",
      "- 选择题的 analysis 要说明判断依据；填空题要写出关键计算或判断步骤；解答题要说明所用方法和关键变形。",
      "- questions 中必须同时包含基础 / 中档 / 提升梯度。",
      "- selectedTopics 中每个知识点都必须至少有 1 题直接覆盖。",
      "- 不要重复出同质题。",
      "- 题型仅使用：选择题、填空题、解答题。",
      "- 每一道题都必须是学生可直接作答的完整题干，不能写成出题说明、任务指令或教师提示。",
      "- 题目正文中禁止出现这些词或模式：课堂练习、课后作业、例题变式、请完成一道、围绕……设置一道、要求学生先……、参考答案：、满分范式：。",
      "- 不要在题目正文里保留任何课包来源标签，不要写“课堂练习第几题”“课后作业第几题”“例题变式”等痕迹。",
      "如果你无法完全满足，也必须优先保证 questions、answerAnalysis、topicsCovered 完整可用。",
    ].join("\n");
  }

  if (input.mode === "follow_up") {
    return [
      "# 最终输出字段契约",
      "你必须只输出一个 JSON 对象，不要输出 Markdown 标题、说明文字或额外包装。",
      "顶层字段只能包含：nextLessonSuggestion, lessonPackage。",
      "nextLessonSuggestion 字段要求如下：",
      "- goal：一句话说明下一课最核心的补习目标。",
      "- continueFocus：2-4 条，表示下一课需要继续保持或延续巩固的内容。",
      "- weakPointFocus：2-4 条，表示下一课重点补弱的内容。",
      "- teachingStrategy：3-5 条，表示下一课课堂安排与讲练策略。",
      ...lessonPackageFieldContract,
      "topic 仍然是本次生成主目标，previousTopic 只作为上一节上下文，不得覆盖当前主题。",
      "如果你无法完全满足，也必须优先保证 nextLessonSuggestion、examples、classExercises、homework、answerAnalysis 这几部分完整可用。",
    ].join("\n");
  }

  return [
    "# 最终输出字段契约",
    "你必须只输出一个符合 lesson_package 结构的 JSON 对象，不要输出 Markdown 标题、说明文字或额外包装。",
    "顶层字段只能包含：overview, keyPoints, difficulties, examples, classExercises, homework, answerAnalysis, improvementTips, quickQuiz。",
    ...lessonPackageFieldContract,
    "如果你无法完全满足，也必须优先保证 examples、classExercises、homework、answerAnalysis 这四个字段完整可用。",
  ].join("\n");
}

function buildFollowUpContext(input: GenerateRequest) {
  if (input.mode !== "follow_up" || !input.followUpContext) {
    return "";
  }

  const context = input.followUpContext;

  return [
    "# 上一节反馈上下文",
    `- 上一节主题：${context.previousTopic}`,
    `- 上一节掌握情况：${context.masteryLevel}`,
    `- 已掌握内容：${context.masteredContent || "未填写"}`,
    `- 薄弱内容：${context.weakContent || "未填写"}`,
    `- 老师备注：${context.teacherRemark || "未填写"}`,
    "注意：topic 仍然是这一次要生成的主目标；previousTopic 只用于描述上一节基础，不得替代当前 topic。",
  ].join("\n");
}

function buildFollowUpStrengthRules(input: GenerateRequest) {
  if (input.mode !== "follow_up" || !input.followUpContext) {
    return "";
  }

  const masteryLevel = input.followUpContext.masteryLevel;

  return [
    "# 跟进强度控制",
    masteryLevel === "一般"
      ? "本次资料包必须更细讲、更多补弱、减少综合题和过早迁移题，优先保证基础讲义、例题拆解和针对性练习。"
      : masteryLevel === "基本掌握"
        ? "本次资料包必须保持讲义、巩固和迁移训练的均衡，不要只重复基础，也不要过早拔高。"
        : "本次资料包应适度压缩基础讲义，增加迁移、变式和前推内容，但仍要保留必要的易错点提醒。",
  ].join("\n");
}

function buildStageTestDifficultyRules(input: GenerateRequest) {
  if (input.mode !== "stage_test" || !input.stageTestContext) {
    return "";
  }

  const bias = input.stageTestContext.masteryBias ?? "均衡检测";

  return [
    "# 阶段测试难度分布",
    bias === "基础巩固"
      ? "本次试卷必须以基础题为主，基础 / 中档 / 提升大致按 6 / 4 / 2 分布，重点检查基础概念、基本方法和直接应用。"
      : bias === "提升检测"
        ? "本次试卷必须增加中档和提升题，基础 / 中档 / 提升大致按 3 / 4 / 5 分布，突出综合、迁移和变式。"
        : "本次试卷保持均衡梯度，基础 / 中档 / 提升大致按 4 / 5 / 3 分布。",
  ].join("\n");
}

function buildLightPatches(subject: string): string[] {
  const patches = [fullAnswerPatch, antiRepetitionPatch];

  if (subject === "语文") {
    patches.push(antiParallelismPatch);
  }

  if (subject === "数学") {
    patches.push(
      [
        "【数学题质量护栏】不要生成“数学上成立但训练价值很差”的退化题。",
        "尤其是“已知直线 / 与某直线平行 / 经过某点 / 求解析式”这类题，如果所给点恰好落在原直线上，最后得到的仍是原解析式，则必须自动换点或换条件。",
        "平行、过点、求解析式类题必须保证学生需要真实完成斜率迁移、代点求参或条件转化，不能只是把原题换个说法。",
      ].join("\n"),
    );
  }

  return patches;
}

export function buildLessonPackagePrompt(input: GenerateRequest): LessonPackagePrompt {
  const system = [
    globalBasePrompt,
    outputStructure,
    coreGuardrailsPrompt,
  ].join("\n\n");

  const user = [
    buildGradeRoutingPrompt(input.grade),
    buildSubjectRoutingPrompt(input.subject),
    taskRouting,
    ...buildLightPatches(input.subject),
    buildTaskVariables(input),
    buildFollowUpContext(input),
    buildFollowUpStrengthRules(input),
    buildStageTestContext(input),
    buildStageTestDifficultyRules(input),
    buildJsonFieldContract(input),
    input.mode === "follow_up"
      ? "请基于以上规则先生成 nextLessonSuggestion，再生成一份新的 lessonPackage。"
      : input.mode === "stage_test"
        ? "请基于以上规则生成一份阶段测试卷，确保每个 selectedTopics 都至少有 1 题直接覆盖，且不要重复出同质题。所有题目都必须是正式试题，不得把出题指令、任务说明或课包标签泄漏进最终试卷。"
        : "请基于以上规则生成一份单次补课资料包。",
    input.mode === "stage_test"
      ? "不要输出 lessonPackage，不要输出 8 模块讲义结构，只输出阶段测试所需字段。"
      : "必须严格按 8 个模块顺序生成 lessonPackage，重点保证模块 1、2、3、4、5、6 的稳定性、可讲性与可用性。",
    input.mode === "stage_test"
      ? "题目区只放题目本体；答案和解析统一放进 answerAnalysis。"
      : "不得擅自改写模块标题，不得使用“重难点”“知识点总结”“课后作业”等旧名称替代当前 8 个模块名。",
  ].join("\n\n");

  return { system, user };
}
