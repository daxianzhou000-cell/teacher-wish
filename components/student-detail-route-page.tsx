"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StudentDetailPage } from "@/components/student-detail-page";
import { readCachedStudentDetail } from "@/lib/client/student-record-cache";
import type { StudentDetail } from "@/lib/types/student-progress";

const shellClassName =
  "rounded-[30px] border border-white/80 bg-[rgba(255,255,255,0.62)] p-5 backdrop-blur-xl shadow-[0_18px_42px_rgba(219,188,198,0.1),inset_0_1px_0_rgba(255,255,255,0.92)]";

export function StudentDetailRoutePage({ studentId }: { studentId: string }) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void readCachedStudentDetail(studentId)
      .then((cachedDetail) => {
        if (cancelled) {
          return;
        }

        setDetail(cachedDetail);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (detail) {
    return <StudentDetailPage {...detail} />;
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-[#4F463F] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <section className={shellClassName}>
          <h1 className="text-[1.35rem] font-semibold tracking-tight text-[#3F3832]">
            {loading ? "正在读取本地学生档案" : "本地还没有这位学生的档案"}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#6D645C]">
            {loading
              ? "正在从当前浏览器本地数据里恢复学生档案，请稍等一下。"
              : "这个页面现在会优先读取当前浏览器的本地数据。若你刚完成迁移、导入备份或第一次打开，请先回到学生列表或导入本地备份后再进入。"}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/students"
              className="rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-5 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_32px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.9)]"
            >
              返回学生列表
            </Link>
            <Link
              href="/settings"
              className="rounded-full border border-white/85 bg-[rgba(255,255,255,0.72)] px-5 py-3 text-sm font-semibold text-[#6B625A] backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.88)]"
            >
              去本地备份设置
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
