/**
 * Vibration feedback utility for mobile devices/touch screens.
 * Wraps navigator.vibrate with safe feature detection.
 */

// Vibration pattern types
export type VibrationPattern = "light" | "medium" | "heavy" | "double" | "warning" | "tap" | "thud" | "pulse" | "success";

const PATTERNS: Record<VibrationPattern, number | number[]> = {
  light: 15,
  medium: 50,
  heavy: 120,
  double: [50, 40, 50],
  warning: [100, 50, 150],
  tap: 10,
  thud: [80, 50, 120],
  pulse: [30, 50, 30, 50, 60],
  success: [40, 60, 80],
};

/**
 * Triggers a vibration feedback if supported by the browser/device.
 * @param type The vibration pattern name or a custom pattern array of durations
 */
export function triggerVibration(type: VibrationPattern | number | number[] = "medium") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  try {
    const pattern = typeof type === "string" ? PATTERNS[type] : type;
    navigator.vibrate(pattern);
  } catch (err) {
    console.debug("Vibration not supported or blocked by user gesture/iframe context", err);
  }
}
