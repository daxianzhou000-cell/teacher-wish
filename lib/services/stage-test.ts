import type { TutoringRecord } from "@/lib/types/student-progress";
import type { StudentStageTest } from "@/lib/types/stage-test";

type TopicRecordGroup = {
  topic: string;
  latestRecord: TutoringRecord;
};

function hashText(value: string): number {
  return Array.from(value).reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);
}

function shuffleQuestions(
  items: StudentStageTest["questions"],
  seedSource: string,
): StudentStageTest["questions"] {
  const next = [...items];
  let seed = hashText(seedSource) || 1;

  for (let index = next.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const swapIndex = seed % (index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }

  return next;
}

function uniqueQuestions(items: StudentStageTest["questions"]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.question.trim();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * @deprecated legacy only
 * 这是旧的本地阶段测试拼装逻辑，仅保留作历史兼容参考。
 * 学生档案页正式入口已切到 /api/generate 的 stage_test 主链，不应再作为正式展示来源。
 */
export function buildStudentStageTest(params: {
  studentName: string;
  grade: TutoringRecord["generateRequest"]["grade"];
  subject: TutoringRecord["generateRequest"]["subject"];
  selectedTopics: string[];
  topicGroups: TopicRecordGroup[];
}): StudentStageTest {
  const chosenGroups = params.topicGroups.filter((group) =>
    params.selectedTopics.includes(group.topic),
  );
  const today = new Date().toISOString().slice(0, 10);

  const baseQuestions = uniqueQuestions(
    chosenGroups.flatMap((group, groupIndex) => {
      const record = group.latestRecord;
      const exampleQuestions = record.lessonPackage.examples.slice(0, 1).map((example, index) => ({
        id: `${groupIndex + 1}-e-${index + 1}`,
        type: "解答题" as const,
        topic: group.topic,
        sourceLabel: "例题变式",
        question: `${example.title}：${example.question}`,
        answer: `${example.thinkingBreakpoint}\n${example.process}\n${example.perfectAnswer}`,
        analysis: "先对比例题与当前题的条件差异，再按变化后的方法完成作答。",
      }));

      const classQuestions = record.lessonPackage.classExercises.slice(0, 2).map((exercise, index) => ({
        id: `${groupIndex + 1}-c-${index + 1}`,
        type: "解答题" as const,
        topic: group.topic,
        sourceLabel: "课堂练习",
        question: exercise.question,
        answer: exercise.answer,
        analysis: "先判断本题考查点，再按课堂中的标准步骤完成解答。",
      }));

      const homeworkQuestions = record.lessonPackage.homework.slice(0, 2).map((exercise, index) => ({
        id: `${groupIndex + 1}-h-${index + 1}`,
        type: "解答题" as const,
        topic: group.topic,
        sourceLabel: "课后作业",
        question: exercise.question,
        answer: exercise.answer,
        analysis: "先独立完成关键计算或推理，再检查结果是否符合题意。",
      }));

      return [...exampleQuestions, ...classQuestions, ...homeworkQuestions];
    }),
  );

  const questions = shuffleQuestions(
    baseQuestions,
    `${params.studentName}-${params.subject}-${today}-${chosenGroups.map((group) => group.topic).join("|")}`,
  ).map((question, index) => ({
    ...question,
    id: `q-${index + 1}`,
  }));

  return {
    title: `${params.studentName}${params.subject}阶段性测试`,
    studentName: params.studentName,
    grade: params.grade,
    subject: params.subject,
    topics: chosenGroups.map((group) => group.topic),
    generatedAt: today,
    questions,
  };
}
