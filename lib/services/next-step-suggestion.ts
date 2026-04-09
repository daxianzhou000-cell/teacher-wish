import type { GenerateRequest } from "@/lib/types/lesson-package";
import type { MasteryLevel } from "@/lib/types/student-progress";

type SuggestionPlan = {
  focusTitle: string;
  diagnosticStep: string;
  teachingStep: string;
  exerciseStep: string;
  closingStep: string;
};

const followUpTopicStrategies: Record<MasteryLevel, string> = {
  未掌握: "基础回炉与步骤重建",
  一般: "巩固训练与变式提升",
  基本掌握: "综合应用与易错突破",
  熟练: "综合迁移与提分训练",
};

const levelHints: Record<GenerateRequest["studentLevel"], string> = {
  基础薄弱: "题量不要多，优先保证每一步都能说清楚、写完整。",
  普通: "保持一题一反馈，先做对再提速，不要一上来堆综合题。",
  提分: "在基础步骤稳定后，可以加 1-2 题变式或限时小题做提速。",
};

function normalizeFeedback(feedback: string) {
  return feedback
    .replace(/[，,；;。！!？?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function buildPlan(topic: string, feedback: string, masteryLevel: MasteryLevel): SuggestionPlan {
  const normalizedFeedback = normalizeFeedback(feedback);
  const issueSource = normalizedFeedback || `${topic}相关基础题`;

  const mentionsCalculation = hasAny(normalizedFeedback, [/计算/, /运算/, /化简/, /分数/, /通分/, /抄错/, /粗心/]);
  const mentionsSign = hasAny(normalizedFeedback, [/符号/, /负号/, /正负/, /去括号/, /移项/]);
  const mentionsSubstitution = hasAny(normalizedFeedback, [/代入/, /套用/, /带入/, /求值/]);
  const mentionsFormula = hasAny(normalizedFeedback, [/公式/, /判别式/, /求根公式/, /面积公式/, /公式法/]);
  const mentionsFactor = hasAny(normalizedFeedback, [/因式分解/, /提公因式/, /平方差/, /完全平方/, /配方/]);
  const mentionsConcept = hasAny(normalizedFeedback, [/概念/, /定义/, /不会判/, /审题/, /理解/]);
  const mentionsWordProblem = hasAny(normalizedFeedback, [/应用题/, /题意/, /实际问题/, /列方程/, /读题/]);

  if (mentionsCalculation || mentionsSign || mentionsSubstitution) {
    return {
      focusTitle: `先把“${issueSource}”里最容易算错的步骤单独补稳`,
      diagnosticStep: mentionsSign
        ? "开头先做 3 题纯计算诊断，专门看去括号、移项和负号处理是不是稳定。"
        : mentionsSubstitution
          ? "开头先做 3 题代入与求值小题，只看代入顺序、抄写和化简，不先讲新综合题。"
          : "开头先做 3 题纯计算小题，先找学生到底卡在通分、化简还是运算顺序。",
      teachingStep: mentionsSubstitution
        ? "讲解时只拆“代什么、先算哪一步、结果写到哪一步”为止，每一步都要求学生口头复述。"
        : "讲解时把题目拆成固定步骤板书：先审式子，再按顺序计算，最后检查符号和结果。",
      exerciseStep: mentionsCalculation
        ? "中段安排 4-6 题同型短题连练，前 3 题只练计算，后 2 题再带回原知识点题型。"
        : "中段先练 2 题同型基础题，再补 2 题带小变式的题，确保学生不是只会照抄。",
      closingStep: "结尾留 5 分钟让学生把本节做错的一题完整重算一遍，并说出自己刚才错在第几步。",
    };
  }

  if (mentionsFormula) {
    return {
      focusTitle: `把“${issueSource}”里公式判断、条件代入和结果检查这三步拆开补`,
      diagnosticStep: "开头先做 2 题公式判断题和 2 题代入题，先不做整道综合题，先看学生到底卡在哪一步。",
      teachingStep: "讲解时固定成“先判断能不能用公式，再写公式，再代入数据，最后检查结果是否合理”的四步。",
      exerciseStep: "中段安排 1 题老师示范、2 题学生独立代入、1 题轻变式，重点盯住分子分母、负号和平方是否抄对。",
      closingStep: "最后把一题完整公式题按“判断-代入-计算-检查”四栏重新整理，形成学生下次可照抄的答题模板。",
    };
  }

  if (mentionsFactor) {
    return {
      focusTitle: `继续围绕“${topic}”补足因式识别和标准变形步骤`,
      diagnosticStep: "开头先做 3 题只判断用哪种因式分解方法的小题，不急着展开完整计算。",
      teachingStep: "讲解时把“先看能否提公因式，再看平方差，再看完全平方”的判断顺序板书出来。",
      exerciseStep: "中段先练 2 题纯识别、2 题标准分解，再补 1 题和方程结合的应用题，防止只会背方法不会用。",
      closingStep: "结尾让学生复述每道题为什么选这种方法，并把一题错题改成完整规范写法。",
    };
  }

  if (mentionsWordProblem) {
    return {
      focusTitle: `下一课先把“读题找量、设未知数、列式”这条应用题链路补顺`,
      diagnosticStep: "开头先做 2 题只圈条件和等量关系的小诊断，不急着正式列方程。",
      teachingStep: "讲解时把题目拆成“已知什么、求什么、数量关系在哪一句”三步，先教学生把关系翻成式子。",
      exerciseStep: "中段安排 2 题半扶半放练习，先老师带着列，再给 2 题学生独立写未知数和方程。",
      closingStep: "最后留 5 分钟专门复盘列式错误，让学生自己说清楚等量关系为什么这么写。",
    };
  }

  if (mentionsConcept) {
    return {
      focusTitle: `先把“${topic}”里学生没真正理解的概念和判断标准补清楚`,
      diagnosticStep: "开头先做 3 题概念判断小题，先确认学生是不会判断，还是只会套题不会解释。",
      teachingStep: "讲解时优先用反例和对比例子，把“什么时候成立、什么时候不成立”讲清楚。",
      exerciseStep: "中段安排 2 题直接判断题、2 题带条件变化的小题，让学生练到能自己说明理由。",
      closingStep: "结尾让学生不用看题，直接复述本节最核心的判断标准和一个典型易错点。",
    };
  }

  return {
    focusTitle:
      masteryLevel === "未掌握"
        ? `下一课先回到“${topic}”最基础的题型，把步骤重新搭起来`
        : `继续围绕“${topic}”做一次有重点的巩固补习`,
    diagnosticStep: "开头先用 2-3 题短诊断找具体卡点，再决定这节课重点讲哪一步，不直接整课平推。",
    teachingStep: "讲解时只抓一个最关键薄弱点，先讲透标准步骤，再让学生马上跟做同型题。",
    exerciseStep: "中段先做基础同型题，再补 1-2 题轻变式，确保学生既能做对，也能稍微迁移。",
    closingStep: "结尾把本节最容易错的一步单独回看一次，要求学生自己复述方法和检查点。",
  };
}

export function buildNextStepSuggestion(params: {
  topic: string;
  studentLevel: GenerateRequest["studentLevel"];
  masteryLevel: MasteryLevel;
  teacherFeedback: string;
}): string {
  const feedback = params.teacherFeedback.trim();
  const plan = buildPlan(params.topic, feedback, params.masteryLevel);
  const hint = levelHints[params.studentLevel];
  const feedbackLine = feedback
    ? `结合老师反馈“${feedback}”，`
    : "结合本次课堂表现，";

  return [
    `${feedbackLine}下一课建议先围绕“${params.topic}”做针对性续接，重点是${plan.focusTitle}。`,
    plan.diagnosticStep,
    plan.teachingStep,
    plan.exerciseStep,
    `${plan.closingStep}${hint}`,
  ].join("");
}

export function buildFollowUpTopic(params: {
  topic: string;
  masteryLevel: MasteryLevel;
}): string {
  return `${params.topic} · ${followUpTopicStrategies[params.masteryLevel]}`;
}
