export interface Post {
  id: string; // Internal stable ID
  postUrl: string;
  creatorUsername: string;
  creatorName?: string; // Creator's display name
  creatorBioUrl?: string; // Creator's bio link (website, YouTube, YouTube, etc.)
  caption: string;
  hashtags: string[];
  savedAt: string; // ISO string
  mediaType: "image" | "video" | "carousel";
  thumbnailUrl: string;
  tags: string[];
  collections: string[];
  isFavorite: boolean;
  isArchived: boolean;
  readLater: boolean;
  isReel: boolean;
  notes: string;
  fbid?: string; // Meta/Facebook internal post ID

  // Best-effort thumbnail fetching metadata
  instagramUrl?: string;
  savedDate?: Date;
  thumbnailStatus?: "pending" | "success" | "failed";
  lastThumbnailAttempt?: Date;
  thumbnailAttempts?: number;

  // Rich interactive mockup additions
  additionalSlides?: string[];
  instagramLikes?: number;
  location?: string;
  comments?: {
    id: string;
    username: string;
    text: string;
    timestamp: string;
  }[];
}

export interface Collection {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: string;
}

export interface SmartRule {
  id: string;
  collectionName: string;
  type: "username" | "keyword";
  value: string;
}
