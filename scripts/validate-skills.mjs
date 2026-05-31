#!/usr/bin/env node
// Repo-specific structural checks, beyond format/lint:
//   1. every *.json parses
//   2. every SKILL.md has YAML frontmatter with non-empty `name` + `description`
//   3. a skill's frontmatter `name` matches its directory name
// Zero deps — string parsing is enough for our flat frontmatter.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename, dirname, relative } from "node:path";

const root = process.cwd();
const errors = [];

/** Recursively collect files, skipping node_modules/.git. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root);

// 1. JSON validity
for (const f of files.filter((f) => f.endsWith(".json"))) {
  try {
    JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    errors.push(`${relative(root, f)}: invalid JSON — ${e.message}`);
  }
}

// 2 + 3. SKILL.md frontmatter
for (const f of files.filter((f) => basename(f) === "SKILL.md")) {
  const rel = relative(root, f);
  const text = readFileSync(f, "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) {
    errors.push(`${rel}: missing YAML frontmatter`);
    continue;
  }
  const fm = m[1];
  const field = (key) =>
    fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1].trim();

  const name = field("name");
  const description = field("description");

  if (!name) errors.push(`${rel}: frontmatter missing \`name\``);
  if (!description) errors.push(`${rel}: frontmatter missing \`description\``);

  const dir = basename(dirname(f));
  if (name && name !== dir) {
    errors.push(`${rel}: frontmatter name "${name}" != directory "${dir}"`);
  }
}

if (errors.length) {
  console.error(`✗ validate-skills: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("✓ validate-skills: all JSON valid, all SKILL.md frontmatter OK");
