import { Post } from "../types/post";
import { validateThumbnailUrl } from "./validation";
import { classifyInstagramPost } from "./instagramClassifier";
import { MissingCriticalFieldsError } from "./importErrors";

// A curated list of gorgeous, premium, high-contrast visual covers from Unsplash
// (spanning abstract art, modern architecture, gradients, minimalism, and cozy textures)
// This ensures that even though Instagram exports do not contain image URLs, the user's dashboard is instantly breathtaking.
const AESTHETIC_COVERS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80", // Pink abstract wave
  "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80", // Colorful 3D glass
  "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=600&auto=format&fit=crop&q=80", // Pastel fluid gradient
  "https://images.unsplash.com/photo-1618005198143-e5283464303b?w=600&auto=format&fit=crop&q=80", // Dark fluid neon
  "https://images.unsplash.com/photo-1574169208507-84376144848b?w=600&auto=format&fit=crop&q=80", // Abstract paint mix
  "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&auto=format&fit=crop&q=80", // Blue abstract geometry
  "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600&auto=format&fit=crop&q=80", // Minimalist sand dunes
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80", // Clay render render architecture
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=600&auto=format&fit=crop&q=80", // Warm purple gradient grain
  "https://images.unsplash.com/photo-1618005121350-305908594b10?w=600&auto=format&fit=crop&q=80", // Iridescent chrome metal wave
  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&auto=format&fit=crop&q=80", // Brutalist concrete design
  "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=600&auto=format&fit=crop&q=80", // Terrazzo pastel grid
  "https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?w=600&auto=format&fit=crop&q=80", // Elegant marble block
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80", // Cozy mountain peaks
  "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600&auto=format&fit=crop&q=80", // Vibrant fluid orange 3D
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80", // Abstract pastel line paint
  "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=80", // Forest sun beams
  "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80", // Neon Tokyo night skyline
  "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80", // Modern architecture arches
  "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80", // Warm autumn sunrise wave
  "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80", // Cyberpunk neon light streak
  "https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?w=600&auto=format&fit=crop&q=80", // Curated art gallery frame
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80", // Golden Hour desert landscape
  "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?w=600&auto=format&fit=crop&q=80", // Scenic pink horizon sky
  "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=600&auto=format&fit=crop&q=80", // Botanical lush green interior
  "https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=600&auto=format&fit=crop&q=80", // Architectural curved staircases
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80", // Dark premium glass prismatic
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&auto=format&fit=crop&q=80", // Warm minimalist shadows
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&auto=format&fit=crop&q=80", // Modern mid-century lounge art
  "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&auto=format&fit=crop&q=80", // Teal ocean ripple
];

// Rich themed categorizer of gorgeous high-resolution Unsplash images matching Instagram content styles
const CATEGORY_COVERS: Record<string, string[]> = {
  workspace: [
    "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=800&auto=format&fit=crop&q=80", // Minimalist workspace
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80", // Clean mechanical keyboard setup
    "https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=800&auto=format&fit=crop&q=80", // Ambient light bar workspace
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80", // Macbook on oak desk
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80", // Audio desk setup
  ],
  coffee: [
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80", // Kyoto cafe breakfast
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80", // Warm latte art
    "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&auto=format&fit=crop&q=80", // Cinnamon rolls cafe morning
    "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&auto=format&fit=crop&q=80", // Rich espresso cup
    "https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?w=800&auto=format&fit=crop&q=80", // Cozy cafe reading spot
  ],
  architecture: [
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80", // Concrete arches
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80", // Brutalist exterior lines
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&auto=format&fit=crop&q=80", // Modern architecture concrete
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80", // Glass skyscraper
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80", // Glass panel sunroom
  ],
  food: [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80", // Gourmet plating
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80", // Crispy salmon dish
    "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&auto=format&fit=crop&q=80", // Creamy risotto bowl
    "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&auto=format&fit=crop&q=80", // Aesthetic avocado sandwich
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&auto=format&fit=crop&q=80", // Rich curry table
  ],
  nature: [
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80", // Dolomites morning lake boat
    "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&auto=format&fit=crop&q=80", // Sunshine through forest trees
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80", // Desert canyon golden hour
    "https://images.unsplash.com/photo-1433832597026-607e1555e55e?w=800&auto=format&fit=crop&q=80", // Misty green hills
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&fit=crop&q=80", // Lake and peaks at sunrise
  ],
  fashion: [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80", // Layered autumn coat
    "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800&auto=format&fit=crop&q=80", // Trench coat styling details
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&auto=format&fit=crop&q=80", // Cozy merino wool sweaters
    "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=80", // Classic tailored outfit
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80", // Loafers and pants details
  ],
  tech: [
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80", // Macbook open on lap
    "https://images.unsplash.com/photo-1550041401-f25b4b490ddf?w=800&auto=format&fit=crop&q=80", // Analog camera vintage feel
    "https://images.unsplash.com/photo-1525609004556-c46c7d6cf0a3?w=800&auto=format&fit=crop&q=80", // Apple devices setup
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80", // Screen setups
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80", // Minimalist phone
  ],
  art: [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80", // Pink abstract wave
    "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&auto=format&fit=crop&q=80", // Geometric iridescent glass
    "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800&auto=format&fit=crop&q=80", // Fluid pastel gradient
    "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80", // Abstract paint geometries
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop&q=80", // Abstract paint mix
  ],
  lifestyle: [
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80", // Cozy room reading spot
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80", // Clean bedroom layout
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80", // Minimal room setup
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80", // Mid-century lounge chair
  ],
  pets: [
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80", // Orange cat
    "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800&auto=format&fit=crop&q=80", // Ginger cat lying down
    "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop&q=80", // Golden retriever dog
    "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=800&auto=format&fit=crop&q=80", // Cat with sunglasses
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop&q=80", // French bulldog
    "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800&auto=format&fit=crop&q=80", // Cute pug dog
    "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=800&auto=format&fit=crop&q=80", // Cute calico cat
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80", // Cute ferret
    "https://images.unsplash.com/photo-1484557985045-eaa2520b9d2f?w=800&auto=format&fit=crop&q=80", // White rabbit bunny
    "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=800&auto=format&fit=crop&q=80", // Fluffy sleeping cat
  ],
  vehicles: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80", // Dark Porsche
    "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&auto=format&fit=crop&q=80", // White Tesla
    "https://images.unsplash.com/photo-1525609004556-c46c7d6cf0a3?w=800&auto=format&fit=crop&q=80", // Audi R8
    "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&auto=format&fit=crop&q=80", // Classic BMW
  ],
};

// Decodes Instagram's weird UTF-8 strings disguised as Latin-1
export const decodeInstagramText = (text: string): string => {
  if (!text) return "";
  try {
    // If the text contains characters above 255, it might already be decoded properly.
    // The typical mojibake (like \u00e2) is within the latin1 range.
    // escape() then decodeURIComponent() converts those latin1 bytes back to utf8.
    return decodeURIComponent(escape(text));
  } catch (e) {
    return text;
  }
};

// Returns a gorgeous, content-relevant cover from the curated dictionary matching the post's caption and tags
export const getDynamicCoverByKeywords = (
  caption: string,
  tags: string[],
  key: string,
): string => {
  const text = `${caption} ${tags.join(" ")}`.toLowerCase();

  let category = "art"; // Fallback default

  if (
    /\b(setup|desk|workspace|keyboard|office|workstation|monitor|pc|desksetup|keycaps|roomsetup)\b/.test(
      text,
    )
  ) {
    category = "workspace";
  } else if (
    /\b(coffee|cafe|espresso|latte|cappuccino|starbucks|barista|pastry|cinnamon|breakfast|morning)\b/.test(
      text,
    )
  ) {
    category = "coffee";
  } else if (
    /\b(architecture|brutalist|interior|building|house|concrete|minimalist building|arches)\b/.test(
      text,
    )
  ) {
    category = "architecture";
  } else if (
    /\b(food|recipe|risotto|salmon|cooking|chef|dinner|delicious|restaurant|eat|curry|pizza|burger|meal|dish|kitchen|baking|bake)\b/.test(
      text,
    )
  ) {
    category = "food";
  } else if (
    /\b(mountain|lake|nature|forest|travel|wanderlust|hiking|sea|ocean|river|adventure|camp|scenic|outdoor|landscape|view|sunset|sunrise|trip)\b/.test(
      text,
    )
  ) {
    category = "nature";
  } else if (
    /\b(fashion|ootd|wardrobe|trench|sweater|style|clothing|loafers|outfit|coat|apparel|dress|wear|jacket|shoes)\b/.test(
      text,
    )
  ) {
    category = "fashion";
  } else if (
    /\b(gadget|phone|iphone|camera|macbook|ipad|headphones|tech|laptop|technology|devices)\b/.test(
      text,
    )
  ) {
    category = "tech";
  } else if (
    /\b(paint|art|abstract|sculpture|gallery|exhibition|museum|design|drawing|canvas|creative)\b/.test(
      text,
    )
  ) {
    category = "art";
  } else if (
    /\b(plant|garden|home|living|cozy|bedroom|furniture|decor|houseplant|indoor|apartment)\b/.test(
      text,
    )
  ) {
    category = "lifestyle";
  } else if (
    /\b(cat|cats|kitten|kittens|meow|feline|dog|dogs|puppy|puppies|pup|canine|pet|pets|animal|animals|bunny|rabbit|hamster|ferret|squirrel|bear|lion|tiger|deer|bird)\b/.test(
      text,
    )
  ) {
    category = "pets";
  } else if (
    /\b(car|cars|automotive|vehicle|vehicles|porsche|ferrari|bmw|audi|mercedes|tesla|drive|racing|speed|motorcycle|bike|vroom)\b/.test(
      text,
    )
  ) {
    category = "vehicles";
  }

  const list = CATEGORY_COVERS[category] || CATEGORY_COVERS["art"];

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % list.length;
  return list[index];
};

// Normalizes and strips query string parameters and trailing slashes from Instagram post URLs,
// standardizing domain, protocol, and /reel/ or /tv/ paths to /p/ for precise deduplication.
export const findAnyInstagramUrlRecursively = (obj: any): string => {
  if (!obj) return "";
  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (
      (trimmed.startsWith("http://") || trimmed.startsWith("https://")) &&
      (trimmed.includes("instagram.com") || trimmed.includes("instagr.am"))
    ) {
      return trimmed;
    }
    return "";
  }
  if (typeof obj === "object") {
    // Check known properties first
    const keysToCheck = [
      "href",
      "value",
      "url",
      "postUrl",
      "instagramUrl",
      "post_url",
      "media_url",
      "uri",
      "link",
    ];
    for (const key of keysToCheck) {
      if (obj[key] && typeof obj[key] === "string") {
        const trimmed = obj[key].trim();
        if (
          trimmed.startsWith("http") &&
          (trimmed.includes("instagram.com") || trimmed.includes("instagr.am"))
        ) {
          return trimmed;
        }
      }
    }

    // Check all string properties next
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "string") {
        const trimmed = obj[key].trim();
        if (
          trimmed.startsWith("http") &&
          (trimmed.includes("instagram.com") || trimmed.includes("instagr.am"))
        ) {
          return trimmed;
        }
      }
    }

    // Recurse into arrays or nested objects
    for (const key of Object.keys(obj)) {
      try {
        const found = findAnyInstagramUrlRecursively(obj[key]);
        if (found) return found;
      } catch (_) {}
    }
  }
  return "";
};

export const extractUrlFromStringMapData = (stringMapData: any): string => {
  if (!stringMapData) return "";

  if (Array.isArray(stringMapData)) {
    for (const item of stringMapData) {
      const found = extractUrlFromStringMapData(item);
      if (found) return found;
    }
    return "";
  }

  if (typeof stringMapData === "object") {
    // Check direct properties of this entry first
    const keysToCheck = ["href", "value", "url", "uri", "link"];
    for (const key of keysToCheck) {
      if (stringMapData[key] && typeof stringMapData[key] === "string") {
        const val = stringMapData[key].trim();
        if (
          val.startsWith("http") &&
          (val.includes("instagram.com") || val.includes("instagr.am"))
        ) {
          return val;
        }
      }
    }

    // Check all properties
    for (const key of Object.keys(stringMapData)) {
      const val = stringMapData[key];
      if (val) {
        if (typeof val === "string") {
          const trimmed = val.trim();
          if (
            trimmed.startsWith("http") &&
            (trimmed.includes("instagram.com") ||
              trimmed.includes("instagr.am"))
          ) {
            return trimmed;
          }
        } else if (typeof val === "object") {
          const found = extractUrlFromStringMapData(val);
          if (found) return found;
        }
      }
    }
  }

  return "";
};

export const cleanInstagramUrl = (url: string): string => {
  if (!url) return "";
  let u = url.trim();

  // Strip query parameters (e.g. ?igsh=..., ?utm_source=...)
  const qIndex = u.indexOf("?");
  if (qIndex !== -1) {
    u = u.substring(0, qIndex);
  }

  // Strip trailing slashes
  while (u.endsWith("/")) {
    u = u.slice(0, -1);
  }

  // Lowercase protocol & domain to ensure consistency, but keep shortcode path case-sensitive
  try {
    const parsed = new URL(u);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.substring(4);
    }
    let path = parsed.pathname;
    // Standardize paths like /reel/, /reels/, or /tv/ to /p/
    path = path.replace(/^\/reels?\//i, "/p/");
    path = path.replace(/^\/tv\//i, "/p/");

    return `${parsed.protocol.toLowerCase()}//${host}${path}`;
  } catch (e) {
    // Fallback if URL parser fails on partial or malformed links
    let low = u.toLowerCase();
    if (low.startsWith("http://")) {
      u = "https://" + u.substring(7);
    }
    u = u.replace(/^https:\/\/www\.instagram\.com/i, "https://instagram.com");
    u = u.replace(/\/reels?\//i, "/p/");
    u = u.replace(/\/tv\//i, "/p/");
    return u;
  }
};

export const extractOwnerDetails = (raw: any) => {
  let creatorUsername = "";
  let creatorName = "";
  let creatorBioUrl = "";

  const checkLabelValues = (obj: any) => {
    if (obj && obj.label_values && Array.isArray(obj.label_values)) {
      const ownerItem = obj.label_values.find(
        (item: any) =>
          item && (item.title === "Owner" || item.title === "owner"),
      );
      if (ownerItem && Array.isArray(ownerItem.dict) && ownerItem.dict[0]) {
        const nestedDict = ownerItem.dict[0].dict;
        if (Array.isArray(nestedDict)) {
          const usernameItem = nestedDict.find(
            (item: any) =>
              item && (item.label === "Username" || item.label === "username"),
          );
          const nameItem = nestedDict.find(
            (item: any) =>
              item && (item.label === "Name" || item.label === "name"),
          );
          const urlItem = nestedDict.find(
            (item: any) =>
              item && (item.label === "URL" || item.label === "url"),
          );

          if (usernameItem && usernameItem.value)
            creatorUsername = usernameItem.value;
          if (nameItem && nameItem.value) creatorName = nameItem.value;
          if (urlItem && urlItem.value) creatorBioUrl = urlItem.value;
        }
      }
    }
  };

  checkLabelValues(raw);
  if (!creatorUsername && raw.media_list_data?.[0]) {
    checkLabelValues(raw.media_list_data[0]);
  }

  // Fallback username extraction if not found
  if (!creatorUsername) {
    const smd =
      raw.media_list_data?.[0]?.string_map_data || raw.string_map_data;
    if (smd) {
      creatorUsername =
        smd.Owner?.value ||
        smd.owner?.value ||
        smd.Creator?.value ||
        smd.creator?.value ||
        smd.Username?.value ||
        smd.username?.value ||
        smd.Title?.value ||
        smd.title?.value ||
        "";
    }
    if (!creatorUsername) {
      creatorUsername =
        raw.title ||
        raw.creatorUsername ||
        raw.username ||
        raw.media_list_data?.[0]?.title ||
        "";
    }
  }

  return { creatorUsername, creatorName, creatorBioUrl };
};

export const extractCreatorUsername = (raw: any): string => {
  return extractOwnerDetails(raw).creatorUsername;
};

export const getDeterministicPalette = (id?: string | null): string[] => {
  const palettes = [
    ["#475569", "#334155", "#1e293b", "#0f172a"], // Slate Neutral
    ["#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"], // Cobalt
    ["#14b8a6", "#0d9488", "#0f766e", "#115e59"], // Sage Teal
    ["#f97316", "#ea580c", "#c2410c", "#9a3412"], // Terracotta Amber
    ["#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6"], // Lavender Purple
    ["#10b981", "#059669", "#047857", "#065f46"], // Emerald Green
  ];
  const safeId = String(id || "");
  let hash = 0;
  for (let i = 0; i < safeId.length; i++) {
    hash = safeId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

export const normalizeInstagramPost = (raw: any): Post => {
  if (!raw || typeof raw !== "object") {
    throw new MissingCriticalFieldsError("Entry is null, undefined, or not a JSON object.");
  }

  // Basic check for recognizable Instagram post fields
  const hasUrl = !!(
    raw.postUrl || raw.url || raw.href || raw.instagramUrl ||
    raw.post_url || raw.media_url || raw.uri || raw.link
  );
  const hasMediaList = Array.isArray(raw.media_list_data) && raw.media_list_data.length > 0;
  const hasStringMap = !!(raw.string_map_data && typeof raw.string_map_data === "object");
  const hasTitle = typeof raw.title === "string" && raw.title.trim().length > 0;
  const hasCaption = typeof raw.caption === "string" && raw.caption.trim().length > 0;
  const hasLabelValues = Array.isArray(raw.label_values) && raw.label_values.length > 0;
  const hasId = !!(raw.id || raw.fbid);

  if (!hasUrl && !hasMediaList && !hasStringMap && !hasTitle && !hasCaption && !hasLabelValues && !hasId) {
    throw new MissingCriticalFieldsError(
      "Post entry is missing critical fields (no post URL, media URI, string_map_data, title, or caption)."
    );
  }

  // 1. Extract and Clean Post URL (extremely thorough fallback keys)
  let rawPostUrl = raw.postUrl || raw.url || raw.href || raw.instagramUrl || "";

  if (raw.label_values && Array.isArray(raw.label_values)) {
    const urlItem = raw.label_values.find(
      (item: any) => item && (item.label === "URL" || item.title === "URL"),
    );
    if (urlItem) {
      rawPostUrl = urlItem.href || urlItem.value || rawPostUrl;
    }
  }

  if (!rawPostUrl && raw.string_map_data) {
    rawPostUrl = extractUrlFromStringMapData(raw.string_map_data);
  }

  if (!rawPostUrl && raw.media_list_data?.[0]?.string_map_data) {
    rawPostUrl = extractUrlFromStringMapData(
      raw.media_list_data[0].string_map_data,
    );
  }

  // Deep recursive search fallback
  if (!rawPostUrl) {
    rawPostUrl = findAnyInstagramUrlRecursively(raw);
  }

  const postUrl = cleanInstagramUrl(rawPostUrl);

  // 2. Extract Creator Username (Instagram puts creator username in "title" inside saved_posts.json)
  const {
    creatorUsername: rawCreatorUsername,
    creatorName,
    creatorBioUrl,
  } = extractOwnerDetails(raw);
  let creatorUsername = rawCreatorUsername.trim().replace(/^@/, "");
  if (
    !creatorUsername ||
    creatorUsername.toLowerCase() === "unknown" ||
    creatorUsername.toLowerCase() === "saved post"
  ) {
    creatorUsername = "instagram_creator";
  }

  // 3. Extract Saved Time (and parse timestamps properly from all possible export schemas)
  let savedAtStr = raw.savedAt || "";
  if (!savedAtStr) {
    let tsVal =
      raw.timestamp ||
      raw.timestamp_saved ||
      raw.saved_timestamp ||
      raw.creation_timestamp;

    // Check inside media_list_data
    if (!tsVal && raw.media_list_data?.[0]) {
      const m = raw.media_list_data[0];
      tsVal = m.timestamp || m.creation_timestamp || m.creation_date;
    }

    // Check inside string_map_data
    if (raw.string_map_data) {
      const savedTimeData =
        raw.string_map_data["Saved Time"] ||
        raw.string_map_data["saved_time"] ||
        raw.string_map_data["Time"] ||
        raw.string_map_data["time"] ||
        raw.string_map_data["Date"] ||
        raw.string_map_data["date"] ||
        raw.string_map_data["Saved on"] ||
        raw.string_map_data["saved_on"];
      if (savedTimeData) {
        tsVal = tsVal || savedTimeData.timestamp || savedTimeData.value;
      }

      // If still not found, do a generic search of all string_map_data keys for a timestamp
      if (!tsVal) {
        for (const key of Object.keys(raw.string_map_data)) {
          const field = raw.string_map_data[key];
          if (field && typeof field === "object" && field.timestamp) {
            tsVal = field.timestamp;
            break;
          }
        }
      }
    }

    // Check inside media_list_data[0].string_map_data
    if (!tsVal && raw.media_list_data?.[0]?.string_map_data) {
      const smd = raw.media_list_data[0].string_map_data;
      const savedTimeData =
        smd["Saved Time"] ||
        smd["saved_time"] ||
        smd["Time"] ||
        smd["time"] ||
        smd["Date"] ||
        smd["date"] ||
        smd["Saved on"] ||
        smd["saved_on"];
      if (savedTimeData) {
        tsVal = savedTimeData.timestamp || savedTimeData.value;
      }

      if (!tsVal) {
        for (const key of Object.keys(smd)) {
          const field = smd[key];
          if (field && typeof field === "object" && field.timestamp) {
            tsVal = field.timestamp;
            break;
          }
        }
      }
    }

    if (tsVal) {
      if (typeof tsVal === "number") {
        // Unix timestamp in seconds needs to be converted to milliseconds
        const ms = tsVal < 9999999999 ? tsVal * 1000 : tsVal;
        savedAtStr = new Date(ms).toISOString();
      } else if (typeof tsVal === "string") {
        // Try parsing string date
        const parsedMs = Date.parse(tsVal);
        if (!isNaN(parsedMs)) {
          savedAtStr = new Date(parsedMs).toISOString();
        }
      }
    }
  }
  if (!savedAtStr) {
    savedAtStr = new Date().toISOString();
  }

  // 4. Extract Caption
  let caption = raw.caption || "";
  if (raw.label_values && Array.isArray(raw.label_values)) {
    const captionItem = raw.label_values.find(
      (item: any) =>
        item && (item.label === "Caption" || item.title === "Caption"),
    );
    if (captionItem) {
      caption = captionItem.value || caption;
    }
  }
  if (!caption && raw.string_map_data) {
    caption =
      raw.string_map_data.Caption?.value ||
      raw.string_map_data.caption?.value ||
      raw.string_map_data["Caption Content"]?.value ||
      "";
  }
  if (!caption && raw.media_list_data?.[0]) {
    const m = raw.media_list_data[0];
    caption = m.title || m.caption || "";
    if (!caption && m.string_map_data) {
      caption =
        m.string_map_data.Caption?.value ||
        m.string_map_data.caption?.value ||
        m.string_map_data["Caption Content"]?.value ||
        m.string_map_data.Title?.value ||
        m.string_map_data.title?.value ||
        "";
    }
  }
  if (!caption && raw.title) {
    const t = raw.title.trim();
    const looksLikeUsername =
      !t.includes(" ") &&
      t.length < 30 &&
      (t === creatorUsername || t === raw.title);
    if (!looksLikeUsername) {
      caption = t;
    }
  }
  caption = caption.trim();
  if (!caption) {
    caption = "";
  }

  // 5. Compute stable deterministic unique Post ID
  let id = "";

  if (postUrl) {
    id = postUrl;
  } else if (raw.id) {
    id = String(raw.id);
    if (id.startsWith("http://") || id.startsWith("https://")) {
      id = cleanInstagramUrl(id);
    }
  }

  if (!id) {
    // Create a deterministic stable ID from creator, saved date, and caption hash
    let uri = "";
    if (raw.media_list_data?.[0]?.uri) {
      uri = raw.media_list_data[0].uri;
    } else if (raw.string_map_data?.["Media URL"]?.value) {
      uri = raw.string_map_data["Media URL"]?.value;
    }

    if (uri) {
      const normalizedUri = uri.replace(/\\/g, "/").replace(/^\//, "");
      id = `uri_${normalizedUri.replace(/[^a-zA-Z0-9]/g, "_")}`;
    } else {
      // Generate a stable numeric hash from caption + creatorUsername + saved timestamp
      const contentStr = `${creatorUsername}_${savedAtStr}_${caption.substring(0, 50)}`;
      let hash = 0;
      for (let i = 0; i < contentStr.length; i++) {
        hash = contentStr.charCodeAt(i) + ((hash << 5) - hash);
      }
      id = `hash_${Math.abs(hash)}`;
    }
  }

  // Parse hashtags from caption & label_values Hashtags
  const hashtagsFromLabelValues: string[] = [];
  if (raw.label_values && Array.isArray(raw.label_values)) {
    const hashtagsItem = raw.label_values.find(
      (item: any) =>
        item && (item.title === "Hashtags" || item.label === "Hashtags"),
    );
    if (hashtagsItem && Array.isArray(hashtagsItem.dict)) {
      hashtagsItem.dict.forEach((hObj: any) => {
        if (hObj && Array.isArray(hObj.dict)) {
          const nameObj = hObj.dict.find(
            (d: any) => d && (d.label === "Name" || d.title === "Name"),
          );
          if (nameObj && nameObj.value) {
            hashtagsFromLabelValues.push(nameObj.value);
          }
        }
      });
    }
  }

  const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
  const matches = [...caption.matchAll(hashtagRegex)].map((m) => m[1]);
  const hashtags = Array.from(
    new Set([...hashtagsFromLabelValues, ...(raw.hashtags || []), ...matches]),
  );

  // 6. Extract Media Type with robust priority
  let mediaType: "image" | "video" | "carousel" = "image";
  let isReel = false;

  const classification = classifyInstagramPost(raw);
  if (classification.type === "reel") {
    mediaType = "video";
    isReel = true;
  } else if (classification.type === "carousel") {
    mediaType = "carousel";
    isReel = false;
  } else if (classification.type === "single_image") {
    mediaType = "image";
    isReel = false;
  } else if (classification.type === "video") {
    mediaType = "video";
    isReel = false;
  } else {
    // Fallback standard parsing if unknown
    if (raw.mediaType) {
      mediaType = raw.mediaType;
    } else if (raw.media_list_data && raw.media_list_data.length > 1) {
      mediaType = "carousel";
    } else if (raw.media_list_data?.[0]?.media_metadata?.video_metadata) {
      mediaType = "video";
    } else if (postUrl) {
      if (postUrl.includes("/reel/") || postUrl.includes("/reels/")) {
        mediaType = "video";
      } else if (postUrl.includes("/p/")) {
        mediaType = "image";
      }
    }

    // Fallback heuristics based on caption/keywords
    const captionLower = caption.toLowerCase();
    if (mediaType === "image") {
      if (captionLower.includes("reel") || captionLower.includes("reels")) {
        mediaType = "video";
      } else if (
        captionLower.includes("carousel") ||
        captionLower.includes("swipe") ||
        captionLower.includes("slides")
      ) {
        mediaType = "carousel";
      }
    }

    isReel =
      postUrl.includes("/reel/") ||
      postUrl.includes("/reels/") ||
      (mediaType === "video" &&
        (captionLower.includes("reel") || captionLower.includes("reels")));
  }

  // 7. Extract Collections & Tags first so we can use them for smart image pairing
  const collections = raw.collections || [];
  const tags = Array.from(new Set([...(raw.tags || []), ...hashtags]));

  // If a collection name is assigned, automatically make it a tag too so filters pick it up!
  collections.forEach((col: string) => {
    const cleanCol = col.trim().toLowerCase();
    if (cleanCol && !tags.includes(cleanCol)) {
      tags.push(cleanCol);
    }
  });

  // 8. Extract Thumbnail / Image URL (Instagram doesn't serve direct web links in simple export)
  let thumbnailUrl = raw.thumbnailUrl || raw.thumbnail || raw.mediaUrl || "";
  if (!thumbnailUrl && raw.string_map_data) {
    thumbnailUrl = raw.string_map_data["Media URL"]?.value || "";
  }
  if (!thumbnailUrl && raw.media_list_data?.[0]?.uri) {
    thumbnailUrl = raw.media_list_data[0].uri;
  }

  // Guard clause: If the thumbnail url is not a valid web image (starts with http, https, or data:)
  // then we set it to empty so the app goes to the link, downloads the image and previews it.
  thumbnailUrl = validateThumbnailUrl(thumbnailUrl.trim());
  if (
    !thumbnailUrl ||
    (!thumbnailUrl.startsWith("http") && !thumbnailUrl.startsWith("data:"))
  ) {
    thumbnailUrl = "";
  }

  // 9. Extract additional slides if it's a carousel, or generate aesthetic ones if empty
  const additionalSlides: string[] = [];
  if (raw.media_list_data && raw.media_list_data.length > 1) {
    for (let i = 1; i < raw.media_list_data.length; i++) {
      const slideItem = raw.media_list_data[i];
      let slideUrl =
        slideItem?.uri ||
        slideItem?.thumbnailUrl ||
        slideItem?.thumbnail ||
        slideItem?.mediaUrl ||
        "";
      if (!slideUrl && slideItem?.string_map_data) {
        slideUrl = slideItem.string_map_data["Media URL"]?.value || "";
      }
      slideUrl = (slideUrl || "").trim();
      if (slideUrl) {
        additionalSlides.push(slideUrl);
      }
    }
  } else if (raw.additionalSlides && Array.isArray(raw.additionalSlides)) {
    additionalSlides.push(...raw.additionalSlides);
  }

  // Generate fallback slides for carousel posts if we don't have any, making them beautiful and interactive
  if (mediaType === "carousel" && additionalSlides.length === 0) {
    const hashString = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return hash;
    };
    const slideCount = 2 + (Math.abs(hashString(id)) % 3); // 2 to 4 slides
    for (let i = 1; i <= slideCount; i++) {
      const fallbackSlide = getDynamicCoverByKeywords(
        caption,
        tags,
        `${id}_slide_${i}`,
      );
      additionalSlides.push(fallbackSlide);
    }
  }

  // Set gorgeous, context-aware placeholder cover from Unsplash if we have no valid thumbnail
  if (!thumbnailUrl) {
    thumbnailUrl = getDynamicCoverByKeywords(caption, tags, id);
  }

  return {
    id,
    postUrl,
    creatorUsername: decodeInstagramText(creatorUsername),
    creatorName: creatorName ? decodeInstagramText(creatorName) : undefined,
    creatorBioUrl: creatorBioUrl || undefined,
    caption: decodeInstagramText(caption),
    hashtags: hashtags.map(decodeInstagramText),
    savedAt: savedAtStr,
    mediaType,
    thumbnailUrl,
    colorPalette: raw.colorPalette || getDeterministicPalette(id),
    additionalSlides:
      additionalSlides.length > 0 ? additionalSlides : undefined,
    mediaCount: raw.mediaCount || (additionalSlides.length > 0 ? 1 + additionalSlides.length : 1),
    tags: tags.map(decodeInstagramText),
    collections: collections.map(decodeInstagramText),
    isFavorite: !!raw.isFavorite,
    isArchived: !!raw.isArchived,
    readLater: !!raw.readLater,
    isReel,
    notes: raw.notes || "",
    instagramUrl: postUrl,
    savedDate: new Date(savedAtStr),
    thumbnailStatus:
      raw.thumbnailStatus ||
      (postUrl &&
      (postUrl.startsWith("http://") || postUrl.startsWith("https://"))
        ? "pending"
        : "success"),
    thumbnailAttempts: raw.thumbnailAttempts || 0,
    lastThumbnailAttempt: raw.lastThumbnailAttempt
      ? new Date(raw.lastThumbnailAttempt)
      : undefined,
    fbid: raw.fbid || undefined,
  };
};

export const normalizeInstagramPostAsync = async (
  raw: any,
  zip?: any,
): Promise<Post> => {
  const post = normalizeInstagramPost(raw);

  if (zip) {
    let rawUri = "";
    if (raw.media_list_data?.[0]?.uri) {
      rawUri = raw.media_list_data[0].uri;
    } else if (raw.string_map_data?.["Media URL"]?.value) {
      rawUri = raw.string_map_data["Media URL"]?.value;
    }

    const resolveZipUri = async (uri: string): Promise<string | null> => {
      try {
        const normalizedUri = uri.replace(/\\/g, "/").replace(/^\//, "");
        let zipFile = zip.files[normalizedUri];

        // Suffix/filename fallback search if not found directly
        if (!zipFile) {
          const uriParts = normalizedUri.split("/");
          const filename = uriParts[uriParts.length - 1];

          if (uriParts.length >= 2) {
            const lastTwo = uriParts.slice(-2).join("/");
            zipFile = Object.values(zip.files).find(
              (f: any) =>
                f.name.replace(/\\/g, "/").endsWith(lastTwo) && !f.dir,
            );
          }

          if (!zipFile && filename) {
            zipFile = Object.values(zip.files).find(
              (f: any) =>
                (f.name.replace(/\\/g, "/").endsWith("/" + filename) ||
                  f.name.replace(/\\/g, "/").endsWith(filename)) &&
                !f.dir,
            );
          }
        }

        if (zipFile) {
          const blob = await zipFile.async("blob");
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          if (dataUrl && dataUrl.startsWith("data:")) {
            return dataUrl;
          }
        }
      } catch (err) {
        console.warn(`Error resolving zip file for URI ${uri}:`, err);
      }
      return null;
    };

    if (rawUri) {
      const mainDataUrl = await resolveZipUri(rawUri);
      if (mainDataUrl) {
        post.thumbnailUrl = mainDataUrl;
      }
    }

    // Resolve additional slides from ZIP for carousel posts
    if (raw.media_list_data && raw.media_list_data.length > 1) {
      const resolvedSlides: string[] = [];
      for (let i = 1; i < raw.media_list_data.length; i++) {
        const slideItem = raw.media_list_data[i];
        let slideUri = slideItem?.uri || "";
        if (!slideUri && slideItem?.string_map_data) {
          slideUri = slideItem.string_map_data["Media URL"]?.value || "";
        }

        if (slideUri) {
          if (slideUri.startsWith("http") || slideUri.startsWith("data:")) {
            resolvedSlides.push(slideUri);
          } else {
            const slideDataUrl = await resolveZipUri(slideUri);
            if (slideDataUrl) {
              resolvedSlides.push(slideDataUrl);
            }
          }
        }
      }
      if (resolvedSlides.length > 0) {
        post.additionalSlides = resolvedSlides;
        post.mediaCount = 1 + resolvedSlides.length;
      }
    }
  }

  return post;
};
