"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyImportedLocalData,
  downloadBackupJson,
  downloadRecordsCsv,
  downloadStudentsCsv,
  importLocalDataFile,
  type LocalImportSummary,
  readLastBackupAt,
} from "@/lib/client/data-transfer";
import type { Student, TutoringRecord } from "@/lib/types/student-progress";

const buttonClassName =
  "rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClassName =
  "rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-4 py-2.5 text-sm font-semibold text-[#645746] transition hover:bg-[rgba(255,239,186,0.92)] disabled:cursor-not-allowed disabled:opacity-60";

export function LocalDataTransferPanel({
  onDataApplied,
}: {
  onDataApplied: (payload: { students: Student[]; records: TutoringRecord[] }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState("");
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    summary: LocalImportSummary;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readLastBackupAt().then((value) => {
      if (cancelled || !value) {
        return;
      }

      setLastBackupAt(value);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function formatBackupTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")} ${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
  }

  async function handleExportJson() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await downloadBackupJson();
      setLastBackupAt(new Date().toISOString());
      setMessage("已导出 JSON 完整备份。");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出失败。");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportStudentsCsv() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await downloadStudentsCsv();
      setLastBackupAt(new Date().toISOString());
      setMessage("已导出学生 CSV。");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出失败。");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportRecordsCsv() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await downloadRecordsCsv();
      setLastBackupAt(new Date().toISOString());
      setMessage("已导出记录 CSV。");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出失败。");
    } finally {
      setLoading(false);
    }
  }

  async function handleImportFile(file: File) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const summary = await importLocalDataFile(file);
      setPendingImport({
        fileName: file.name,
        summary,
      });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败。");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleConfirmImport() {
    if (!pendingImport) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const next = await applyImportedLocalData(pendingImport.summary);
      onDataApplied(next);
      setMessage(
        `已导入 ${pendingImport.summary.label}，当前共有 ${next.students.length} 位学生、${next.records.length} 条记录。`,
      );
      setPendingImport(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[26px] border border-white/86 bg-[rgba(255,255,255,0.7)] p-5 backdrop-blur-md shadow-[0_14px_30px_rgba(170,196,228,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#4F463F]">本地数据备份</h3>
          <p className="mt-1 text-sm text-[#6F655C]">
            支持 JSON 完整备份，以及学生、记录 CSV 导入导出。
          </p>
          {lastBackupAt ? (
            <p className="mt-1 text-xs text-[#8A8178]">
              最近备份：{formatBackupTime(lastBackupAt)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExportJson} disabled={loading} className={primaryButtonClassName}>
            导出 JSON
          </button>
          <button type="button" onClick={handleExportStudentsCsv} disabled={loading} className={buttonClassName}>
            导出学生 CSV
          </button>
          <button type="button" onClick={handleExportRecordsCsv} disabled={loading} className={buttonClassName}>
            导出记录 CSV
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className={buttonClassName}
          >
            导入文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImportFile(file);
              }
            }}
          />
        </div>
      </div>

      {pendingImport ? (
        <div className="mt-4 rounded-[22px] border border-[#F0E1BE] bg-[rgba(255,249,236,0.88)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A8927F]">
                Import Preview
              </p>
              <h4 className="mt-1 text-sm font-semibold text-[#4F463F]">
                {pendingImport.fileName}
              </h4>
              <p className="mt-1 text-sm text-[#6F655C]">
                {pendingImport.summary.label}
                {pendingImport.summary.mode === "replace-all"
                  ? "，将覆盖当前本地数据"
                  : "，将合并进当前本地数据"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={loading}
                className={primaryButtonClassName}
              >
                确认导入
              </button>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                disabled={loading}
                className={buttonClassName}
              >
                取消
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#6B625A]">
              学生 {pendingImport.summary.students.length} 位
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#6B625A]">
              记录 {pendingImport.summary.records.length} 条
            </span>
            {pendingImport.summary.appMeta?.length ? (
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#6B625A]">
                恢复状态 {pendingImport.summary.appMeta.length} 项
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-[#6483A4]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[#B56562]">{error}</p> : null}
    </section>
  );
}
