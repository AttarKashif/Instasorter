/**
 * Calculates dynamic grid columns based on the screen width.
 * Single column: <= 640px
 * Double columns: > 640px and <= 1024px
 * Quad columns: > 1024px
 * 
 * @param width Viewport width in pixels
 */
export function calculateGridColumns(width: number): number {
  if (width <= 1024) {
    return 2; // double columns by default
  } else {
    return 4; // quad columns on desktop
  }
}

/**
 * Calculates the dynamic gap size (in pixels) based on viewport width
 * to maintain a consistent aesthetic across mobile, tablet, and desktop screens.
 * 
 * @param width Viewport width in pixels
 */
export function calculateGridGap(width: number): number {
  // Linear scaling from 12px at 320px width to 28px at 1440px width
  const minWidth = 320;
  const maxWidth = 1440;
  const minGap = 12;
  const maxGap = 28;

  if (width <= minWidth) return minGap;
  if (width >= maxWidth) return maxGap;

  const ratio = (width - minWidth) / (maxWidth - minWidth);
  const gap = minGap + ratio * (maxGap - minGap);
  return Math.round(gap);
}
