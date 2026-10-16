# Implementation Plan: Instagram-Feel Media Bifurcation, Mobile UI & Clean Blank Fallback

Revise the application to give an authentic Instagram-style browsing experience: bifurcate posts into Single Pictures, Carousels, and Videos/Reels with dedicated tabs, sorting, and filtering, make the layout mobile-first with a bottom navigation bar, and render a clean blank screen when thumbnail fetching fails.

## User Requirements & Core Specifications
1. **Thumbnail Failure Handling**:
   - If the app fails to fetch the thumbnail or if the image fails to load, keep it as a clean **blank screen** (minimal neutral surface with subtle Instagram aspect ratio, avoiding busy SVG fallback cards, broken image icons, or noisy error logs).
2. **Media Bifurcation (Single Pic, Carousel, Videos)**:
   - Categorize and bifurcate all saved posts into three distinct media types:
     - 📷 **Single Photos**: Standard single-image posts.
     - 📑 **Carousels**: Multi-slide posts with multi-image indicators and slide counters (`1/N`).
     - 🎥 **Videos & Reels**: Video content with reel/video duration or play badges.
   - Instagram-style media segment tabs (`All`, `Photos`, `Carousels`, `Videos`) with live item counts and instant switching.
3. **Instagram Feeling & Layout**:
   - Iconic corner badges: stacked squares icon for Carousels, play/reel icon for Videos.
   - Clean aspect ratios (`aspect-square` or `aspect-[4/5]`) matching Instagram's native explore grid.
   - Sorting capabilities: Newest first, Oldest first, Most slides / carousel depth, Starred first, Read later.
   - Multi-dimensional filtering: by media type (Single Pic, Carousel, Video), tags, folders, reading status, and search keywords.
4. **Mobile-Friendly UI**:
   - Responsive 2-column explore grid for mobile screens (`grid-cols-2`), with quick toggle to 1-column feed or list view.
   - Fixed mobile bottom navigation bar (`BottomTabBar`) with thumb-friendly touch targets (>= 44px) for Home, Folders, Analytics, Import, and Profile.
   - Safe-area inset support and swipeable or bottom-sheet modals on mobile devices.

---

## Proposed Changes

### 1. Data Model & Media Bifurcation Detection
- **`src/types/index.ts` & `src/utils/instagramParser.ts`**:
  - Add explicit `media_type: 'photo' | 'carousel' | 'video'` field to posts.
  - Automatically detect and classify posts upon import or hydration:
    - Check for `carousel_media` or slide array length > 1 -> `'carousel'`
    - Check for `is_video === true`, `video_url`, or `/reel/` URL format -> `'video'`
    - Single image URL or standard `/p/` without video -> `'photo'`
  - Expose helper utilities to compute counts per media bucket.

### 2. Instagram Tab Bar & Media Filter Controls
- **`src/components/dashboard/MediaSegmentBar.tsx`**:
  - Instagram-style segmented navigation tabs:
    - **All Posts** (with total count)
    - **Photos** (single pic icon + count)
    - **Carousels** (stacked squares icon + count)
    - **Videos & Reels** (play/reels icon + count)
  - Integrated Sorting Bar:
    - Sort dropdown: Date Added (Newest/Oldest), Carousel slide count, Starred, Title/Caption.
    - Quick filter pills for Bookmarks, Favorites, Read Later.

### 3. Blank Screen Thumbnail Fallback
- **`src/components/ui/InstagramImage.tsx`**:
  - When an image fails to load or no thumbnail URL exists, render a clean, elegant **blank screen**:
    - Flat neutral background (`bg-slate-900/40 dark:bg-zinc-900/60` or pure quiet slate) preserving the 1:1 or 4:5 aspect ratio.
    - No distracting placeholder art, error text, or broken icons—matching Instagram's native unloaded media state.
    - Subtle interactive click/tap behavior to open the post details or original Instagram link directly.
- **Server Cleanup (`server.ts`)**:
  - Ensure server returns HTTP 200 with `{ success: false, url: null }` without triggering unhandled exceptions or noisy 401 logs when external Instagram mirrors reject unauthenticated requests.

### 4. Instagram Explore Grid & Post Cards
- **`src/components/dashboard/PostGrid.tsx`**:
  - Mobile (`< 640px`): default to 2-column explore grid (`grid-cols-2 gap-2 sm:gap-4`).
  - Tablet/Desktop (`>= 640px`): 3 to 4 column responsive grid with smooth transitions.
  - View toggle button (2-Col Grid vs 1-Col Full Feed vs List View).
- **`src/components/dashboard/PostCard.tsx`**:
  - Instagram corner indicators:
    - Top-right stacked icon badge for carousels with slide count indicator.
    - Top-right reel/play icon badge for video posts.
  - Clean bottom overlay on hover / tap showing Star, Bookmark, and Folder indicators.

### 5. Mobile Navigation & Insets
- **`src/components/navigation/BottomTabBar.tsx`**:
  - Persistent bottom navigation bar on mobile screens (`block md:hidden`).
  - Tabs: Feed (`1`), Media Categories (`2`), Folders (`3`), Analytics (`4`), Import (`5`).
  - Safe-area bottom padding (`pb-[env(safe-area-inset-bottom)]`).
- **`src/components/navigation/Header.tsx`**:
  - Compact mobile top bar with app title, quick search bar, and active filter pill counters.

---

## Verification Plan

### Automated Tests & Lint
- Run `npm run lint` / `compile_applet` to verify TypeScript compile integrity.
- Run `npx vitest run` to verify data parsing and component tests pass without errors.

### Media Bifurcation Verification
- Load posts and verify that single photos, carousels, and videos are cleanly sorted into their respective tabs with correct counts.
- Switch between tabs (All -> Photos -> Carousels -> Videos) and verify instant filtering.
- Verify carousel cards show the stacked square badge and videos show the reel/play badge.

### Thumbnail Failure & Blank Screen Verification
- Invalidate or clear thumbnail for a post and verify it renders a clean, quiet blank screen rather than broken graphics or SVG error messages.
- Verify server logs remain clean with no 401 or rejected promise errors.

### Mobile Responsiveness Verification
- Test mobile viewport sizes (`375px`, `390px`, `412px`).
- Confirm 2-column grid renders cleanly without overflow.
- Confirm bottom tab bar stays anchored with touch targets >= 44px.
