"use client";

import type { FormEvent, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAppMeta } from "@/lib/client/app-meta-store";
import {
  createStudentViaApi,
  deleteStudentViaApi,
  readPreferredStudents,
  updateStudentViaApi,
} from "@/lib/client/student-record-repository";
import { StudentAvatar } from "@/components/student-avatar";
import type { Grade, Subject } from "@/lib/generator";
import type { Student } from "@/lib/types/student-progress";

const gradeOptions: Grade[] = ["七年级", "八年级", "九年级"];
const subjectOptions: Subject[] = ["语文", "数学", "英语"];

const shellClassName =
  "rounded-[30px] border border-white/80 bg-[rgba(255,255,255,0.62)] p-5 backdrop-blur-xl shadow-[0_18px_42px_rgba(170,196,228,0.1),inset_0_1px_0_rgba(255,255,255,0.92)]";

const fieldClassName =
  "rounded-[20px] border border-white/82 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-[#4F463F] backdrop-blur-md outline-none transition active:translate-y-[1px] active:bg-white/82 active:shadow-[inset_0_3px_10px_rgba(98,131,164,0.08)] focus:border-[#BED7F6] focus:bg-white/84 focus:shadow-[inset_0_3px_12px_rgba(98,131,164,0.08)] focus:ring-4 focus:ring-[#E8F3FF]";

const primaryButtonClassName =
  "rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_32px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.9)] disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "rounded-full border border-white/90 bg-[rgba(255,241,246,0.74)] px-5 py-3 text-sm font-semibold text-[#7C6470] backdrop-blur-md transition hover:bg-[rgba(255,246,249,0.9)]";

const neutralButtonClassName =
  "rounded-full border border-white/85 bg-[rgba(255,255,255,0.72)] px-5 py-3 text-sm font-semibold text-[#6B625A] backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.88)]";

const dangerButtonClassName =
  "rounded-full border border-white/90 bg-[rgba(255,243,241,0.76)] px-5 py-3 text-sm font-semibold text-[#B56562] backdrop-blur-md transition hover:bg-[rgba(255,248,246,0.9)]";

const ACTIVE_STAGE_TEST_JOB_STORAGE_KEY = "student-detail-active-stage-test-job";

type Props = {
  initialStudents: Student[];
};

type ApiStudentResponse = {
  data?: Student;
  error?: string;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
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
  tone?: "yellow" | "blue";
}) {
  const toneClassName =
    tone === "blue" ? "bg-[#F4F9FF] text-[#6483A4]" : "bg-[#FFF9DE] text-[#8E744B]";

  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${toneClassName}`}>
      {children}
    </span>
  );
}

function FloatingCat() {
  return (
    <svg viewBox="0 0 120 78" className="h-auto w-[88px]" aria-hidden="true">
      <defs>
        <linearGradient id="studentsCatBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF8EC" />
          <stop offset="100%" stopColor="#F3DEC3" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#8E745F" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path
          fill="url(#studentsCatBody)"
          d="M20 48c0-12 10-22 24-22h17c18 0 29 8 29 21 0 10-8 17-20 17H39c-12 0-19-6-19-16Z"
        />
        <path fill="url(#studentsCatBody)" d="M36 27 45 14l8 12" />
        <path fill="url(#studentsCatBody)" d="m62 26 9-12 8 13" />
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

export function StudentsPage({ initialStudents }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState(initialStudents);
  const [searchName, setSearchName] = useState("");
  const [filterGrade, setFilterGrade] = useState("全部");
  const [filterSubject, setFilterSubject] = useState("全部");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<Grade>("七年级");
  const [subject, setSubject] = useState<Subject>("数学");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingStudentId, setEditingStudentId] = useState("");
  const [editName, setEditName] = useState("");
  const [editGrade, setEditGrade] = useState<Grade>("七年级");
  const [editSubject, setEditSubject] = useState<Subject>("数学");
  const [editNote, setEditNote] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

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

  useEffect(() => {
    const shouldResumeStageTest = searchParams.get("resumeStageTest") === "1";

    if (!shouldResumeStageTest) {
      return;
    }

    let cancelled = false;

    void getAppMeta(ACTIVE_STAGE_TEST_JOB_STORAGE_KEY).then((savedJob) => {
      if (!savedJob || cancelled) {
        return;
      }

      try {
        const parsed = JSON.parse(savedJob) as { studentId?: string };

        if (parsed.studentId) {
          router.replace(`/students/${parsed.studentId}?resumeStageTest=1`);
        }
      } catch {
        // ignore invalid session payload
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  const filteredStudents = useMemo(() => {
    const keyword = normalizeText(searchName);

    return students.filter((student) => {
      const matchName = !keyword || normalizeText(student.name).includes(keyword);
      const matchGrade =
        filterGrade === "全部" ? true : normalizeText(student.grade) === normalizeText(filterGrade);
      const matchSubject =
        filterSubject === "全部"
          ? true
          : normalizeText(student.subject) === normalizeText(filterSubject);

      return matchName && matchGrade && matchSubject;
    });
  }, [filterGrade, filterSubject, searchName, students]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const student = await createStudentViaApi({ name, grade, subject, note });
      setStudents((current) => [student, ...current]);
      setName("");
      setNote("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "新增学生失败。");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(student: Student) {
    setEditingStudentId(student.id);
    setEditName(student.name);
    setEditGrade(student.grade);
    setEditSubject(student.subject);
    setEditNote(student.note);
    setEditError("");
  }

  function cancelEdit() {
    setEditingStudentId("");
    setEditError("");
  }

  async function handleUpdateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudentId) {
      return;
    }

    setEditLoading(true);
    setEditError("");

    try {
      const updatedStudent = await updateStudentViaApi(editingStudentId, {
        name: editName,
        grade: editGrade,
        subject: editSubject,
        note: editNote,
      });
      setStudents((current) =>
        current.map((student) => (student.id === updatedStudent.id ? updatedStudent : student)),
      );
      cancelEdit();
    } catch (submitError) {
      setEditError(submitError instanceof Error ? submitError.message : "更新学生失败。");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteStudent(student: Student) {
    const confirmed = window.confirm(
      `确认删除学生“${student.name}”吗？该学生的全部补课记录也会一并删除。`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteStudentViaApi(student.id);
      setStudents((current) => current.filter((item) => item.id !== student.id));

      if (editingStudentId === student.id) {
        cancelEdit();
      }
    } catch (submitError) {
      setEditError(submitError instanceof Error ? submitError.message : "删除学生失败。");
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-[#4F463F] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <ClayShell className="relative h-fit overflow-visible">
            <div className="pointer-events-none absolute -top-10 left-3 z-10">
              <FloatingCat />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                  Create
                </p>
                <h2 className="mt-2 text-[1.35rem] font-semibold text-[#3F3832]">新增学生</h2>
              </div>
              <PastelBadge tone="yellow">学生档案</PastelBadge>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>姓名</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={fieldClassName}
                  placeholder="例如：李明"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>年级</span>
                <select
                  value={grade}
                  onChange={(event) => setGrade(event.target.value as Grade)}
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
                  value={subject}
                  onChange={(event) => setSubject(event.target.value as Subject)}
                  className={fieldClassName}
                >
                  {subjectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>备注</span>
                <textarea
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className={`${fieldClassName} min-h-[120px] resize-none`}
                  placeholder="例如：计算步骤容易跳步，英语听写较弱"
                />
              </label>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className={`w-full ${primaryButtonClassName}`}
              >
                {loading ? "正在保存学生..." : "新增学生"}
              </button>

              {error ? <p className="text-sm text-[#C36C68]">{error}</p> : null}
            </form>
          </ClayShell>

          <ClayShell>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                  Students
                </p>
                <h2 className="mt-2 text-[1.55rem] font-semibold text-[#3F3832]">学生列表</h2>
                <p className="mt-2 text-sm leading-7 text-[#6D645C]">
                  当前共 {students.length} 位学生，筛选结果 {filteredStudents.length} 位。
                </p>
              </div>
              <p className="text-sm leading-7 text-[#7A838C]">
                支持搜索、筛选、编辑与删除，适合持续维护学生档案。
              </p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>按姓名搜索</span>
                <input
                  value={searchName}
                  onChange={(event) => setSearchName(event.target.value)}
                  placeholder="输入学生姓名"
                  className={fieldClassName}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>按年级筛选</span>
                <select
                  value={filterGrade}
                  onChange={(event) => setFilterGrade(event.target.value)}
                  className={fieldClassName}
                >
                  <option value="全部">全部年级</option>
                  {gradeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>按学科筛选</span>
                <select
                  value={filterSubject}
                  onChange={(event) => setFilterSubject(event.target.value)}
                  className={fieldClassName}
                >
                  <option value="全部">全部学科</option>
                  {subjectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {editError ? <p className="mt-5 text-sm text-[#C36C68]">{editError}</p> : null}

            {students.length === 0 ? (
              <div className="mt-6 rounded-[30px] border border-dashed border-[#EBCF9E] bg-white/75 p-8 text-sm leading-7 text-[#7B6A59]">
                还没有学生记录，先在左侧创建第一位学生。
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="mt-6 rounded-[30px] border border-dashed border-[#EBCF9E] bg-white/75 p-8 text-sm leading-7 text-[#7B6A59]">
                当前筛选条件下没有匹配的学生，调整姓名、年级或学科后再试。
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {filteredStudents.map((student) =>
                  editingStudentId === student.id ? (
                    <form
                      key={student.id}
                      onSubmit={handleUpdateStudent}
                      className="rounded-[28px] border border-white/88 bg-[rgba(231,243,255,0.64)] p-5 backdrop-blur-xl shadow-[0_16px_36px_rgba(175,202,233,0.12),inset_0_1px_0_rgba(255,255,255,0.94)]"
                    >
                      <div className="space-y-4">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                          <span>姓名</span>
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className={fieldClassName}
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                          <span>年级</span>
                          <select
                            value={editGrade}
                            onChange={(event) => setEditGrade(event.target.value as Grade)}
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
                            value={editSubject}
                            onChange={(event) => setEditSubject(event.target.value as Subject)}
                            className={fieldClassName}
                          >
                            {subjectOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                          <span>备注</span>
                          <textarea
                            rows={3}
                            value={editNote}
                            onChange={(event) => setEditNote(event.target.value)}
                            className={`${fieldClassName} min-h-[104px] resize-none`}
                          />
                        </label>

                        <div className="flex flex-wrap gap-3 pt-1">
                          <button
                            type="submit"
                            disabled={editLoading || !editName.trim()}
                            className={primaryButtonClassName}
                          >
                            {editLoading ? "保存中..." : "保存修改"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className={neutralButtonClassName}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <article
                      key={student.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/students/${student.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/students/${student.id}`);
                        }
                      }}
                      className="group relative cursor-pointer overflow-hidden rounded-[32px] border border-[#E8EDF4] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(251,252,254,0.98)_100%)] p-6 text-left shadow-[0_22px_46px_rgba(49,72,100,0.05)] transition hover:-translate-y-1 hover:border-[#D6E4F3] hover:shadow-[0_28px_60px_rgba(49,72,100,0.08)] focus:outline-none focus:ring-4 focus:ring-[#E8F3FF]"
                    >
                      <div className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#E9F2FD_0%,#CFE1F7_35%,#F9FBFE_100%)]" />
                      <div className="absolute right-6 top-6 h-20 w-20 rounded-full bg-[radial-gradient(circle,rgba(214,229,248,0.32)_0%,rgba(214,229,248,0)_72%)]" />
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(201,219,241,0.95)_50%,rgba(255,255,255,0)_100%)]" />
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <StudentAvatar name={student.name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#A7B3C0]">
                              Student Archive
                            </p>
                            <h3 className="mt-2 truncate text-[1.5rem] font-semibold tracking-[-0.03em] text-[#25303B]">
                              {student.name}
                            </h3>
                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6B7783]">
                              <span>{student.grade}</span>
                              <span className="text-[#C5CFD9]">•</span>
                              <span>{student.subject}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="rounded-full border border-[#EDF2F8] bg-[#FBFDFF] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#95A4B5]">
                            维护中
                          </span>
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDF2F8] bg-[#FBFDFF] text-[#9AA9B8] transition group-hover:translate-x-0.5 group-hover:border-[#D6E4F3] group-hover:text-[#6F8192]">
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
                      </div>

                      <div className="mt-7 border-t border-[#EEF2F6] pt-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A6B1BB]">
                          Learning Note
                        </p>
                        <p className="mt-3 min-h-[68px] text-[15px] leading-7 text-[#5B6671]">
                          {student.note || "暂无备注"}
                        </p>
                      </div>

                      <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[#EEF2F6] pt-5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEdit(student);
                          }}
                          className="rounded-full border border-[#F0E6EA] bg-[#FCF7F9] px-5 py-3 text-sm font-semibold text-[#7D6972] transition hover:bg-[#FBF2F5]"
                        >
                          编辑学生
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteStudent(student);
                          }}
                          className="ml-auto text-sm font-semibold text-[#B56562] transition hover:text-[#9F4E4B]"
                        >
                          删除
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </ClayShell>
        </div>
      </div>
    </main>
  );
}
