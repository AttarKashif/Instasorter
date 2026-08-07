import { describe, it, expect } from "vitest";
import { validateThumbnailUrl } from "../validation";
import { findAnyInstagramUrlRecursively, decodeInstagramText, getDynamicCoverByKeywords } from "../parser";

describe("Validation Logic", () => {
  it("should return empty string for undefined or empty url", () => {
    expect(validateThumbnailUrl(undefined)).toBe("");
    expect(validateThumbnailUrl("")).toBe("");
  });

  it("should reject unsplash.com URLs", () => {
    expect(validateThumbnailUrl("https://images.unsplash.com/photo-12345")).toBe("");
  });

  it("should reject sample- URLs", () => {
    expect(validateThumbnailUrl("https://example.com/sample-image.jpg")).toBe("");
  });

  it("should accept valid external URLs", () => {
    const validUrl = "https://instagram.com/p/Cxyz123/";
    expect(validateThumbnailUrl(validUrl)).toBe(validUrl);
  });
});

describe("Parser URL Recursion Logic", () => {
  it("should return empty string for non-instagram values", () => {
    expect(findAnyInstagramUrlRecursively(null)).toBe("");
    expect(findAnyInstagramUrlRecursively("https://google.com")).toBe("");
  });

  it("should extract Instagram URL from string", () => {
    const url = "https://www.instagram.com/p/Cxyz123/";
    expect(findAnyInstagramUrlRecursively(url)).toBe(url);
  });

  it("should extract Instagram URL recursively from object structure", () => {
    const obj = {
      title: "Check this out",
      string_map_data: {
        href: {
          value: "https://instagram.com/reel/Bxyz789/",
        },
      },
    };
    expect(findAnyInstagramUrlRecursively(obj)).toBe("https://instagram.com/reel/Bxyz789/");
  });
});

describe("Text Decoding and Cover Selection", () => {
  it("should decode Instagram mojibake text safely", () => {
    expect(decodeInstagramText("")).toBe("");
    expect(decodeInstagramText("Hello World")).toBe("Hello World");
  });

  it("should return a dynamic cover based on keywords", () => {
    const cover = getDynamicCoverByKeywords("Amazing desk setup", ["workspace"], "post-1");
    expect(cover).toContain("unsplash.com");
  });
});

