import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DesignStore } from "../pipeline/designStore.js";
import type { V0Design } from "../types/index.js";

function makeDesign(id: string): V0Design {
  return {
    id,
    prompt: "test prompt",
    code: "export function Test() { return <div />; }",
    framework: "nextjs",
    createdAt: new Date().toISOString(),
  };
}

describe("DesignStore", () => {
  let tmpDir: string;
  let store: DesignStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "design-store-"));
    store = new DesignStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads a design by id", async () => {
    const design = makeDesign("my-design-1");
    await store.save(design);
    const loaded = await store.load("my-design-1");
    expect(loaded.id).toBe("my-design-1");
    expect(loaded.prompt).toBe("test prompt");
  });

  it("returns true from exists() after saving", async () => {
    await store.save(makeDesign("check-me"));
    expect(await store.exists("check-me")).toBe(true);
  });

  it("returns false from exists() for unknown ids", async () => {
    expect(await store.exists("unknown")).toBe(false);
  });

  it("lists saved design ids", async () => {
    await Promise.all([
      store.save(makeDesign("a")),
      store.save(makeDesign("b")),
      store.save(makeDesign("c")),
    ]);
    const ids = await store.list();
    expect(ids.sort()).toEqual(["a", "b", "c"]);
  });

  it("returns an empty list when no designs are saved", async () => {
    const ids = await store.list();
    expect(ids).toEqual([]);
  });

  it("loads a design from an explicit file path", async () => {
    const design = makeDesign("file-load");
    const savedPath = await store.save(design);
    const loaded = await store.loadFromPath(savedPath);
    expect(loaded.id).toBe("file-load");
  });
});
