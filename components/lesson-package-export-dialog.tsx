"use client";

import { useMemo, useState } from "react";

import {
  downloadLessonPackageAsWord,
  exportModuleLabels,
  exportPresets,
  type ExportMode,
  type ExportModuleKey,
} from "@/lib/export/lesson-package-word";
import type { LessonPackage } from "@/lib/types/lesson-package";

const allModules = Object.keys(exportModuleLabels) as ExportModuleKey[];

function sameModules(left: ExportModuleKey[], right: ExportModuleKey[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

function resolveExportMode(selectedModules: ExportModuleKey[]): ExportMode {
  if (sameModules(selectedModules, exportPresets.teacher)) {
    return "teacher";
  }

  if (sameModules(selectedModules, exportPresets.student)) {
    return "student";
  }

  return "custom";
}

export function LessonPackageExportDialog({
  title,
  fileName,
  result,
  mode = "full",
  showPresets = true,
  onExportComplete,
}: {
  title: string;
  fileName?: string;
  result: LessonPackage;
  mode?: "full" | "compact" | "inline";
  showPresets?: boolean;
  onExportComplete?: () => void;
}) {
  const [selectedModules, setSelectedModules] = useState<ExportModuleKey[]>(exportPresets.teacher);
  const [expanded, setExpanded] = useState(false);

  const exportMode = useMemo(() => resolveExportMode(selectedModules), [selectedModules]);

  function applyPreset(preset: "teacher" | "student") {
    setSelectedModules(exportPresets[preset]);
  }

  function toggleModule(moduleKey: ExportModuleKey) {
    setSelectedModules((current) => {
      if (current.includes(moduleKey)) {
        return current.filter((item) => item !== moduleKey);
      }

      return allModules.filter((item) => item === moduleKey || current.includes(item));
    });
  }

  function handleExport() {
    if (selectedModules.length === 0) {
      return;
    }

    downloadLessonPackageAsWord({
      title: title || "补课备课包",
      fileName,
      result,
      preset: exportMode,
      selectedModules,
    });

    if (mode === "compact") {
      setExpanded(false);
    }

    onExportComplete?.();
  }

  if (mode === "compact") {
    return (
      <section className="relative w-auto">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-3">
            {expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
              >
                收起
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_30px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.92)]"
            >
              导出
            </button>
          </div>
        </div>

        {expanded ? (
          <div className="absolute right-0 top-full z-20 mt-2 w-[min(520px,calc(100vw-3rem))] rounded-[24px] border border-white/88 bg-[rgba(255,255,255,0.96)] p-4 backdrop-blur-md shadow-[0_18px_40px_rgba(170,154,126,0.18)]">
            {showPresets ? (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("teacher")}
                  className={
                    exportMode === "teacher"
                      ? "rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-4 py-2.5 text-sm font-semibold text-[#645746]"
                      : "rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
                  }
                >
                  老师版
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("student")}
                  className={
                    exportMode === "student"
                      ? "rounded-full border border-white/90 bg-[rgba(255,241,246,0.82)] px-4 py-2.5 text-sm font-semibold text-[#765B68]"
                      : "rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
                  }
                >
                  学生版
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {allModules.map((moduleKey) => {
                const checked = selectedModules.includes(moduleKey);

                return (
                  <label
                    key={moduleKey}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      checked
                        ? "border-[#F1DDA7] bg-[rgba(255,249,230,0.92)] text-[#695A45]"
                        : "border-white/88 bg-white/78 text-[#6B625A]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModule(moduleKey)}
                    />
                    <span>{exportModuleLabels[moduleKey]}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleExport}
                disabled={selectedModules.length === 0}
                className="rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_30px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                确认导出
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  if (mode === "inline") {
    return (
      <section className="rounded-[26px] border border-white/86 bg-[rgba(255,255,255,0.74)] p-5 backdrop-blur-md shadow-[0_14px_30px_rgba(214,195,166,0.1)]">
        {showPresets ? (
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset("teacher")}
              className={
                exportMode === "teacher"
                  ? "rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-4 py-2.5 text-sm font-semibold text-[#645746]"
                  : "rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
              }
            >
              老师版
            </button>
            <button
              type="button"
              onClick={() => applyPreset("student")}
              className={
                exportMode === "student"
                  ? "rounded-full border border-white/90 bg-[rgba(255,241,246,0.82)] px-4 py-2.5 text-sm font-semibold text-[#765B68]"
                  : "rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
              }
            >
              学生版
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2.5">
          {allModules.map((moduleKey) => {
            const checked = selectedModules.includes(moduleKey);

            return (
              <label
                key={moduleKey}
                className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  checked
                    ? "border-[#F1DDA7] bg-[rgba(255,249,230,0.92)] text-[#695A45]"
                    : "border-white/88 bg-white/78 text-[#6B625A]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleModule(moduleKey)}
                />
                <span>{exportModuleLabels[moduleKey]}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedModules.length === 0}
            className="rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_30px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            确认导出
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-white/85 bg-[rgba(255,255,255,0.72)] p-4 backdrop-blur-md shadow-[0_12px_28px_rgba(214,195,166,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset("teacher")}
            className={
              exportMode === "teacher"
                ? "rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-4 py-2.5 text-sm font-semibold text-[#645746]"
                : "rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
            }
          >
            老师版
          </button>
          <button
            type="button"
            onClick={() => applyPreset("student")}
            className={
              exportMode === "student"
                ? "rounded-full border border-white/90 bg-[rgba(255,241,246,0.82)] px-4 py-2.5 text-sm font-semibold text-[#765B68]"
                : "rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
            }
          >
            学生版
          </button>
          <button
            type="button"
            onClick={() => setSelectedModules(allModules)}
            className="rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
          >
            全选
          </button>
          <button
            type="button"
            onClick={() => setSelectedModules([])}
            className="rounded-full border border-white/88 bg-white/76 px-4 py-2.5 text-sm font-semibold text-[#6B625A] transition hover:bg-white"
          >
            清空
          </button>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={selectedModules.length === 0}
          className="rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_30px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          导出
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {allModules.map((moduleKey) => {
          const checked = selectedModules.includes(moduleKey);

          return (
            <label
              key={moduleKey}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                checked
                  ? "border-[#F1DDA7] bg-[rgba(255,249,230,0.92)] text-[#695A45]"
                  : "border-white/88 bg-white/78 text-[#6B625A]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleModule(moduleKey)}
              />
              <span>{exportModuleLabels[moduleKey]}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
