/**
 * Mobile JobService — API client for job vacancy management.
 *
 * Implements:
 *   - Req 5.1: Create vacancy with validation (POST /jobs)
 *   - Req 5.3: New title added to master_dictionary atomically
 *   - Req 5.4: Deactivate / Delete actions on the recruiter's own vacancies
 *   - Req 5.5: Fetching the recruiter's vacancies with live application_count
 *   - Req 6.1: Job feed for seekers (GET /jobs/feed)
 *   - Req 6.2: Apply to vacancy (POST /jobs/:id/apply)
 *   - Req 6.5: Application history (GET /applications/history)
 */

import * as SecureStore from 'expo-secure-store';
import { SESSION_TOKEN_KEY } from './AuthService';

// ─── API base URL ─────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Exported types ───────────────────────────────────────────────────────────

export type JobType = 'chhutak' | 'fixed';
export type VacancyStatus = 'active' | 'inactive';

export interface VacancyWithCount {
  id: string;
  recruiter_id: string;
  title: string;
  salary: string;
  area: string;
  description: string | null;
  job_type: JobType;
  status: VacancyStatus;
  created_at: string;
  updated_at: string;
  application_count: number;
}

// ─── Vacancy creation types ───────────────────────────────────────────────────

export interface VacancyInput {
  title: string;
  salary: number;
  area: string;
  description?: string;
  job_type: JobType;
}

export interface JobVacancy {
  id: string;
  recruiter_id: string;
  title: string;
  salary: string;
  area: string;
  description: string | null;
  job_type: JobType;
  status: VacancyStatus;
  created_at: string;
  updated_at: string;
}

export interface VacancyFieldError {
  field: string;
  message: string;
}

// ─── Feed / seeker types ──────────────────────────────────────────────────────

/**
 * A vacancy as returned by `GET /jobs/feed` (Req 6.1).
 * Includes all fields needed to render a `JobCard`.
 */
export interface FeedVacancy {
  id: string;
  recruiter_id: string;
  title: string;
  salary: string;
  area: string;
  description: string | null;
  job_type: JobType;
  status: VacancyStatus;
  created_at: string;
}

/**
 * A job application record as returned by `POST /jobs/:id/apply` (Req 6.2).
 */
export interface JobApplication {
  id: string;
  seeker_id: string;
  vacancy_id: string;
  applied_at: string;
}

/**
 * A single entry in the application history list (Req 6.5).
 * The `formatted` field is pre-formatted by the server:
 *   "[Job Title] at [Company Name] • Applied on [Date] at [Time]"
 */
export interface ApplicationHistoryItem {
  id: string;
  vacancy_id: string;
  applied_at: string;
  formatted: string;
}

/**
 * Thrown when the seeker has already applied to the vacancy (HTTP 409).
 * Maps to Req 6.3.
 */
export class DuplicateApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateApplicationError';
  }
}

/**
 * Thrown when an active subscription is required (HTTP 402).
 * Maps to Req 6.4.
 */
export class SubscriptionRequiredError extends Error {
  constructor() {
    super('An active subscription is required to apply for jobs.');
    this.name = 'SubscriptionRequiredError';
  }
}

/**
 * Thrown when the server returns field-level validation errors for a vacancy.
 * Maps directly to the HTTP 400 VALIDATION_ERROR response (Req 5.1).
 */
export class VacancyValidationError extends Error {
  readonly fields: VacancyFieldError[];

  constructor(fields: VacancyFieldError[]) {
    super('Vacancy validation failed.');
    this.name = 'VacancyValidationError';
    this.fields = fields;
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
 * Creates a new job vacancy for the authenticated recruiter.
 *
 * Calls `POST /jobs`. On success returns the created vacancy.
 *
 * If the title does not exist in the Master Dictionary the server inserts it
 * atomically with source = 'user_generated' (Req 5.3).
 *
 * @throws {VacancyValidationError} when the server returns field-level errors
 *   (HTTP 400 VALIDATION_ERROR) — Req 5.1.
 * @throws {Error} on network error or other non-2xx response.
 */
export async function createVacancy(data: VacancyInput): Promise<JobVacancy> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (response.status === 400) {
    const body = await response.json().catch(() => ({})) as {
      error?: string;
      fields?: VacancyFieldError[];
      message?: string;
    };
    if (body.error === 'VALIDATION_ERROR' && Array.isArray(body.fields)) {
      throw new VacancyValidationError(body.fields);
    }
    throw new Error(body.message ?? `Failed to create vacancy (${response.status})`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to create vacancy (${response.status})`);
  }

  const result = await response.json() as { vacancy: JobVacancy };
  return result.vacancy;
}

/**
 * Fetches all of the authenticated recruiter's vacancies with live
 * application counts (Req 5.5).
 *
 * Calls `GET /jobs/mine` and returns the list of vacancies.
 *
 * @throws {Error} on network error or non-2xx response.
 */
export async function getMyVacancies(): Promise<VacancyWithCount[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/jobs/mine`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to fetch vacancies (${response.status})`);
  }

  const data = (await response.json()) as { vacancies: VacancyWithCount[] };
  return data.vacancies;
}

/**
 * Sets the specified vacancy's status to 'inactive', removing it from
 * the seeker feed (Req 5.4).
 *
 * Calls `PATCH /jobs/:id/deactivate`.
 *
 * @throws {Error} on network error, 403 Forbidden, 404 Not Found, or other non-2xx.
 */
export async function deactivateVacancy(vacancyId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/jobs/${encodeURIComponent(vacancyId)}/deactivate`, {
    method: 'PATCH',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to deactivate vacancy (${response.status})`);
  }
}

/**
 * Permanently deletes the specified vacancy and its associated applications
 * (Req 5.4).
 *
 * Calls `DELETE /jobs/:id`.
 *
 * @throws {Error} on network error, 403 Forbidden, 404 Not Found, or other non-2xx.
 */
export async function deleteVacancy(vacancyId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/jobs/${encodeURIComponent(vacancyId)}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to delete vacancy (${response.status})`);
  }
}

/**
 * Fetches the job seeker feed of active vacancies (Req 6.1).
 *
 * Calls `GET /jobs/feed`.  The server handles Redis caching and DB fallback
 * transparently (Req 8.1–8.3).
 *
 * @throws {Error} on network error or non-2xx response.
 */
export async function getJobFeed(): Promise<FeedVacancy[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/jobs/feed`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to load job feed (${response.status})`);
  }

  const data = (await response.json()) as { vacancies: FeedVacancy[] };
  return data.vacancies;
}

/**
 * Submits an application for the given vacancy (Req 6.2).
 *
 * Calls `POST /jobs/:id/apply`.
 *
 * @throws {SubscriptionRequiredError} when the seeker is not subscribed (HTTP 402).
 * @throws {DuplicateApplicationError} when already applied (HTTP 409).
 * @throws {Error} on DB/network failure or other non-2xx.
 */
export async function applyToVacancy(vacancyId: string): Promise<JobApplication> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/jobs/${encodeURIComponent(vacancyId)}/apply`,
    {
      method: 'POST',
      headers,
    },
  );

  if (response.status === 402) {
    throw new SubscriptionRequiredError();
  }

  if (response.status === 409) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new DuplicateApplicationError(
      body.message ?? 'You have already applied to this vacancy.',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to apply (${response.status})`);
  }

  const data = (await response.json()) as { application: JobApplication };
  return data.application;
}

/**
 * Fetches the authenticated seeker's application history (Req 6.5).
 *
 * Calls `GET /applications/history`.  Each item has a `formatted` string
 * ready for display.
 *
 * @throws {Error} on network error or non-2xx response.
 */
export async function getApplicationHistory(): Promise<ApplicationHistoryItem[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/applications/history`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Failed to load history (${response.status})`);
  }

  const data = (await response.json()) as { history: ApplicationHistoryItem[] };
  return data.history;
}
