/**
 * Rilevamento piattaforma per la gestione delle notifiche push.
 * iOS impone vincoli specifici: le push funzionano SOLO se la PWA e' installata
 * in schermata Home (display: standalone), iOS 16.4+.
 */

/** Vero su iPhone/iPad (incluso iPadOS che si maschera da macOS). */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIphoneIpod = /iPhone|iPad|iPod/i.test(ua);
  // iPadOS 13+ si presenta come "MacIntel" ma ha il touch.
  const isIpadOs =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return isIphoneIpod || isIpadOs;
}

/** Vero quando l'app gira installata (standalone), non nel browser. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  // Proprieta' non standard di Safari iOS.
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayModeStandalone || iosStandalone;
}

/** Vero se il browser corrente espone le API necessarie alle push. */
export function canUsePush(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}
