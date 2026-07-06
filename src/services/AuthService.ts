import * as SecureStore from 'expo-secure-store';

// ─── API response types ──────────────────────────────────────────────────────

/** Successful response from POST /auth/otp/verify */
export interface VerifyOtpResponse {
  /** Bearer token for the authenticated session. */
  token: string;
  /**
   * The role assigned to the user, if one has already been set.
   * Absent (undefined) for first-time users who must select a role.
   */
  role?: 'seeker' | 'recruiter';
}

// ─── Secure-store keys ───────────────────────────────────────────────────────
/** The key under which the session bearer token is stored on-device. */
export const SESSION_TOKEN_KEY = 'hirarozgar_session_token';

/** The key under which cached profile data is stored on-device. */
export const PROFILE_DATA_KEY = 'hirarozgar_profile_data';

/** The key under which personal info (e.g. name, phone) is stored on-device. */
export const PERSONAL_INFO_KEY = 'hirarozgar_personal_info';

/** All secure-store keys managed by this service. */
const ALL_SECURE_KEYS: string[] = [SESSION_TOKEN_KEY, PROFILE_DATA_KEY, PERSONAL_INFO_KEY];

// ─── API base URL ────────────────────────────────────────────────────────────
// In production, replace with the real server URL via environment config.
// For development, Expo defaults to the host machine at port 3000.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Timeout ─────────────────────────────────────────────────────────────────
/** Maximum time (ms) to wait for the sign-out API call before proceeding. */
const SIGNOUT_API_TIMEOUT_MS = 10_000;

/**
 * Mobile AuthService — handles client-side auth operations including
 * persisting session tokens, calling the server sign-out endpoint, and
 * clearing all locally cached credentials.
 */

/**
 * Retrieves the stored session token from secure storage.
 * Returns `null` if no token is stored or if the store is unavailable.
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists a session token to secure storage.
 */
export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

// ─── OTP / Auth API calls ─────────────────────────────────────────────────────

/**
 * Sends a 6-digit OTP via SMS to the given mobile number.
 * Calls `POST /auth/otp/send` with `{ mobile }`.
 *
 * @throws {Error} with a descriptive `message` on network error or non-2xx response.
 */
export async function sendOtp(mobile: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Send OTP failed (${response.status})`);
  }
}

/**
 * Verifies a 6-digit OTP for the given mobile number.
 * Calls `POST /auth/otp/verify` with `{ mobile, otp }`.
 *
 * On success, persists the returned session token to secure storage and
 * returns the full response so the caller can decide where to navigate.
 *
 * @throws {Error} with a descriptive `message` on network error, non-2xx
 *   response, or a server-signalled lock (the API returns a specific message
 *   when the account has been locked after 3 wrong attempts).
 */
export async function verifyOtp(mobile: string, otp: string): Promise<VerifyOtpResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, otp }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as {
      message?: string;
      locked?: boolean;
    };
    const err = new Error(body.message ?? `Verify OTP failed (${response.status})`);
    // Attach a `locked` flag so the screen can differentiate a lockout response
    (err as Error & { locked?: boolean }).locked = body.locked === true;
    throw err;
  }

  const data = await response.json() as VerifyOtpResponse;

  // Persist the session token securely (Req 2.8)
  await storeToken(data.token);

  return data;
}

/**
 * `AuthService.signOut` — implements Req 10.1–10.4.
 *
 * Steps:
 *  1. Read the stored session token.
 *  2. Call `POST /auth/signout` to invalidate the server-side session
 *     within 10 s (Req 10.1). A missing token or server error does not
 *     block the remaining steps.
 *  3. Clear ALL locally stored secure-store keys (Req 10.2, 10.4).
 *     Any individual cleanup failure is silently swallowed (Req 10.3).
 *
 * The caller is responsible for navigating to the Welcome Screen after
 * this function resolves, regardless of whether it threw.
 *
 * This function NEVER throws — it completes the cleanup steps and
 * returns, even when the server call fails or local deletion fails.
 */
export async function signOut(): Promise<void> {
  // --- Step 1: Read stored token ---
  const token = await getStoredToken();

  // --- Step 2: Invalidate server-side session (Req 10.1) ---
  if (token) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SIGNOUT_API_TIMEOUT_MS);

      await fetch(`${API_BASE_URL}/auth/signout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch {
      // Server call failed or timed out — still proceed to local cleanup.
      // Req 10.3: no error is surfaced to the user.
    }
  }

  // --- Step 3: Clear all local secure-store keys (Req 10.2, 10.4) ---
  // Each deletion is attempted independently; any failure is silently ignored (Req 10.3).
  await Promise.allSettled(
    ALL_SECURE_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
  );
}
