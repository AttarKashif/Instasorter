/**
 * Haptic Vibration Engine utility using the HTML5 Vibration API (navigator.vibrate).
 * Provides tactile feedback for mobile interactions in Instasorter.
 */

export type HapticImpactPattern = "light" | "medium" | "heavy";

const HAPTIC_PATTERNS: Record<HapticImpactPattern, number | number[]> = {
  light: 15,
  medium: 50,
  heavy: 120,
};

/**
 * Triggers a haptic vibration feedback based on selected impact pattern.
 * Safely handles iframe sandboxing constraints and lack of browser support.
 */
export function triggerHaptic(pattern: HapticImpactPattern = "light") {
  if (typeof navigator === "undefined" || !navigator.vibrate) {
    return;
  }

  try {
    const duration = HAPTIC_PATTERNS[pattern] || HAPTIC_PATTERNS.light;
    navigator.vibrate(duration);
  } catch (error) {
    console.debug("[Haptic Engine] Vibration blocked or unsupported in current environment", error);
  }
}
