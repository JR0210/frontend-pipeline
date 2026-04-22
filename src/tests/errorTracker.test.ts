import { describe, it, expect } from "vitest";
import { ErrorTracker } from "../observability/errorTracker.js";

describe("ErrorTracker", () => {
  it("starts with no errors", () => {
    const tracker = new ErrorTracker();
    expect(tracker.hasErrors()).toBe(false);
    expect(tracker.getErrors()).toHaveLength(0);
  });

  it("captures an error and returns it", () => {
    const tracker = new ErrorTracker();
    tracker.capture({ code: "TEST_ERR", message: "Something failed" });
    expect(tracker.hasErrors()).toBe(true);
    expect(tracker.getErrors()[0].code).toBe("TEST_ERR");
  });

  it("captures an exception from a thrown Error", () => {
    const tracker = new ErrorTracker();
    tracker.captureException("CAUGHT", new Error("boom"), { extra: "info" });
    expect(tracker.hasErrors()).toBe(true);
    const err = tracker.getErrors()[0];
    expect(err.code).toBe("CAUGHT");
    expect(err.message).toBe("boom");
    expect(err.context).toEqual({ extra: "info" });
  });

  it("captures an exception from a non-Error thrown value", () => {
    const tracker = new ErrorTracker();
    tracker.captureException("STRING_ERR", "just a string");
    expect(tracker.getErrors()[0].message).toBe("just a string");
  });

  it("clears all errors", () => {
    const tracker = new ErrorTracker();
    tracker.capture({ code: "A", message: "a" });
    tracker.capture({ code: "B", message: "b" });
    tracker.clear();
    expect(tracker.hasErrors()).toBe(false);
    expect(tracker.getErrors()).toHaveLength(0);
  });

  it("accumulates multiple errors", () => {
    const tracker = new ErrorTracker();
    tracker.capture({ code: "E1", message: "first" });
    tracker.capture({ code: "E2", message: "second" });
    expect(tracker.getErrors()).toHaveLength(2);
  });
});
