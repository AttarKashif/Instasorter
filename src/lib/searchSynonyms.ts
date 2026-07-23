/**
 * Search Synonyms & Category-Based Keyword Dictionary for Instasorter
 * Enables smart discovery across posts without manual tagging.
 */

export interface CategoryDefinition {
  id: string;
  label: string;
  icon: string;
  keywords: string[];
  synonyms: string[];
}

export const CATEGORY_DICTIONARY: CategoryDefinition[] = [
  {
    id: "food",
    label: "Food & Culinary",
    icon: "Utensils",
    keywords: ["food", "dining", "eat", "meal", "cuisine", "foodie"],
    synonyms: [
      "recipe",
      "recipes",
      "cooking",
      "cook",
      "bake",
      "baking",
      "dish",
      "restaurant",
      "delicious",
      "yummy",
      "snack",
      "dessert",
      "breakfast",
      "lunch",
      "dinner",
      "gourmet",
      "chef",
      "cocktail",
      "drink",
      "cafe",
      "baking",
      "pasta",
      "pizza",
      "burger",
      "coffee",
      "tea",
      "kitchen",
      "taste",
      "treat",
    ],
  },
  {
    id: "fashion",
    label: "Fashion & Style",
    icon: "Shirt",
    keywords: ["fashion", "outfit", "style", "clothing", "apparel"],
    synonyms: [
      "wear",
      "look",
      "ootd",
      "dress",
      "wardrobe",
      "shoes",
      "streetwear",
      "chic",
      "boutique",
      "vibe",
      "trend",
      "threads",
      "model",
      "couture",
      "accessory",
      "jewelry",
      "boots",
      "sneakers",
      "attire",
      "garment",
      "tailored",
      "vintage",
    ],
  },
  {
    id: "travel",
    label: "Travel & Places",
    icon: "Compass",
    keywords: ["travel", "vacation", "trip", "tour", "destination"],
    synonyms: [
      "explore",
      "wanderlust",
      "tourism",
      "hotel",
      "resort",
      "beach",
      "mountain",
      "nature",
      "flight",
      "passport",
      "city",
      "landscape",
      "journey",
      "adventure",
      "getaway",
      "sea",
      "ocean",
      "island",
      "sightseeing",
      "roadtrip",
      "sunset",
    ],
  },
  {
    id: "fitness",
    label: "Fitness & Health",
    icon: "Dumbbell",
    keywords: ["fitness", "workout", "gym", "health", "exercise"],
    synonyms: [
      "training",
      "running",
      "yoga",
      "bodybuilding",
      "cardio",
      "athlete",
      "crossfit",
      "wellness",
      "pilates",
      "stretching",
      "marathon",
      "lifting",
      "physique",
      "gains",
      "active",
      "sport",
      "sports",
      "diet",
      "nutrition",
    ],
  },
  {
    id: "tech",
    label: "Tech & Software",
    icon: "Cpu",
    keywords: ["tech", "technology", "code", "coding", "software"],
    synonyms: [
      "developer",
      "programming",
      "ai",
      "gadget",
      "computer",
      "setup",
      "app",
      "web",
      "webdev",
      "python",
      "javascript",
      "react",
      "ux",
      "ui",
      "hardware",
      "device",
      "laptop",
      "macbook",
      "automation",
      "data",
      "digital",
      "robotics",
    ],
  },
  {
    id: "art",
    label: "Art & Design",
    icon: "Palette",
    keywords: ["art", "design", "illustration", "creative", "artwork"],
    synonyms: [
      "artist",
      "drawing",
      "painting",
      "sketch",
      "graphic",
      "aesthetic",
      "gallery",
      "museum",
      "3d",
      "vector",
      "poster",
      "canvas",
      "doodle",
      "sculpture",
      "typography",
      "creativity",
    ],
  },
  {
    id: "photography",
    label: "Photography & Shots",
    icon: "Camera",
    keywords: ["photo", "photography", "camera", "shot", "picture"],
    synonyms: [
      "portrait",
      "photographer",
      "lens",
      "frame",
      "capture",
      "snapshot",
      "film",
      "streetphotography",
      "cinematic",
      "lighting",
      "exposure",
      "photoshoot",
      "canon",
      "nikon",
      "sony",
    ],
  },
  {
    id: "music",
    label: "Music & Audio",
    icon: "Music",
    keywords: ["music", "song", "audio", "sound", "track"],
    synonyms: [
      "band",
      "concert",
      "playlist",
      "singer",
      "album",
      "beats",
      "live",
      "stage",
      "guitar",
      "piano",
      "dj",
      "performance",
      "melody",
      "rhythm",
      "musician",
      "festival",
    ],
  },
  {
    id: "home",
    label: "Home & Interior",
    icon: "Home",
    keywords: ["home", "interior", "decor", "house", "living"],
    synonyms: [
      "architecture",
      "furniture",
      "cozy",
      "room",
      "kitchen",
      "bedroom",
      "garden",
      "renovation",
      "homedecor",
      "interiordesign",
      "minimalism",
      "apartment",
      "space",
    ],
  },
  {
    id: "pets",
    label: "Pets & Animals",
    icon: "PawPrint",
    keywords: ["pets", "pet", "animal", "animals", "fauna"],
    synonyms: [
      "dog",
      "dogs",
      "cat",
      "cats",
      "puppy",
      "kitten",
      "cute",
      "furry",
      "rescue",
      "canine",
      "feline",
      "paws",
      "wildlife",
    ],
  },
  {
    id: "business",
    label: "Business & Finance",
    icon: "Briefcase",
    keywords: ["business", "finance", "money", "startup", "work"],
    synonyms: [
      "entrepreneur",
      "marketing",
      "investing",
      "crypto",
      "stocks",
      "office",
      "career",
      "productivity",
      "strategy",
      "leadership",
      "sales",
      "growth",
    ],
  },
];

export interface ExpandedSearchQuery {
  originalQuery: string;
  originalTerms: string[];
  expandedTerms: string[];
  matchedCategories: Array<{
    category: CategoryDefinition;
    matchedTerm: string;
    synonyms: string[];
  }>;
}

/**
 * Expands a search query string by identifying categories and looking up basic synonyms.
 */
export function expandSearchQuery(query: string): ExpandedSearchQuery {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return {
      originalQuery: "",
      originalTerms: [],
      expandedTerms: [],
      matchedCategories: [],
    };
  }

  // Split query into individual words (filtering out short common stop words if needed)
  const words = normalized
    .split(/[\s,+#_]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);

  const expandedSet = new Set<string>();
  const matchedCategoriesMap = new Map<
    string,
    { category: CategoryDefinition; matchedTerm: string; synonyms: string[] }
  >();

  // Add original words
  words.forEach((w) => expandedSet.add(w));

  // Check each word against categories and synonyms
  words.forEach((word) => {
    CATEGORY_DICTIONARY.forEach((cat) => {
      const isKeywordMatch = cat.keywords.some(
        (kw) => kw === word || word.includes(kw) || kw.includes(word),
      );
      const isSynonymMatch = cat.synonyms.some(
        (syn) => syn === word || word.includes(syn) || syn.includes(word),
      );

      if (isKeywordMatch || isSynonymMatch) {
        // Add all keywords and synonyms for this category
        cat.keywords.forEach((k) => expandedSet.add(k));
        cat.synonyms.forEach((s) => expandedSet.add(s));

        if (!matchedCategoriesMap.has(cat.id)) {
          matchedCategoriesMap.set(cat.id, {
            category: cat,
            matchedTerm: word,
            synonyms: Array.from(new Set([...cat.keywords, ...cat.synonyms])),
          });
        }
      }
    });
  });

  return {
    originalQuery: query,
    originalTerms: words,
    expandedTerms: Array.from(expandedSet),
    matchedCategories: Array.from(matchedCategoriesMap.values()),
  };
}

/**
 * Helper to test if a string containing post text (caption, notes, tags) matches
 * either the original query or any of its synonym terms.
 */
export function checkPostMatchWithSynonyms(
  postContent: {
    caption?: string;
    notes?: string;
    tags?: string[];
    hashtags?: string[];
    collections?: string[];
    creatorUsername?: string;
    creatorName?: string;
  },
  expandedQuery: ExpandedSearchQuery,
): { matches: boolean; matchedViaSynonym: boolean; matchedTerm?: string } {
  if (!expandedQuery.originalQuery.trim()) {
    return { matches: true, matchedViaSynonym: false };
  }

  const { originalTerms, expandedTerms } = expandedQuery;

  // Build a single combined lowercased string for fast text scanning
  const captionText = (postContent.caption || "").toLowerCase();
  const notesText = (postContent.notes || "").toLowerCase();
  const creatorText = `${postContent.creatorUsername || ""} ${postContent.creatorName || ""}`.toLowerCase();
  const tagsText = [
    ...(postContent.tags || []),
    ...(postContent.hashtags || []),
    ...(postContent.collections || []),
  ]
    .join(" ")
    .toLowerCase();

  const fullSearchableText = `${captionText} ${notesText} ${creatorText} ${tagsText}`;

  // 1. Check direct/original terms match
  for (const term of originalTerms) {
    if (fullSearchableText.includes(term)) {
      return { matches: true, matchedViaSynonym: false, matchedTerm: term };
    }
  }

  // 2. Check synonym-expanded terms match
  for (const expTerm of expandedTerms) {
    if (fullSearchableText.includes(expTerm)) {
      return { matches: true, matchedViaSynonym: true, matchedTerm: expTerm };
    }
  }

  return { matches: false, matchedViaSynonym: false };
}
