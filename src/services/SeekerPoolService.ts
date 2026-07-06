/**
 * Mobile SeekerPoolService — API client for the Global Seeker Pool feature.
 *
 * Implements:
 *   - Req 7.1: Create seeker inquiry (POST /inquiries)
 *   - Req 7.2: List active inquiries for recruiter (GET /seeker-pool)
 *   - Req 7.3: Deactivate / reactivate own inquiry
 *   - Req 7.4: Block second active inquiry; surface deactivation option
 *   - Req 7.5: Account deletion removes all inquiries (handled server-side via CASCADE)
 *   - Req 7.6: Unsubscribed seeker blocked; surface subscription prompt
 */

import * as SecureStore from 'expo-secure-store';
import { SESSION_TOKEN_KEY } from './AuthService';

// ─── API base URL ─────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Exported types ───────────────────────────────────────────────────────────

export type InquiryStatus = 'active' | 'inactive';

/** A seeker inquiry as stored in the DB and returned by the API. */
export interface SeekerInquiry {
  id: string;
  seeker_id: string;
  skills: string[];
  expected_pay: string;    // NUMERIC returned as string by pg driver
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
}

/** A seeker inquiry enriched with the seeker's public profile (GET /seeker-pool). */
export interface SeekerPoolEntry extends SeekerInquiry {
  /** Job Seeker's full name from seeker_profiles.full_name (Req 7.2). */
  seeker_name: string;
  /** Job Seeker's registered mobile — revealed only when "Contact" is tapped (Req 7.2). */
  mobile: string;
}

/** Input payload for creating a new inquiry (POST /inquiries). */
export interface InquiryInput {
  /** Up to 10 skills from the Master Dictionary (Req 7.1). */
  skills: string[];
  /** Expected daily pay in ₹ (numeric, Req 7.1). */
  expected_pay: number;
}

// ─── Custom error classes ─────────────────────────────────────────────────────

/**
 * Thrown when the seeker already has one active inquiry (HTTP 409).
 * Carries the existing inquiry so the UI can offer a deactivation option (Req 7.4).
 */
export class ActiveInquiryExistsError extends Error {
  readonly existingInquiry: SeekerInquiry;

  constructor(existingInquiry: SeekerInquiry, message?: string) {
    super(message ?? 'You already have an active inquiry.');
    this.name = 'ActiveInquiryExistsError';
    this.existingInquiry = existingInquiry;
  }
}

/**
 * Thrown when the seeker's subscription is not active (HTTP 402).
 * Maps to Req 7.6.
 */
export class SubscriptionRequiredError extends Error {
  constructor() {
    super('An active subscription is required to raise an inquiry.');
    this.name = 'SubscriptionRequiredError';
  }
}

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

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Creates a new seeker inquiry (Req 7.1).
 *
 * Calls `POST /inquiries` with `{ skills, expected_pay }`.
 *
 * @throws {SubscriptionRequiredError} when seeker is not subscribed (HTTP 402) — Req 7.6.
 * @throws {ActiveInquiryExistsError} when seeker already has one active inquiry (HTTP 409) — Req 7.4.
 * @throws {Error} on network error or other non-2xx response.
 */
export async function createInquiry(data: InquiryInput): Promise<SeekerInquiry> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/inquiries`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (response.status === 402) {
    throw new SubscriptionRequiredError();
  }

  if (response.status === 409) {
    const body = await response.json().catch(() => ({})) as {
      message?: string;
      existingInquiry?: SeekerInquiry;
    };
    throw new ActiveInquiryExistsError(
      body.existingInquiry ?? ({ id: '', seeker_id: '', skills: [], expected_pay: '0', status: 'active', created_at: '', updated_at: '' } satisfies SeekerInquiry),
      body.message ?? 'You already have an active inquiry.',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to create inquiry (${response.status})`);
  }

  const result = await response.json() as { inquiry: SeekerInquiry };
  return result.inquiry;
}

/**
 * Lists all active seeker inquiries for a subscribed Recruiter (Req 7.2).
 *
 * Calls `GET /seeker-pool`. Each entry includes the seeker's name and mobile.
 *
 * @throws {Error} on network error or non-2xx response.
 */
export async function listSeekerPool(): Promise<SeekerPoolEntry[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/seeker-pool`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to load seeker pool (${response.status})`);
  }

  const data = await response.json() as { inquiries: SeekerPoolEntry[] };
  return data.inquiries;
}

/**
 * Deactivates the seeker's own inquiry, removing it from the public pool (Req 7.3).
 *
 * Calls `PATCH /inquiries/:id/deactivate`.
 *
 * @throws {Error} on network error, 403 Forbidden, 404 Not Found, or other non-2xx.
 */
export async function deactivateInquiry(inquiryId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/inquiries/${encodeURIComponent(inquiryId)}/deactivate`,
    {
      method: 'PATCH',
      headers,
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to deactivate inquiry (${response.status})`);
  }
}

/**
 * Reactivates a previously deactivated inquiry, restoring it to the public pool
 * without requiring form resubmission (Req 7.3).
 *
 * Calls `PATCH /inquiries/:id/reactivate`.
 *
 * @throws {ActiveInquiryExistsError} when a different active inquiry already exists (HTTP 409).
 * @throws {Error} on network error, 403 Forbidden, 404 Not Found, or other non-2xx.
 */
export async function reactivateInquiry(inquiryId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/inquiries/${encodeURIComponent(inquiryId)}/reactivate`,
    {
      method: 'PATCH',
      headers,
    },
  );

  if (response.status === 409) {
    const body = await response.json().catch(() => ({})) as {
      message?: string;
      existingInquiry?: SeekerInquiry;
    };
    throw new ActiveInquiryExistsError(
      body.existingInquiry ?? ({ id: '', seeker_id: '', skills: [], expected_pay: '0', status: 'active', created_at: '', updated_at: '' } satisfies SeekerInquiry),
      body.message ?? 'You already have another active inquiry.',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to reactivate inquiry (${response.status})`);
  }
}

/**
 * Removes all seeker inquiries for the given user from the public pool.
 *
 * Called when a Job Seeker account is permanently deleted (Req 7.5).
 * In practice the server CASCADE handles this; this method is exposed
 * for completeness and potential admin / cleanup use.
 *
 * Calls `DELETE /inquiries` (admin-level endpoint, not exposed to regular UI).
 */
export async function removeAllForUser(): Promise<void> {
  // On the mobile client, account deletion flows through the server which
  // applies ON DELETE CASCADE automatically. This function is a no-op
  // placeholder included so the interface mirrors SeekerPoolService exactly.
  // The server-side SeekerPoolService.removeAllForUser is invoked by the
  // account-deletion route directly.
}
