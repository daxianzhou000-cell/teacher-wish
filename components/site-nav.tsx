"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getAppMeta } from "@/lib/client/app-meta-store";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/students", label: "学生列表" },
  { href: "/library", label: "资料仓库" },
  { href: "/settings", label: "设置" },
];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === "/";

  async function resolveNavHref(href: string) {
    if (href !== "/students") {
      return href;
    }

    try {
      const savedJob = await getAppMeta("student-detail-active-stage-test-job");

      if (!savedJob) {
        return href;
      }

      const parsed = JSON.parse(savedJob) as { studentId?: string };

      if (parsed.studentId) {
        return "/students?resumeStageTest=1";
      }
    } catch {
      return href;
    }

    return href;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[rgba(255,255,255,0.78)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {isHomePage ? (
          <div className="w-6 sm:w-10" aria-hidden="true" />
        ) : (
          <div className="min-w-0">
            <Link href="/" className="block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#A8927F]">
                Class Candy
              </p>
              <h1 className="mt-1 bg-[linear-gradient(135deg,#7399c3_0%,#c289aa_45%,#daa85b_100%)] bg-clip-text text-xl font-semibold tracking-tight text-transparent">
                课糖
              </h1>
            </Link>
          </div>
        )}

        <nav className="flex flex-wrap items-center justify-end gap-1.5">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <button
                key={item.href}
                type="button"
                onClick={async () => router.push(await resolveNavHref(item.href))}
                className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                  active
                    ? "border border-[#F2DFC1] bg-[rgba(255,247,220,0.92)] text-[#6A5947] shadow-[0_10px_24px_rgba(229,207,153,0.14)]"
                    : "border border-transparent bg-[rgba(255,255,255,0.44)] text-[#7A6D62] hover:border-white/80 hover:bg-[rgba(255,255,255,0.78)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
