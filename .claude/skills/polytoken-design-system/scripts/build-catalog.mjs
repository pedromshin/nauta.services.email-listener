// Regenerates references/component-catalog.md from the live registry indexes
// plus the local @polytoken/ui inventory. Run whenever registries drift:
//   node .claude/skills/polytoken-design-system/scripts/build-catalog.mjs
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = join(scriptDir, "..");
const repoRoot = join(skillDir, "..", "..", "..");
const outFile = join(skillDir, "references", "component-catalog.md");

const REGISTRIES = [
  {
    ns: "@shadcn",
    index: "https://ui.shadcn.com/r/registry.json",
    fallback: "https://ui.shadcn.com/r/index.json",
    note: "canonical staples — upstream defaults to Base UI since 2026-07; we stay on Radix, always `diff` first",
    style: "list",
  },
  {
    ns: "@kibo-ui",
    index: "https://www.kibo-ui.com/r/registry.json",
    note: "complex app components — heavier deps per item (dnd-kit, tiptap, ...)",
    style: "list",
  },
  {
    ns: "@magicui",
    index: "https://magicui.design/r/registry.json",
    note: "animated effects — most need the `motion` package (not yet in packages/ui); payloads are Tailwind-v4-leaning",
    style: "list",
  },
  {
    ns: "@coss",
    index: "https://coss.com/ui/r/registry.json",
    note: "ex-Origin UI variant library — Base UI-based; swap primitives to Radix when vendoring",
    style: "compact",
  },
];

const clip = (s, n = 110) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const fetchIndex = async (url) => {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
};

const loadItems = async (reg) => {
  const urls = [reg.index, reg.fallback].filter(Boolean);
  for (const url of urls) {
    try {
      const data = await fetchIndex(url);
      const items = Array.isArray(data) ? data : (data.items ?? []);
      if (items.length > 0) return items;
    } catch {
      // try fallback
    }
  }
  return null;
};

const localInventory = () => {
  const srcDir = join(repoRoot, "packages", "ui", "src");
  const files = readdirSync(srcDir, { withFileTypes: true });
  const components = files
    .filter((f) => f.isFile() && f.name.endsWith(".tsx"))
    .map((f) => f.name.replace(/\.tsx$/, ""))
    .sort();
  const dirs = files
    .filter((f) => f.isDirectory() && !f.name.startsWith("__"))
    .map((f) => f.name)
    .sort();
  return { components, dirs };
};

const compactColumns = (names, perLine = 10) => {
  const lines = [];
  for (let i = 0; i < names.length; i += perLine) {
    lines.push(names.slice(i, i + perLine).join(" · "));
  }
  return lines.join("\n");
};

const main = async () => {
  const local = localInventory();
  const sections = [];
  const counts = [];

  sections.push(`## Local first: @polytoken/ui (vendored, Tailwind v3, Radix)

Always prefer these over registry items — zero adaptation cost.
Import: \`import { X } from "@polytoken/ui/<name>"\`; \`cn\` from \`@polytoken/ui\`.

${compactColumns(local.components)}

Compound suites: ${local.dirs.map((d) => `\`${d}/\``).join(", ")} (see \`packages/ui/src/<dir>/index.ts\`).`);

  for (const reg of REGISTRIES) {
    const items = await loadItems(reg);
    if (!items) {
      sections.push(`## ${reg.ns} — INDEX UNAVAILABLE at generation time\n\nFall back to \`npx shadcn@latest search ${reg.ns} -q <term>\`.`);
      continue;
    }
    const usable = items.filter((i) => i.name && i.name !== "index" && i.name !== "registry");
    counts.push(`${reg.ns}: ${usable.length}`);
    if (reg.style === "compact") {
      sections.push(`## ${reg.ns} (${usable.length} items)\n\n${reg.note}\n\n${compactColumns(usable.map((i) => i.name))}`);
    } else {
      const lines = usable.map((i) => {
        const desc = clip(i.description);
        return desc ? `- \`${i.name}\` — ${desc}` : `- \`${i.name}\``;
      });
      sections.push(`## ${reg.ns} (${usable.length} items)\n\n${reg.note}\n\n${lines.join("\n")}`);
    }
  }

  const doc = `# Component Catalog — full inventory (pre-enumerated)

> Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/build-catalog.mjs\`. Do not hand-edit; rerun the script to refresh.
> Purpose: when composing a page, read THIS file instead of running \`shadcn search\`.
> Every registry item is fetched with \`npx shadcn@latest add <ns>/<name> --dry-run --view\` (from \`packages/ui/\`)
> then vendored per the workflow in ../SKILL.md — plain \`add\` is broken for this package.

Counts: local @polytoken/ui: ${local.components.length} + ${local.dirs.length} suites | ${counts.join(" | ")}

${sections.join("\n\n")}
`;

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, doc, "utf8");
  console.log(`Wrote ${outFile}`);
  console.log(`Counts — local: ${local.components.length}, ${counts.join(", ")}`);
};

await main();
