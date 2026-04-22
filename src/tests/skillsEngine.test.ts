import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { SkillsEngine } from "../pipeline/skillsEngine.js";

const SAMPLE_SKILL = `# Test Skill

> Use this pattern for testing.

\`\`\`pattern
useState|useEffect
\`\`\`

\`\`\`tsx
const [count, setCount] = useState(0);
\`\`\`
`;

describe("SkillsEngine", () => {
  let tmpDir: string;
  let engine: SkillsEngine;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-engine-"));
    engine = new SkillsEngine(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("loads skills from markdown files", async () => {
    await fs.writeFile(path.join(tmpDir, "test-skill.md"), SAMPLE_SKILL, "utf-8");
    const skills = await engine.loadSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Test Skill");
    expect(skills[0].description).toBe("Use this pattern for testing.");
  });

  it("returns empty array when directory does not exist", async () => {
    const missing = new SkillsEngine("/does/not/exist");
    const skills = await missing.loadSkills();
    expect(skills).toEqual([]);
  });

  it("returns empty array when no markdown files are present", async () => {
    const skills = await engine.loadSkills();
    expect(skills).toEqual([]);
  });

  it("applies relevant skills as a comment block", async () => {
    await fs.writeFile(path.join(tmpDir, "react-skill.md"), SAMPLE_SKILL, "utf-8");
    await engine.loadSkills();

    const code = `const [count, setCount] = useState(0);`;
    const annotated = engine.applyToCode(code);
    expect(annotated).toContain("Applied repository skills:");
    expect(annotated).toContain("Test Skill");
  });

  it("does not modify code when no skills match", async () => {
    await fs.writeFile(path.join(tmpDir, "react-skill.md"), SAMPLE_SKILL, "utf-8");
    await engine.loadSkills();

    const code = `export function StaticCard() { return <div>hello</div>; }`;
    const result = engine.applyToCode(code);
    expect(result).toBe(code);
  });

  it("returns code unchanged when no skills are loaded", () => {
    const code = `const [x] = useState(0);`;
    expect(engine.applyToCode(code)).toBe(code);
  });
});
