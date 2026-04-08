"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { getAppMeta, setAppMeta } from "@/lib/client/app-meta-store";

const STORAGE_KEY = "class-candy-entry-complete";
const FALLING_WRAPPERS = [
  { left: "6%", delay: "0ms", duration: "2580ms", scale: 0.72, rotate: "-18deg", drift: "-4vw" },
  { left: "14%", delay: "120ms", duration: "2360ms", scale: 0.58, rotate: "12deg", drift: "3vw" },
  { left: "22%", delay: "40ms", duration: "2720ms", scale: 0.82, rotate: "-8deg", drift: "-2vw" },
  { left: "31%", delay: "220ms", duration: "2280ms", scale: 0.66, rotate: "18deg", drift: "5vw" },
  { left: "40%", delay: "80ms", duration: "2860ms", scale: 0.9, rotate: "-12deg", drift: "-3vw" },
  { left: "49%", delay: "260ms", duration: "2460ms", scale: 0.62, rotate: "16deg", drift: "2vw" },
  { left: "58%", delay: "160ms", duration: "2920ms", scale: 0.78, rotate: "-20deg", drift: "-5vw" },
  { left: "68%", delay: "20ms", duration: "2520ms", scale: 0.7, rotate: "10deg", drift: "4vw" },
  { left: "77%", delay: "320ms", duration: "2780ms", scale: 0.88, rotate: "-14deg", drift: "-3vw" },
  { left: "86%", delay: "140ms", duration: "2420ms", scale: 0.64, rotate: "22deg", drift: "3vw" },
];

export function EntranceGate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const forcedOpen = useMemo(() => searchParams.get("welcome") === "1", [searchParams]);
  const isHomePage = pathname === "/";

  useEffect(() => {
    let cancelled = false;

    void getAppMeta(STORAGE_KEY).then((value) => {
      if (cancelled) {
        return;
      }

      const completed = value === "true";
      setOpen(forcedOpen || (isHomePage && !completed));
      setChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [forcedOpen, isHomePage]);

  useEffect(() => {
    if (!checked || !open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [checked, open]);

  function handleEnter() {
    if (isClosing) {
      return;
    }

    setIsClosing(true);

    window.setTimeout(() => {
      void setAppMeta(STORAGE_KEY, "true");
      setOpen(false);
      setIsClosing(false);
    }, 520);
  }

  if (!checked || !open) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden bg-[#fbfaf5] transition-opacity duration-500 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#fcfbf6_0%,#f8f4eb_100%)]" />
      <div className="class-candy-cloud class-candy-cloud-blue absolute left-[-22%] top-[-18%] h-[68vh] w-[72vw]" />
      <div className="class-candy-cloud class-candy-cloud-pink absolute right-[-24%] top-[-10%] h-[66vh] w-[68vw]" />
      <div className="class-candy-cloud class-candy-cloud-gold absolute left-[8%] bottom-[-28%] h-[70vh] w-[76vw]" />
      <div className="class-candy-paper-bloom absolute inset-0" />
      <div className="class-candy-paper-grain absolute inset-0" />
      <div className="class-candy-paper-fibers absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
        {FALLING_WRAPPERS.map((wrapper, index) => (
          <svg
            key={`${wrapper.left}-${wrapper.delay}-${index}`}
            viewBox="0 0 120 120"
            aria-hidden="true"
            className="class-candy-drop absolute top-[6%] h-[76px] w-[76px] sm:h-[92px] sm:w-[92px]"
            style={{
              left: wrapper.left,
              animationDelay: wrapper.delay,
              animationDuration: wrapper.duration,
              ["--drop-rotate" as string]: wrapper.rotate,
              ["--drop-scale" as string]: String(wrapper.scale),
              ["--drop-drift" as string]: wrapper.drift,
            }}
          >
            <defs>
              <linearGradient id={`dropWrapperMain-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff9fd" />
                <stop offset="52%" stopColor="#ffe7f1" />
                <stop offset="100%" stopColor="#fff1cf" />
              </linearGradient>
              <linearGradient id={`dropWrapperStripe-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffbfd9" />
                <stop offset="48%" stopColor="#ffc969" />
                <stop offset="100%" stopColor="#a9d5ff" />
              </linearGradient>
              <filter id={`dropCandyGlow-${index}`} x="-20%" y="-20%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.6" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 .22 0"
                />
              </filter>
            </defs>
            <g stroke="#9b7d67" strokeLinecap="round" strokeLinejoin="round">
              <path
                d="M25 63
                   C15 54 13 42 18 34
                   C24 26 36 30 43 42
                   C40 51 35 58 25 63Z"
                fill={`url(#dropWrapperMain-${index})`}
                strokeWidth="2.1"
              />
              <path
                d="M95 63
                   C105 54 107 42 102 34
                   C96 26 84 30 77 42
                   C80 51 85 58 95 63Z"
                fill={`url(#dropWrapperMain-${index})`}
                strokeWidth="2.1"
              />
              <path
                d="M37 43
                   C39 36 47 32 60 32
                   C73 32 81 37 83 45
                   C80 58 72 65 60 67
                   C47 65 39 57 37 43Z"
                fill={`url(#dropWrapperMain-${index})`}
                filter={`url(#dropCandyGlow-${index})`}
              />
              <path
                d="M40 44
                   C42 38 49 35 60 35
                   C70 35 77 39 80 46
                   C77 56 70 61 60 63
                   C49 61 43 55 40 44Z"
                fill={`url(#dropWrapperMain-${index})`}
                strokeWidth="2.3"
              />
              <path d="M44 40 C50 38 69 38 76 41" fill="none" stroke={`url(#dropWrapperStripe-${index})`} strokeWidth="3.2" opacity="0.95" />
              <path d="M43 46 C49 44 69 44 77 47" fill="none" stroke={`url(#dropWrapperStripe-${index})`} strokeWidth="3.2" opacity="0.8" />
              <path d="M46 52 C52 50 67 50 73 52" fill="none" stroke={`url(#dropWrapperStripe-${index})`} strokeWidth="2.8" opacity="0.72" />
              <path d="M28 38 C31 42 33 48 32 54" fill="none" stroke="#fffdf6" strokeWidth="1.8" opacity="0.8" />
              <path d="M92 38 C89 42 87 48 88 54" fill="none" stroke="#fffdf6" strokeWidth="1.8" opacity="0.8" />
            </g>
          </svg>
        ))}
      </div>
      <div className="absolute inset-0 opacity-[0.22] [background-image:repeating-linear-gradient(172deg,rgba(135,119,102,0.06)_0,rgba(135,119,102,0.06)_1px,transparent_1px,transparent_18px),repeating-linear-gradient(94deg,rgba(255,255,255,0.5)_0,rgba(255,255,255,0.5)_1px,transparent_1px,transparent_28px)]" />
      <div className="absolute inset-0 opacity-[0.1] [background-image:radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.9),transparent_18%),radial-gradient(circle_at_72%_64%,rgba(255,255,255,0.7),transparent_20%),radial-gradient(circle_at_46%_52%,rgba(120,102,83,0.16),transparent_22%)]" />

      <div className="relative flex min-h-screen items-center justify-center px-8">
        <div className="text-center">
          <div className="group relative inline-block overflow-visible">
            <button
              type="button"
              onClick={handleEnter}
              aria-label="进入首页"
              className="inline-block origin-center transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-2deg] group-hover:scale-[1.03]"
            >
              <svg
                viewBox="0 0 760 240"
                className="class-candy-title-reveal class-candy-title-delayed h-auto w-[400px] transition-all duration-300 group-hover:scale-[1.08] group-hover:[filter:drop-shadow(0_20px_30px_rgba(201,166,104,0.24))_brightness(1.1)] group-hover:animate-class-candy-wiggle sm:w-[640px]"
                role="img"
                aria-label="课糖"
              >
                <defs>
                  <linearGradient id="classCandyInk" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7399c3" />
                    <stop offset="45%" stopColor="#c289aa" />
                    <stop offset="100%" stopColor="#daa85b" />
                  </linearGradient>
                  <linearGradient id="classCandySheen" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="24%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="40%" stopColor="rgba(255,255,255,0.42)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,1)" />
                    <stop offset="60%" stopColor="rgba(255,255,255,0.52)" />
                    <stop offset="76%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>
                  <filter id="classCandySheenBlur" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="10" />
                  </filter>
                  <filter id="classCandyGlow" x="-20%" y="-20%" width="140%" height="140%">
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
                  <clipPath id="classCandyTextClip">
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

                <g filter="url(#classCandyGlow)">
                  <text
                    x="380"
                    y="190"
                    textAnchor="middle"
                    fontSize="206"
                    fontWeight="700"
                    transform="rotate(-1.2 380 190)"
                    letterSpacing="12"
                    fontFamily="'Hannotate SC','TsangerJinKai05','Baoli SC','STKaiti','YouYuan','PingFang SC',cursive"
                    fill="url(#classCandyInk)"
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
                  fill="url(#classCandyInk)"
                  paintOrder="stroke fill"
                  stroke="rgba(255,255,255,0.24)"
                  strokeWidth="1.8"
                >
                  课糖
                </text>
                <g clipPath="url(#classCandyTextClip)" className="class-candy-sheen-sweep">
                  <rect
                    x="-320"
                    y="-20"
                    width="320"
                    height="280"
                    rx="40"
                    fill="url(#classCandySheen)"
                    filter="url(#classCandySheenBlur)"
                  />
                </g>
              </svg>
            </button>
            <svg
              viewBox="0 0 96 96"
              aria-hidden="true"
              className="pointer-events-none absolute left-6 top-1 h-[64px] w-[64px] -translate-x-2 -translate-y-2 rotate-[-14deg] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 sm:left-10 sm:top-0 sm:h-[78px] sm:w-[78px]"
            >
              <defs>
                <linearGradient id="candyBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffd6ef" />
                  <stop offset="45%" stopColor="#ffb3d8" />
                  <stop offset="100%" stopColor="#ffcf73" />
                </linearGradient>
                <linearGradient id="candyWrap" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff7fb" />
                  <stop offset="50%" stopColor="#ffe9f3" />
                  <stop offset="100%" stopColor="#fff2cc" />
                </linearGradient>
                <linearGradient id="candyGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#fff4cf" stopOpacity="0.25" />
                </linearGradient>
                <filter id="candySoftGlow" x="-20%" y="-20%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.6" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0
                            0 1 0 0 0
                            0 0 1 0 0
                            0 0 0 .18 0"
                  />
                </filter>
              </defs>
              <ellipse cx="49" cy="51" rx="33" ry="10" fill="rgba(189,165,141,0.1)" />
              <g stroke="#9b7d67" strokeLinecap="round" strokeLinejoin="round">
                <path
                  d="M20 49
                     C12 40 10 31 14 25
                     C20 18 30 21 36 29
                     C34 37 29 44 20 49Z"
                  fill="url(#candyWrap)"
                  strokeWidth="2"
                />
                <path
                  d="M76 49
                     C84 40 86 31 82 25
                     C76 18 66 21 60 29
                     C62 37 67 44 76 49Z"
                  fill="url(#candyWrap)"
                  strokeWidth="2"
                />
                <path
                  d="M27 35
                     C28 27 35 22 47 22
                     C61 22 69 28 69 39
                     L69 55
                     C69 66 60 72 47 72
                     C35 72 27 66 27 56Z"
                  fill="url(#candyBody)"
                  filter="url(#candySoftGlow)"
                />
                <path
                  d="M29 36
                     C30 29 36 25 47 25
                     C59 25 66 30 66 39
                     L66 54
                     C66 63 58 69 47 69
                     C37 69 30 64 30 56Z"
                  fill="url(#candyBody)"
                  strokeWidth="2.2"
                />
                <path d="M17 25 C22 28 24 34 23 41" fill="none" strokeWidth="1.6" opacity="0.55" />
                <path d="M13 31 C18 34 20 39 19 46" fill="none" strokeWidth="1.4" opacity="0.42" />
                <path d="M79 25 C74 28 72 34 73 41" fill="none" strokeWidth="1.6" opacity="0.55" />
                <path d="M83 31 C78 34 76 39 77 46" fill="none" strokeWidth="1.4" opacity="0.42" />
                <path d="M35 34 C42 31 54 31 61 35" fill="none" strokeWidth="2" opacity="0.28" />
                <path d="M34 48 C41 45 54 45 61 49" fill="none" strokeWidth="2" opacity="0.22" />
                <ellipse cx="41.5" cy="35.5" rx="6.5" ry="4.5" fill="url(#candyGloss)" opacity="0.85" />
                <path d="M47 28 C52 27.5 58 29.5 60 33" fill="none" stroke="#fffdf6" strokeWidth="2.2" opacity="0.78" />
                <path d="M39 59 C44 61.5 51 61.5 56 58.5" fill="none" strokeWidth="2.1" opacity="0.45" />
              </g>
            </svg>
            <svg
              viewBox="0 0 140 110"
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1 right-10 h-[92px] w-[122px] translate-x-4 translate-y-2 rotate-[4deg] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 sm:bottom-0 sm:right-14 sm:h-[108px] sm:w-[144px]"
            >
              <defs>
                <linearGradient id="catFur" x1="0%" y1="10%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff9f0" />
                  <stop offset="55%" stopColor="#f7ead8" />
                  <stop offset="100%" stopColor="#ebd6be" />
                </linearGradient>
                <linearGradient id="catBelly" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fffdf8" />
                  <stop offset="100%" stopColor="#f7efe1" />
                </linearGradient>
                <filter id="catSoftGlow" x="-20%" y="-20%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0
                            0 1 0 0 0
                            0 0 1 0 0
                            0 0 0 .18 0"
                  />
                </filter>
              </defs>
              <ellipse cx="74" cy="97" rx="42" ry="9" fill="rgba(186,162,138,0.12)" />
              <g strokeLinecap="round" strokeLinejoin="round">
                <path
                  d="M32 73
                     C30 58 42 48 61 46
                     C88 44 110 51 118 64
                     C123 72 122 82 116 88
                     C107 96 91 99 71 99
                     C53 99 40 96 34 88
                     C31 84 31 79 32 73Z"
                  fill="url(#catFur)"
                  filter="url(#catSoftGlow)"
                />
                <path
                  d="M37 72
                     C36 58 47 48 63 47
                     C86 45 106 51 113 63
                     C117 70 116 78 110 84
                     C103 91 89 94 72 94
                     C54 94 42 91 38 84
                     C36 80 36 76 37 72Z"
                  fill="url(#catFur)"
                  stroke="#a58872"
                  strokeWidth="2.2"
                />
                <ellipse cx="68" cy="68" rx="26" ry="23" fill="url(#catBelly)" opacity="0.82" />
                <path
                  d="M47 56
                     C48 42 58 34 71 34
                     C85 34 96 42 97 56
                     C98 63 95 69 90 74
                     C84 79 76 81 68 81
                     C59 81 51 79 46 73
                     C42 68 41 62 47 56Z"
                  fill="url(#catFur)"
                  stroke="#a58872"
                  strokeWidth="2.2"
                />
                <path d="M56 45 L50 31 L64 40" fill="url(#catFur)" stroke="#a58872" strokeWidth="2.2" />
                <path d="M80 42 L90 30 L92 46" fill="url(#catFur)" stroke="#a58872" strokeWidth="2.2" />
                <ellipse cx="59.5" cy="58.5" rx="2.3" ry="2.7" fill="#70584a" />
                <ellipse cx="77.5" cy="58.5" rx="2.3" ry="2.7" fill="#70584a" />
                <path d="M67 65 C68.8 67 70.6 67 72.2 65" fill="none" stroke="#8b6d5a" strokeWidth="2" />
                <path d="M69.4 61.5 L65.8 64.2 L73 64.2 Z" fill="#d9989e" opacity="0.72" />
                <path d="M64 66.5 C58 69 53 69.5 47.5 68.5" fill="none" stroke="#a58872" strokeWidth="1.7" opacity="0.7" />
                <path d="M74 66.5 C79.5 69 84.5 69.5 90 68.5" fill="none" stroke="#a58872" strokeWidth="1.7" opacity="0.7" />
                <path d="M45 61 C37 59.5 30 60 22 64" fill="none" stroke="#a58872" strokeWidth="1.5" opacity="0.58" />
                <path d="M45 65 C35.5 65 28 66.5 20 71" fill="none" stroke="#a58872" strokeWidth="1.5" opacity="0.58" />
                <path d="M88 61 C96 59.5 103 60 111 64" fill="none" stroke="#a58872" strokeWidth="1.5" opacity="0.58" />
                <path d="M88 65 C97.5 65 105 66.5 113 71" fill="none" stroke="#a58872" strokeWidth="1.5" opacity="0.58" />
                <ellipse cx="56" cy="90" rx="10" ry="5.5" fill="url(#catBelly)" stroke="#a58872" strokeWidth="2" />
                <ellipse cx="81" cy="90" rx="10" ry="5.5" fill="url(#catBelly)" stroke="#a58872" strokeWidth="2" />
                <path d="M111 73 C122 72 129 78 128 87 C127 96 116 97 108 90" fill="none" stroke="#a58872" strokeWidth="2.6" />
                <path d="M34 84 C28 84 23 86 20 90" fill="none" stroke="#a58872" strokeWidth="2.1" />
                <path d="M42 51 C40 54 39.5 57 40 60" fill="none" stroke="#fff8ef" strokeWidth="2.4" opacity="0.72" />
                <path d="M83 50 C88 53 91 58 90 63" fill="none" stroke="#fff8ef" strokeWidth="2.4" opacity="0.68" />
              </g>
            </svg>
          </div>
          <p className="class-candy-subtle-rise class-candy-title-delayed mt-6 text-[11px] uppercase tracking-[0.42em] text-[#8d7f73] sm:text-xs">
            Class Candy
          </p>
        </div>
      </div>
    </div>
  );
}
