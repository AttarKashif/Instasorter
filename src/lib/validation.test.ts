import { describe, it, expect } from "vitest";
import { validateThumbnailUrl } from "./validation";

describe("validation.ts - Thumbnail URL Sanitization", () => {
  it("should return empty string for undefined, null, or empty string", () => {
    expect(validateThumbnailUrl(undefined)).toBe("");
    expect(validateThumbnailUrl("")).toBe("");
  });

  it("should invalidate unsplash placeholder URLs and sample URLs", () => {
    expect(validateThumbnailUrl("https://images.unsplash.com/photo-12345")).toBe("");
    expect(validateThumbnailUrl("https://example.com/sample-image.jpg")).toBe("");
    expect(validateThumbnailUrl("sample-post-thumbnail")).toBe("");
  });

  it("should accept valid Instagram or external image URLs", () => {
    const validUrl = "https://instagram.fccu1-2.fna.fbcdn.net/v/t51.2885-15/30000000_n.jpg";
    expect(validateThumbnailUrl(validUrl)).toBe(validUrl);
  });
});
