import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit } from "./public-api-middleware";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows requests under the limit", () => {
    const result = checkRateLimit(1, 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);

    const result2 = checkRateLimit(1, 3);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = checkRateLimit(1, 3);
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    checkRateLimit(2, 2);
    checkRateLimit(2, 2);
    const result = checkRateLimit(2, 2);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after the window passes", () => {
    checkRateLimit(3, 1);
    const blocked = checkRateLimit(3, 1);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(61_000);
    const reset = checkRateLimit(3, 1);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(0);
  });
});
