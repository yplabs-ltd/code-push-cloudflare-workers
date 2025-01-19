export function generateKey(prefix = ""): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const key = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return prefix + key;
}

export function generateSecureId(): string {
  return generateKey();
}

export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sanitizeString(input: string): string {
  return input.replace(/[^a-zA-Z0-9\-_]/g, "");
}

export const VALID_KEY_REGEX = /^[a-zA-Z0-9\-_]{10,}$/;

export function isValidKey(key: string): boolean {
  return VALID_KEY_REGEX.test(key);
}

export function maskAccessKey(key: string): string {
  if (key.length <= 8) return "*".repeat(key.length);
  return key.substring(0, 4) + "*".repeat(key.length - 8) + key.slice(-4);
}

export const ACCESS_KEY_PREFIX = "ck_";
export const DEPLOYMENT_KEY_PREFIX = "dk_";

export function generateAccessKey(): string {
  return generateKey(ACCESS_KEY_PREFIX);
}

export function generateDeploymentKey(): string {
  return generateKey(DEPLOYMENT_KEY_PREFIX);
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isSecurePassword(password: string): boolean {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChars
  );
}

export function generateSessionId(): string {
  return `session_${generateKey()}`;
}

// Rate limiting helper
export class RateLimiter {
  private readonly store: Map<string, number[]>;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.store = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isRateLimited(key: string): boolean {
    const now = Date.now();
    const timestamps = this.store.get(key) || [];

    // Remove old timestamps
    const validTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    if (validTimestamps.length >= this.maxRequests) {
      return true;
    }

    validTimestamps.push(now);
    this.store.set(key, validTimestamps);

    return false;
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

// Content security helpers
export function sanitizeHtml(html: string): string {
  return html
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const SECURE_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
} as const;
