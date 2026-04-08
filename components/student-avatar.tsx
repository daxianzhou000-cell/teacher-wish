"use client";

import { useMemo } from "react";

const avatarPalettes = [
  {
    shell: ["#EEF5FF", "#DDEBFF"],
    accent: "#8FB7F0",
    accentSoft: "#D9E8FF",
    face: "#F7DEC9",
    hair: "#5E514A",
    shirt: "#AFC8F4",
    shirtAlt: "#84A8DE",
  },
  {
    shell: ["#FFF0F4", "#FFE1EA"],
    accent: "#F2A8BD",
    accentSoft: "#FFE0EA",
    face: "#F5D7C4",
    hair: "#6C4E4B",
    shirt: "#F5C2D1",
    shirtAlt: "#E79AAF",
  },
  {
    shell: ["#F2FBF7", "#E0F5EA"],
    accent: "#8DC7A5",
    accentSoft: "#D8F0E2",
    face: "#F6DCC7",
    hair: "#534A45",
    shirt: "#A9D8BE",
    shirtAlt: "#7CB697",
  },
  {
    shell: ["#FFF7EA", "#FFEBC7"],
    accent: "#F1BE67",
    accentSoft: "#FFF0CA",
    face: "#F7DFC8",
    hair: "#685246",
    shirt: "#F2D08B",
    shirtAlt: "#D6AF63",
  },
  {
    shell: ["#F4F1FF", "#E7DEFF"],
    accent: "#B49EF4",
    accentSoft: "#EAE2FF",
    face: "#F6DCCC",
    hair: "#52495E",
    shirt: "#C6B4F3",
    shirtAlt: "#A38BDE",
  },
  {
    shell: ["#F0FBFF", "#D9F3FA"],
    accent: "#78C5D8",
    accentSoft: "#D7F2F8",
    face: "#F4DBC8",
    hair: "#47595B",
    shirt: "#9EDBE8",
    shirtAlt: "#6CB9CE",
  },
  {
    shell: ["#FFF4ED", "#FFE3D3"],
    accent: "#F2A178",
    accentSoft: "#FFE7D8",
    face: "#F7D8C5",
    hair: "#6E4C42",
    shirt: "#F5B89A",
    shirtAlt: "#DE8E66",
  },
  {
    shell: ["#F7FAED", "#E9F2CF"],
    accent: "#B4CB63",
    accentSoft: "#EDF4D5",
    face: "#F3DBC9",
    hair: "#575341",
    shirt: "#D3E08D",
    shirtAlt: "#A8BC5B",
  },
];

function hashText(value: string): number {
  return Array.from(value).reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);
}

function buildHairPath(style: number, hair: string): string {
  const paths = [
    `<path d="M47 72C47 51 61 38 80 38C99 38 113 51 113 72V74C113 78 110 81 106 81H54C50 81 47 78 47 74V72Z" fill="${hair}"/>`,
    `<path d="M45 74C45 48 62 36 81 36C100 36 115 49 115 73C115 79 111 82 105 82H55C49 82 45 79 45 74Z" fill="${hair}"/><path d="M55 60C61 52 69 49 80 49C92 49 99 52 106 60" stroke="rgba(255,255,255,0.18)" stroke-width="2" stroke-linecap="round"/>`,
    `<path d="M48 72C48 51 62 39 80 39C98 39 112 51 112 72V76H48V72Z" fill="${hair}"/><path d="M54 74C59 66 68 62 80 62C92 62 102 66 106 74" stroke="rgba(255,255,255,0.2)" stroke-width="2.4" stroke-linecap="round"/>`,
    `<path d="M46 74C46 49 63 37 81 37C99 37 114 49 114 74V77C114 81 110 84 106 84H54C50 84 46 81 46 77V74Z" fill="${hair}"/><circle cx="58" cy="56" r="8" fill="${hair}"/><circle cx="103" cy="55" r="8" fill="${hair}"/>`,
    `<path d="M50 73C50 52 63 41 80 41C97 41 110 52 110 73V80H50V73Z" fill="${hair}"/><path d="M50 72C56 63 66 58 80 58C94 58 103 63 110 72" stroke="rgba(255,255,255,0.18)" stroke-width="2.4" stroke-linecap="round"/>`,
  ];

  return paths[style % paths.length]!;
}

function buildAccessory(style: number, accent: string, accentSoft: string): string {
  const accessories = [
    `<circle cx="118" cy="42" r="12" fill="${accent}" fill-opacity="0.22"/><circle cx="44" cy="118" r="18" fill="white" fill-opacity="0.25"/>`,
    `<rect x="108" y="32" width="18" height="18" rx="6" fill="${accentSoft}"/><circle cx="45" cy="116" r="16" fill="${accent}" fill-opacity="0.16"/>`,
    `<path d="M118 36C123 36 127 40 127 45C127 52 120 55 118 60C116 55 109 52 109 45C109 40 113 36 118 36Z" fill="${accent}" fill-opacity="0.22"/><circle cx="50" cy="120" r="14" fill="white" fill-opacity="0.22"/>`,
    `<circle cx="122" cy="44" r="10" fill="${accentSoft}"/><path d="M39 121C39 112 46 105 55 105C58 112 58 119 55 126C46 126 39 130 39 121Z" fill="${accent}" fill-opacity="0.2"/>`,
  ];

  return accessories[style % accessories.length]!;
}

function buildShirt(style: number, shirt: string, shirtAlt: string): string {
  const shirts = [
    `<path d="M52 136C56 116 67 106 80 106C93 106 104 116 108 136V141H52V136Z" fill="${shirt}"/>`,
    `<path d="M52 136C56 116 67 106 80 106C93 106 104 116 108 136V141H52V136Z" fill="${shirt}"/><path d="M70 112H90" stroke="${shirtAlt}" stroke-width="3" stroke-linecap="round"/><path d="M66 120H94" stroke="${shirtAlt}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="M52 136C56 116 67 106 80 106C93 106 104 116 108 136V141H52V136Z" fill="${shirt}"/><path d="M80 106V141" stroke="${shirtAlt}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="M52 136C56 116 67 106 80 106C93 106 104 116 108 136V141H52V136Z" fill="${shirt}"/><circle cx="69" cy="122" r="4" fill="${shirtAlt}"/><circle cx="92" cy="122" r="4" fill="${shirtAlt}"/>`,
  ];

  return shirts[style % shirts.length]!;
}

function buildAvatarDataUri(name: string): string {
  const hash = hashText(name || "student");
  const palette = avatarPalettes[hash % avatarPalettes.length];
  const eyeOffset = 56 + (hash % 8);
  const mouthWidth = 24 + (hash % 10);
  const blushOpacity = 0.08 + (hash % 5) * 0.02;
  const faceRx = 31 + (hash % 5);
  const faceRy = 34 + ((hash >> 1) % 4);
  const accessoryStyle = (hash >> 2) % 4;
  const hairStyle = (hash >> 3) % 5;
  const shirtStyle = (hash >> 4) % 4;
  const eyebrowTilt = (hash % 5) - 2;
  const id = `avatar-${hash}`;
  const svg = `
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${id}-bg" x1="18" y1="16" x2="140" y2="144" gradientUnits="userSpaceOnUse">
          <stop stop-color="${palette.shell[0]}"/>
          <stop offset="1" stop-color="${palette.shell[1]}"/>
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="140" height="140" rx="46" fill="url(#${id}-bg)"/>
      <rect x="12" y="12" width="136" height="136" rx="44" stroke="white" stroke-opacity="0.85" stroke-width="2"/>
      ${buildAccessory(accessoryStyle, palette.accent, palette.accentSoft)}
      ${buildHairPath(hairStyle, palette.hair)}
      <ellipse cx="80" cy="85" rx="${faceRx}" ry="${faceRy}" fill="${palette.face}"/>
      ${buildShirt(shirtStyle, palette.shirt, palette.shirtAlt)}
      <circle cx="67" cy="84" r="3.5" fill="#4A403B"/>
      <circle cx="93" cy="84" r="3.5" fill="#4A403B"/>
      <ellipse cx="60" cy="93" rx="7" ry="4" fill="#F29AA9" fill-opacity="${blushOpacity}"/>
      <ellipse cx="100" cy="93" rx="7" ry="4" fill="#F29AA9" fill-opacity="${blushOpacity}"/>
      <path d="M${80 - mouthWidth / 2} 100C${80 - mouthWidth / 5} 109 ${80 + mouthWidth / 5} 109 ${80 + mouthWidth / 2} 100" stroke="#8C605A" stroke-width="4" stroke-linecap="round"/>
      <path d="M62 ${eyeOffset}C66 ${eyeOffset - 3 - eyebrowTilt} 70 ${eyeOffset - 3 + eyebrowTilt} 74 ${eyeOffset}" stroke="#7A6960" stroke-width="3" stroke-linecap="round"/>
      <path d="M86 ${eyeOffset}C90 ${eyeOffset - 3 + eyebrowTilt} 94 ${eyeOffset - 3 - eyebrowTilt} 98 ${eyeOffset}" stroke="#7A6960" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function StudentAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const src = useMemo(() => buildAvatarDataUri(name), [name]);
  const frameClassName =
    size === "sm"
      ? "h-16 w-16 rounded-[22px]"
      : "h-20 w-20 rounded-[28px]";

  return (
    <div className={`relative shrink-0 overflow-hidden border border-white/94 bg-[rgba(255,255,255,0.7)] backdrop-blur-md shadow-[0_18px_38px_rgba(208,166,171,0.16)] ring-1 ring-[#F1DEE3] ${frameClassName}`}>
      <img src={src} alt={`${name} 头像`} className="h-full w-full object-cover" />
    </div>
  );
}
