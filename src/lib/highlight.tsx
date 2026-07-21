import React from "react";

export const parseSearchQuery = (query: string) => {
  const normalized = query.trim();
  if (!normalized) return { isPrefix: false, prefixes: [], generalText: "" };

  const matches: Array<{ prefix: string; value: string }> = [];
  let remainingText = normalized;

  // 1. Regex to extract prefix:value pairs. Supports quoted strings like creator:"john doe"
  const colonRegex =
    /(?:(post|caption|creator|user|author|from|tag|hashtag|collection|folder|is):\s*)(?:"([^"]+)"|([^\s]+))/gi;

  let match;
  while ((match = colonRegex.exec(normalized)) !== null) {
    const prefix = match[1].toLowerCase();
    const value = match[2] || match[3];
    matches.push({ prefix, value });
    remainingText = remainingText.replace(match[0], "");
  }

  // 2. Hashtags starting with #, e.g. #nature
  const hashRegex = /#([^\s#]+)/g;
  while ((match = hashRegex.exec(normalized)) !== null) {
    const value = match[1];
    matches.push({ prefix: "hashtag", value });
    remainingText = remainingText.replace(match[0], "");
  }

  // 3. User handles starting with @, e.g. @john
  const atRegex = /@([^\s@]+)/g;
  while ((match = atRegex.exec(normalized)) !== null) {
    const value = match[1];
    matches.push({ prefix: "creator", value });
    remainingText = remainingText.replace(match[0], "");
  }

  remainingText = remainingText.replace(/\s+/g, " ").trim();

  return {
    isPrefix: matches.length > 0,
    prefixes: matches,
    generalText: remainingText,
  };
};

export const getHighlightTerms = (
  fieldType: "caption" | "creator",
  searchQuery: string,
  creatorFilter?: string
): string[] => {
  const terms: string[] = [];

  // Add creatorFilter if active and we are highlighting the creator field
  if (fieldType === "creator" && creatorFilter) {
    const trimmed = creatorFilter.trim();
    if (trimmed) {
      terms.push(trimmed);
    }
  }

  const query = searchQuery ? searchQuery.trim() : "";
  if (query) {
    const parsed = parseSearchQuery(query);
    if (parsed.isPrefix) {
      parsed.prefixes.forEach(({ prefix, value }) => {
        const valTrimmed = value.trim();
        if (!valTrimmed) return;

        if (fieldType === "creator") {
          if (
            prefix === "creator" ||
            prefix === "user" ||
            prefix === "author" ||
            prefix === "from"
          ) {
            terms.push(valTrimmed);
          }
        } else if (fieldType === "caption") {
          if (
            prefix === "post" ||
            prefix === "caption" ||
            prefix === "tag" ||
            prefix === "hashtag"
          ) {
            terms.push(valTrimmed);
          }
        }
      });

      if (parsed.generalText) {
        const genTrimmed = parsed.generalText.trim();
        if (genTrimmed) {
          terms.push(genTrimmed);
          const words = genTrimmed.split(/\s+/).filter(Boolean);
          if (words.length > 1) {
            terms.push(...words);
          }
        }
      }
    } else {
      // General search query
      terms.push(query);
      const words = query.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        terms.push(...words);
      }
    }
  }

  // Deduplicate and filter out empty strings, and sort by length descending
  return Array.from(new Set(terms))
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .sort((a, b) => b.length - a.length);
};

export const highlightTextHelper = (
  text: string,
  fieldType: "caption" | "creator",
  searchQuery: string,
  creatorFilter?: string
) => {
  if (!text) return "";
  const terms = getHighlightTerms(fieldType, searchQuery, creatorFilter);
  if (terms.length === 0) return text;

  // Escape special regex characters in terms
  const escapedTerms = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="bg-amber-100 text-slate-955 dark:bg-amber-900/60 dark:text-amber-50 rounded-[3px] px-0.5 font-bold border border-amber-200/30 shadow-xs"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const getSubtlePaletteColor = (
  colorPalette?: string[] | null,
  surfaceVar: string = "var(--m3-surface-low)"
): string | undefined => {
  if (!colorPalette || !Array.isArray(colorPalette) || colorPalette.length === 0) {
    return undefined;
  }
  const baseColor = colorPalette[0];
  if (baseColor && baseColor.startsWith("#")) {
    return `color-mix(in srgb, ${surfaceVar} 94%, ${baseColor} 6%)`;
  }
  return undefined;
};

