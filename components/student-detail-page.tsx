"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAppMeta, removeAppMeta, setAppMeta } from "@/lib/client/app-meta-store";
import {
  createGenerationJob,
  failGenerationJob,
  fetchGenerationJob,
  hydrateGenerationJob,
} from "@/lib/client/generation-job-repository";
import {
  buildStudentDetailFromState,
  deleteRecordViaApi,
  deleteStudentViaApi,
  readPreferredStudentDetail,
  updateRecordViaApi,
  updateStudentViaApi,
} from "@/lib/client/student-record-repository";

import { LessonPackageExportDialog } from "@/components/lesson-package-export-dialog";
import { MathInlineText } from "@/components/math-rich-text";
import { StudentAvatar } from "@/components/student-avatar";
import {
  getRecordActionLabel,
  getRecordStageLabel,
  isFeedbackCompleted,
} from "@/lib/domain/student-progress-status";
import type { Grade, StageTestResult, Subject } from "@/lib/generator";
import { downloadStageTestAsWord } from "@/lib/export/stage-test-word";
import { buildFollowUpTopic } from "@/lib/services/next-step-suggestion";
import type { StudentStageTest } from "@/lib/types/stage-test";
import type {
  MasteryLevel,
  Student,
  StudentDetail,
  TutoringRecord,
} from "@/lib/types/student-progress";
import {
  buildLessonPackageFileName,
  extractBaseTopic,
  formatTopicSummary,
} from "@/lib/utils/topic-format";

const gradeOptions: Grade[] = ["七年级", "八年级", "九年级"];
const subjectOptions: Subject[] = ["语文", "数学", "英语"];
const masteryOptions: MasteryLevel[] = ["未掌握", "一般", "基本掌握", "熟练"];
const sortOptions = [
  { value: "desc", label: "最新优先" },
  { value: "asc", label: "最旧优先" },
] as const;

const shellClassName =
  "rounded-[30px] border border-white/80 bg-[rgba(255,255,255,0.62)] p-5 backdrop-blur-xl shadow-[0_18px_42px_rgba(219,188,198,0.1),inset_0_1px_0_rgba(255,255,255,0.92)]";

const ACTIVE_STAGE_TEST_JOB_STORAGE_KEY = "student-detail-active-stage-test-job";

function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return "暂无";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLatestRecordByActualTime(records: TutoringRecord[]) {
  return records
    .slice()
    .sort((left, right) => {
      const leftAnchor = left.updatedAt || left.date || left.createdAt;
      const rightAnchor = right.updatedAt || right.date || right.createdAt;
      return rightAnchor.localeCompare(leftAnchor);
    })[0];
}

const fieldClassName =
  "rounded-[20px] border border-white/82 bg-[rgba(255,255,255,0.74)] px-4 py-3 text-sm text-[#4F463F] backdrop-blur-md outline-none transition active:translate-y-[1px] active:bg-white/84 active:shadow-[inset_0_3px_10px_rgba(160,108,126,0.08)] focus:border-[#F3C4D0] focus:bg-white/86 focus:shadow-[inset_0_3px_12px_rgba(160,108,126,0.08)] focus:ring-4 focus:ring-[#FDEBF1]";

const primaryButtonClassName =
  "rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_32px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.9)] disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "rounded-full border border-white/90 bg-[rgba(255,241,246,0.76)] px-5 py-3 text-sm font-semibold text-[#7C6470] backdrop-blur-md transition hover:bg-[rgba(255,246,249,0.9)]";

const neutralButtonClassName =
  "rounded-full border border-white/85 bg-[rgba(255,255,255,0.72)] px-5 py-3 text-sm font-semibold text-[#6B625A] backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.88)]";

const dangerButtonClassName =
  "rounded-full border border-white/90 bg-[rgba(255,243,241,0.76)] px-5 py-3 text-sm font-semibold text-[#B56562] backdrop-blur-md transition hover:bg-[rgba(255,248,246,0.9)]";

function inferStageTestTopicLabel(
  prompt: string,
  selectedTopics: string[],
): string {
  const normalized = prompt.replace(/\s+/g, "");
  const matches = selectedTopics.filter((topic) => normalized.includes(topic.replace(/\s+/g, "")));

  if (matches.length === 1) {
    return matches[0]!;
  }

  const functionSignals = /一次函数|直线|图像|斜率|解析式|平移|y轴|x轴|k|b/.test(normalized);
  const equationGroupSignals = /二元一次方程组|方程组|消元|代入法|加减法|单价|苹果|梨/.test(normalized);

  if (functionSignals && equationGroupSignals) {
    return "综合应用";
  }

  if (functionSignals) {
    return selectedTopics.find((topic) => /函数|图像|解析式/.test(topic)) ?? selectedTopics[0] ?? "综合应用";
  }

  if (equationGroupSignals) {
    return selectedTopics.find((topic) => /方程组/.test(topic)) ?? selectedTopics[0] ?? "综合应用";
  }

  return selectedTopics[0] ?? "综合应用";
}

function inferStageTestTier(
  questionType: StageTestResult["questions"][number]["type"],
  index: number,
  total: number,
): "基础" | "中档" | "提升" {
  if (questionType === "选择题") {
    return "基础";
  }

  if (questionType === "填空题") {
    return "中档";
  }

  return index >= Math.max(total - 3, 8) ? "提升" : "中档";
}

function getTopicOrder(label: string, selectedTopics: string[]): number {
  if (label === "综合应用") {
    return selectedTopics.length + 1;
  }

  const exactIndex = selectedTopics.findIndex((topic) => topic === label);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const fuzzyIndex = selectedTopics.findIndex(
    (topic) => label.includes(topic) || topic.includes(label),
  );

  return fuzzyIndex >= 0 ? fuzzyIndex : selectedTopics.length;
}

function mapStageTestResultToStudentStageTest(params: {
  result: StageTestResult;
  studentName: string;
  grade: Grade;
  subject: Subject;
  jobId: string;
}): StudentStageTest {
  const today = formatDisplayDate(new Date().toISOString());
  const answerMap = new Map(
    params.result.answerAnalysis.map((item) => [item.questionIndex, item]),
  );
  const tierRank = {
    基础: 0,
    中档: 1,
    提升: 2,
  } as const;
  const selectedTopics = params.result.topicsCovered;

  const orderedQuestions = params.result.questions
    .map((question, index) => {
      const topicLabel = inferStageTestTopicLabel(question.prompt, selectedTopics);
      const tier = inferStageTestTier(question.type, index, params.result.questions.length);

      return {
        id: `q-${index + 1}`,
        type: question.type,
        topic: topicLabel,
        sourceLabel: tier,
        question: question.prompt,
        answer: answerMap.get(index + 1)?.answer ?? "暂无答案",
        analysis: answerMap.get(index + 1)?.analysis ?? "暂无解析",
        originalIndex: index,
      };
    })
    .sort((left, right) => {
      const tierDiff = tierRank[left.sourceLabel as keyof typeof tierRank] - tierRank[right.sourceLabel as keyof typeof tierRank];

      if (tierDiff !== 0) {
        return tierDiff;
      }

      const topicDiff = getTopicOrder(left.topic, selectedTopics) - getTopicOrder(right.topic, selectedTopics);

      if (topicDiff !== 0) {
        return topicDiff;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ originalIndex: _originalIndex, ...question }) => question);

  return {
    title: params.result.title,
    studentName: params.studentName,
    grade: params.grade,
    subject: params.subject,
    topics: params.result.topicsCovered,
    generatedAt: today,
    source: "job",
    jobId: params.jobId,
    mode: "stage_test",
    questions: orderedQuestions,
  };
}

function buildReuseHref(record: TutoringRecord) {
  const params = new URLSearchParams({
    studentId: record.studentId ?? "",
    subject: record.generateRequest.subject,
    grade: record.generateRequest.grade,
    topic: record.generateRequest.topic,
    studentLevel: record.generateRequest.studentLevel,
    lessonStyle: record.generateRequest.lessonStyle,
    duration: String(record.generateRequest.duration),
    exerciseCount: String(record.generateRequest.exerciseCount),
  });

  return `/?${params.toString()}`;
}

function buildNextLessonHref(record: TutoringRecord) {
  const params = new URLSearchParams({
    studentId: record.studentId ?? "",
    subject: record.generateRequest.subject,
    grade: record.generateRequest.grade,
    topic: record.masteryLevel
      ? buildFollowUpTopic({
          topic: record.topic,
          masteryLevel: record.masteryLevel,
        })
      : record.topic,
    studentLevel: record.generateRequest.studentLevel,
    lessonStyle: record.generateRequest.lessonStyle,
    duration: String(record.generateRequest.duration),
    exerciseCount: String(record.generateRequest.exerciseCount),
    previousRecordId: record.id,
    learningThreadId: record.learningThreadId,
    sourceTopic: record.topic,
    sourceFeedback: record.teacherFeedback,
    sourceSuggestion: record.nextStepSuggestion,
    sourceMasteryLevel: record.masteryLevel ?? "",
  });

  return `/?${params.toString()}`;
}

function ClayShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`${shellClassName} ${className}`}>{children}</section>;
}

function PastelBadge({
  children,
  tone = "yellow",
}: {
  children: ReactNode;
  tone?: "yellow" | "blue" | "green";
}) {
  const toneClassName =
    tone === "blue"
      ? "bg-[#F4F9FF] text-[#6483A4]"
      : tone === "green"
        ? "bg-[#F3FAF4] text-[#5F8C69]"
        : "bg-[#FFF9DE] text-[#8E744B]";

  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${toneClassName}`}>
      {children}
    </span>
  );
}

function SubjectGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="18" height="16" rx="5" fill="url(#subjectFill)" />
      <path d="M9 9.5H17" stroke="#5E7FA7" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 13H17" stroke="#5E7FA7" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 16.5H14.5" stroke="#5E7FA7" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.8 7.5V18.5" stroke="white" strokeOpacity="0.9" strokeWidth="1.4" strokeLinecap="round" />
      <defs>
        <linearGradient id="subjectFill" x1="4" y1="5" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DCEBFD" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TopicGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="2.25" fill="#C89A43" />
      <circle cx="16" cy="11" r="2.25" fill="#D4AE61" />
      <circle cx="8.5" cy="16" r="2.25" fill="#E1C37E" />
      <path d="M7.8 7.2L13.9 9.9" stroke="#B9914F" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.6 12.8L10 14.9" stroke="#B9914F" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function masteryTone(level: MasteryLevel): "yellow" | "blue" | "green" {
  switch (level) {
    case "熟练":
      return "green";
    case "基本掌握":
      return "blue";
    default:
      return "yellow";
  }
}

function masteryCardClass(record: TutoringRecord): string {
  if (!record.masteryLevel) {
    return "border-[#F3D9DF] bg-[rgba(255,246,248,0.7)] shadow-[0_20px_48px_rgba(222,193,201,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]";
  }

  switch (record.masteryLevel) {
    case "未掌握":
      return "border-[#F1D3D7] bg-[rgba(255,243,244,0.72)] shadow-[0_20px_48px_rgba(224,185,191,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]";
    case "一般":
      return "border-[#F1E2BE] bg-[rgba(255,249,232,0.76)] shadow-[0_20px_48px_rgba(235,214,166,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]";
    case "基本掌握":
      return "border-[#D7E5F7] bg-[rgba(242,248,255,0.76)] shadow-[0_20px_48px_rgba(184,208,236,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]";
    case "熟练":
      return "border-[#D7ECDC] bg-[rgba(244,251,246,0.76)] shadow-[0_20px_48px_rgba(188,220,197,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]";
  }
}

function masteryHeaderClass(record: TutoringRecord): string {
  if (!record.masteryLevel) {
    return "bg-[linear-gradient(180deg,rgba(255,245,247,0.92)_0%,rgba(255,255,255,0.6)_100%)]";
  }

  switch (record.masteryLevel) {
    case "未掌握":
      return "bg-[linear-gradient(180deg,rgba(255,236,239,0.95)_0%,rgba(255,255,255,0.62)_100%)]";
    case "一般":
      return "bg-[linear-gradient(180deg,rgba(255,247,221,0.95)_0%,rgba(255,255,255,0.62)_100%)]";
    case "基本掌握":
      return "bg-[linear-gradient(180deg,rgba(236,245,255,0.95)_0%,rgba(255,255,255,0.62)_100%)]";
    case "熟练":
      return "bg-[linear-gradient(180deg,rgba(236,248,239,0.95)_0%,rgba(255,255,255,0.62)_100%)]";
  }
}

function orderRecordsByProgress(records: TutoringRecord[]): TutoringRecord[] {
  if (records.length <= 1) {
    return records;
  }

  const byId = new Map(records.map((record) => [record.id, record]));
  const start =
    records.find((record) => !record.previousRecordId || !byId.has(record.previousRecordId)) ??
    records[0];

  const ordered: TutoringRecord[] = [];
  const visited = new Set<string>();
  let current: TutoringRecord | undefined = start;

  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);
    current = current.nextRecordId ? byId.get(current.nextRecordId) : undefined;
  }

  records.forEach((record) => {
    if (!visited.has(record.id)) {
      ordered.push(record);
    }
  });

  return ordered;
}

export function StudentDetailPage(initialDetail: StudentDetail) {
  const [student, setStudent] = useState(initialDetail.student);
  const [records, setRecords] = useState(initialDetail.records);
  const initialSubjects = Array.from(
    new Set([
      initialDetail.student.subject,
      ...initialDetail.records.map((record) => record.generateRequest.subject),
    ]),
  ).sort((a, b) => subjectOptions.indexOf(a as Subject) - subjectOptions.indexOf(b as Subject)) as Subject[];

  const [editingStudent, setEditingStudent] = useState(false);
  const [studentName, setStudentName] = useState(initialDetail.student.name);
  const [studentGrade, setStudentGrade] = useState(initialDetail.student.grade);
  const [studentSubject, setStudentSubject] = useState(initialDetail.student.subject);
  const [studentNote, setStudentNote] = useState(initialDetail.student.note);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState("");

  const [updatingRecordId, setUpdatingRecordId] = useState("");
  const [recordDate, setRecordDate] = useState("");
  const [recordTopic, setRecordTopic] = useState("");
  const [recordTeacherFeedback, setRecordTeacherFeedback] = useState("");
  const [recordMasteryLevel, setRecordMasteryLevel] = useState<MasteryLevel | "">("");
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordMasteryFilter, setRecordMasteryFilter] = useState("全部");
  const [recordSortOrder, setRecordSortOrder] = useState<"desc" | "asc">("desc");
  const [stageTestExpanded, setStageTestExpanded] = useState(false);
  const [stageTestSelections, setStageTestSelections] = useState<Record<Subject, string[]>>(
    () =>
      subjectOptions.reduce<Record<Subject, string[]>>((accumulator, subject) => {
        const topics = Array.from(
          new Set(
            initialDetail.records
              .filter((record) => record.generateRequest.subject === subject)
              .map((record) => record.topic.trim())
              .filter(Boolean),
          ),
        );
        accumulator[subject] = topics;
        return accumulator;
      }, {} as Record<Subject, string[]>),
  );
  const [stageTestResult, setStageTestResult] = useState<StudentStageTest | null>(null);
  const [stageTestJobId, setStageTestJobId] = useState("");
  const [stageTestLoading, setStageTestLoading] = useState(false);
  const stageTestAbortRef = useRef(false);
  const [activeSubject, setActiveSubject] = useState<Subject>(initialSubjects[0] ?? initialDetail.student.subject);
  const [expandedThreadIds, setExpandedThreadIds] = useState<Record<string, boolean>>(() => {
    const initialThreadIds = Array.from(
      new Set(initialDetail.records.map((record) => record.learningThreadId || record.id)),
    );

    return initialThreadIds.reduce<Record<string, boolean>>((accumulator, threadId, index) => {
      accumulator[threadId] = index === 0;
      return accumulator;
    }, {});
  });
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>(() =>
    initialDetail.records.reduce<Record<string, boolean>>((accumulator, record, index) => {
      accumulator[record.id] = index === 0;
      return accumulator;
    }, {}),
  );

  useEffect(() => {
    let cancelled = false;

    void readPreferredStudentDetail(initialDetail).then((preferredDetail) => {
      if (cancelled) {
        return;
      }

      setStudent(preferredDetail.student);
      setRecords(preferredDetail.records);
      setStudentName(preferredDetail.student.name);
      setStudentGrade(preferredDetail.student.grade);
      setStudentSubject(preferredDetail.student.subject);
      setStudentNote(preferredDetail.student.note);
    });

    return () => {
      cancelled = true;
    };
  }, [initialDetail.records, initialDetail.student]);

  const filteredRecords = useMemo(() => {
    const keyword = recordSearch.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const matchTopic = !keyword || record.topic.toLowerCase().includes(keyword);
        const matchMastery =
          recordMasteryFilter === "全部" || record.masteryLevel === recordMasteryFilter;

        return matchTopic && matchMastery;
      })
      .sort((a, b) => {
        const compare = a.date.localeCompare(b.date);
        return recordSortOrder === "asc" ? compare : -compare;
      });
  }, [recordMasteryFilter, recordSearch, recordSortOrder, records]);

  const recordIndexMap = useMemo(() => {
    const recordsByThread = new Map<string, TutoringRecord[]>();

    records.forEach((record) => {
      const threadId = record.learningThreadId || record.id;
      const threadRecords = recordsByThread.get(threadId) ?? [];
      threadRecords.push(record);
      recordsByThread.set(threadId, threadRecords);
    });

    const indexMap = new Map<
      string,
      {
        position: number;
        total: number;
      }
    >();

    recordsByThread.forEach((threadRecords) => {
      const ordered = orderRecordsByProgress([...threadRecords]);
      ordered.forEach((record, index) => {
        indexMap.set(record.id, {
          position: index + 1,
          total: ordered.length,
        });
      });
    });

    return indexMap;
  }, [records]);

  const terminalRecordIds = useMemo(() => {
    const ids = new Set<string>();

    records.forEach((record) => {
      if (!record.nextRecordId) {
        ids.add(record.id);
      }
    });

    return ids;
  }, [records]);

  const groupedRecordThreads = useMemo(() => {
    const groups = new Map<
      string,
      {
        threadId: string;
        records: TutoringRecord[];
      }
    >();

    filteredRecords.forEach((record) => {
      const threadId = record.learningThreadId || record.id;
      const existing = groups.get(threadId);

      if (existing) {
        existing.records.push(record);
        return;
      }

      groups.set(threadId, {
        threadId,
        records: [record],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        subject: group.records[0]?.generateRequest.subject ?? student.subject,
        records: orderRecordsByProgress([...group.records]),
      }))
      .sort((a, b) => {
        const aAnchor = a.records.at(-1)?.updatedAt ?? "";
        const bAnchor = b.records.at(-1)?.updatedAt ?? "";

        return recordSortOrder === "asc"
          ? aAnchor.localeCompare(bAnchor)
          : bAnchor.localeCompare(aAnchor);
      });
  }, [filteredRecords, recordSortOrder, student.subject]);

  const groupedSubjectSections = useMemo(() => {
    const sections = new Map<
      Subject,
      {
        subject: Subject;
        threads: typeof groupedRecordThreads;
      }
    >();

    groupedRecordThreads.forEach((thread) => {
      const subject = thread.subject;
      const existing = sections.get(subject);

      if (existing) {
        existing.threads.push(thread);
        return;
      }

      sections.set(subject, {
        subject,
        threads: [thread],
      });
    });

    return Array.from(sections.values()).sort(
      (a, b) => subjectOptions.indexOf(a.subject) - subjectOptions.indexOf(b.subject),
    );
  }, [groupedRecordThreads]);

  const coveredSubjects = useMemo(
    () =>
      Array.from(new Set([student.subject, ...records.map((record) => record.generateRequest.subject)])).sort(
        (a, b) => subjectOptions.indexOf(a as Subject) - subjectOptions.indexOf(b as Subject),
      ) as Subject[],
    [records, student.subject],
  );

  const currentSubject =
    coveredSubjects.find((subject) => subject === activeSubject) ?? coveredSubjects[0] ?? student.subject;

  const activeSubjectSection =
    groupedSubjectSections.find((section) => section.subject === currentSubject) ?? null;
  const subjectTopicCountMap = useMemo(
    () =>
      groupedSubjectSections.reduce<Record<Subject, number>>((accumulator, section) => {
        accumulator[section.subject] = section.threads.length;
        return accumulator;
      }, {} as Record<Subject, number>),
    [groupedSubjectSections],
  );
  const activeTopicOptions = useMemo(
    () => activeSubjectSection?.threads.map((thread) => thread.records[0]?.topic || "").filter(Boolean) ?? [],
    [activeSubjectSection],
  );
  const selectedStageTopics = useMemo(() => {
    const current = stageTestSelections[currentSubject] ?? [];
    return current.filter((topic) => activeTopicOptions.includes(topic));
  }, [activeTopicOptions, currentSubject, stageTestSelections]);

  const recentTopicSections = useMemo(() => {
    const threadsBySubject = new Map<
      Subject,
      Array<{
        threadId: string;
        label: string;
        baseTopic: string;
        total: number;
        anchorDate: string;
      }>
    >();
    const recordsByThread = new Map<string, TutoringRecord[]>();

    records.forEach((record) => {
      const threadId = record.learningThreadId || record.id;
      const threadRecords = recordsByThread.get(threadId) ?? [];
      threadRecords.push(record);
      recordsByThread.set(threadId, threadRecords);
    });

    recordsByThread.forEach((threadRecords, threadId) => {
      const ordered = orderRecordsByProgress([...threadRecords]);
      const firstRecord = ordered[0];
      const latestRecord = ordered.at(-1);

      if (!firstRecord || !latestRecord) {
        return;
      }

      const subject = latestRecord.generateRequest.subject;
      const baseTopic = extractBaseTopic(firstRecord.topic || latestRecord.topic);

      if (!baseTopic) {
        return;
      }

      const sectionItems = threadsBySubject.get(subject) ?? [];

      sectionItems.push({
        threadId,
        label: formatTopicSummary(baseTopic, ordered.length),
        baseTopic,
        total: ordered.length,
        anchorDate: latestRecord.date || latestRecord.updatedAt || "",
      });
      threadsBySubject.set(subject, sectionItems);
    });

    return Array.from(threadsBySubject.entries())
      .sort((a, b) => subjectOptions.indexOf(a[0]) - subjectOptions.indexOf(b[0]))
      .map(([subject, topics]) => ({
        subject,
        topics: topics
          .sort((a, b) => b.anchorDate.localeCompare(a.anchorDate))
          .slice(0, 4),
      }));
  }, [records]);

  const activeRecentTopicSection =
    recentTopicSections.find((section) => section.subject === currentSubject) ?? null;
  const currentSubjectRecords = useMemo(
    () => records.filter((record) => record.generateRequest.subject === currentSubject),
    [currentSubject, records],
  );
  const latestCurrentSubjectRecord = getLatestRecordByActualTime(currentSubjectRecords);
  const latestOverallRecord = getLatestRecordByActualTime(records);
  const allSubjectsLabel = coveredSubjects.join(" / ");

  function persistStageTestJob(jobId: string, subject: Subject) {
    void setAppMeta(
      ACTIVE_STAGE_TEST_JOB_STORAGE_KEY,
      JSON.stringify({
        jobId,
        subject,
        studentId: student.id,
      }),
    );
  }

  function clearPersistedStageTestJob() {
    void removeAppMeta(ACTIVE_STAGE_TEST_JOB_STORAGE_KEY);
  }

  async function pollStageTestJob(jobId: string, subject: Subject) {
    const pollStartedAt = Date.now();
    const maxPollDurationMs = 150_000;

    while (!stageTestAbortRef.current && Date.now() - pollStartedAt < maxPollDurationMs) {
      const jobPayload = await fetchGenerationJob(jobId);

      if (jobPayload.status === "completed" && jobPayload.data?.mode === "stage_test") {
        setStageTestResult(
          mapStageTestResultToStudentStageTest({
            result: jobPayload.data.stageTest,
            studentName: student.name,
            grade: student.grade,
            subject,
            jobId,
          }),
        );
        setRecordError("");
        clearPersistedStageTestJob();
        return;
      }

      if (jobPayload.status === "failed") {
        clearPersistedStageTestJob();
        throw new Error(jobPayload.error || "阶段测试生成失败。");
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }

    if (stageTestAbortRef.current) {
      return;
    }

    throw new Error("阶段测试生成时间较久，请稍后再试。");
  }

  useEffect(() => {
    stageTestAbortRef.current = false;

    void getAppMeta(ACTIVE_STAGE_TEST_JOB_STORAGE_KEY).then((savedJob) => {
      if (!savedJob || stageTestAbortRef.current) {
        return;
      }

      try {
        const parsed = JSON.parse(savedJob) as { jobId?: string; subject?: Subject; studentId?: string };

        if (!parsed.jobId || !parsed.subject) {
          clearPersistedStageTestJob();
          return;
        }

        const restoredSubject = parsed.subject;
        const restoredJobId = parsed.jobId;

        void hydrateGenerationJob(restoredJobId).then((cachedJob) => {
          if (
            !cachedJob ||
            cachedJob.data?.mode !== "stage_test" ||
            stageTestAbortRef.current
          ) {
            return;
          }

          setStageTestResult(
            mapStageTestResultToStudentStageTest({
              result: cachedJob.data.stageTest,
              studentName: student.name,
              grade: student.grade,
              subject: restoredSubject,
              jobId: restoredJobId,
            }),
          );

          if (cachedJob.status === "failed" && cachedJob.error) {
            setRecordError(cachedJob.error);
            setStageTestLoading(false);
          }
        });

        setStageTestJobId(restoredJobId);
        setStageTestLoading(true);

        void pollStageTestJob(restoredJobId, restoredSubject)
          .catch((error) => {
            if (stageTestAbortRef.current) {
              return;
            }

            setRecordError(error instanceof Error ? error.message : "阶段测试生成失败。");
            clearPersistedStageTestJob();
          })
          .finally(() => {
            if (!stageTestAbortRef.current) {
              setStageTestLoading(false);
            }
          });
      } catch {
        clearPersistedStageTestJob();
      }
    });

    return () => {
      stageTestAbortRef.current = true;
    };
  }, [student.grade, student.name]);

  function cancelRecordEdit() {
    setUpdatingRecordId("");
    setRecordError("");
  }

  function startRecordUpdate(record: TutoringRecord) {
    setUpdatingRecordId(record.id);
    setRecordDate(record.date);
    setRecordTopic(record.topic);
    setRecordTeacherFeedback(record.teacherFeedback);
    setRecordMasteryLevel(record.masteryLevel ?? "");
    setRecordError("");
    setExpandedRecordIds((current) => ({ ...current, [record.id]: true }));
  }

  function toggleRecordExpanded(recordId: string) {
    setExpandedRecordIds((current) => ({ ...current, [recordId]: !current[recordId] }));
  }

  function toggleThreadExpanded(threadId: string) {
    setExpandedThreadIds((current) => ({ ...current, [threadId]: !current[threadId] }));
  }

  function selectSubject(subject: Subject) {
    setActiveSubject(subject);
  }

  function toggleStageTestTopic(topic: string) {
    setStageTestSelections((current) => {
      const existing = current[currentSubject] ?? [];
      const next = existing.includes(topic)
        ? existing.filter((item) => item !== topic)
        : [...existing, topic];

      return {
        ...current,
        [currentSubject]: next,
      };
    });
  }

  function selectAllStageTopics() {
    setStageTestSelections((current) => ({
      ...current,
      [currentSubject]: activeTopicOptions,
    }));
  }

  function clearStageTopics() {
    setStageTestSelections((current) => ({
      ...current,
      [currentSubject]: [],
    }));
  }

  async function handleGenerateStageTest() {
    if (!activeSubjectSection || selectedStageTopics.length < 2 || selectedStageTopics.length > 6) {
      setRecordError("请先选择 2 到 6 个专题，再生成阶段测试。");
      return;
    }

    setStageTestLoading(true);
    setRecordError("");
    setStageTestJobId("");
    let createdJobId = "";

    try {
      const payload = await createGenerationJob({
        mode: "stage_test",
        subject: currentSubject,
        grade: student.grade,
        topic: `${currentSubject}阶段测试`,
        studentLevel: latestCurrentSubjectRecord?.generateRequest.studentLevel ?? "普通",
        lessonStyle: latestCurrentSubjectRecord?.generateRequest.lessonStyle ?? "提分补习",
        duration: latestCurrentSubjectRecord?.generateRequest.duration ?? 60,
        exerciseCount: 5,
        stageTestContext: {
          selectedTopics: selectedStageTopics,
          testName: `${student.name}${currentSubject}阶段测试`,
          masteryBias: "均衡检测",
          totalQuestionCount: 12,
        },
      });

      createdJobId = payload.jobId;
      setStageTestJobId(payload.jobId);
      persistStageTestJob(payload.jobId, currentSubject);
      await pollStageTestJob(payload.jobId, currentSubject);
    } catch (error) {
      if (stageTestAbortRef.current) {
        return;
      }

      setRecordError(error instanceof Error ? error.message : "阶段测试生成失败。");
      if (createdJobId) {
        await failGenerationJob(
          createdJobId,
          error instanceof Error ? error.message : "阶段测试生成失败。",
        );
      }
      clearPersistedStageTestJob();
    } finally {
      if (!stageTestAbortRef.current) {
        setStageTestLoading(false);
      }
    }
  }

  async function handleUpdateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStudentLoading(true);
    setStudentError("");

    try {
      const updatedStudent = await updateStudentViaApi(student.id, {
        name: studentName,
        grade: studentGrade,
        subject: studentSubject,
        note: studentNote,
      });
      setStudent(updatedStudent);
      setStudentName(updatedStudent.name);
      setStudentGrade(updatedStudent.grade);
      setStudentSubject(updatedStudent.subject);
      setStudentNote(updatedStudent.note);
      setEditingStudent(false);
    } catch (submitError) {
      setStudentError(submitError instanceof Error ? submitError.message : "更新学生失败。");
    } finally {
      setStudentLoading(false);
    }
  }

  async function handleDeleteStudent() {
    const confirmed = window.confirm(
      `确认删除学生“${student.name}”吗？该学生的全部补课记录也会一并删除。`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteStudentViaApi(student.id);
      window.location.href = "/students";
    } catch (error) {
      setStudentError(error instanceof Error ? error.message : "删除学生失败。");
    }
  }

  async function handleUpdateRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetRecordId = updatingRecordId;

    if (!targetRecordId) {
      return;
    }

    setRecordLoading(true);
    setRecordError("");

    try {
      const updatedRecord = await updateRecordViaApi(targetRecordId, {
        date: recordDate,
        topic: recordTopic,
        teacherFeedback: recordTeacherFeedback,
        masteryLevel: recordMasteryLevel,
      });
      const nextRecords = records.map((record) =>
        record.id === updatedRecord.id ? updatedRecord : record,
      );

      setRecords(nextRecords);
      const preferredDetail = await readPreferredStudentDetail(
        buildStudentDetailFromState(student, nextRecords),
      );
      setStudent(preferredDetail.student);
      setRecords(preferredDetail.records);
      cancelRecordEdit();
    } catch (submitError) {
      setRecordError(
        submitError instanceof Error ? submitError.message : "更新补课记录失败。",
      );
    } finally {
      setRecordLoading(false);
    }
  }

  async function handleDeleteRecord(record: TutoringRecord) {
    const confirmed = window.confirm(`确认删除这条补课记录“${record.topic}”吗？`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteRecordViaApi(record.id);
      const nextRecords = records.filter((item) => item.id !== record.id);
      const preferredDetail = await readPreferredStudentDetail(
        buildStudentDetailFromState(student, nextRecords),
      );
      setStudent(preferredDetail.student);
      setRecords(preferredDetail.records);
      if (updatingRecordId === record.id) {
        cancelRecordEdit();
      }
    } catch (submitError) {
      setRecordError(
        submitError instanceof Error ? submitError.message : "删除补课记录失败。",
      );
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-[#4F463F] sm:px-6 lg:px-8">
      {stageTestLoading ? (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="rounded-full border border-white/90 bg-[rgba(255,251,239,0.92)] px-6 py-3 text-sm font-semibold text-[#7B6A59] shadow-[0_18px_40px_rgba(214,190,140,0.18)] backdrop-blur-md">
            时间较久，耐心等待
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
        <section className="overflow-hidden rounded-[30px] border border-white/82 bg-[rgba(255,255,255,0.62)] px-5 py-6 backdrop-blur-xl shadow-[0_16px_34px_rgba(214,190,199,0.07),inset_0_1px_0_rgba(255,255,255,0.92)] lg:px-6">
          <div className="flex min-h-[132px] flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-8">
            <div className="flex min-w-0 items-start gap-5">
              <StudentAvatar name={student.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                    Class Candy / Student Archive
                  </p>
                  <span className="rounded-full border border-white/88 bg-[rgba(255,255,255,0.76)] px-3 py-1 text-[11px] font-semibold text-[#A16D7C]">
                    学习档案
                  </span>
                </div>

                <h1 className="mt-3 text-[2.35rem] font-semibold tracking-[-0.03em] text-[#232A31]">
                  {student.name}
                </h1>

                <div className="mt-4 flex flex-wrap gap-2">
                  <PastelBadge tone="yellow">{student.grade}</PastelBadge>
                  <PastelBadge tone="blue">补习科目：{allSubjectsLabel}</PastelBadge>
                  {student.note ? <PastelBadge tone="yellow">已备注</PastelBadge> : null}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-[#6D645C]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B19983]">
                      累计补课
                    </span>
                    <span className="text-[1.25rem] font-semibold text-[#2F2A26]">{records.length}</span>
                    <span>次</span>
                  </div>
                  <span className="hidden h-4 w-px bg-[rgba(190,170,150,0.35)] sm:block" />
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B19983]">
                      覆盖科目
                    </span>
                    <span className="text-[1.25rem] font-semibold text-[#2F2A26]">{coveredSubjects.length}</span>
                    <span>个</span>
                  </div>
                  <span className="hidden h-4 w-px bg-[rgba(190,170,150,0.35)] sm:block" />
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B19983]">
                      最近一次
                    </span>
                    <span className="font-semibold text-[#2F2A26]">
                      {latestOverallRecord
                        ? formatDisplayDate(latestOverallRecord.updatedAt || latestOverallRecord.date)
                        : "暂无"}
                    </span>
                  </div>
                </div>

                {student.note ? (
                  <div className="mt-5 max-w-3xl border-l-[3px] border-[#E6CFA7] pl-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B19983]">
                      学习备注
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[#6D645C]">
                      {student.note}
                    </p>
                  </div>
                ) : null}

                {(activeRecentTopicSection?.topics ?? []).length ? (
                  <div className="mt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B19983]">
                      最近主题
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(activeRecentTopicSection?.topics ?? []).slice(0, 4).map((topic) => (
                        <PastelBadge key={`hero-topic-${topic.threadId}`} tone="blue">
                          {topic.label}
                        </PastelBadge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/70 pt-4 text-right lg:justify-end lg:self-start lg:border-t-0 lg:pt-1">
              <Link
                href="/"
                className="rounded-full border border-[#F0D9A7] bg-[linear-gradient(135deg,rgba(255,244,205,0.98)_0%,rgba(255,236,174,0.92)_100%)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_32px_rgba(240,215,150,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(240,215,150,0.26)]"
              >
                去生成并保存记录
              </Link>

              {!editingStudent ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingStudent(true);
                    setStudentError("");
                  }}
                  className="px-1 py-2 text-sm font-semibold text-[#7B6470] transition hover:text-[#684F5B]"
                >
                  编辑学生
                </button>
              ) : null}
              <Link
                href="/students"
                className="px-1 py-2 text-sm font-semibold text-[#6B625A] transition hover:text-[#51483F]"
              >
                返回学生列表
              </Link>
              <button
                type="button"
                onClick={handleDeleteStudent}
                className="px-1 py-2 text-sm font-semibold text-[#B56562] transition hover:text-[#9F4E4B]"
              >
                删除学生
              </button>
            </div>
          </div>
          {studentError ? <p className="mt-4 text-sm text-[#C36C68]">{studentError}</p> : null}
        </section>

        {editingStudent ? (
          <ClayShell className="border-white/88 bg-[rgba(255,234,229,0.62)] shadow-[0_20px_44px_rgba(230,192,187,0.14),inset_0_1px_0_rgba(255,255,255,0.95)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                  Archive
                </p>
                <h2 className="mt-2 text-[1.35rem] font-semibold text-[#3F3832]">编辑学生</h2>
              </div>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleUpdateStudent}>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>姓名</span>
                <input
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  className={fieldClassName}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                  <span>年级</span>
                  <select
                    value={studentGrade}
                    onChange={(event) => setStudentGrade(event.target.value as Grade)}
                    className={fieldClassName}
                  >
                    {gradeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                  <span>学科</span>
                  <select
                    value={studentSubject}
                    onChange={(event) => setStudentSubject(event.target.value as Subject)}
                    className={fieldClassName}
                  >
                    {subjectOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>备注</span>
                <textarea
                  rows={4}
                  value={studentNote}
                  onChange={(event) => setStudentNote(event.target.value)}
                  className={`${fieldClassName} min-h-[120px] resize-none`}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={studentLoading || !studentName.trim()}
                  className={primaryButtonClassName}
                >
                  {studentLoading ? "保存中..." : "保存学生"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingStudent(false);
                    setStudentName(student.name);
                    setStudentGrade(student.grade);
                    setStudentSubject(student.subject);
                    setStudentNote(student.note);
                    setStudentError("");
                  }}
                  className={neutralButtonClassName}
                >
                  取消
                </button>
              </div>
            </form>
          </ClayShell>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          <aside className="space-y-5">
            <ClayShell>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                    Recent Topics
                  </p>
                  <h2 className="mt-2 text-[1.2rem] font-semibold text-[#3F3832]">
                    最近学过的知识点
                  </h2>
                </div>
                <PastelBadge tone="blue">{currentSubject}</PastelBadge>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {coveredSubjects.map((subject) => (
                  <button
                    key={`recent-topic-${subject}`}
                    type="button"
                    onClick={() => selectSubject(subject)}
                    className={
                      subject === currentSubject
                        ? secondaryButtonClassName
                        : "rounded-full border border-dashed border-[#DFD4C8] bg-[rgba(255,255,255,0.68)] px-4 py-2 text-sm font-semibold text-[#796C63] transition hover:bg-[rgba(255,255,255,0.84)]"
                    }
                  >
                    {subject}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {activeRecentTopicSection?.topics.length ? (
                  activeRecentTopicSection.topics.map((topic, index) => (
                    <div
                      key={`recent-topic-item-${topic.threadId}`}
                      className="rounded-[22px] border border-white/88 bg-[rgba(255,255,255,0.72)] px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B19983]">
                        最近主题 {index + 1}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-7 text-[#5C524B]">
                        {topic.label}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[#EADBC1] bg-[rgba(255,252,246,0.7)] px-4 py-4 text-sm leading-7 text-[#7A6B5D]">
                    当前科目下还没有最近学习主题。
                  </div>
                )}
              </div>
            </ClayShell>

            <ClayShell>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                Overview
              </p>
              <h2 className="mt-2 text-[1.2rem] font-semibold text-[#3F3832]">学习概览</h2>

              <div className="mt-4 space-y-3">
                <div className="rounded-[22px] border border-white/88 bg-[rgba(255,255,255,0.72)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B19983]">
                    累计记录
                  </p>
                  <p className="mt-2 text-[1.35rem] font-semibold text-[#2F2A26]">
                    {records.length} 次
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/88 bg-[rgba(255,255,255,0.72)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B19983]">
                    当前科目专题
                  </p>
                  <p className="mt-2 text-[1.35rem] font-semibold text-[#2F2A26]">
                    {activeSubjectSection?.threads.length ?? 0} 个
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/88 bg-[rgba(255,255,255,0.72)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B19983]">
                    最近一次
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-7 text-[#5C524B]">
                    {latestCurrentSubjectRecord
                      ? `${formatDisplayDate(latestCurrentSubjectRecord.updatedAt || latestCurrentSubjectRecord.date)} · ${latestCurrentSubjectRecord.topic}`
                      : "当前科目暂无补课记录"}
                  </p>
                </div>
              </div>
            </ClayShell>
          </aside>

          <section className="space-y-6">
            <ClayShell>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_220px]">
                <div className="lg:col-span-4 rounded-[24px] border border-[#E8DCC7] bg-[linear-gradient(180deg,rgba(255,252,246,0.92)_0%,rgba(255,255,255,0.72)_100%)] p-4 shadow-[0_14px_30px_rgba(225,205,170,0.08)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="mt-1 text-sm font-semibold text-[#5F554C]">
                        选择科目后，下方直接查看这个科目下的已学主题
                      </p>
                    </div>
                    <span className="text-sm text-[#7B6A59]">
                      共 {records.length} 条记录，当前 {filteredRecords.length} 条
                    </span>
                  </div>

                  <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {coveredSubjects.map((subject) => {
                      const active = subject === currentSubject;
                      const topicCount = subjectTopicCountMap[subject] ?? 0;

                      return (
                        <button
                          key={`records-${subject}`}
                          type="button"
                          onClick={() => selectSubject(subject)}
                          className={`group min-w-[152px] shrink-0 rounded-[18px] border px-3.5 py-3 text-left transition ${
                            active
                              ? "border-[#E8C87A] bg-[linear-gradient(135deg,rgba(255,243,205,0.98)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_14px_28px_rgba(233,209,148,0.18)] ring-2 ring-[#F7E6B6]"
                              : "border-[#E7E2D8] bg-[rgba(255,255,255,0.86)] shadow-[0_10px_18px_rgba(193,181,162,0.06)] hover:border-[#D9C9A9] hover:bg-[rgba(255,253,248,0.96)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[1rem] font-semibold text-[#3F3832]">
                                {subject}
                              </p>
                              <p className="mt-1 text-[11px] text-[#7A6B5D]">
                                已学 {topicCount} 个主题
                              </p>
                            </div>
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                                active
                                  ? "border-[#E7C980] bg-white text-[#A47A2F]"
                                  : "border-[#EEE6D8] bg-white text-[#A59078] group-hover:border-[#E2D2B5]"
                              }`}
                            >
                              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                                <path
                                  d="M7 5.5 12 10l-5 4.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.8"
                                />
                              </svg>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                  <span>按知识点 / 主题搜索</span>
                  <input
                    value={recordSearch}
                    onChange={(event) => setRecordSearch(event.target.value)}
                    placeholder="输入主题关键词"
                    className={fieldClassName}
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                  <span>按掌握程度筛选</span>
                  <select
                    value={recordMasteryFilter}
                    onChange={(event) => setRecordMasteryFilter(event.target.value)}
                    className={fieldClassName}
                  >
                    <option value="全部">全部掌握程度</option>
                    {masteryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                  <span>按日期排序</span>
                  <select
                    value={recordSortOrder}
                    onChange={(event) => setRecordSortOrder(event.target.value as "desc" | "asc")}
                    className={fieldClassName}
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div
                  className="rounded-[22px] border border-[#E7DCC8] bg-[rgba(255,255,255,0.74)] px-4 py-3 transition hover:bg-[rgba(255,255,255,0.88)]"
                  onClick={() => setStageTestExpanded((current) => !current)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A8927F]">
                        Test
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-[#3F3832]">阶段测试</h3>
                    </div>
                    <PastelBadge tone="blue">{currentSubject}</PastelBadge>
                  </div>
                </div>
              </div>

              {recordError ? <p className="mt-4 text-sm text-[#C36C68]">{recordError}</p> : null}

              <div className="mt-5">
                {stageTestExpanded ? (
                  <div className="rounded-[24px] border border-[rgba(232,221,201,0.88)] bg-[rgba(255,252,246,0.8)] p-5">
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={selectAllStageTopics} className={neutralButtonClassName}>
                        全选专题
                      </button>
                      <button type="button" onClick={clearStageTopics} className={neutralButtonClassName}>
                        清空选择
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleGenerateStageTest();
                        }}
                        disabled={
                          stageTestLoading ||
                          selectedStageTopics.length < 2 ||
                          selectedStageTopics.length > 6
                        }
                        className={primaryButtonClassName}
                      >
                        {stageTestLoading ? "生成中..." : "生成阶段测试"}
                      </button>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {activeTopicOptions.length === 0 ? (
                        <span className="text-sm text-[#7B6A59]">当前科目下还没有可用专题。</span>
                      ) : (
                        activeTopicOptions.map((topic) => {
                          const selected = selectedStageTopics.includes(topic);

                          return (
                            <button
                              key={`stage-topic-${topic}`}
                              type="button"
                              onClick={() => toggleStageTestTopic(topic)}
                              className={
                                selected
                                  ? secondaryButtonClassName
                                  : "rounded-full border border-dashed border-[#DFD4C8] bg-[rgba(255,255,255,0.68)] px-4 py-2 text-sm font-semibold text-[#796C63] transition hover:bg-[rgba(255,255,255,0.84)]"
                              }
                            >
                              {topic}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <p className="mt-4 text-xs leading-6 text-[#8A7765]">
                      当前已选 {selectedStageTopics.length} 个专题。阶段测试第一版需选择 2 到 6 个专题。
                    </p>

                    {stageTestResult && stageTestResult.subject === currentSubject ? (
                      <div className="mt-6 rounded-[22px] border border-white/88 bg-[rgba(255,255,255,0.76)] p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <h3 className="text-[1.2rem] font-semibold text-[#3E372F]">{stageTestResult.title}</h3>
                            <p className="mt-2 text-sm leading-7 text-[#6C6056]">
                              适用：{stageTestResult.grade} · {stageTestResult.subject} · 生成于 {stageTestResult.generatedAt}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {stageTestResult.topics.map((topic) => (
                              <PastelBadge key={`test-${topic}`} tone="yellow">
                                {topic}
                              </PastelBadge>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => downloadStageTestAsWord(stageTestResult, "questions")}
                            className={neutralButtonClassName}
                          >
                            导出题目 Word
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadStageTestAsWord(stageTestResult, "answers")}
                            className={neutralButtonClassName}
                          >
                            导出答案 Word
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadStageTestAsWord(stageTestResult, "both")}
                            className={secondaryButtonClassName}
                          >
                            导出题目+答案 Word
                          </button>
                        </div>

                        <section className="mt-5 rounded-[22px] border border-white/88 bg-[rgba(255,255,255,0.76)] p-5">
                          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">测试题目</h4>
                          <ol className="mt-4 space-y-4 text-sm leading-7 text-[#5E544D]">
                            {stageTestResult.questions.map((question, index) => (
                              <li key={question.id}>
                                <p className="font-semibold text-[#443C37]">
                                  第 {index + 1} 题 · {question.topic} · {question.sourceLabel}
                                </p>
                                <p className="mt-1">
                                  <MathInlineText value={question.question} />
                                </p>
                              </li>
                            ))}
                          </ol>
                        </section>

                        <section className="mt-5 rounded-[22px] border border-white/88 bg-[rgba(255,255,255,0.76)] p-5">
                          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">答案解析</h4>
                          <ol className="mt-4 space-y-4 text-sm leading-7 text-[#5E544D]">
                            {stageTestResult.questions.map((question, index) => (
                              <li key={`${question.id}-answer`} className="rounded-[18px] border border-[rgba(232,221,201,0.72)] bg-[rgba(255,252,246,0.72)] px-4 py-3">
                                <p>
                                  <span className="font-semibold text-[#443C37]">第 {index + 1} 题答案：</span>
                                  <MathInlineText value={question.answer} />
                                </p>
                                <p className="mt-2 text-[#6C6056]">
                                  <span className="font-semibold text-[#443C37]">解析：</span>
                                  <MathInlineText value={question.analysis} />
                                </p>
                              </li>
                            ))}
                          </ol>
                        </section>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </ClayShell>

            {records.length === 0 ? (
              <div className="rounded-[30px] border border-dashed border-[#EBCF9E] bg-white/75 p-8 text-sm leading-7 text-[#7B6A59]">
                这位学生还没有保存过补课记录，回到生成页完成第一次保存即可。
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="rounded-[30px] border border-dashed border-[#EBCF9E] bg-white/75 p-8 text-sm leading-7 text-[#7B6A59]">
                当前筛选条件下没有匹配的补课记录，调整关键词、掌握程度或排序后再试。
              </div>
            ) : (
              activeSubjectSection ? (
                <section
                  key={activeSubjectSection.subject}
                  className="space-y-6 rounded-[34px] border border-[rgba(214,224,239,0.86)] bg-[linear-gradient(180deg,rgba(241,247,255,0.94)_0%,rgba(255,255,255,0.7)_100%)] p-4 shadow-[0_22px_52px_rgba(169,190,214,0.08)] sm:p-5"
                >
                  {activeSubjectSection.threads.map((thread) => {
                    const chainTotal = thread.records.length;
                    const chainStart = thread.records[0];
                    const chainEnd = thread.records.at(-1);

                    return (
                      <section
                        key={thread.threadId}
                        className="relative z-0 overflow-visible rounded-[30px] border border-[rgba(233,225,212,0.72)] bg-[rgba(255,255,255,0.58)] shadow-[0_18px_40px_rgba(196,181,166,0.06)] focus-within:z-40"
                      >
                        <div className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,#F4D89E_0%,#E8BF6B_100%)]" />
                        <div className="border-b border-white/80 bg-[linear-gradient(180deg,rgba(255,249,239,0.96)_0%,rgba(255,255,255,0.68)_100%)] px-6 py-5">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex min-w-0 items-start gap-4">
                              <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[#F5E4B8] bg-[linear-gradient(180deg,rgba(255,252,241,0.98)_0%,rgba(255,243,209,0.94)_100%)] shadow-[0_10px_22px_rgba(229,194,117,0.15)]">
                                <TopicGlyph />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#B1946F]">
                                  Topic Progress
                                </p>
                                <h3 className="mt-1 text-[1.28rem] font-semibold tracking-[-0.02em] text-[#3F3832]">
                                  {chainStart?.topic || "专题学习进程"}
                                </h3>
                                <p className="mt-2 text-sm leading-7 text-[#6E625A] xl:whitespace-nowrap">
                                  共 {chainTotal} 次补习
                                  {chainStart ? ` · 开始于 ${formatDisplayDate(chainStart.date)}` : ""}
                                  {chainEnd ? ` · 最近一次 ${formatDisplayDate(chainEnd.updatedAt || chainEnd.date)}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                              {chainEnd?.masteryLevel ? (
                                <PastelBadge tone={masteryTone(chainEnd.masteryLevel)}>
                                  当前进度：{chainEnd.masteryLevel}
                                </PastelBadge>
                              ) : (
                                <PastelBadge tone="yellow">当前进度：待补反馈</PastelBadge>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleThreadExpanded(thread.threadId)}
                                className="rounded-full border border-[#E9DAB7] bg-white/86 px-5 py-3 text-sm font-semibold text-[#8B7350] shadow-[0_10px_24px_rgba(226,198,140,0.08)] transition hover:bg-white"
                              >
                                {expandedThreadIds[thread.threadId] === false ? "展开专题" : "收起专题"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {expandedThreadIds[thread.threadId] === false ? null : (
                          <div className="space-y-4 px-4 py-5 sm:px-5">
                            {thread.records.map((record) =>
                        updatingRecordId === record.id ? (
                  <form key={record.id} onSubmit={handleUpdateRecord} className={shellClassName}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[1.2rem] font-semibold text-[#3F3832]">更新补课记录</h3>
                      <PastelBadge tone="yellow">
                        {getRecordActionLabel(record)}
                      </PastelBadge>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                        <span>补课日期</span>
                        <input
                          type="date"
                          value={recordDate}
                          onChange={(event) => setRecordDate(event.target.value)}
                          className={fieldClassName}
                        />
                      </label>

                      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                        <span>掌握程度</span>
                        <select
                          value={recordMasteryLevel}
                          onChange={(event) =>
                            setRecordMasteryLevel(event.target.value as MasteryLevel | "")
                          }
                          className={fieldClassName}
                        >
                          <option value="">暂不填写</option>
                          {masteryOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="xl:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                        <span>知识点 / 主题</span>
                        <input
                          value={recordTopic}
                          onChange={(event) => setRecordTopic(event.target.value)}
                          className={fieldClassName}
                        />
                      </label>

                      <label className="xl:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                        <span>老师反馈</span>
                        <textarea
                          rows={5}
                          value={recordTeacherFeedback}
                          onChange={(event) => setRecordTeacherFeedback(event.target.value)}
                          className={`${fieldClassName} min-h-[140px] resize-none`}
                          placeholder="例如：基础概念能跟上，但一到变式题就会漏掉条件，计算过程还不够稳定。"
                        />
                      </label>

                      <div className="xl:col-span-2 rounded-[22px] border border-dashed border-[#EADBC1] bg-[rgba(255,250,239,0.72)] px-4 py-4 text-sm leading-7 text-[#7A6B5D]">
                        保存后会根据本次掌握情况自动生成下一步补习建议；老师反馈可以补充，但不是必填。
                        {!recordTeacherFeedback.trim() ? (
                          <p className="mt-2 text-xs leading-6 text-[#9A7B63]">
                            不填老师反馈也可以继续生成；如果补一句具体薄弱点，下一次资料会更准。
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={
                          recordLoading ||
                          !recordDate ||
                          !recordTopic.trim()
                        }
                        className={primaryButtonClassName}
                      >
                        {recordLoading ? "保存中..." : "保存更新"}
                      </button>
                      <button type="button" onClick={cancelRecordEdit} className={neutralButtonClassName}>
                        取消
                      </button>
                    </div>
                  </form>
                        ) : (
                  <article
                    key={record.id}
                    className={`relative z-0 overflow-visible rounded-[32px] border backdrop-blur-xl focus-within:z-50 ${masteryCardClass(record)}`}
                  >
                    <div className="absolute bottom-0 left-8 top-0 hidden w-px bg-[linear-gradient(180deg,rgba(221,205,196,0.1)_0%,rgba(209,187,168,0.55)_18%,rgba(209,187,168,0.42)_82%,rgba(221,205,196,0.1)_100%)] lg:block" />
                    <div className="absolute left-[25px] top-10 hidden h-6 w-6 rounded-full border-4 border-white bg-[#E7D4BA] shadow-[0_8px_18px_rgba(191,164,138,0.25)] lg:block" />
                    {(() => {
                      const chainInfo = recordIndexMap.get(record.id);
                      const isTerminalRecord = terminalRecordIds.has(record.id);

                      return (
                        <>
                          <div className={`border-b border-white/85 px-5 py-5 sm:px-6 lg:pl-16 ${masteryHeaderClass(record)}`}>
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap gap-2">
                                  <PastelBadge tone="yellow">{record.date}</PastelBadge>
                                  {record.masteryLevel ? (
                                    <PastelBadge tone={masteryTone(record.masteryLevel)}>
                                      掌握程度：{record.masteryLevel}
                                    </PastelBadge>
                                  ) : (
                                    <PastelBadge tone="yellow">待补反馈</PastelBadge>
                                  )}
                                  <PastelBadge tone="blue">
                                    {getRecordStageLabel(record)}
                                  </PastelBadge>
                                  {chainInfo && chainInfo.total > 1 ? (
                                    <PastelBadge tone="green">
                                      第 {chainInfo.position} / {chainInfo.total} 次补习
                                    </PastelBadge>
                                  ) : null}
                                </div>
                                <h3 className="mt-4 text-[1.28rem] font-semibold tracking-[-0.02em] text-[#2E2825]">
                                  {record.topic}
                                </h3>
                                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6E625D]">
                                  {record.teacherFeedback
                                    ? record.teacherFeedback.slice(0, 90)
                                    : "这份资料已先保存，课后老师反馈和下一步建议可以在上课后再补充。"}
                                  {record.teacherFeedback && record.teacherFeedback.length > 90 ? "..." : ""}
                                </p>
                              </div>

                              <div className="flex flex-col items-start gap-3 xl:items-end">
                                <div className="flex flex-wrap gap-3 xl:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => toggleRecordExpanded(record.id)}
                                    className={neutralButtonClassName}
                                  >
                                    {expandedRecordIds[record.id] ? "收起资料" : "查看资料"}
                                  </button>
                                  <Link href={buildReuseHref(record)} className={secondaryButtonClassName}>
                                    复制为新备课
                                  </Link>
                                  {isTerminalRecord && record.masteryLevel !== "熟练" && record.nextStepSuggestion ? (
                                    <Link href={buildNextLessonHref(record)} className={primaryButtonClassName}>
                                      按建议生成下一次备课
                                    </Link>
                                  ) : (
                                    <span className="rounded-full border border-white/88 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm font-semibold text-[#6F7D67]">
                                      {record.masteryLevel === "熟练"
                                        ? "本知识点已掌握"
                                        : isFeedbackCompleted(record)
                                          ? "当前建议已生成"
                                          : "待补反馈后续课"}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => startRecordUpdate(record)}
                                    className={primaryButtonClassName}
                                  >
                                    {getRecordActionLabel(record)}
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A18F80]">
                                    资料操作
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRecord(record)}
                                    className="text-sm font-semibold text-[#B56562] transition hover:text-[#9F4E4B]"
                                  >
                                    删除记录
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="relative z-[60] px-5 pb-5 sm:px-6 sm:pb-6 lg:pl-16">
                            <LessonPackageExportDialog
                              title={record.topic || "补课备课包"}
                              fileName={buildLessonPackageFileName({
                                studentName: student.name,
                                topic: record.topic,
                                attemptIndex: chainInfo?.position ?? 1,
                              })}
                              result={record.lessonPackage}
                              mode="compact"
                            />
                          </div>
                        </>
                      );
                    })()}

                    {expandedRecordIds[record.id] ? (
                      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.2fr_0.8fr] lg:pl-16">
                        <div className="space-y-5">
                          <section className="rounded-[24px] border border-white/88 bg-[rgba(255,255,255,0.74)] p-5 backdrop-blur-md">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">
                              知识总结
                            </h4>
                            <p className="mt-3 whitespace-pre-line text-sm leading-8 text-[#655A54]">
                              {record.lessonPackage.overview}
                            </p>
                          </section>

                          <section className="rounded-[24px] border border-white/88 bg-[rgba(255,255,255,0.74)] p-5 backdrop-blur-md">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">
                              重点难点
                            </h4>
                            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#655A54]">
                              {record.lessonPackage.keyPoints.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                              {record.lessonPackage.difficulties.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </section>
                        </div>

                        <div className="space-y-5">
                          <section className="rounded-[24px] border border-white/88 bg-[rgba(255,255,255,0.74)] p-5 backdrop-blur-md">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">
                              老师反馈
                            </h4>
                            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#655A54]">
                              {record.teacherFeedback || "这份资料包已保存，课后老师反馈暂未补充。"}
                            </p>
                          </section>

                          <section className="rounded-[24px] border border-white/88 bg-[rgba(255,255,255,0.74)] p-5 backdrop-blur-md">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">
                              下一步补习建议
                            </h4>
                            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#655A54]">
                              {record.nextStepSuggestion || "补充掌握情况后，这里会自动生成下一步补习建议。"}
                            </p>
                            {terminalRecordIds.has(record.id) && record.nextStepSuggestion && record.masteryLevel !== "熟练" ? (
                              <Link href={buildNextLessonHref(record)} className="mt-4 inline-flex rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_32px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.9)]">
                                直接续接生成下一次备课
                              </Link>
                            ) : null}
                          </section>

                          <section className="rounded-[24px] border border-white/88 bg-[rgba(255,252,245,0.72)] p-5 backdrop-blur-md">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">
                              资料摘要
                            </h4>
                            <div className="mt-3 space-y-2 text-sm leading-7 text-[#655A54]">
                              <p>课堂练习：{record.lessonPackage.classExercises.length} 题</p>
                              <p>课后练习：{record.lessonPackage.homework.length} 题</p>
                              <p>例题示范：{record.lessonPackage.examples.length} 题</p>
                              {record.previousRecordId ? <p>承接上一轮：已关联</p> : <p>承接上一轮：本链起点</p>}
                              {record.nextRecordId ? <p>下一轮备课：已生成</p> : <p>下一轮备课：待续接</p>}
                            </div>
                          </section>
                        </div>
                      </div>
                    ) : null}
                  </article>
                        ),
                      )}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </section>
              ) : (
                <div className="rounded-[30px] border border-dashed border-[#EBCF9E] bg-white/75 p-8 text-sm leading-7 text-[#7B6A59]">
                  当前所选科目下还没有匹配的补课记录。
                </div>
              )
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
