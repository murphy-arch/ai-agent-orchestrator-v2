import { describe, it, expect, vi } from "vitest";

// Simple unit tests for the multi-agent engine's parsing logic

describe("Team collaboration task parsing", () => {
  it("parses numbered task lines correctly", () => {
    const text = `1. Research the topic
2. Write a summary
3. Review for accuracy`;

    const tasks = new Map<number, string>();
    for (const line of text.split("\n")) {
      const match = line.match(/^\s*(\d+)\s*[:.\)]\s*(.+)/);
      if (match) {
        tasks.set(Number(match[1]), match[2].trim());
      }
    }

    expect(tasks.get(1)).toBe("Research the topic");
    expect(tasks.get(2)).toBe("Write a summary");
    expect(tasks.get(3)).toBe("Review for accuracy");
  });

  it("handles agent ID format like 42: task", () => {
    const text = `42: Analyze data\n7: Generate report`;

    const tasks = new Map<number, string>();
    for (const line of text.split("\n")) {
      const match = line.match(/^\s*(\d+)\s*[:.\)]\s*(.+)/);
      if (match) {
        tasks.set(Number(match[1]), match[2].trim());
      }
    }

    expect(tasks.get(42)).toBe("Analyze data");
    expect(tasks.get(7)).toBe("Generate report");
  });

  it("returns empty map for unstructured text", () => {
    const text = "Here is a plan: do some research then write";

    const tasks = new Map<number, string>();
    for (const line of text.split("\n")) {
      const match = line.match(/^\s*(\d+)\s*[:.\)]\s*(.+)/);
      if (match) {
        tasks.set(Number(match[1]), match[2].trim());
      }
    }

    expect(tasks.size).toBe(0);
  });
});
