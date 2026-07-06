import * as SecureStore from 'expo-secure-store';
import { SESSION_TOKEN_KEY } from './AuthService';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Response from GET /autocomplete */
export interface AutocompleteResponse {
  suggestions: string[];
}

// ─── API base URL ─────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retrieves the stored session token and builds an Authorization header.
 * Throws if no token is found.
 */
async function getAuthHeaders(): Promise<{ Authorization: string }> {
  const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  if (!token) {
    throw new Error('No session token found. Please sign in again.');
  }
  return { Authorization: `Bearer ${token}` };
}

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Fetches autocomplete suggestions from the Master Dictionary.
 *
 * Calls `GET /autocomplete?q=<query>` and returns the list of matching title
 * strings.  Results are returned within 300 ms on the server side thanks to
 * the GIN trigram index (Req 5.2, 6.6).
 *
 * Use this in:
 *   - The job posting form's title field (Recruiter, Req 5.2).
 *   - The Raise Inquiry form's skills field (Job Seeker, Req 6.6).
 *
 * @param query  The characters typed by the user.  An empty string returns an
 *               empty suggestions array without making a network request.
 *
 * @throws {Error} on network error or non-2xx response.
 */
export async function getAutocompleteSuggestions(query: string): Promise<string[]> {
  const q = query.trim();

  // Avoid unnecessary network round-trips for empty input
  if (q.length === 0) {
    return [];
  }

  const headers = await getAuthHeaders();

  const url = `${API_BASE_URL}/autocomplete?q=${encodeURIComponent(q)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Autocomplete request failed (${response.status})`);
  }

  const data = (await response.json()) as AutocompleteResponse;
  return data.suggestions;
}
