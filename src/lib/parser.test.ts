import { describe, it, expect } from "vitest";
import {
  decodeInstagramText,
  getDynamicCoverByKeywords,
  findAnyInstagramUrlRecursively,
} from "./parser";

describe("parser.ts - Instagram JSON Parsing & Edge Cases", () => {
  it("should decode Instagram mojibake text safely", () => {
    expect(decodeInstagramText("")).toBe("");
    expect(decodeInstagramText("Clean text without mojibake")).toBe("Clean text without mojibake");
  });

  it("should select category-based dynamic covers accurately", () => {
    const workspaceCover = getDynamicCoverByKeywords("Loving this new mechanical keyboard setup!", ["desk"], "post-1");
    expect(workspaceCover).toContain("unsplash.com");

    const coffeeCover = getDynamicCoverByKeywords("Morning espresso time", ["coffee"], "post-2");
    expect(coffeeCover).toContain("unsplash.com");
  });

  it("should recursively find Instagram URLs in nested JSON objects and arrays", () => {
    const nestedData = {
      media: null,
      nested: {
        deepLink: "https://www.instagram.com/p/C-TestCode123/",
      },
      list: [1, 2, { url: "https://instagram.com/reel/XYZ789/" }],
    };

    expect(findAnyInstagramUrlRecursively(nestedData)).toBe("https://www.instagram.com/p/C-TestCode123/");

    const arrayData = [{ href: "https://instagram.com/p/ArrayTest/" }];
    expect(findAnyInstagramUrlRecursively(arrayData)).toBe("https://instagram.com/p/ArrayTest/");
  });

  it("should handle malformed or empty metadata objects gracefully without crashing", () => {
    expect(findAnyInstagramUrlRecursively(null)).toBe("");
    expect(findAnyInstagramUrlRecursively(undefined)).toBe("");
    expect(findAnyInstagramUrlRecursively(12345)).toBe("");
    expect(findAnyInstagramUrlRecursively("just a string")).toBe("");
  });
});
