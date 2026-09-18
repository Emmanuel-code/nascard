/**
 * App Lock coordination utility.
 * Allows pausing AppLock during native operations such as:
 * - Camera capture & selfie recording
 * - System image gallery picking
 * - Barcode scanner active sessions
 * - System permission requests
 */

// Default grace period: 3 minutes
export let BACKGROUND_LOCK_GRACE_PERIOD_MS = 3 * 60 * 1000;

export function setAppLockGracePeriod(minutes: number) {
  BACKGROUND_LOCK_GRACE_PERIOD_MS = minutes * 60 * 1000;
}

export function getAppLockGracePeriod(): number {
  return BACKGROUND_LOCK_GRACE_PERIOD_MS;
}

let pauseUntil = 0;

/**
 * Temporarily pause AppLock from triggering on background/foreground transitions.
 * @param durationMs Duration in ms to keep lock paused (default 120s / 2 min)
 */
export function pauseAppLock(durationMs = 120000) {
  pauseUntil = Date.now() + durationMs;
}

/**
 * Check if AppLock is currently paused for an ongoing native operation.
 */
export function isAppLockPaused(): boolean {
  return Date.now() < pauseUntil;
}

/**
 * Resume AppLock immediately (clears any active pause).
 */
export function resumeAppLock() {
  pauseUntil = 0;
}
