import { Post } from "../types/post";

export const SAMPLE_POSTS: Post[] = [
  {
    id: "sample-1",
    postUrl: "https://www.instagram.com/p/C6Z5y2xL-1a/",
    creatorUsername: "designtrends",
    caption:
      "Clean desks foster clear thoughts. Updated the workstation with oak wood tones, custom mechanical keyboard, and a soft ambient light bar. What do you think? 🌿⌨️ #workspace #desksetup #minimalism",
    hashtags: ["workspace", "desksetup", "minimalism"],
    savedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    mediaType: "image",
    thumbnailUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80",
    thumbnailStatus: "success",
    tags: ["workplace", "minimal", "inspiration"],
    collections: ["Design Ideas", "Tech Gadgets"],
    isFavorite: true,
    isArchived: false,
    readLater: false,
    isReel: false,
    notes:
      "Really love the warm backlight setup. Need to buy a screen light bar for my home office monitor.",
  },
  {
    id: "sample-2",
    postUrl: "https://www.instagram.com/p/C5X3f9yK-2b/",
    creatorUsername: "cozycafes",
    caption:
      "Rainy mornings call for double espresso and quiet jazz vibes. Found this little hideout in Kyoto. Best cinnamon roll in town! ☕🍂🥐 #cafehopping #coffeelover #travelkyoto",
    hashtags: ["cafehopping", "coffeelover", "travelkyoto"],
    savedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    mediaType: "image",
    thumbnailUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80",
    thumbnailStatus: "success",
    tags: ["cafe", "travel", "foodie"],
    collections: ["Wanderlust", "Food Guide"],
    isFavorite: false,
    isArchived: false,
    readLater: false,
    isReel: false,
    notes:
      'Bookmark this for next Japan trip. Kyoto cafe called "Le Chat Botté" near Gion district.',
  },
  {
    id: "sample-3",
    postUrl: "https://www.instagram.com/p/C4W2e8xJ-3c/",
    creatorUsername: "architect_digest",
    caption:
      "Brutalist concrete meets organic green life. An architectural wonder nesting right inside the forest outskirts. Spacious window panels capture gorgeous shadows throughout the day. 🏛️🌲 #architecture #brutalism #interiordesign",
    hashtags: ["architecture", "brutalism", "interiordesign"],
    savedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    mediaType: "carousel",
    thumbnailUrl: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
    thumbnailStatus: "success",
    tags: ["minimal", "design", "architecture"],
    collections: ["Design Ideas"],
    isFavorite: true,
    isArchived: false,
    readLater: false,
    isReel: false,
    notes: "Amazing interior concept blending indoor and outdoor feel.",
  },
  {
    id: "sample-4",
    postUrl: "https://www.instagram.com/p/C3V1d7xI-4d/",
    creatorUsername: "chef_secrets",
    caption:
      "Crispy skin salmon over creamy saffron risotto with charred asparagus. Perfecting this summer recipe for the dinner series. Full breakdown on my stories! 🐟🍽️🍋 #cookingathome #risotto #finedining #seafood",
    hashtags: ["cookingathome", "risotto", "finedining", "seafood"],
    savedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    mediaType: "image",
    thumbnailUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80",
    thumbnailStatus: "success",
    tags: ["recipe", "cooking", "foodie"],
    collections: ["Food Guide"],
    isFavorite: false,
    isArchived: false,
    readLater: false,
    isReel: false,
    notes:
      "Risotto broth ratio: 4 cups stock to 1 cup arborio rice. Toast the rice in butter first.",
  },
  {
    id: "sample-5",
    postUrl: "https://www.instagram.com/p/C2U0c6xH-5e/",
    creatorUsername: "adventure_awaits",
    caption:
      "Gliding through the emerald waters of Lake Braies at sunrise. The mountain peaks were covered in mist, creating the most quiet atmosphere imaginable. 🚣🏔️ #dolomites #italytravel #kayaking #naturelovers",
    hashtags: ["dolomites", "italytravel", "kayaking", "naturelovers"],
    savedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    mediaType: "video",
    thumbnailUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80",
    thumbnailStatus: "success",
    tags: ["travel", "nature", "outdoor"],
    collections: ["Wanderlust"],
    isFavorite: false,
    isArchived: false,
    readLater: false,
    isReel: false,
    notes:
      "Lake Braies boat rentals open at 8:30 AM. Go early to avoid the crowds!",
  },
  {
    id: "sample-6",
    postUrl: "https://www.instagram.com/p/C1T9b5xG-6f/",
    creatorUsername: "minimal_wardrobe",
    caption:
      "Aesthetic layers for crisp autumn walks. Merino wool sweater paired with oversized cotton trench coat and classic leather loafers. Simple and durable. 🧥🍂 #fallfashion #capsulewardrobe #minimalstyle",
    hashtags: ["fallfashion", "capsulewardrobe", "minimalstyle"],
    savedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    mediaType: "image",
    thumbnailUrl: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800&auto=format&fit=crop&q=80",
    thumbnailStatus: "success",
    tags: ["fashion", "minimal", "wardrobe"],
    collections: ["Design Ideas"],
    isFavorite: false,
    isArchived: true, // Archived to show how archives work!
    readLater: false,
    isReel: false,
    notes:
      "Need to look for a high-quality beige wool trench coat similar to this.",
  },
];
