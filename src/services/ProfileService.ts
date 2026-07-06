import * as SecureStore from 'expo-secure-store';
import { SESSION_TOKEN_KEY } from './AuthService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = 'seeker' | 'recruiter';

export interface SeekerProfile {
  full_name: string | null;
  age: number | null;
  experience_years: number | null;
  experience_months: number | null;
}

export interface RecruiterProfile {
  company_name: string | null;
  contact_name: string | null;
  alt_phone: string | null;
  office_address: string | null;
}

export type ProfileData = SeekerProfile | RecruiterProfile;

export interface UserProfileResponse {
  userId: string;
  role: Role;
  profile: ProfileData | null;
}

export interface FieldError {
  field: string;
  message: string;
}

// ─── API base URL ─────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retrieves the stored session token and builds an Authorization header.
 * Throws if no token is found (user should not be on a profile screen).
 */
async function getAuthHeaders(): Promise<{ Authorization: string; 'Content-Type': string }> {
  const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  if (!token) {
    throw new Error('No session token found. Please sign in again.');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Assigns the user's role (first-time only).
 * Calls `POST /profile/role`.
 *
 * @throws {Error} with message on network error, non-2xx, or 409 Conflict.
 */
export async function assignRole(role: Role): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/profile/role`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Assign role failed (${response.status})`);
  }
}

/**
 * Fetches the authenticated user's profile.
 * Calls `GET /profile`.
 *
 * @throws {Error} on network error or non-2xx response.
 */
export async function getProfile(): Promise<UserProfileResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Get profile failed (${response.status})`);
  }

  return response.json() as Promise<UserProfileResponse>;
}

/**
 * Updates the authenticated user's profile fields.
 * Calls `PUT /profile`.
 *
 * @throws {FieldValidationError} when the server returns 400 with field errors.
 * @throws {Error} on network error or other non-2xx responses.
 */
export class FieldValidationError extends Error {
  readonly fields: FieldError[];

  constructor(fields: FieldError[]) {
    super('Profile validation failed.');
    this.name = 'FieldValidationError';
    this.fields = fields;
  }
}

export async function updateProfile(data: Partial<ProfileData>): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (response.status === 400) {
    const body = await response.json().catch(() => ({})) as {
      error?: string;
      fields?: FieldError[];
    };
    if (body.fields && body.fields.length > 0) {
      throw new FieldValidationError(body.fields);
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Update profile failed (${response.status})`);
  }
}
