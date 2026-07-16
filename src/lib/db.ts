import Dexie, { Table } from "dexie";
import { Post, Collection } from "../types/post";
import { validateThumbnailUrl } from "./validation";

export class InstasorterDatabase extends Dexie {
  posts!: Table<Post, string>;
  collections!: Table<Collection, string>;

  constructor() {
    super("InstasorterDB");
    this.version(2).stores({
      posts: "id, postUrl, creatorUsername, savedAt, isFavorite, isArchived",
      collections: "id, name, parentId",
    });
    this.version(3).stores({
      posts:
        "id, postUrl, creatorUsername, savedAt, isFavorite, isArchived, thumbnailStatus",
      collections: "id, name, parentId",
    });

    // Enforce validation at the database level using Dexie hooks
    this.posts.hook("creating", (_primKey, obj) => {
      const validated = validateThumbnailUrl(obj.thumbnailUrl);
      if (validated !== obj.thumbnailUrl) {
        obj.thumbnailUrl = validated;
        obj.thumbnailStatus = "pending";
      }
    });

    this.posts.hook("updating", (mods: any) => {
      if ("thumbnailUrl" in mods) {
        const validated = validateThumbnailUrl(mods.thumbnailUrl);
        if (validated !== mods.thumbnailUrl) {
          return {
            ...mods,
            thumbnailUrl: validated,
            thumbnailStatus: "pending",
          };
        }
      }
      return undefined; // return undefined if no modification to the updates
    });
  }

  async cleanupFailedThumbnails() {
    return this.posts.where("thumbnailStatus").equals("failed").modify({
      thumbnailUrl: "",
      thumbnailStatus: "pending",
    });
  }
}

export const db = new InstasorterDatabase();
