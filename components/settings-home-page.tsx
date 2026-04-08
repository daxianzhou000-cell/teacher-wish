"use client";

import Link from "next/link";

import { LocalDataTransferPanel } from "@/components/local-data-transfer-panel";

const shellClassName =
  "rounded-[30px] border border-white/80 bg-[rgba(255,255,255,0.62)] p-5 backdrop-blur-xl shadow-[0_18px_42px_rgba(170,196,228,0.1),inset_0_1px_0_rgba(255,255,255,0.92)]";

const cardClassName =
  "rounded-[26px] border border-white/86 bg-[rgba(255,255,255,0.72)] p-5 backdrop-blur-md shadow-[0_14px_30px_rgba(170,196,228,0.08)] transition hover:bg-[rgba(255,255,255,0.82)]";

export function SettingsHomePage() {
  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-[#4F463F] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className={shellClassName}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
            Settings
          </p>
          <h2 className="mt-2 text-[1.55rem] font-semibold text-[#3F3832]">设置中心</h2>
          <p className="mt-2 text-sm leading-7 text-[#6D645C]">
            模型和本地数据备份都收在这里，后面用户要维护本地单机数据也会主要从这里进入。
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-1">
          <Link href="/settings/model" className={cardClassName}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A8927F]">
              Model
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[#3F3832]">模型设置</h3>
            <p className="mt-2 text-sm leading-7 text-[#6D645C]">
              配置平台内置或用户自配的模型、Base URL 和主备模型来源。
            </p>
          </Link>
        </section>

        <LocalDataTransferPanel
          onDataApplied={() => {
            // Settings page only needs the import/export workflow itself.
          }}
        />
      </div>
    </main>
  );
}
