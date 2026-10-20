// Draws card.svg: a year of work in Frontera3K colors (public + private contributions).
// Runs daily from .github/workflows/stats.yml. Needs GITHUB_TOKEN in env.
import { readFileSync, writeFileSync } from "node:fs";

const LOGIN = process.env.STATS_LOGIN ?? "leorivastech";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is missing");

const query = `query($login: String!) {
  user(login: $login) {
    name
    contributionsCollection {
      restrictedContributionsCount
      totalPullRequestContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
const { name, contributionsCollection: c } = json.data.user;
const cal = c.contributionCalendar;
const weeks = cal.weeks.map((w) => w.contributionDays);
const days = weeks.flat();

// ---- numbers ----
const activeDays = days.filter((d) => d.contributionCount > 0).length;
let longest = 0;
let run = 0;
for (const d of days) {
  run = d.contributionCount > 0 ? run + 1 : 0;
  longest = Math.max(longest, run);
}
let current = 0;
let i = days.length - 1;
if (days[i]?.contributionCount === 0) i--; // today may still be empty
for (; i >= 0 && days[i].contributionCount > 0; i--) current++;

const fmt = (n) => n.toLocaleString("en-US");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---- brand (Frontera3K) ----
const ESPRESSO = "#0a3438";
const INK = "#0b181c";
const CREAM = "#e9f7f5";
const TEAL = "#44a5a7";
const MINT = "#4abba1";
const DIM = "#7fa6a6";
const LEVELS = ["#0f3f43", "#0f5a5d", "#008388", "#44a5a7", "#7fd6c4"];

const font = (file) => readFileSync(new URL(`../fonts/${file}`, import.meta.url)).toString("base64");

// ---- heatmap ----
const CELL = 11;
const GAP = 3;
const max = Math.max(...days.map((d) => d.contributionCount));
const level = (n) => (n === 0 ? 0 : Math.min(4, 1 + Math.floor((Math.sqrt(n) / Math.sqrt(max)) * 3.999)));
const GRID_X = 30;
const GRID_Y = 112;
const cells = weeks
  .map((week, wi) =>
    week
      .map((d) => {
        const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay();
        return `<rect x="${GRID_X + wi * (CELL + GAP)}" y="${GRID_Y + dow * (CELL + GAP)}" width="${CELL}" height="${CELL}" rx="2.5" fill="${LEVELS[level(d.contributionCount)]}"><title>${d.date}: ${d.contributionCount}</title></rect>`;
      })
      .join(""),
  )
  .join("\n    ");

// month labels above the grid
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const starts = [];
let lastMonth = -1;
weeks.forEach((week, wi) => {
  const m = new Date(`${week.at(-1).date}T00:00:00Z`).getUTCMonth();
  if (m !== lastMonth) starts.push({ wi, m });
  lastMonth = m;
});
const monthLabels = starts
  .filter((s, k) => !starts[k + 1] || starts[k + 1].wi - s.wi >= 3) // no crowded labels
  .filter((s) => s.wi <= weeks.length - 2)
  .map((s) => `<text x="${GRID_X + s.wi * (CELL + GAP)}" y="${GRID_Y - 8}" class="tiny">${MONTHS[s.m]}</text>`)
  .join("");

const gridRight = GRID_X + weeks.length * (CELL + GAP) - GAP;
const W = Math.max(800, gridRight + 30);
const H = 300;

// ---- stats row ----
const stats = [
  [fmt(activeDays), "active days, last year"],
  [fmt(current), current >= longest ? "day streak · best yet" : `day streak · best: ${fmt(longest)}`],
  [fmt(c.totalPullRequestContributions), "pull requests"],
  [fmt(c.restrictedContributionsCount), "in private repos"],
];
const colW = (gridRight - GRID_X) / stats.length;
const statSvg = stats
  .map(
    ([v, l], k) => `<g transform="translate(${GRID_X + k * colW}, 248)">
      <text class="num">${v}</text>
      <text y="20" class="label">${esc(l)}</text>
    </g>`,
  )
  .join("\n  ");

const who = name ?? LOGIN;
const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t d">
  <title id="t">${esc(who)} on GitHub: ${fmt(cal.totalContributions)} contributions in the last year</title>
  <desc id="d">${stats.map(([v, l]) => `${v} ${l}`).join(", ")}. Public and private contributions, from GitHub.</desc>
  <defs>
    <style>
      @font-face { font-family: "F3K Display"; font-weight: 700; src: url(data:font/woff2;base64,${font("fraunces-700.woff2")}) format("woff2"); }
      @font-face { font-family: "F3K Sans"; font-weight: 100 900; src: url(data:font/woff2;base64,${font("figtree.woff2")}) format("woff2"); }
      .name { font: 700 30px "F3K Display", Georgia, serif; fill: ${CREAM}; }
      .role { font: 500 13px "F3K Sans", "Segoe UI", sans-serif; fill: ${TEAL}; letter-spacing: .3px; }
      .total { font: 700 40px "F3K Display", Georgia, serif; fill: url(#brand); }
      .totalLabel { font: 500 12px "F3K Sans", "Segoe UI", sans-serif; fill: ${DIM}; }
      .tiny { font: 500 10px "F3K Sans", "Segoe UI", sans-serif; fill: ${DIM}; }
      .num { font: 700 22px "F3K Display", Georgia, serif; fill: ${CREAM}; }
      .label { font: 500 12px "F3K Sans", "Segoe UI", sans-serif; fill: ${DIM}; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ESPRESSO}"/>
      <stop offset="1" stop-color="${INK}"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${MINT}"/>
      <stop offset=".5" stop-color="${TEAL}"/>
      <stop offset="1" stop-color="#7fd6c4"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="16" fill="url(#bg)"/>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="15.5" fill="none" stroke="${TEAL}" stroke-opacity=".25"/>

  <text x="${GRID_X}" y="52" class="name">${esc(who)}</text>
  <text x="${GRID_X}" y="76" class="role">Cofounder @ Frontera3K · Built in Mexico</text>

  <text x="${gridRight}" y="54" text-anchor="end" class="total">${fmt(cal.totalContributions)}</text>
  <text x="${gridRight}" y="76" text-anchor="end" class="totalLabel">contributions in the last year</text>

  ${monthLabels}
  <g>
    ${cells}
  </g>

  ${statSvg}

  <text x="${GRID_X}" y="${H - 10}" class="tiny" opacity=".7">public + private · updated ${new Date().toISOString().slice(0, 10)}</text>
</svg>
`;

writeFileSync(new URL("../card.svg", import.meta.url), svg);
console.log(`total ${cal.totalContributions}, ${stats.map(([v, l]) => `${v} ${l}`).join(", ")}`);
