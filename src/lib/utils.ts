import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ----- Quota / Persistence helpers -----

type QuotaInfo = {
  usage: number; // bytes
  quota: number; // bytes
  persisted: boolean;
};

export function isFirefox(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /firefox/i.test(navigator.userAgent);
}

export function toGiB(bytes: number) {
  return bytes / (1024 ** 3);
}

export async function getQuotaInfo(): Promise<QuotaInfo> {
  const est = await navigator.storage?.estimate?.();
  const persisted = await navigator.storage?.persisted?.();
  return {
    usage: est?.usage ?? 0,
    quota: est?.quota ?? 0,
    persisted: !!persisted,
  };
}

/**
 * Requests persistent storage if not already granted.
 * Returns true if the origin is persisted after this call.
 */
export async function ensurePersistentStorage(
  confirmPrompt?: () => Promise<boolean> | boolean
): Promise<boolean> {
  if (!('storage' in navigator) || !navigator.storage?.persist) return false;

  const already = await navigator.storage.persisted?.();
  if (already) return true;

  // Ask the user. You can replace this with a custom modal.
  let okToAsk = true;
  if (confirmPrompt) {
    okToAsk = await confirmPrompt();
  } else if (typeof window !== 'undefined' && 'confirm' in window) {
    okToAsk = window.confirm(
      'Allow this app to use persistent storage? This helps store more images and prevents unexpected deletion.'
    );
  }

  if (!okToAsk) return false;

  const granted = await navigator.storage.persist();
  return !!granted;
}

/**
 * Preflight: checks if (current usage + incomingBytes) fits in current quota.
 * If not, tries to get persistent storage once and rechecks.
 * Returns the final QuotaInfo and whether it looks safe to proceed.
 */
export async function preflightQuotaOrPersist(incomingBytes: number, confirmPrompt?: () => Promise<boolean> | boolean) {
  let info = await getQuotaInfo();
  // const fitsNow = info.usage + incomingBytes <= info.quota - (10 * 1024 * 1024); // leave ~10MB headroom

  // if (fitsNow) {
  //   return { info, canProceed: true, requestedPersist: false };
  // }

  // Try to upgrade to persistent storage (esp. helpful on Firefox)
  const persisted = await ensurePersistentStorage(confirmPrompt);
  info = await getQuotaInfo();

  const fitsAfter = info.usage + incomingBytes <= info.quota - (10 * 1024 * 1024);
  return { info, canProceed: fitsAfter, requestedPersist: persisted };
}
