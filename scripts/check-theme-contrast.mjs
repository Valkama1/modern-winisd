#!/usr/bin/env node
// One-off dev tool: verifies WCAG contrast ratios for each theme's color
// pairs. Not wired into CI or the app build — run manually after editing
// src/theme.ts, and keep the THEMES constant below in sync with it.

const THEMES = {
  slate: {
    bg: "#020617", sidebar: "#0f172a", text: "#f8fafc", textMuted: "#94a3b8",
    accent: "#10b981", graphGrid: "#64748b", warning: "#f59e0b", danger: "#f87171",
  },
  classic: {
    bg: "#d1d5db", sidebar: "#9ca3af", text: "#111827", textMuted: "#1f2937",
    accent: "#1e40af", graphGrid: "#6b7280", warning: "#b45309", danger: "#b91c1c",
  },
  cyberpunk: {
    bg: "#0f051d", sidebar: "#1b0a2f", text: "#fdf4ff", textMuted: "#c4b5fd",
    accent: "#f43f5e", graphGrid: "#7c3aed", warning: "#fbbf24", danger: "#f87171",
  },
  solarized: {
    bg: "#fdf6e3", sidebar: "#eee8d5", text: "#073642", textMuted: "#2d3c45",
    accent: "#8b5900", graphGrid: "#657b86", warning: "#cb4b16", danger: "#dc322f",
  },
};

function luminance(hex) {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.substring(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// [label, foreground key, background key, minimum ratio]
const CHECKS = [
  ["body text on bg", "text", "bg", 4.5],
  ["body text on sidebar", "text", "sidebar", 4.5],
  ["muted text on bg", "textMuted", "bg", 4.5],
  ["muted text on sidebar", "textMuted", "sidebar", 4.5],
  ["accent on bg", "accent", "bg", 3.0],
  ["accent on sidebar", "accent", "sidebar", 3.0],
  ["warning on bg", "warning", "bg", 3.0],
  ["danger on bg", "danger", "bg", 3.0],
  ["grid lines on bg", "graphGrid", "bg", 3.0],
];

let anyFailed = false;

for (const [themeName, colors] of Object.entries(THEMES)) {
  console.log(`\n${themeName}`);
  for (const [label, fgKey, bgKey, minRatio] of CHECKS) {
    const ratio = contrastRatio(colors[fgKey], colors[bgKey]);
    const pass = ratio >= minRatio;
    if (!pass) anyFailed = true;
    console.log(
      `  ${pass ? "PASS" : "FAIL"}  ${label.padEnd(24)} ${ratio.toFixed(2)}:1  (need >= ${minRatio}:1)`
    );
  }
}

console.log();
if (anyFailed) {
  console.error("One or more contrast checks failed. Adjust src/theme.ts and this script's THEMES constant, then re-run.");
  process.exit(1);
} else {
  console.log("All contrast checks passed.");
  process.exit(0);
}
