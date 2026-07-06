import * as SecureStore from 'expo-secure-store';
import { SESSION_TOKEN_KEY } from './AuthService';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Response from POST /payment/create-order */
export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  /** UPI Intent deep-link URL to open a compatible UPI app (Req 4.3). */
  upiDeepLink: string;
  /** Razorpay key ID for the mobile SDK. */
  keyId: string;
}

/** A single payment receipt entry from GET /payment/receipts */
export interface PaymentReceipt {
  id: string;
  razorpayTxnId: string;
  amountPaise: number;
  status: string;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  receivedAt: string;
}

/** Response from GET /payment/receipts */
export interface ReceiptsResponse {
  receipts: PaymentReceipt[];
  /** Set when no records exist (Req 11.3). */
  message?: string;
}

// ─── API base URL ─────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retrieves the stored session token and builds an Authorization header. */
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
 * Creates a Razorpay order and returns the UPI Intent deep-link.
 * Calls `POST /payment/create-order`.
 *
 * @throws {Error} on network error or non-2xx response.
 */
export async function createOrder(): Promise<CreateOrderResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/payment/create-order`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Create order failed (${response.status})`);
  }

  return response.json() as Promise<CreateOrderResponse>;
}

/**
 * Fetches payment receipts for the authenticated user.
 * Calls `GET /payment/receipts`.
 *
 * @throws {LedgerUnavailableError} when the server returns 503 (Req 11.2).
 * @throws {Error} on network error or other non-2xx responses.
 */
export class LedgerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerUnavailableError';
  }
}

export async function getReceipts(): Promise<ReceiptsResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/payment/receipts`, {
    method: 'GET',
    headers,
  });

  if (response.status === 503) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new LedgerUnavailableError(
      body.message ?? 'Payment records are temporarily unavailable. Please try again.',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Get receipts failed (${response.status})`);
  }

  return response.json() as Promise<ReceiptsResponse>;
}
