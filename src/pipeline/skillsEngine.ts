import fs from "node:fs/promises";
import path from "node:path";
import type { Skill } from "../types/index.js";
import { logger } from "../observability/logger.js";

const SKILLS_DIR = path.resolve("skills");

/**
 * Loads repository "skills" from the /skills directory and applies them to
 * generated component code by inserting relevant usage hints as comments.
 */
export class SkillsEngine {
  private readonly dir: string;
  private skills: Skill[] = [];

  constructor(dir?: string) {
    this.dir = dir ?? SKILLS_DIR;
  }

  /** Load all skill markdown files from the skills directory. */
  async loadSkills(): Promise<Skill[]> {
    try {
      const files = await fs.readdir(this.dir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));

      this.skills = await Promise.all(
        mdFiles.map(async (file) => {
          const content = await fs.readFile(path.join(this.dir, file), "utf-8");
          return this.parseSkillFile(file, content);
        })
      );

      logger.info("Skills loaded", { count: this.skills.length });
      return this.skills;
    } catch {
      logger.warn("Skills directory not found or unreadable", { dir: this.dir });
      return [];
    }
  }

  /**
   * Apply loaded skills to a piece of generated code.
   * Returns the code with a skill-summary comment block prepended, and with
   * any concrete transformations applied (e.g. adding "use client" when
   * client-only patterns are detected but the directive is absent).
   */
  applyToCode(code: string): string {
    if (this.skills.length === 0) return code;

    const relevant = this.skills.filter((skill) =>
      this.isRelevant(skill, code)
    );

    if (relevant.length === 0) return code;

    let result = code;

    // Concrete transformation: server-components skill detected client-side
    // patterns without an existing "use client" directive — prepend it.
    const serverComponentsSkill = relevant.find((s) =>
      s.name.toLowerCase().includes("server")
    );
    if (serverComponentsSkill && !result.trimStart().startsWith('"use client"')) {
      result = `"use client";\n\n${result}`;
      logger.debug("Skills engine: added 'use client' directive", {
        skill: serverComponentsSkill.name,
      });
    }

    const comment = [
      "/**",
      " * Applied repository skills:",
      ...relevant.map((s) => ` *  - ${s.name}: ${s.description}`),
      " */",
    ].join("\n");

    return `${comment}\n${result}`;
  }

  /** Return the currently loaded skills. */
  getSkills(): ReadonlyArray<Skill> {
    return this.skills;
  }

  private isRelevant(skill: Skill, code: string): boolean {
    try {
      const re = new RegExp(skill.pattern, "i");
      return re.test(code);
    } catch {
      return false;
    }
  }

  private parseSkillFile(filename: string, content: string): Skill {
    const nameMatch = content.match(/^#\s+(.+)/m);
    const descMatch = content.match(/^>\s+(.+)/m);
    const patternMatch = content.match(/```pattern\n([\s\S]+?)\n```/m);
    const exampleMatch = content.match(/```(?:tsx?|jsx?)\n([\s\S]+?)\n```/m);

    const name = nameMatch ? nameMatch[1].trim() : filename.replace(/\.md$/, "");
    const description = descMatch ? descMatch[1].trim() : name;
    const pattern = patternMatch ? patternMatch[1].trim() : ".*";
    const example = exampleMatch ? exampleMatch[1].trim() : undefined;

    return { name, description, pattern, example };
  }
}
