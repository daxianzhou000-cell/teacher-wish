"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  readPreferredLibraryData,
  updateRecordViaApi,
} from "@/lib/client/student-record-repository";

import { LessonPackageExportDialog } from "@/components/lesson-package-export-dialog";
import { getRecordStageLabel } from "@/lib/domain/student-progress-status";
import type { Student, TutoringRecord } from "@/lib/types/student-progress";
import { buildLessonPackageFileName } from "@/lib/utils/topic-format";

type Props = {
  records: TutoringRecord[];
  students: Student[];
};

function FloatingCat() {
  return (
    <svg viewBox="0 0 120 78" className="h-auto w-[88px]" aria-hidden="true">
      <defs>
        <linearGradient id="libraryCatBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF8EC" />
          <stop offset="100%" stopColor="#F3DEC3" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#8E745F" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path
          fill="url(#libraryCatBody)"
          d="M20 48c0-12 10-22 24-22h17c18 0 29 8 29 21 0 10-8 17-20 17H39c-12 0-19-6-19-16Z"
        />
        <path fill="url(#libraryCatBody)" d="M36 27 45 14l8 12" />
        <path fill="url(#libraryCatBody)" d="m62 26 9-12 8 13" />
        <path d="M48 43c1.5-1 3-1 4.5 0" />
        <path d="M63 43c1.5-1 3-1 4.5 0" />
        <path d="M56 50c2.5 2 5.5 2 8 0" />
        <path d="M44 49c-6 1-11 1-15 0" />
        <path d="M44 53c-6 2-11 2-15 2" />
        <path d="M72 49c6 1 11 1 15 0" />
        <path d="M72 53c6 2 11 2 15 2" />
        <path d="M87 52c9 0 14 7 9 12-3 3-8 1-11-2" />
      </g>
    </svg>
  );
}

function hashText(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }

  return hash;
}

function CandyCorner({ seed }: { seed: string }) {
  const variants = [
    {
      wrap: ["#ffe7ef", "#ffd779", "#d6ebff"],
      center: ["#fffdf8", "#f7e2b4"],
      stripe: "#fff8ef",
    },
    {
      wrap: ["#fff0dc", "#f0ce98", "#ffc8df"],
      center: ["#fffdf7", "#f3ddb6"],
      stripe: "#fff7eb",
    },
    {
      wrap: ["#ffe9d6", "#ffd997", "#c8e3ff"],
      center: ["#fffef8", "#f6dfb1"],
      stripe: "#fff9f0",
    },
  ] as const;

  const variant = variants[hashText(seed) % variants.length];
  const [wrapStart, wrapMid, wrapEnd] = variant.wrap;
  const [centerStart, centerEnd] = variant.center;

  return (
    <svg
      viewBox="0 0 108 86"
      className="h-auto w-[52px] rotate-[10deg] drop-shadow-[0_10px_18px_rgba(222,190,135,0.14)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`candyWrap-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={wrapStart} />
          <stop offset="48%" stopColor={wrapMid} />
          <stop offset="100%" stopColor={wrapEnd} />
        </linearGradient>
        <linearGradient id={`candyCore-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={centerStart} />
          <stop offset="100%" stopColor={centerEnd} />
        </linearGradient>
      </defs>

      <g fill="none" stroke="#ad8a69" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M17 46c-9-6-14-17-10-25 6-8 18-8 28 1-1 10-5 17-18 24Z"
          fill={`url(#candyWrap-${seed})`}
          strokeWidth="2"
          opacity="0.95"
        />
        <path
          d="M91 46c9-6 14-17 10-25-6-8-18-8-28 1 1 10 5 17 18 24Z"
          fill={`url(#candyWrap-${seed})`}
          strokeWidth="2"
          opacity="0.95"
        />
        <rect
          x="26"
          y="22"
          width="50"
          height="36"
          rx="18"
          fill={`url(#candyCore-${seed})`}
          strokeWidth="2.3"
        />
        <path d="M34 31c10-5 26-5 34 0" stroke={variant.stripe} strokeWidth="3" opacity="0.92" />
        <path d="M32 40c12-3 28-3 38 0" stroke="#fffdf7" strokeWidth="2.6" opacity="0.76" />
        <path d="M38 49c8-2 18-2 24 0" stroke="#fff8ef" strokeWidth="2.1" opacity="0.62" />
      </g>
    </svg>
  );
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

export function PackageLibraryPage({ records, students }: Props) {
  const [items, setItems] = useState(records);
  const [localStudents, setLocalStudents] = useState(students);
  const [bindingStudentByRecord, setBindingStudentByRecord] = useState<Record<string, string>>({});
  const [savingRecordId, setSavingRecordId] = useState("");
  const [filter, setFilter] = useState<"all" | "unassigned" | "linked">("all");
  const [error, setError] = useState("");
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    void readPreferredLibraryData({ students, records }).then((preferredData) => {
      if (cancelled) {
        return;
      }

      setItems(preferredData.records);
      setLocalStudents(preferredData.students);
    });

    return () => {
      cancelled = true;
    };
  }, [records, students]);

  const visibleRecords = useMemo(() => {
    if (filter === "unassigned") {
      return items.filter((record) => !record.studentId);
    }

    if (filter === "linked") {
      return items.filter((record) => Boolean(record.studentId));
    }

    return items;
  }, [filter, items]);
  const recordIndexMap = useMemo(() => {
    const recordsByThread = new Map<string, TutoringRecord[]>();

    items.forEach((record) => {
      const threadId = record.learningThreadId || record.id;
      const threadRecords = recordsByThread.get(threadId) ?? [];
      threadRecords.push(record);
      recordsByThread.set(threadId, threadRecords);
    });

    const indexMap = new Map<string, { position: number }>();

    recordsByThread.forEach((threadRecords) => {
      const ordered = [...threadRecords].sort((left, right) => left.date.localeCompare(right.date));
      ordered.forEach((record, index) => {
        indexMap.set(record.id, { position: index + 1 });
      });
    });

    return indexMap;
  }, [items]);
  const studentNameMap = useMemo(
    () => new Map(localStudents.map((student) => [student.id, student.name])),
    [localStudents],
  );

  async function handleBindStudent(record: TutoringRecord) {
    const studentId = bindingStudentByRecord[record.id]?.trim();

    if (!studentId) {
      setError("请先选择要绑定的学生。");
      return;
    }

    setSavingRecordId(record.id);
    setError("");

    try {
      const updatedRecord = await updateRecordViaApi(record.id, {
        studentId,
        date: record.date,
        topic: record.topic,
        teacherFeedback: record.teacherFeedback,
        masteryLevel: record.masteryLevel,
        nextStepSuggestion: record.nextStepSuggestion,
      });
      setItems((current) =>
        current.map((item) => (item.id === updatedRecord.id ? updatedRecord : item)),
      );
      setBindingStudentByRecord((current) => ({
        ...current,
        [record.id]: updatedRecord.studentId ?? "",
      }));
    } catch (bindError) {
      setError(bindError instanceof Error ? bindError.message : "绑定学生失败。");
    } finally {
      setSavingRecordId("");
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-[#4F463F] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="relative rounded-[30px] border border-white/80 bg-[rgba(255,255,255,0.6)] p-5 backdrop-blur-xl shadow-[0_18px_42px_rgba(198,191,179,0.12)]">
          <div className="pointer-events-none absolute -top-10 left-4 z-10">
            <FloatingCat />
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[1.45rem] font-semibold text-[#3F3832]">已保存资料包</h2>
              <p className="mt-2 text-sm leading-7 text-[#6D645C]">
                当前共 {items.length} 份资料，筛选结果 {visibleRecords.length} 份。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  filter === "all" ? "bg-[#EEF6FF] text-[#5C7593]" : "bg-white text-[#6B625A]"
                }`}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => setFilter("unassigned")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  filter === "unassigned"
                    ? "bg-[#FFF0F5] text-[#8B6674]"
                    : "bg-white text-[#6B625A]"
                }`}
              >
                未绑定学生
              </button>
              <button
                type="button"
                onClick={() => setFilter("linked")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  filter === "linked" ? "bg-[#F1FAF6] text-[#5F866F]" : "bg-white text-[#6B625A]"
                }`}
              >
                已绑定学生
              </button>
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-[#C36C68]">{error}</p> : null}

          <div className="mt-6 grid gap-4">
            {visibleRecords.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#E8DDB3] bg-white/75 p-8 text-sm leading-7 text-[#6D645C]">
                当前筛选条件下没有资料包。
              </div>
            ) : (
              visibleRecords.map((record) => {
                const linkedStudent = students.find((student) => student.id === record.studentId) ?? null;

                return (
                  <article
                    key={record.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedRecordIds((current) => ({
                        ...current,
                        [record.id]: !current[record.id],
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpandedRecordIds((current) => ({
                          ...current,
                          [record.id]: !current[record.id],
                        }));
                      }
                    }}
                    className="group relative cursor-pointer overflow-hidden rounded-[28px] border border-white/88 bg-[rgba(255,255,255,0.72)] p-5 text-left backdrop-blur-xl shadow-[0_16px_36px_rgba(198,191,179,0.12)] transition hover:-translate-y-0.5 hover:border-[#E3E9F1] hover:shadow-[0_22px_44px_rgba(198,191,179,0.16)] focus:outline-none focus:ring-4 focus:ring-[#EAF2FF]"
                  >
                    <div className="pointer-events-none absolute bottom-1 right-1 z-[1] opacity-95">
                      <CandyCorner seed={record.id} />
                    </div>
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(209,220,235,0.95)_50%,rgba(255,255,255,0)_100%)]" />
                    </div>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#FFF1E3] px-3 py-1.5 text-xs font-semibold text-[#98725A]">
                            {record.date}
                          </span>
                          <span className="rounded-full bg-[#F7F3FF] px-3 py-1.5 text-xs font-semibold text-[#736887]">
                            {getRecordStageLabel(record)}
                          </span>
                          <span className="rounded-full bg-[#EEF6FF] px-3 py-1.5 text-xs font-semibold text-[#6483A4]">
                            {linkedStudent ? `已绑定：${linkedStudent.name}` : "未绑定学生"}
                          </span>
                        </div>

                        <h3 className="mt-2 text-[1.25rem] font-semibold text-[#3F3832]">
                          {record.topic}
                        </h3>
                        <p className="mt-1 text-sm leading-7 text-[#6D645C]">
                          {record.generateRequest.subject} / {record.generateRequest.grade} /{" "}
                          {record.generateRequest.lessonStyle}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-3 xl:items-end">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E7EDF5] bg-white/88 text-[#98A6B5] transition group-hover:translate-x-0.5 group-hover:border-[#D6E4F3] group-hover:text-[#6F8192]">
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
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedRecordIds((current) => ({
                                ...current,
                                [record.id]: !current[record.id],
                              }));
                            }}
                            className="rounded-full border border-[#DCE6F1] bg-[rgba(255,255,255,0.88)] px-4 py-2.5 text-sm font-semibold text-[#607185] transition hover:bg-[#F8FBFF]"
                          >
                            {expandedRecordIds[record.id] ? "收起资料" : "查看资料"}
                          </button>
                          <Link
                            href={buildReuseHref(record)}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-full border border-[#E6D3E6] bg-[linear-gradient(135deg,rgba(255,241,246,0.94)_0%,rgba(240,245,255,0.92)_100%)] px-4 py-2.5 text-sm font-semibold text-[#725F71] shadow-[0_12px_24px_rgba(212,190,214,0.14)] transition hover:bg-[linear-gradient(135deg,rgba(255,245,249,0.98)_0%,rgba(245,248,255,0.96)_100%)]"
                          >
                            复制为新备课
                          </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-[#7B6A59]">
                          {linkedStudent ? (
                            <Link
                              href={`/students/${linkedStudent.id}?refresh=${encodeURIComponent(record.updatedAt)}`}
                              prefetch={false}
                              onClick={(event) => event.stopPropagation()}
                              className="text-[#6E7A62] transition hover:text-[#556348]"
                            >
                              查看学生
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9EA8B2]">
                          知识讲义摘要
                        </p>
                        <p className="mt-1 line-clamp-4 text-sm leading-7 text-[#5E6670]">
                          {record.lessonPackage.overview}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9EA8B2]">
                          绑定到学生
                        </p>
                        <select
                          value={bindingStudentByRecord[record.id] ?? record.studentId ?? ""}
                          onChange={(event) =>
                            setBindingStudentByRecord((current) => ({
                              ...current,
                              [record.id]: event.target.value,
                            }))
                          }
                          onClick={(event) => event.stopPropagation()}
                          className="w-full rounded-[18px] border border-[#E7EBEF] bg-white px-4 py-3 text-sm text-[#4F463F]"
                        >
                          <option value="">暂不绑定学生</option>
                    {localStudents.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name} · {student.grade} · {student.subject}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-3 sm:flex-nowrap">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleBindStudent(record);
                            }}
                            disabled={savingRecordId === record.id}
                            className="rounded-full border border-[#D8E4F3] bg-[#EEF6FF] px-5 py-3 text-sm font-semibold text-[#5F748C] disabled:opacity-60"
                          >
                            {savingRecordId === record.id ? "保存中..." : "保存绑定"}
                          </button>
                          <div onClick={(event) => event.stopPropagation()}>
                            <LessonPackageExportDialog
                              title={record.topic || "补课备课包"}
                              fileName={buildLessonPackageFileName({
                                studentName: record.studentId ? studentNameMap.get(record.studentId) : "",
                                topic: record.topic,
                                attemptIndex: recordIndexMap.get(record.id)?.position ?? 1,
                              })}
                              result={record.lessonPackage}
                              mode="compact"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {expandedRecordIds[record.id] ? (
                      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                        <section className="rounded-[24px] border border-white/88 bg-[rgba(255,255,255,0.76)] p-5 backdrop-blur-md">
                          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">
                            知识讲义
                          </h4>
                          <p className="mt-3 whitespace-pre-line text-sm leading-8 text-[#655A54]">
                            {record.lessonPackage.overview}
                          </p>
                        </section>

                        <section className="rounded-[24px] border border-white/88 bg-[rgba(255,255,255,0.76)] p-5 backdrop-blur-md">
                          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8E7665]">
                            难点提醒与结构
                          </h4>
                          <div className="mt-3 space-y-4 text-sm leading-7 text-[#655A54]">
                            <div>
                              <p className="font-semibold text-[#5C534B]">重点内容</p>
                              <ul className="mt-2 list-disc space-y-1 pl-5">
                                {record.lessonPackage.keyPoints.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold text-[#5C534B]">难点提醒</p>
                              <ul className="mt-2 list-disc space-y-1 pl-5">
                                {record.lessonPackage.difficulties.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold text-[#5C534B]">资料摘要</p>
                              <p className="mt-2">例题示范：{record.lessonPackage.examples.length} 题</p>
                              <p>课堂练习：{record.lessonPackage.classExercises.length} 题</p>
                              <p>课后练习：{record.lessonPackage.homework.length} 题</p>
                            </div>
                          </div>
                        </section>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
