const CONSENT_KEY = 'affiliateos_cookie_consent';
const GTAG_ID = 'AW-18497812603';

export type ConsentState = 'accepted' | 'declined' | null;

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: 'accepted' | 'declined'): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // storage unavailable
  }
  if (value === 'accepted') loadAnalytics();
}

let analyticsLoaded = false;

/** Loads Google tag ONLY after the visitor has accepted. Nothing loads before consent. */
export function loadAnalytics(): void {
  if (analyticsLoaded || getConsent() !== 'accepted') return;
  analyticsLoaded = true;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () { w.dataLayer.push(arguments); };
  w.gtag('js', new Date());
  w.gtag('config', GTAG_ID);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
  document.head.appendChild(s);
}
