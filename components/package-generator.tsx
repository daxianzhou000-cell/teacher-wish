"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getAppMeta, removeAppMeta, setAppMeta } from "@/lib/client/app-meta-store";
import {
  createGenerationJob,
  failGenerationJob,
  fetchGenerationJob,
  hydrateGenerationJob,
} from "@/lib/client/generation-job-repository";
import {
  createRecordViaApi,
  createStudentViaApi,
  readPreferredStudents,
} from "@/lib/client/student-record-repository";

import { LessonPackageExportDialog } from "@/components/lesson-package-export-dialog";
import { MathInlineText, MathTextBlock } from "@/components/math-rich-text";
import { buildLessonPackageFileName } from "@/lib/utils/topic-format";
import type {
  ExerciseCount,
  FollowUpMasteryLevel,
  GenerateMode,
  GenerateRequest,
  Grade,
  LessonDuration,
  LessonPackage,
  LessonStyle,
  NextLessonSuggestion,
  StageTestBias,
  StageTestResult,
  StudentLevel,
  Subject,
} from "@/lib/generator";
import type {
  MasteryLevel,
  Student,
  TutoringRecord,
} from "@/lib/types/student-progress";

const subjectOptions: Subject[] = ["语文", "数学", "英语"];
const gradeOptions: Grade[] = ["七年级", "八年级", "九年级"];
const levelOptions: StudentLevel[] = ["基础薄弱", "普通", "提分"];
const styleOptions: LessonStyle[] = ["基础补习", "提分补习", "考前冲刺", "一对一讲解"];
const durationOptions: LessonDuration[] = [30, 60, 90];
const masteryOptions: MasteryLevel[] = ["未掌握", "一般", "基本掌握", "熟练"];
const followUpMasteryOptions: FollowUpMasteryLevel[] = ["一般", "基本掌握", "熟悉"];
const stageTestBiasOptions: StageTestBias[] = ["基础巩固", "均衡检测", "提升检测"];
const stageTestTopicPresets: Record<Subject, string[]> = {
  语文: ["文言文实词虚词", "现代文阅读", "古诗鉴赏", "病句辨析", "作文审题立意", "表现手法"],
  数学: ["一元二次方程", "因式分解", "公式法", "判别式", "函数图像", "几何证明"],
  英语: ["一般过去时", "过去完成时", "被动语态", "阅读理解", "完形填空", "书面表达"],
};

const defaultForm: GenerateRequest = {
  mode: "single",
  subject: "数学",
  grade: "八年级",
  topic: "",
  studentLevel: "普通",
  lessonStyle: "提分补习",
  duration: 60,
  exerciseCount: 5,
};

const fieldClassName =
  "rounded-[20px] border border-white/80 bg-white/72 px-4 py-3 text-sm text-[#4F463F] backdrop-blur-md outline-none transition active:translate-y-[1px] active:bg-white/82 active:shadow-[inset_0_3px_10px_rgba(120,104,83,0.08)] focus:border-[#F3D9A4] focus:bg-white/84 focus:shadow-[inset_0_3px_12px_rgba(120,104,83,0.08)] focus:ring-4 focus:ring-[#FFF3CD]";

const textareaClassName =
  `${fieldClassName} min-h-[84px] resize-none text-[1.3rem] font-semibold leading-8 text-[#2F2722] placeholder:text-[1.08rem] placeholder:font-medium placeholder:text-[#9B8A79]`;
const topicTextareaClassName =
  `${fieldClassName} min-h-[92px] resize-none text-[1.2rem] font-semibold leading-[1.55] text-[#183A59] placeholder:text-[1rem] placeholder:font-medium placeholder:text-[#8F8275] sm:text-[1.35rem]`;

const resultToolButtonClassName =
  "min-w-[112px] rounded-full border px-5 py-3 text-sm font-semibold transition";

type Props = {
  initialStudents: Student[];
  initialForm: GenerateRequest | null;
  initialStudentId: string;
  initialFollowUpPrefill: {
    studentId: string;
    previousRecordId: string;
    learningThreadId: string;
    sourceTopic: string;
    sourceFeedback: string;
    sourceSuggestion: string;
    sourceMasteryLevel: string;
  } | null;
};

type SelectFieldProps<T extends string | number> = {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
};

type ApiErrorPayload = {
  error?: string;
};

type FollowUpPrefill = NonNullable<Props["initialFollowUpPrefill"]>;
type GeneratorDraft = {
  form: GenerateRequest;
  selectedStudentId: string;
  followUpPrefill: FollowUpPrefill | null;
  result: LessonPackage | null;
  resultTopic: string;
  resultJobId: string;
  generatedMode: GenerateMode;
  nextLessonSuggestion: NextLessonSuggestion | null;
  lessonDate: string;
  teacherFeedback: string;
  masteryLevel: MasteryLevel | "";
  savedRecord: TutoringRecord | null;
  activeTool: "bind" | "export" | null;
  hasExportedResult: boolean;
  stageTestResult: StageTestResult | null;
};

const ACTIVE_JOB_STORAGE_KEY = "lesson-package-active-job";
const ACTIVE_FORM_STORAGE_KEY = "lesson-package-active-form";
const DRAFT_STORAGE_KEY = "lesson-package-draft";

function normalizeInitialForm(input: GenerateRequest | null): GenerateRequest {
  return {
    ...defaultForm,
    ...(input ?? {}),
    mode: input?.mode === "follow_up" ? "follow_up" : "single",
  };
}

function toPersistedGenerateRequest(input: GenerateRequest): GenerateRequest {
  return {
    mode: "single",
    subject: input.subject,
    grade: input.grade,
    topic: input.topic,
    studentLevel: input.studentLevel,
    lessonStyle: input.lessonStyle,
    duration: input.duration,
    exerciseCount: input.exerciseCount,
  };
}

function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={fieldClassName}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClayCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[30px] border border-white/75 bg-[rgba(255,255,255,0.62)] p-5 backdrop-blur-xl shadow-[0_18px_48px_rgba(233,210,154,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] ${className}`}
    >
      {children}
    </div>
  );
}

function CandyTitleMark() {
  return (
    <div className="relative inline-flex items-center justify-center px-2 py-2">
      <svg
        viewBox="0 0 760 240"
        className="h-auto w-[220px] sm:w-[300px]"
        role="img"
        aria-label="课糖"
      >
        <defs>
          <linearGradient id="pageCandyInk" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7399c3" />
            <stop offset="45%" stopColor="#c289aa" />
            <stop offset="100%" stopColor="#daa85b" />
          </linearGradient>
          <filter id="pageCandyGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 .2 0"
            />
          </filter>
          <clipPath id="pageCandyTextClip">
            <text
              x="380"
              y="190"
              textAnchor="middle"
              fontSize="206"
              fontWeight="700"
              transform="rotate(-1.2 380 190)"
              letterSpacing="12"
              fontFamily="'Hannotate SC','TsangerJinKai05','Baoli SC','STKaiti','YouYuan','PingFang SC',cursive"
            >
              课糖
            </text>
          </clipPath>
        </defs>

        <g filter="url(#pageCandyGlow)">
          <text
            x="380"
            y="190"
            textAnchor="middle"
            fontSize="206"
            fontWeight="700"
            transform="rotate(-1.2 380 190)"
            letterSpacing="12"
            fontFamily="'Hannotate SC','TsangerJinKai05','Baoli SC','STKaiti','YouYuan','PingFang SC',cursive"
            fill="url(#pageCandyInk)"
            opacity="0.72"
          >
            课糖
          </text>
        </g>
        <text
          x="380"
          y="190"
          textAnchor="middle"
          fontSize="206"
          fontWeight="700"
          transform="rotate(-1.2 380 190)"
          letterSpacing="12"
          fontFamily="'Hannotate SC','TsangerJinKai05','Baoli SC','STKaiti','YouYuan','PingFang SC',cursive"
          fill="url(#pageCandyInk)"
        >
          课糖
        </text>
      </svg>

      <svg
        viewBox="0 0 96 96"
        className="absolute left-0 top-0 h-[44px] w-[44px] -translate-x-2 -translate-y-2 rotate-[-14deg] sm:h-[54px] sm:w-[54px]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pageCandyBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd6ef" />
            <stop offset="45%" stopColor="#ffb3d8" />
            <stop offset="100%" stopColor="#ffcf73" />
          </linearGradient>
          <linearGradient id="pageCandyWrap" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff7fb" />
            <stop offset="50%" stopColor="#ffe9f3" />
            <stop offset="100%" stopColor="#fff2cc" />
          </linearGradient>
          <linearGradient id="pageCandyGloss" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff4cf" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="#9d8063" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M20 49
               C12 40 10 31 14 25
               C20 18 30 21 36 29
               C34 37 29 44 20 49Z"
            fill="url(#pageCandyWrap)"
            strokeWidth="2"
          />
          <path
            d="M76 49
               C84 40 86 31 82 25
               C76 18 66 21 60 29
               C62 37 67 44 76 49Z"
            fill="url(#pageCandyWrap)"
            strokeWidth="2"
          />
          <path
            d="M27 35
               C28 27 35 22 47 22
               C61 22 69 28 69 39
               L69 55
               C69 66 60 72 47 72
               C35 72 27 66 27 56Z"
            fill="url(#pageCandyBody)"
          />
          <path
            d="M29 36
               C30 29 36 25 47 25
               C59 25 66 30 66 39
               L66 54
               C66 63 58 69 47 69
               C37 69 30 64 30 56Z"
            fill="url(#pageCandyBody)"
            strokeWidth="2.2"
          />
          <ellipse cx="41.5" cy="35.5" rx="6.5" ry="4.5" fill="url(#pageCandyGloss)" opacity="0.85" />
        </g>
      </svg>

      <svg
        viewBox="0 0 170 132"
        className="absolute -bottom-2 right-0 h-[58px] w-[78px] sm:h-[72px] sm:w-[96px]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pageCatFur" x1="0%" y1="10%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff9f0" />
            <stop offset="55%" stopColor="#f7ead8" />
            <stop offset="100%" stopColor="#ebd6be" />
          </linearGradient>
          <linearGradient id="pageCatBelly" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffdf8" />
            <stop offset="100%" stopColor="#f7efe1" />
          </linearGradient>
        </defs>
        <g transform="translate(4 5)" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="74" cy="97" rx="42" ry="9" fill="rgba(186,162,138,0.12)" />
          <path
            d="M32 73
               C30 58 42 48 61 46
               C88 44 110 51 118 64
               C123 72 122 82 116 88
               C107 96 91 99 71 99
               C53 99 40 96 34 88
               C31 84 31 79 32 73Z"
            fill="url(#pageCatFur)"
          />
          <path
            d="M37 72
               C36 58 47 48 63 47
               C86 45 106 51 113 63
               C117 70 116 78 110 84
               C103 91 89 94 72 94
               C54 94 42 91 38 84
               C36 80 36 76 37 72Z"
            fill="url(#pageCatFur)"
            stroke="#a58872"
            strokeWidth="2.2"
          />
          <ellipse cx="68" cy="68" rx="26" ry="23" fill="url(#pageCatBelly)" opacity="0.82" />
          <path
            d="M47 56
               C48 42 58 34 71 34
               C85 34 96 42 97 56
               C98 63 95 69 90 74
               C84 79 76 81 68 81
               C59 81 51 79 46 73
               C42 68 41 62 47 56Z"
            fill="url(#pageCatFur)"
            stroke="#a58872"
            strokeWidth="2.2"
          />
          <path d="M56 45 L50 31 L64 40" fill="url(#pageCatFur)" stroke="#a58872" strokeWidth="2.2" />
          <path d="M80 42 L90 30 L92 46" fill="url(#pageCatFur)" stroke="#a58872" strokeWidth="2.2" />
          <ellipse cx="59.5" cy="58.5" rx="2.3" ry="2.7" fill="#70584a" />
          <ellipse cx="77.5" cy="58.5" rx="2.3" ry="2.7" fill="#70584a" />
          <path d="M67 65 C68.8 67 70.6 67 72.2 65" fill="none" stroke="#8b6d5a" strokeWidth="2" />
          <path d="M69.4 61.5 L65.8 64.2 L73 64.2 Z" fill="#d9989e" opacity="0.72" />
          <ellipse cx="56" cy="90" rx="10" ry="5.5" fill="url(#pageCatBelly)" stroke="#a58872" strokeWidth="2" />
          <ellipse cx="81" cy="90" rx="10" ry="5.5" fill="url(#pageCatBelly)" stroke="#a58872" strokeWidth="2" />
          <path d="M111 73 C122 72 129 78 128 87 C127 96 116 97 108 90" fill="none" stroke="#a58872" strokeWidth="2.6" />
        </g>
      </svg>
    </div>
  );
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function PackageGenerator({
  initialStudents,
  initialForm,
  initialStudentId,
  initialFollowUpPrefill,
}: Props) {
  const [students, setStudents] = useState(initialStudents);
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || "");
  const [form, setForm] = useState<GenerateRequest>(normalizeInitialForm(initialForm));
  const [result, setResult] = useState<LessonPackage | null>(null);
  const [resultTopic, setResultTopic] = useState("");
  const [resultJobId, setResultJobId] = useState("");
  const [stageTestResult, setStageTestResult] = useState<StageTestResult | null>(null);
  const [generatedMode, setGeneratedMode] = useState<GenerateMode>("single");
  const [nextLessonSuggestion, setNextLessonSuggestion] = useState<NextLessonSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const pollTimerRef = useRef<number | null>(null);
  const topicFieldRef = useRef<HTMLTextAreaElement | null>(null);

  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState<Grade>(defaultForm.grade);
  const [newStudentSubject, setNewStudentSubject] = useState<Subject>(defaultForm.subject);
  const [newStudentNote, setNewStudentNote] = useState("");
  const [studentCreateLoading, setStudentCreateLoading] = useState(false);
  const [studentCreateError, setStudentCreateError] = useState("");

  const [lessonDate, setLessonDate] = useState(todayString());
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [masteryLevel, setMasteryLevel] = useState<MasteryLevel | "">("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedRecord, setSavedRecord] = useState<TutoringRecord | null>(null);
  const [hasExportedResult, setHasExportedResult] = useState(false);
  const [followUpContext, setFollowUpContext] = useState<FollowUpPrefill | null>(initialFollowUpPrefill);
  const [activeTool, setActiveTool] = useState<"bind" | "export" | null>(null);
  const selectedStudent =
    students.find((student) => student.id === selectedStudentId) ?? null;
  const linkedFollowUpStudentId =
    followUpContext?.studentId?.trim() || initialStudentId || "";
  const resolvedRecordStudentId = selectedStudentId || linkedFollowUpStudentId || "";

  useEffect(() => {
    let cancelled = false;

    void readPreferredStudents(initialStudents).then((preferredStudents) => {
      if (cancelled) {
        return;
      }

      setStudents(preferredStudents);
    });

    return () => {
      cancelled = true;
    };
  }, [initialStudents]);

  const resolvedLessonTopic =
    resultTopic.trim() ||
    form.topic.trim() ||
    (generatedMode === "follow_up" ? followUpContext?.sourceTopic?.trim() ?? "" : "");

  useEffect(() => {
    if (!initialFollowUpPrefill) {
      return;
    }

    setFollowUpContext((current) => current ?? initialFollowUpPrefill);
    setSelectedStudentId((current) => current || initialFollowUpPrefill.studentId || initialStudentId || "");

    setForm((current) => {
      if (current.followUpContext?.previousTopic) {
        return current;
      }

      return {
        ...current,
        mode: "follow_up",
        followUpContext: {
          previousTopic: initialFollowUpPrefill.sourceTopic || current.topic,
          masteryLevel:
            initialFollowUpPrefill.sourceMasteryLevel === "基本掌握" ||
            initialFollowUpPrefill.sourceMasteryLevel === "熟练"
              ? "熟悉"
              : initialFollowUpPrefill.sourceMasteryLevel === "一般"
                ? "一般"
                : "一般",
          masteredContent: "",
          weakContent: initialFollowUpPrefill.sourceFeedback || "",
          teacherRemark: initialFollowUpPrefill.sourceFeedback || "",
        },
      };
    });
  }, [initialFollowUpPrefill]);

  useEffect(() => {
    if (!linkedFollowUpStudentId) {
      return;
    }

    setSelectedStudentId((current) => current || linkedFollowUpStudentId);
  }, [linkedFollowUpStudentId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getAppMeta(ACTIVE_JOB_STORAGE_KEY),
      getAppMeta(DRAFT_STORAGE_KEY),
      getAppMeta(ACTIVE_FORM_STORAGE_KEY),
    ]).then(([savedJobId, savedDraft, savedForm]) => {
      if (cancelled) {
        return;
      }

      const resumeDraft =
        new URLSearchParams(window.location.search).get("resumeDraft") === "1";
      const navigationEntry = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const isReload = navigationEntry?.type === "reload";
      const shouldRestoreDraft =
        Boolean(savedDraft) &&
        (resumeDraft || Boolean(savedJobId) || Boolean(initialFollowUpPrefill) || !isReload);

      if (shouldRestoreDraft) {
        try {
          const parsed = JSON.parse(savedDraft ?? "{}") as Partial<GeneratorDraft>;
          let savedPendingForm: GenerateRequest | null = null;

          if (savedForm) {
            try {
              savedPendingForm = JSON.parse(savedForm) as GenerateRequest;
            } catch {
              savedPendingForm = null;
            }
          }

          if (parsed.form) {
            setForm(normalizeInitialForm(parsed.form));
          } else if (savedPendingForm) {
            setForm(normalizeInitialForm(savedPendingForm));
          }

          if (typeof parsed.selectedStudentId === "string") {
            setSelectedStudentId(parsed.selectedStudentId);
          }

          if (parsed.followUpPrefill) {
            setFollowUpContext(parsed.followUpPrefill);
          }

          if (parsed.result) {
            setResult(parsed.result);
          }

          if (typeof parsed.resultTopic === "string") {
            setResultTopic(parsed.resultTopic);
          } else if (parsed.result) {
            const fallbackTopic =
              parsed.form?.topic?.trim() ||
              savedPendingForm?.topic?.trim() ||
              "";

            if (fallbackTopic) {
              setResultTopic(fallbackTopic);
            }
          }

          if (typeof parsed.resultJobId === "string") {
            setResultJobId(parsed.resultJobId);
          }

          if (parsed.stageTestResult) {
            setStageTestResult(parsed.stageTestResult);
          }

          if (parsed.generatedMode) {
            setGeneratedMode(parsed.generatedMode);
          }

          if (parsed.nextLessonSuggestion) {
            setNextLessonSuggestion(parsed.nextLessonSuggestion);
          }

          if (typeof parsed.lessonDate === "string") {
            setLessonDate(parsed.lessonDate);
          }

          if (typeof parsed.teacherFeedback === "string") {
            setTeacherFeedback(parsed.teacherFeedback);
          }

          if (
            parsed.masteryLevel === "" ||
            parsed.masteryLevel === "未掌握" ||
            parsed.masteryLevel === "一般" ||
            parsed.masteryLevel === "基本掌握" ||
            parsed.masteryLevel === "熟练"
          ) {
            setMasteryLevel(parsed.masteryLevel);
          }

          if (parsed.savedRecord) {
            setSavedRecord(parsed.savedRecord);
          }

          if (parsed.activeTool === "bind" || parsed.activeTool === "export" || parsed.activeTool === null) {
            setActiveTool(parsed.activeTool);
          }

          if (typeof parsed.hasExportedResult === "boolean") {
            setHasExportedResult(parsed.hasExportedResult);
          }
        } catch {
          void removeAppMeta(DRAFT_STORAGE_KEY);
        }
      } else if (isReload && !savedJobId && !initialFollowUpPrefill && !resumeDraft) {
        void removeAppMeta(DRAFT_STORAGE_KEY);
      } else if (savedForm) {
        try {
          const parsed = JSON.parse(savedForm) as GenerateRequest;
          setForm(normalizeInitialForm(parsed));
        } catch {
          void removeAppMeta(ACTIVE_FORM_STORAGE_KEY);
        }
      }

      if (savedJobId) {
        void hydrateGenerationJob(savedJobId).then((cachedJob) => {
          if (!cachedJob || cancelled) {
            return;
          }

          if (cachedJob.input) {
            setForm(normalizeInitialForm(cachedJob.input));
          }

          if (cachedJob.data?.mode === "stage_test") {
            setGeneratedMode("stage_test");
            setStageTestResult(cachedJob.data.stageTest);
          } else if (cachedJob.data) {
            setGeneratedMode(cachedJob.data.mode);
            setResult(cachedJob.data.lessonPackage);
            setResultTopic(
              cachedJob.input?.topic?.trim() ||
                cachedJob.input?.followUpContext?.previousTopic?.trim() ||
                "",
            );
            setResultJobId(savedJobId);
            setNextLessonSuggestion(
              cachedJob.data.mode === "follow_up" ? cachedJob.data.nextLessonSuggestion : null,
            );
          }

          if (cachedJob.status === "failed" && cachedJob.error) {
            setError(cachedJob.error);
            setLoading(false);
          }
        });

        setActiveJobId(savedJobId);
        setLoading(true);
        void pollJob(savedJobId);
      }
    });

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [initialFollowUpPrefill]);

  useEffect(() => {
    const draft: GeneratorDraft = {
      form,
      selectedStudentId,
      followUpPrefill: followUpContext,
      result,
      resultTopic,
      resultJobId,
      stageTestResult,
      generatedMode,
      nextLessonSuggestion,
      lessonDate,
      teacherFeedback,
      masteryLevel,
      savedRecord,
      activeTool,
      hasExportedResult,
    };

    void setAppMeta(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    activeTool,
    followUpContext,
    form,
    generatedMode,
    lessonDate,
    masteryLevel,
    nextLessonSuggestion,
    result,
    resultTopic,
    resultJobId,
    stageTestResult,
    savedRecord,
    selectedStudentId,
    teacherFeedback,
    hasExportedResult,
  ]);

  useEffect(() => {
    if (!savedRecord || !hasExportedResult) {
      return;
    }

    void removeAppMeta(DRAFT_STORAGE_KEY);
    void removeAppMeta(ACTIVE_FORM_STORAGE_KEY);
    void removeAppMeta(ACTIVE_JOB_STORAGE_KEY);
  }, [hasExportedResult, savedRecord]);

  useEffect(() => {
    if (!result || resultTopic.trim() || !resultJobId) {
      return;
    }

    let cancelled = false;

    void fetchGenerationJob(resultJobId)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const recoveredTopic =
          payload.input?.topic?.trim() ||
          payload.input?.followUpContext?.previousTopic?.trim() ||
          "";

        if (recoveredTopic) {
          setResultTopic(recoveredTopic);
        }
      })
      .catch(() => {
        // ignore recovery failures; explicit save will still show a clear message
      });

    return () => {
      cancelled = true;
    };
  }, [result, resultJobId, resultTopic]);

  function persistPendingJob(jobId: string, nextForm: GenerateRequest) {
    void setAppMeta(ACTIVE_JOB_STORAGE_KEY, jobId);
    void setAppMeta(ACTIVE_FORM_STORAGE_KEY, JSON.stringify(nextForm));
  }

  function clearPendingJob() {
    void removeAppMeta(ACTIVE_JOB_STORAGE_KEY);
    void removeAppMeta(ACTIVE_FORM_STORAGE_KEY);
    setActiveJobId("");
  }

  async function pollJob(jobId: string) {
    try {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }

      const payload = await fetchGenerationJob(jobId);

      if (payload.status === "completed" && payload.data) {
        setGeneratedMode(payload.data.mode);
        if (payload.data.mode === "stage_test") {
          setStageTestResult(payload.data.stageTest);
          setResult(null);
          setResultTopic("");
          setResultJobId("");
          setNextLessonSuggestion(null);
        } else {
          setResult(payload.data.lessonPackage);
          const jobTopic =
            payload.input?.topic?.trim() ||
            payload.input?.followUpContext?.previousTopic?.trim() ||
            "";
          setResultTopic((current) => current || jobTopic || form.topic.trim());
          setResultJobId(jobId);
          setStageTestResult(null);
          setNextLessonSuggestion(
            payload.data.mode === "follow_up" ? payload.data.nextLessonSuggestion : null,
          );
        }
        setLoading(false);
        setError("");
        clearPendingJob();
        return;
      }

      if (payload.status === "failed") {
        throw new Error(payload.error || "生成失败，请稍后重试。");
      }

      setLoading(true);
      pollTimerRef.current = window.setTimeout(() => {
        void pollJob(jobId);
      }, 1500);
    } catch (jobError) {
      setLoading(false);
      setError(jobError instanceof Error ? jobError.message : "生成失败。");
      await failGenerationJob(
        jobId,
        jobError instanceof Error ? jobError.message : "生成失败。",
      );
      clearPendingJob();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSavedRecord(null);
    setSaveError("");
    setNextLessonSuggestion(null);
    setStageTestResult(null);
    const requestForm: GenerateRequest =
      form.mode === "follow_up"
        ? {
            ...form,
            followUpContext: {
              previousTopic:
                form.followUpContext?.previousTopic?.trim() || form.topic.trim() || "上一节同主题内容",
              masteryLevel: form.followUpContext?.masteryLevel ?? "一般",
              masteredContent: form.followUpContext?.masteredContent ?? "",
              weakContent: form.followUpContext?.weakContent ?? "",
              teacherRemark: form.followUpContext?.teacherRemark ?? "",
            },
          }
        : form.mode === "stage_test"
          ? {
              ...form,
              topic:
                form.topic.trim() ||
                form.stageTestContext?.testName?.trim() ||
                form.stageTestContext?.selectedTopics?.join("、") ||
                `${form.subject}阶段测试`,
              stageTestContext: {
                selectedTopics: form.stageTestContext?.selectedTopics ?? [],
                testName: form.stageTestContext?.testName?.trim() ?? "",
                masteryBias: form.stageTestContext?.masteryBias ?? "均衡检测",
                totalQuestionCount: form.stageTestContext?.totalQuestionCount ?? 12,
              },
            }
        : form;

    setGeneratedMode(requestForm.mode ?? "single");
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
    }

    try {
      setForm(requestForm);
      setResultTopic(requestForm.topic.trim());
      const payload = await createGenerationJob(requestForm);

      setActiveJobId(payload.jobId);
      persistPendingJob(payload.jobId, requestForm);
      await pollJob(payload.jobId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "请求失败。");
      setLoading(false);
    }
  }

  async function handleCreateStudent() {
    setStudentCreateLoading(true);
    setStudentCreateError("");

    try {
      const student = await createStudentViaApi({
        name: newStudentName,
        grade: newStudentGrade,
        subject: newStudentSubject,
        note: newStudentNote,
      });

      setStudents((current) => [student, ...current]);
      setSelectedStudentId(student.id);
      setNewStudentName("");
      setNewStudentNote("");
      setActiveTool("bind");
    } catch (submitError) {
      setStudentCreateError(
        submitError instanceof Error ? submitError.message : "新增学生失败。",
      );
    } finally {
      setStudentCreateLoading(false);
    }
  }

  async function handleSaveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!result) {
      setSaveError("请先生成补课备课包。");
      return;
    }

    if (!resolvedLessonTopic) {
      setSaveError("当前主题缺失，请重新生成一次资料包后再保存。");
      return;
    }

    setSaveLoading(true);
    setSaveError("");

    try {
      const record = await createRecordViaApi({
        studentId: resolvedRecordStudentId || null,
        date: lessonDate,
        topic: resolvedLessonTopic,
        learningThreadId: followUpContext?.learningThreadId ?? null,
        previousRecordId: followUpContext?.previousRecordId ?? null,
        lessonPackage: result,
        teacherFeedback,
        masteryLevel,
        generateRequest: toPersistedGenerateRequest(form),
      });

      if (resolvedRecordStudentId && record.studentId !== resolvedRecordStudentId) {
        throw new Error("资料已保存，但绑定学生没有成功，请重新选择学生后再试。");
      }

      setSavedRecord(record);
    } catch (submitError) {
      setSaveError(
        submitError instanceof Error ? submitError.message : "保存补课记录失败。",
      );
    } finally {
      setSaveLoading(false);
    }
  }

  function handlePrepareNextLesson() {
    setResult(null);
    setResultTopic("");
    setResultJobId("");
    setNextLessonSuggestion(null);
    setGeneratedMode("single");
    setStageTestResult(null);
    setSavedRecord(null);
    setSaveError("");
    setError("");
    setActiveTool(null);
    setHasExportedResult(false);
    setTeacherFeedback("");
    setMasteryLevel("");

    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => {
      topicFieldRef.current?.focus();
    }, 150);
  }

  function renderLessonContent() {
    if (generatedMode === "stage_test" && stageTestResult) {
      return (
        <div className="space-y-5">
          <ClayCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                  Stage Test
                </p>
                <h3 className="mt-2 text-[1.65rem] font-semibold text-[#3F3832]">
                  {stageTestResult.title}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {stageTestResult.topicsCovered.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-[#F0E7C9] bg-[#FFFBEF] px-3 py-1.5 text-[#7A6A58]"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </ClayCard>

          <ClayCard>
            <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">测试说明</h3>
            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-8 text-[#5E554D]">
              {stageTestResult.testDirections.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </ClayCard>

          <ClayCard>
            <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">测试题目</h3>
            <ol className="mt-5 space-y-4 pl-0 text-sm leading-8 text-[#5E554D]">
              {stageTestResult.questions.map((question, index) => (
                <li key={`${question.type}-${question.prompt}-${index}`} className="rounded-[22px] border border-[#EEF2F5] bg-white px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A8927F]">
                    {question.type}
                  </p>
                  <p className="mt-2 text-sm leading-8 text-[#5E554D]">
                    <MathInlineText value={question.prompt} />
                  </p>
                </li>
              ))}
            </ol>
          </ClayCard>

          <ClayCard>
            <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">答案解析</h3>
            <ol className="mt-5 space-y-4 pl-0 text-sm leading-8 text-[#5E554D]">
              {stageTestResult.answerAnalysis.map((item) => (
                <li key={`${item.questionIndex}-${item.answer}`} className="rounded-[22px] border border-[#EEF2F5] bg-white px-5 py-4">
                  <p className="text-sm font-semibold text-[#3F3832]">第 {item.questionIndex} 题</p>
                  <p className="mt-2 text-sm text-[#5E554D]">
                    <span className="font-semibold text-[#6A5E55]">参考答案：</span>
                    <MathInlineText value={item.answer} />
                  </p>
                  <p className="mt-2 text-sm text-[#5E554D]">
                    <span className="font-semibold text-[#6A5E55]">解析：</span>
                    <MathInlineText value={item.analysis} />
                  </p>
                </li>
              ))}
            </ol>
          </ClayCard>
        </div>
      );
    }

    if (!result) {
      return (
        <ClayCard className="min-h-[360px] text-center">
          <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-12">
            <div className="mb-5 rounded-full border border-[#F3E6C2] bg-[#FFFBEF] px-6 py-4">
              <span className="text-sm font-semibold text-[#8B7456]">工作流已准备好</span>
            </div>
            <h2 className="text-[1.9rem] font-semibold text-[#3F3832]">先输入今天要补的课，再开始生成</h2>
            <p className="mt-4 text-sm leading-7 text-[#6D645C]">
              先拿到一整份可上课的资料，再决定是否导出、保存到资料库，或者绑定到具体学生。
            </p>
          </div>
        </ClayCard>
      );
    }

    return (
      <div className="space-y-5">
        <ClayCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                Lesson Sheet
              </p>
              <h3 className="mt-2 text-[1.65rem] font-semibold text-[#3F3832]">
                {resolvedLessonTopic}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-[#F0E7C9] bg-[#FFFBEF] px-3 py-1.5 text-[#7A6A58]">
                {form.subject}
              </span>
              <span className="rounded-full border border-[#F0E7C9] bg-[#FFFBEF] px-3 py-1.5 text-[#7A6A58]">
                {form.grade}
              </span>
              <span className="rounded-full border border-[#F0E7C9] bg-[#FFFBEF] px-3 py-1.5 text-[#7A6A58]">
                {form.duration} 分钟
              </span>
            </div>
          </div>
        </ClayCard>

        <ClayCard>
          <h3 className="text-[1.55rem] font-semibold text-[#3F3832]">知识讲义</h3>
          <MathTextBlock value={result.overview} className="mt-5 text-sm leading-8 text-[#5E554D]" />
        </ClayCard>

        <ClayCard className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">核心讲练内容</h3>
            <p className="text-sm text-[#8B7A69]">先看讲义、例题和讲练题，最适合直接上课</p>
          </div>
        </ClayCard>

        <ClayCard>
          <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">例题示范</h3>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {result.examples.map((example) => (
              <div
                key={example.title}
                className="rounded-[24px] border border-[#EEF2F5] bg-white px-5 py-5"
              >
                <p className="text-base font-semibold text-[#3F3832]">{example.title}</p>
                <p className="mt-3 text-sm font-semibold text-[#5E554D]">题目</p>
                <MathTextBlock value={example.question} className="mt-2 text-sm leading-7 text-[#5E554D]" />
                <p className="mt-4 text-sm font-semibold text-[#5E554D]">思考断点</p>
                <MathTextBlock value={example.thinkingBreakpoint} className="mt-2 text-sm leading-7 text-[#7C7168]" />
                <p className="mt-4 text-sm font-semibold text-[#5E554D]">讲解过程</p>
                <MathTextBlock value={example.process} className="mt-2 text-sm leading-7 text-[#7C7168]" />
                <p className="mt-4 text-sm font-semibold text-[#5E554D]">满分范式</p>
                <MathTextBlock value={example.perfectAnswer} className="mt-2 text-sm leading-7 text-[#6D625A]" />
              </div>
            ))}
          </div>
        </ClayCard>

        <ClayCard>
          <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">课堂练习</h3>
          <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-8 text-[#5E554D]">
            {result.classExercises.map((exercise) => (
              <li key={exercise.question}>
                <MathInlineText value={exercise.question} />
              </li>
            ))}
          </ol>
        </ClayCard>

        <ClayCard>
          <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">课后练习</h3>
          <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-8 text-[#5E554D]">
            {result.homework.map((item) => (
              <li key={item.question}>
                <MathInlineText value={item.question} />
              </li>
            ))}
          </ol>
        </ClayCard>

        <div className="grid gap-5 xl:grid-cols-2">
          <ClayCard>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">难点提醒</h3>
                <p className="mt-4 text-sm font-semibold text-[#6A5E55]">核心要点</p>
                <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-8 text-[#5E554D]">
                  {result.keyPoints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">难点提醒</h3>
                <p className="mt-4 text-sm font-semibold text-[#6A5E55]">易错与避坑</p>
                <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-8 text-[#5E554D]">
                  {result.difficulties.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ClayCard>

        <ClayCard>
          <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">答案解析</h3>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-8 text-[#5E554D]">
            {result.answerAnalysis.map((item) => (
                <li key={item}>
                  <MathInlineText value={item} />
                </li>
              ))}
          </ol>
        </ClayCard>

        <ClayCard>
          <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">提分建议</h3>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-8 text-[#5E554D]">
            {result.improvementTips.map((item) => (
                <li key={item}>
                  <MathInlineText value={item} />
                </li>
              ))}
          </ol>
        </ClayCard>

        <ClayCard>
          <h3 className="text-[1.45rem] font-semibold text-[#3F3832]">小测收尾</h3>
          <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-8 text-[#5E554D]">
            {result.quickQuiz.map((item) => (
                <li key={item.question}>
                  <MathInlineText value={item.question} />
                </li>
              ))}
          </ol>
        </ClayCard>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent px-4 py-8 text-[#4F463F] sm:px-6 lg:px-8">
      {loading ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="rounded-full border border-white/90 bg-[rgba(255,250,239,0.94)] px-6 py-3 text-sm font-semibold text-[#766656] shadow-[0_18px_36px_rgba(170,154,126,0.18)] backdrop-blur-md">
            时间较久，请耐心等待
          </div>
        </div>
      ) : null}

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-12 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(255,230,164,0.42)_0%,rgba(255,230,164,0.18)_42%,rgba(255,230,164,0)_76%)] blur-3xl" />
        <div className="absolute right-[-120px] top-[18%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(255,214,228,0.38)_0%,rgba(255,214,228,0.16)_46%,rgba(255,214,228,0)_76%)] blur-3xl" />
        <div className="absolute left-[26%] bottom-[-120px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(211,229,255,0.36)_0%,rgba(211,229,255,0.14)_48%,rgba(211,229,255,0)_78%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <section className="space-y-4 rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,248,225,0.58)_0%,rgba(255,255,255,0.5)_48%,rgba(238,246,255,0.56)_100%)] p-4 backdrop-blur-md">
          <ClayCard className="relative overflow-visible bg-[linear-gradient(145deg,rgba(255,255,255,0.72)_0%,rgba(255,250,236,0.54)_42%,rgba(243,248,255,0.52)_100%)] pt-14">
            <div className="pointer-events-none absolute -left-2 -top-12 z-10 rotate-[-7deg] drop-shadow-[0_16px_26px_rgba(194,137,170,0.08)] sm:-left-4 sm:-top-14">
              <CandyTitleMark />
            </div>

            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-[#A8927F]">
                Lesson Builder
              </p>
              <h2 className="mt-3 text-[1.85rem] font-semibold leading-[1.14] tracking-[-0.03em] text-[#3F3832]">
                先定下今天这一课
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#6D645C]">
                填好主题和节奏，直接生成一份可上课的资料。
              </p>
              {initialForm ? (
                <div className="mt-5 inline-flex rounded-full border border-[#F3E6C2] bg-[#FFFBEF] px-5 py-3 text-sm font-medium text-[#8B7456] shadow-[0_10px_30px_rgba(244,226,177,0.12)]">
                  已从历史记录带入参数，可以直接微调后重新生成
                </div>
              ) : null}
              {followUpContext ? (
                <div className="mt-5 max-w-2xl rounded-[24px] border border-[#F4D9E3] bg-[linear-gradient(135deg,rgba(255,247,250,0.96)_0%,rgba(255,242,247,0.9)_100%)] px-5 py-4 text-left text-sm leading-7 text-[#7A5E68] shadow-[0_14px_30px_rgba(244,217,227,0.14)]">
                  <p className="font-semibold text-[#6E525C]">
                    正在续接上一轮补习链路
                  </p>
                  <p className="mt-2">
                    来源知识点：{followUpContext.sourceTopic || "上一条记录"}
                  </p>
                  <p className="mt-1">
                    上期反馈：{followUpContext.sourceFeedback || "未提供上期反馈。"}
                  </p>
                  <p className="mt-1">
                    历史建议（仅供参考）：{followUpContext.sourceSuggestion || "本次会重新生成新的下一步建议。"}
                  </p>
                  {!followUpContext.sourceFeedback ? (
                    <p className="mt-2 text-xs leading-6 text-[#9C7180]">
                      没有老师反馈也可以直接继续；如果补一句薄弱点，下一次资料会更贴合真实问题。
                    </p>
                  ) : null}
                  {followUpContext.sourceSuggestion ? (
                    <p className="mt-2 text-xs leading-6 text-[#9C7180]">
                      这条是上一轮记录里保存的旧建议，本次重新生成后，下方结果区会给出新的下一步安排。
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <SelectField
                  label="年级"
                  value={form.grade}
                  options={gradeOptions}
                  onChange={(value) => setForm((current) => ({ ...current, grade: value }))}
                />
                <SelectField
                  label="科目"
                  value={form.subject}
                  options={subjectOptions}
                  onChange={(value) => setForm((current) => ({ ...current, subject: value }))}
                />
                <SelectField
                  label="学生水平"
                  value={form.studentLevel}
                  options={levelOptions}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, studentLevel: value }))
                  }
                />
                <SelectField
                  label="课程风格"
                  value={form.lessonStyle}
                  options={styleOptions}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, lessonStyle: value }))
                  }
                />
                <SelectField
                  label="课程时长"
                  value={form.duration}
                  options={durationOptions}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      duration: Number(value) as LessonDuration,
                    }))
                  }
                />
              </div>

              <label className="mx-auto flex w-full max-w-3xl flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span className="text-[1rem] font-semibold tracking-[0.01em] text-[#58453A]">
                  {form.mode === "stage_test" ? "测试范围主题" : "当前主题"}
                </span>
                <textarea
                  ref={topicFieldRef}
                  rows={2}
                  value={form.topic}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, topic: event.target.value }))
                  }
                  placeholder={
                    form.mode === "stage_test"
                      ? "可留空，系统会按测试名称和知识点自动生成"
                      : "例如：一元一次方程"
                  }
                  className={topicTextareaClassName}
                />
              </label>

              {form.mode === "stage_test" ? (
                <div className="mx-auto w-full max-w-4xl space-y-4 rounded-[28px] border border-white/82 bg-[rgba(255,255,255,0.54)] p-4 backdrop-blur-md">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745] md:col-span-2">
                      <span>测试名称</span>
                      <input
                        value={form.stageTestContext?.testName ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mode: "stage_test",
                            stageTestContext: {
                              selectedTopics:
                                current.stageTestContext?.selectedTopics ??
                                stageTestTopicPresets[current.subject].slice(0, 3),
                              testName: event.target.value,
                              masteryBias: current.stageTestContext?.masteryBias ?? "均衡检测",
                              totalQuestionCount: current.stageTestContext?.totalQuestionCount ?? 12,
                            },
                          }))
                        }
                        placeholder="例如：一元二次方程阶段测试"
                        className={fieldClassName}
                      />
                    </label>
                    <SelectField
                      label="检测风格"
                      value={form.stageTestContext?.masteryBias ?? "均衡检测"}
                      options={stageTestBiasOptions}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          mode: "stage_test",
                          stageTestContext: {
                            selectedTopics:
                              current.stageTestContext?.selectedTopics ??
                              stageTestTopicPresets[current.subject].slice(0, 3),
                            testName: current.stageTestContext?.testName ?? "",
                            masteryBias: value,
                            totalQuestionCount: current.stageTestContext?.totalQuestionCount ?? 12,
                          },
                        }))
                      }
                    />
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                      <span>总题量</span>
                      <select
                        value={form.stageTestContext?.totalQuestionCount ?? 12}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mode: "stage_test",
                            stageTestContext: {
                              selectedTopics:
                                current.stageTestContext?.selectedTopics ??
                                stageTestTopicPresets[current.subject].slice(0, 3),
                              testName: current.stageTestContext?.testName ?? "",
                              masteryBias: current.stageTestContext?.masteryBias ?? "均衡检测",
                              totalQuestionCount: Number(event.target.value),
                            },
                          }))
                        }
                        className={fieldClassName}
                      >
                        {[12, 13, 14, 15].map((count) => (
                          <option key={count} value={count}>
                            {count} 题
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#6B5745]">知识点多选</p>
                      <span className="text-xs text-[#8B7A69]">第一版建议选 3 到 6 个知识点</span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {stageTestTopicPresets[form.subject].map((topic) => {
                        const checked = form.stageTestContext?.selectedTopics?.includes(topic) ?? false;

                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() =>
                              setForm((current) => {
                                const currentTopics = current.stageTestContext?.selectedTopics ?? [];
                                const nextTopics = checked
                                  ? currentTopics.filter((item) => item !== topic)
                                  : currentTopics.length >= 6
                                    ? currentTopics
                                    : [...currentTopics, topic];

                                return {
                                  ...current,
                                  mode: "stage_test",
                                  stageTestContext: {
                                    selectedTopics: nextTopics,
                                    testName: current.stageTestContext?.testName ?? "",
                                    masteryBias: current.stageTestContext?.masteryBias ?? "均衡检测",
                                    totalQuestionCount: current.stageTestContext?.totalQuestionCount ?? 12,
                                  },
                                };
                              })
                            }
                            className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                              checked
                                ? "border-[#F1DDA7] bg-[rgba(255,249,230,0.92)] text-[#695A45]"
                                : "border-white/88 bg-white/78 text-[#6B625A]"
                            }`}
                          >
                            {topic}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {form.mode === "follow_up" && !followUpContext ? (
                <div className="mx-auto w-full max-w-4xl space-y-4 rounded-[28px] border border-white/82 bg-[rgba(255,255,255,0.54)] p-4 backdrop-blur-md">
                  {!(form.followUpContext?.teacherRemark ?? "").trim() ? (
                    <div className="rounded-[20px] border border-dashed border-[#E9D7B8] bg-[rgba(255,250,239,0.72)] px-4 py-3 text-xs leading-6 text-[#8E735E]">
                      现在就可以继续生成；如果补一句老师备注或薄弱点，资料包会更精准。
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                      <span>上一节主题</span>
                      <input
                        value={form.followUpContext?.previousTopic ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mode: "follow_up",
                            followUpContext: {
                              previousTopic: event.target.value,
                              masteryLevel: current.followUpContext?.masteryLevel ?? "一般",
                              masteredContent: current.followUpContext?.masteredContent ?? "",
                              weakContent: current.followUpContext?.weakContent ?? "",
                              teacherRemark: current.followUpContext?.teacherRemark ?? "",
                            },
                          }))
                        }
                        placeholder="例如：一次函数图像与性质"
                        className={fieldClassName}
                      />
                    </label>

                    <SelectField
                      label="掌握情况"
                      value={form.followUpContext?.masteryLevel ?? "一般"}
                      options={followUpMasteryOptions}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          mode: "follow_up",
                          followUpContext: {
                            previousTopic: current.followUpContext?.previousTopic ?? "",
                            masteryLevel: value,
                            masteredContent: current.followUpContext?.masteredContent ?? "",
                            weakContent: current.followUpContext?.weakContent ?? "",
                            teacherRemark: current.followUpContext?.teacherRemark ?? "",
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                      <span>已掌握内容</span>
                      <textarea
                        rows={4}
                        value={form.followUpContext?.masteredContent ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mode: "follow_up",
                            followUpContext: {
                              previousTopic: current.followUpContext?.previousTopic ?? "",
                              masteryLevel: current.followUpContext?.masteryLevel ?? "一般",
                              masteredContent: event.target.value,
                              weakContent: current.followUpContext?.weakContent ?? "",
                              teacherRemark: current.followUpContext?.teacherRemark ?? "",
                            },
                          }))
                        }
                        className={`${fieldClassName} min-h-[120px] resize-none`}
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                      <span>薄弱内容</span>
                      <textarea
                        rows={4}
                        value={form.followUpContext?.weakContent ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mode: "follow_up",
                            followUpContext: {
                              previousTopic: current.followUpContext?.previousTopic ?? "",
                              masteryLevel: current.followUpContext?.masteryLevel ?? "一般",
                              masteredContent: current.followUpContext?.masteredContent ?? "",
                              weakContent: event.target.value,
                              teacherRemark: current.followUpContext?.teacherRemark ?? "",
                            },
                          }))
                        }
                        className={`${fieldClassName} min-h-[120px] resize-none`}
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                      <span>老师备注</span>
                      <textarea
                        rows={4}
                        value={form.followUpContext?.teacherRemark ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mode: "follow_up",
                            followUpContext: {
                              previousTopic: current.followUpContext?.previousTopic ?? "",
                              masteryLevel: current.followUpContext?.masteryLevel ?? "一般",
                              masteredContent: current.followUpContext?.masteredContent ?? "",
                              weakContent: current.followUpContext?.weakContent ?? "",
                              teacherRemark: event.target.value,
                            },
                          }))
                        }
                        className={`${fieldClassName} min-h-[120px] resize-none`}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  loading ||
                  (form.mode !== "stage_test" && !form.topic.trim()) ||
                  (form.mode === "stage_test" &&
                    (((form.stageTestContext?.selectedTopics?.length ?? 0) < 3) ||
                      ((form.stageTestContext?.selectedTopics?.length ?? 0) > 6))) ||
                  (form.mode === "follow_up" &&
                    (!(form.followUpContext?.previousTopic ?? form.topic).trim() ||
                      !form.followUpContext?.masteryLevel))
                }
                className="w-full rounded-full border border-white/90 bg-[rgba(255,242,194,0.84)] px-8 py-5 text-lg font-semibold text-[#645746] shadow-[0_20px_40px_rgba(240,215,150,0.2),inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:bg-[rgba(255,239,186,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "正在生成补课资料..."
                  : form.mode === "follow_up"
                  ? "生成下一次资料包"
                  : form.mode === "stage_test"
                    ? "生成阶段测试"
                  : "生成补课资料"}
              </button>

              <p className="text-sm text-[#8A7765]">
                生成成功后，再决定导出、保存到资料库，或者绑定到某位学生。
              </p>

              {error ? <p className="text-sm text-[#D65477]">{error}</p> : null}
            </form>
          </ClayCard>
        </section>

        <section className="space-y-4 rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.48)_0%,rgba(255,250,236,0.38)_54%,rgba(242,247,255,0.36)_100%)] p-4 backdrop-blur-md">
            <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-[#A8927F]">
                Lesson Result
              </p>
              <h2 className="mt-3 text-[1.85rem] font-semibold leading-[1.14] tracking-[-0.03em] text-[#3F3832]">
                生成结果
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#6D645C]">
                先看核心讲练内容，再决定导出、保存，或者继续生成下一课。
              </p>
            </div>
            {result ? (
              <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.56)] p-2 backdrop-blur-md shadow-[0_12px_26px_rgba(214,195,166,0.08)]">
                <button
                  type="button"
                  onClick={() => setActiveTool((current) => (current === "bind" ? null : "bind"))}
                  className={`${resultToolButtonClassName} ${
                    activeTool === "bind"
                      ? "border-white/90 bg-[rgba(255,242,194,0.82)] text-[#645746] shadow-[0_16px_30px_rgba(240,215,150,0.16)]"
                      : "border-white/85 bg-[rgba(255,255,255,0.72)] text-[#6B625A] backdrop-blur-md hover:bg-white"
                  }`}
                >
                  绑定学生
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool((current) => (current === "export" ? null : "export"))}
                  className={`${resultToolButtonClassName} ${
                    activeTool === "export"
                      ? "border-white/90 bg-[rgba(255,242,194,0.82)] text-[#645746] shadow-[0_16px_30px_rgba(240,215,150,0.16)]"
                      : "border-white/85 bg-[rgba(255,255,255,0.72)] text-[#6B625A] backdrop-blur-md hover:bg-white"
                  }`}
                >
                  导出
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveRecord({
                      preventDefault() {},
                    } as FormEvent<HTMLFormElement>);
                  }}
                  disabled={saveLoading || !result}
                  className={`${resultToolButtonClassName} border-white/90 bg-[rgba(255,240,245,0.74)] text-[#705E68] backdrop-blur-md shadow-[0_16px_34px_rgba(243,204,214,0.16)] hover:bg-[rgba(255,245,248,0.9)] disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {saveLoading ? "保存中..." : "保存资料"}
                </button>
                <div className="hidden h-8 w-px bg-[rgba(193,175,151,0.35)] sm:block" />
                <button
                  type="button"
                  onClick={handlePrepareNextLesson}
                  className={`${resultToolButtonClassName} border-white/85 bg-[rgba(255,246,248,0.72)] text-[#705E68] backdrop-blur-md hover:bg-white`}
                >
                  继续生成下一课
                </button>
              </div>
            ) : generatedMode === "stage_test" && stageTestResult ? (
              <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.56)] p-2 backdrop-blur-md shadow-[0_12px_26px_rgba(214,195,166,0.08)]">
                <button
                  type="button"
                  onClick={handlePrepareNextLesson}
                  className={`${resultToolButtonClassName} border-white/85 bg-[rgba(255,246,248,0.72)] text-[#705E68] backdrop-blur-md hover:bg-white`}
                >
                  继续生成下一课
                </button>
              </div>
            ) : null}
          </div>

          {result && activeTool === "export" ? (
            <LessonPackageExportDialog
              title={resolvedLessonTopic || "补课备课包"}
              fileName={buildLessonPackageFileName({
                studentName: selectedStudent?.name ?? "",
                topic: resolvedLessonTopic,
              })}
              result={result}
              mode="inline"
              showPresets
              onExportComplete={() => setHasExportedResult(true)}
            />
          ) : null}

          {generatedMode === "follow_up" && nextLessonSuggestion ? (
            <ClayCard className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                  Next Lesson Suggestion
                </p>
                <h3 className="mt-2 text-[1.45rem] font-semibold text-[#3F3832]">
                  下一步补习建议
                </h3>
              </div>

              <div className="rounded-[22px] border border-white/85 bg-[rgba(255,255,255,0.72)] px-4 py-4">
                <p className="text-sm font-semibold text-[#6A5E55]">目标</p>
                <p className="mt-2 text-sm leading-7 text-[#5E554D]">
                  {nextLessonSuggestion.goal}
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-[22px] border border-white/85 bg-[rgba(255,255,255,0.72)] px-4 py-4">
                  <p className="text-sm font-semibold text-[#6A5E55]">保留并延续</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#5E554D]">
                    {nextLessonSuggestion.continueFocus.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[22px] border border-white/85 bg-[rgba(255,255,255,0.72)] px-4 py-4">
                  <p className="text-sm font-semibold text-[#6A5E55]">重点补弱</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#5E554D]">
                    {nextLessonSuggestion.weakPointFocus.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[22px] border border-white/85 bg-[rgba(255,255,255,0.72)] px-4 py-4">
                  <p className="text-sm font-semibold text-[#6A5E55]">下一课怎么上</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#5E554D]">
                    {nextLessonSuggestion.teachingStrategy.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </ClayCard>
          ) : null}

          {result && activeTool === "bind" ? (
            <section className="rounded-[26px] border border-white/86 bg-[rgba(255,255,255,0.74)] p-5 backdrop-blur-md shadow-[0_14px_30px_rgba(214,195,166,0.1)]">
              <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-[#E7E0CF] bg-[rgba(255,252,245,0.84)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#5F544A]">选择已有学生</p>
                      <span className="rounded-full bg-[rgba(255,242,194,0.82)] px-3 py-1 text-xs font-semibold text-[#7A6648]">
                        直接绑定
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#7A6D61]">
                      点下面下拉框，直接选择已有学生。
                    </p>
                    <label className="mt-3 flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                      <span className="sr-only">选择已有学生</span>
                      <select
                        value={selectedStudentId}
                        onChange={(event) => setSelectedStudentId(event.target.value)}
                        className={`${fieldClassName} border-[#E4D7BE] bg-[rgba(255,255,255,0.96)] text-[0.98rem] font-medium shadow-[0_8px_20px_rgba(225,205,166,0.12)]`}
                      >
                        <option value="">先不绑定，直接保存到仓库</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.name} · {student.grade} · {student.subject}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {selectedStudent ? (
                    <div className="rounded-[22px] border border-white/85 bg-[rgba(255,255,255,0.66)] px-4 py-4 text-sm leading-7 text-[#6C6158]">
                      {selectedStudent.name} · {selectedStudent.grade} · {selectedStudent.subject}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4 rounded-[22px] border border-dashed border-[#D7DEE6] bg-[rgba(255,255,255,0.5)] px-4 py-4">
                  <p className="text-sm font-semibold text-[#6B5745]">新增并绑定学生</p>
                  <div className="space-y-4">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                      <span>姓名</span>
                      <input
                        value={newStudentName}
                        onChange={(event) => setNewStudentName(event.target.value)}
                        className={fieldClassName}
                        placeholder="例如：王同学"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <SelectField
                        label="年级"
                        value={newStudentGrade}
                        options={gradeOptions}
                        onChange={(value) => setNewStudentGrade(value)}
                      />
                      <SelectField
                        label="学科"
                        value={newStudentSubject}
                        options={subjectOptions}
                        onChange={(value) => setNewStudentSubject(value)}
                      />
                    </div>

                    <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                      <span>备注</span>
                      <textarea
                        rows={3}
                        value={newStudentNote}
                        onChange={(event) => setNewStudentNote(event.target.value)}
                        className={textareaClassName}
                        placeholder="例如：基础不稳、阅读理解薄弱"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleCreateStudent()}
                      disabled={studentCreateLoading || !newStudentName.trim()}
                      className="w-full rounded-full border border-white/90 bg-[rgba(255,255,255,0.72)] px-5 py-4 text-sm font-semibold text-[#6B625A] transition hover:bg-[rgba(255,255,255,0.88)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {studentCreateLoading ? "新增中..." : "新增并选中"}
                    </button>

                    {studentCreateError ? (
                      <p className="text-sm text-[#D65477]">{studentCreateError}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {saveError ? <p className="text-sm text-[#D65477]">{saveError}</p> : null}

          {savedRecord ? (
            <div className="rounded-[24px] border border-[#DDEFCF] bg-[#F8FFF2] px-4 py-4 text-sm text-[#58714A]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">
                  {savedRecord.studentId ? "资料已保存并绑定学生" : "资料已保存到仓库"}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {savedRecord.studentId ? (
                    <Link
                      href={`/students/${savedRecord.studentId}?refresh=${encodeURIComponent(savedRecord.updatedAt)}`}
                      prefetch={false}
                      className="rounded-full border border-[#D9E8CA] bg-white px-4 py-2.5 text-sm font-semibold text-[#58714A] transition hover:bg-[#FCFFF9]"
                    >
                      去学生档案查看
                    </Link>
                  ) : null}
                  <Link
                    href="/library"
                    prefetch={false}
                    className="rounded-full border border-[#D9E8CA] bg-white px-4 py-2.5 text-sm font-semibold text-[#58714A] transition hover:bg-[#FCFFF9]"
                  >
                    去仓库查看
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {renderLessonContent()}
        </section>
      </div>
    </main>
  );
}
