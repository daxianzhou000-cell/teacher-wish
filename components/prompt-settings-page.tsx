"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  clearCachedPromptSettings,
  readCachedPromptSettings,
  writeCachedPromptSettings,
} from "@/lib/client/prompt-settings-cache";
import { shouldUseLocalPrimaryStorage } from "@/lib/client/storage-mode";
import type { PromptSettings } from "@/lib/types/prompt-settings";

const shellClassName =
  "rounded-[28px] border border-white/80 bg-[rgba(255,255,255,0.68)] p-5 backdrop-blur-xl shadow-[0_18px_44px_rgba(219,188,198,0.08),inset_0_1px_0_rgba(255,255,255,0.92)]";

const fieldClassName =
  "rounded-[18px] border border-white/82 bg-[rgba(255,255,255,0.76)] px-4 py-3 text-sm text-[#4F463F] outline-none transition focus:border-[#F3C4D0] focus:ring-4 focus:ring-[#FDEBF1]";

type ApiPayload = {
  data?: PromptSettings;
  error?: string;
};

function PromptField({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className={shellClassName}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
        Prompt Block
      </p>
      <h2 className="mt-2 text-[1.15rem] font-semibold text-[#3F3832]">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-[#6D645C]">{description}</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className={`${fieldClassName} mt-4 min-h-[140px] w-full resize-y leading-7`}
      />
    </section>
  );
}

export function PromptSettingsPage({ initialSettings }: { initialSettings: PromptSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void readCachedPromptSettings().then((cachedSettings) => {
      if (!cachedSettings || cancelled) {
        return;
      }

      setSettings((current) =>
        cachedSettings.updatedAt.localeCompare(current.updatedAt) > 0 ? cachedSettings : current,
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void writeCachedPromptSettings(settings);
  }, [settings]);

  async function save(payload: Partial<PromptSettings> & { resetToDefault?: boolean }) {
    const useLocalPrimary = await shouldUseLocalPrimaryStorage();

    if (useLocalPrimary) {
      if (payload.resetToDefault) {
        await clearCachedPromptSettings();
        setSettings(initialSettings);
        return initialSettings;
      }

      const next: PromptSettings = {
        systemRole: payload.systemRole ?? settings.systemRole,
        lectureRequirements: payload.lectureRequirements ?? settings.lectureRequirements,
        exerciseRequirements: payload.exerciseRequirements ?? settings.exerciseRequirements,
        homeworkRequirements: payload.homeworkRequirements ?? settings.homeworkRequirements,
        parentFeedbackRequirements:
          payload.parentFeedbackRequirements ?? settings.parentFeedbackRequirements,
        outputRequirements: payload.outputRequirements ?? settings.outputRequirements,
        extraInstructions: payload.extraInstructions ?? settings.extraInstructions,
        updatedAt: new Date().toISOString(),
      };

      setSettings(next);
      await writeCachedPromptSettings(next);
      return next;
    }

    const response = await fetch("/api/settings/prompt", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as ApiPayload;

    if (!response.ok || !data.data) {
      throw new Error(data.error || "保存提示词设置失败。");
    }

    setSettings(data.data);
    return data.data;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await save(settings);
      setMessage("提示词设置已保存，后续生成会直接使用这套内容规则。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存提示词设置失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await save({ resetToDefault: true });
      setMessage("已恢复默认提示词规则。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "恢复默认失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-[#4F463F] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className={`${shellClassName} overflow-hidden p-0`}>
          <div className="bg-[linear-gradient(135deg,rgba(255,249,232,0.94)_0%,rgba(255,255,255,0.9)_52%,rgba(238,246,255,0.82)_100%)] px-6 py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#A8927F]">
                  Class Candy
                </p>
                <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-[#3F3832]">
                  提示词设置
                </h1>
                <p className="mt-4 text-sm leading-7 text-[#6D645C] sm:text-base">
                  这里控制“生成内容的质量标准”。你可以单独调整讲义要求、练习要求、作业要求和家长反馈风格，而不用改 provider 代码。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/settings/model"
                  className="rounded-full border border-white/90 bg-[rgba(255,245,248,0.84)] px-5 py-3 text-sm font-semibold text-[#8A6473] transition hover:bg-[rgba(255,249,251,0.94)]"
                >
                  模型设置
                </Link>
                <Link
                  href="/"
                  className="rounded-full border border-white/90 bg-[rgba(255,248,226,0.86)] px-5 py-3 text-sm font-semibold text-[#866F4A] transition hover:bg-[rgba(255,251,236,0.94)]"
                >
                  返回首页
                </Link>
              </div>
            </div>
          </div>
        </section>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <PromptField
            title="系统角色"
            description="定义模型的整体身份、输出目标和内容基调。"
            value={settings.systemRole}
            onChange={(value) => setSettings((current) => ({ ...current, systemRole: value }))}
          />
          <PromptField
            title="讲义要求"
            description="控制知识点总结、讲解逻辑和讲义可读性。"
            value={settings.lectureRequirements}
            onChange={(value) =>
              setSettings((current) => ({ ...current, lectureRequirements: value }))
            }
          />
          <PromptField
            title="课堂练习要求"
            description="控制题目数量、难度层次和题干具体程度。"
            value={settings.exerciseRequirements}
            onChange={(value) =>
              setSettings((current) => ({ ...current, exerciseRequirements: value }))
            }
          />
          <PromptField
            title="课后作业要求"
            description="控制作业题的具体性和答案配套程度。"
            value={settings.homeworkRequirements}
            onChange={(value) =>
              setSettings((current) => ({ ...current, homeworkRequirements: value }))
            }
          />
          <PromptField
            title="家长反馈要求"
            description="控制家长反馈的结构、语气和具体程度。"
            value={settings.parentFeedbackRequirements}
            onChange={(value) =>
              setSettings((current) => ({
                ...current,
                parentFeedbackRequirements: value,
              }))
            }
          />
          <PromptField
            title="输出要求"
            description="控制必须覆盖的模块和整体输出完整度。"
            value={settings.outputRequirements}
            onChange={(value) =>
              setSettings((current) => ({ ...current, outputRequirements: value }))
            }
          />
          <PromptField
            title="补充说明"
            description="放置学科偏好、风格补充或你自己的特殊规则。"
            value={settings.extraInstructions}
            onChange={(value) =>
              setSettings((current) => ({ ...current, extraInstructions: value }))
            }
          />

          {error ? <p className="text-sm text-[#C36C68]">{error}</p> : null}
          {message ? <p className="text-sm text-[#64806C]">{message}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-6 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_32px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.9)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存提示词设置"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-full border border-white/90 bg-[rgba(255,255,255,0.76)] px-6 py-3 text-sm font-semibold text-[#6B625A] transition hover:bg-[rgba(255,255,255,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              恢复默认
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
