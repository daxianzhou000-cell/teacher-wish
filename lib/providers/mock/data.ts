import type {
  GenerateRequest,
  LessonPackage,
  LessonStyle,
  StageTestQuestionType,
  StageTestResult,
  StudentLevel,
  Subject,
} from "@/lib/types/lesson-package";

const subjectHints: Record<Subject, string> = {
  语文: "重视概念梳理、文本理解和表达训练",
  数学: "重视方法建模、步骤规范和错因复盘",
  英语: "重视词汇语法、语境理解和输出表达",
};

const levelHints: Record<StudentLevel, string> = {
  基础薄弱: "先补基础概念，再通过少量高频题建立信心",
  普通: "兼顾理解与练习，帮助学生形成稳定答题节奏",
  提分: "强化综合应用和变式训练，突出得分点与失分点",
};

const styleHints: Record<LessonStyle, string> = {
  基础补习: "以讲透基本概念和基础题型为主",
  提分补习: "以常考题型拆解和提分策略为主",
  考前冲刺: "以高频考点归纳和限时训练为主",
  一对一讲解: "以诊断式讲解和针对性纠错为主",
};

export function buildMockLessonPackage(input: GenerateRequest): LessonPackage {
  const topic = input.topic.trim() || "本节主题";
  const summary = [
    `一、核心概念讲义`,
    `${topic}是${input.grade}${input.subject}中的重点内容。本节讲义围绕“概念是什么、题目怎么认、步骤怎么做、错误怎么避开”四个层面展开。${subjectHints[input.subject]}，并结合${input.studentLevel}学生常见问题进行针对性拆解。`,
    `二、解题或作答方法`,
    `处理“${topic}”时，建议先完成审题定位，再找出关键信息和考查点，接着按固定步骤进行分析与作答。${styleHints[input.lessonStyle]}，因此讲义中会把常见题型拆成可直接套用的操作顺序。`,
    `三、易错提醒`,
    `本节最容易出问题的地方通常在概念边界、步骤遗漏和表达不规范。${levelHints[input.studentLevel]}，所以课堂中要把“为什么错、怎样改、下次怎样避免”讲透。`,
    `四、课堂使用方式`,
    `本节课程时长 ${input.duration} 分钟，建议先讲义梳理，再例题示范，再进行分层练习和讲评，最后完成课后巩固。`,
  ].join("\n\n");

  const exerciseCountMap: Record<GenerateRequest["exerciseCount"], number> = {
    3: 6,
    5: 8,
    8: 12,
  };

  const totalExercises = exerciseCountMap[input.exerciseCount];

  return {
    overview: summary,
    keyPoints: [
      `明确“${topic}”的核心概念、基本结构和常见考点`,
      `归纳${input.grade}${input.subject}中围绕“${topic}”最常出现的题型`,
      `提炼学生可直接使用的标准解题或答题步骤`,
    ],
    difficulties: [
      `学生容易把“${topic}”的概念边界和适用条件混淆`,
      `从基础理解过渡到题目应用时容易出现步骤断层`,
      `遇到变式题或综合题时缺少稳定的分析顺序`,
    ],
    examples: [
      {
        title: "例题 1",
        question: `围绕“${topic}”设置一道基础示范题。要求学生先圈出题目中的关键信息，再判断本题考查的核心方法，最后按步骤完整作答。`,
        thinkingBreakpoint: `先判断这道题考查的是“${topic}”中的哪一种基础模型，再决定第一步该看条件、列式还是直接求解。`,
        process: `讲解时先带学生做题型识别，再拆出关键条件，接着按标准步骤完成推导或作答，边做边指出为什么这样写才规范。`,
        perfectAnswer: "满分范式：先写清题目考查点，再按步骤完成分析与作答，结果后补一句检验或总结，确保格式完整。",
      },
      {
        title: "例题 2",
        question: `围绕“${topic}”设置一道变式题。要求学生对比例题 1 与本题条件变化，说明解题方法为什么需要调整。`,
        thinkingBreakpoint: "先找出本题和基础例题相比，究竟是哪一个条件变了，再判断原方法哪里需要调整。",
        process: "讲解时重点比较基础题与变式题在条件、步骤和易错点上的差异，先讲为什么不能照抄原方法，再示范如何做出调整。",
        perfectAnswer: "满分范式：先指出条件变化，再写调整后的关键步骤，最后补出本题和基础题的核心区别。",
      },
    ],
    classExercises: Array.from({ length: totalExercises }, (_, index) => ({
      question: `当堂练习 ${index + 1}：请完成一题与“${topic}”相关的${
        index < 3 ? "基础巩固题" : index < 6 ? "变式提升题" : "综合应用题"
      }。要求先独立审题，再写出关键分析过程，最后完成规范作答。`,
      answer: `参考答案 ${index + 1}：先判断本题考查点，再列出关键信息和步骤，最后写出完整结果，并检查是否存在概念混淆或步骤遗漏。`,
    })),
    homework: [
      {
        question: `课后作业 1：完成一道“${topic}”基础巩固题，要求写出完整步骤，并在题目旁标出本题考查的知识点。`,
        answer: "参考答案：先写出关键条件，再按课堂讲过的标准步骤完成作答，最后在结尾总结本题考查的核心方法。",
      },
      {
        question: `课后作业 2：完成一道“${topic}”变式题，要求对比它与课堂例题的不同，并说明解法为什么要调整。`,
        answer: "参考答案：对比题目条件变化，指出方法调整的原因，并按新条件完成完整推导或作答。",
      },
      {
        question: `课后作业 3：完成一道“${topic}”综合应用题，要求独立完成审题、分析、作答和检查，不看课堂讲义直接尝试。`,
        answer: "参考答案：先判断题型，再分步骤完成分析和结果表达，最后检查是否存在概念混淆、步骤遗漏和格式问题。",
      },
      {
        question: `课后作业 4：整理本节“${topic}”错题 1 题，重做后写出“错因 + 正确做法 + 下次提醒”。`,
        answer: "参考答案：从错误来源、正确方法和下次避免方式三个角度完成错题复盘。",
      },
    ],
    answerAnalysis: [
      `答案解析时要先看“${topic}”对应的方法是否选对，再看步骤是否完整，最后看表达是否规范。`,
      "讲评建议按“基础题 - 变式题 - 综合题”顺序展开，让学生明确每类题先看什么、后做什么。",
      `对于${input.studentLevel}学生，要优先纠正概念错误、步骤遗漏和表达不规范，再逐步追求速度与熟练度。`,
    ],
    improvementTips: [
      `遇到“${topic}”相关题目时，先判断这道题考查的是基础概念、标准方法，还是条件变化后的变式。`,
      `做题前先圈出关键信息，再按课堂讲过的固定步骤作答，避免一上来就凭感觉下笔。`,
      `做完后重点检查概念边界、步骤完整性和表达规范，先把“会而做错”降下来，再追求速度。`,
    ],
    quickQuiz: Array.from({ length: 3 }, (_, index) => ({
      question: `小测 ${index + 1}：请完成一道与“${topic}”相关的${
        index === 0 ? "基础检测题" : index === 1 ? "方法应用题" : "收尾巩固题"
      }，要求独立完成并写出关键步骤。`,
      answer: `参考答案 ${index + 1}：先明确本题考查点，再写出关键步骤，最后完成规范作答并检查是否遗漏条件。`,
    })),
  };
}

export function buildMockStageTest(input: GenerateRequest): StageTestResult {
  const context = input.stageTestContext ?? {
    selectedTopics: [input.topic || "阶段测试主题"],
    testName: `${input.topic || input.subject}阶段测试`,
    masteryBias: "均衡检测" as const,
    totalQuestionCount: 12,
  };
  const total = context.totalQuestionCount ?? 12;
  const easyCount =
    context.masteryBias === "基础巩固" ? 6 : context.masteryBias === "提升检测" ? 3 : 4;
  const hardCount =
    context.masteryBias === "基础巩固" ? 2 : context.masteryBias === "提升检测" ? 5 : 3;

  const questions = Array.from({ length: total }, (_, index) => {
    const topic = context.selectedTopics[index % context.selectedTopics.length];
    const type: StageTestQuestionType =
      index < 4 ? "选择题" : index < 8 ? "填空题" : "解答题";
    const difficulty =
      index < easyCount
        ? "基础"
        : index >= total - hardCount
          ? "提升"
          : "中档";

    return {
      type,
      prompt:
        type === "选择题"
          ? `${index + 1}. 下列关于“${topic}”的说法中，正确的是（ ）`
          : type === "填空题"
            ? `${index + 1}. 已知某题考查“${topic}”，请写出题中所求结果。`
            : `${index + 1}. 某题考查“${topic}”的${difficulty}应用，请写出解题过程并给出结论。`,
    };
  });

  return {
    title: context.testName?.trim() || `${input.topic || input.subject}阶段测试`,
    topicsCovered: context.selectedTopics,
    testDirections: [
      "本卷覆盖近期学习的多个核心知识点，请先完成基础题，再处理提升题。",
      "选择题、填空题重在快速判断，解答题请写出关键步骤。",
      "请避免重复同类题型，注意每个知识点至少有 1 题直接覆盖。",
    ],
    questions,
    answerAnalysis: questions.map((question, index) => ({
      questionIndex: index + 1,
      answer: `围绕“${context.selectedTopics[index % context.selectedTopics.length]}”完成标准作答。`,
      analysis: `先定位本题对应知识点，再按该知识点的核心方法完成作答。`,
    })),
  };
}
