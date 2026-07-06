/**
 * SettingsPanel.test.tsx
 *
 * Unit tests for the SettingsPanel component covering all five sub-features:
 *  1. Language selector → changeLocale() — Req 1.5
 *  2. Theme toggle → setTheme() — Req 9.1
 *  3. Edit Profile → onEditProfile() — Req 3.5
 *  4. Payment Receipts → GET /payment/receipts — Req 11.1–11.3
 *  5. Sign Out → POST /auth/signout — Req 10.1–10.4
 *
 * NOTE: @testing-library/react-native@14 uses async render() and async
 * fireEvent. Every render() and fireEvent call must be awaited.
 * We use the render() return value directly (not the global `screen`)
 * to avoid race conditions with the global screen singleton.
 */

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { SettingsPanel } from './SettingsPanel';
import * as AuthService from '../services/AuthService';
import * as PaymentService from '../services/PaymentService';

// Mock the services
jest.mock('../services/AuthService');
jest.mock('../services/PaymentService');

// Mock the hooks
const mockChangeLocale = jest.fn();
const mockSetTheme = jest.fn();

jest.mock('../hooks/useLocale', () => ({
  useLocale: () => ({
    locale: 'gu-IN' as const,
    changeLocale: mockChangeLocale,
  }),
}));

jest.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light' as const,
    tokens: {
      background: '#FFFFFF',
      backgroundSecondary: '#F5F5F5',
      surface: '#FAFAFA',
      textPrimary: '#212121',
      textSecondary: '#757575',
      textDisabled: '#BDBDBD',
      primary: '#2196F3',
      error: '#F44336',
      success: '#4CAF50',
      warning: '#FF9800',
      border: '#E0E0E0',
    },
    setTheme: mockSetTheme,
  }),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Icon component
jest.mock('./Icon', () => ({
  Icon: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID}>{`Icon:${name}`}</Text>;
  },
}));

const mockOnSignedOut = jest.fn();
const mockOnEditProfile = jest.fn();

// Convenience: render the panel and return query helpers bound to that instance
async function renderPanel() {
  return render(
    <SettingsPanel onSignedOut={mockOnSignedOut} onEditProfile={mockOnEditProfile} />,
  );
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Manual cleanup since RNTL auto-cleanup is disabled globally (via jest.setup.js).
  afterEach(async () => {
    await cleanup();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── 1. Language Selector Tests (Req 1.5) ─────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  describe('Language Selector', () => {
    it('should render all three language buttons', async () => {
      const { getByTestId } = await renderPanel();

      expect(getByTestId('lang-btn-gu-IN')).toBeTruthy();
      expect(getByTestId('lang-btn-hi-IN')).toBeTruthy();
      expect(getByTestId('lang-btn-en-IN')).toBeTruthy();
    });

    it('should call changeLocale when a language button is pressed', async () => {
      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('lang-btn-hi-IN'));

      expect(mockChangeLocale).toHaveBeenCalledWith('hi-IN');
      expect(mockChangeLocale).toHaveBeenCalledTimes(1);
    });

    it('should call changeLocale with correct locale for each button', async () => {
      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('lang-btn-gu-IN'));
      expect(mockChangeLocale).toHaveBeenCalledWith('gu-IN');

      await fireEvent.press(getByTestId('lang-btn-hi-IN'));
      expect(mockChangeLocale).toHaveBeenCalledWith('hi-IN');

      await fireEvent.press(getByTestId('lang-btn-en-IN'));
      expect(mockChangeLocale).toHaveBeenCalledWith('en-IN');

      expect(mockChangeLocale).toHaveBeenCalledTimes(3);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── 2. Theme Toggle Tests (Req 9.1) ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  describe('Theme Toggle', () => {
    it('should render the theme toggle switch', async () => {
      const { getByTestId } = await renderPanel();

      expect(getByTestId('theme-toggle-switch')).toBeTruthy();
    });

    it('should call setTheme with "dark" when switch is toggled on', async () => {
      mockSetTheme.mockResolvedValue(undefined);
      const { getByTestId } = await renderPanel();

      await fireEvent(getByTestId('theme-toggle-switch'), 'valueChange', true);

      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith('dark');
      });
    });

    it('should call setTheme with "light" when switch is toggled off', async () => {
      mockSetTheme.mockResolvedValue(undefined);
      const { getByTestId } = await renderPanel();

      await fireEvent(getByTestId('theme-toggle-switch'), 'valueChange', false);

      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith('light');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── 3. Edit Profile Tests (Req 3.5) ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  describe('Edit Profile', () => {
    it('should render the edit profile button', async () => {
      const { getByTestId } = await renderPanel();

      expect(getByTestId('edit-profile-btn')).toBeTruthy();
    });

    it('should call onEditProfile when edit profile button is pressed', async () => {
      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('edit-profile-btn'));

      expect(mockOnEditProfile).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── 4. Payment Receipts Tests (Req 11.1–11.3) ─────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  describe('Payment Receipts', () => {
    it('should render the payment receipts toggle button', async () => {
      const { getByTestId } = await renderPanel();

      expect(getByTestId('payment-receipts-toggle')).toBeTruthy();
    });

    it('should show loading state when receipts panel is opened', async () => {
      const mockGetReceipts = jest.spyOn(PaymentService, 'getReceipts')
        .mockImplementation(() => new Promise(() => {})); // Never resolves

      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('payment-receipts-toggle'));

      await waitFor(() => {
        expect(getByTestId('receipts-loading')).toBeTruthy();
      });

      mockGetReceipts.mockRestore();
    });

    it('should fetch and display receipts when panel is opened (Req 11.1)', async () => {
      const mockReceipts: PaymentService.PaymentReceipt[] = [
        {
          id: 'receipt-1',
          razorpayTxnId: 'txn_123456',
          amountPaise: 4900,
          status: 'success',
          subscriptionStart: '2024-01-01T00:00:00Z',
          subscriptionEnd: '2024-01-31T23:59:59Z',
          receivedAt: '2024-01-01T10:30:00Z',
        },
        {
          id: 'receipt-2',
          razorpayTxnId: 'txn_789012',
          amountPaise: 4900,
          status: 'success',
          subscriptionStart: '2024-02-01T00:00:00Z',
          subscriptionEnd: '2024-02-29T23:59:59Z',
          receivedAt: '2024-02-01T11:45:00Z',
        },
      ];

      const mockGetReceipts = jest.spyOn(PaymentService, 'getReceipts')
        .mockResolvedValue({ receipts: mockReceipts });

      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('payment-receipts-toggle'));

      await waitFor(() => {
        expect(getByTestId('receipts-list')).toBeTruthy();
        expect(getByTestId('receipt-receipt-1')).toBeTruthy();
        expect(getByTestId('receipt-receipt-2')).toBeTruthy();
      });

      expect(mockGetReceipts).toHaveBeenCalledTimes(1);
      mockGetReceipts.mockRestore();
    });

    it('should display empty state when no receipts exist (Req 11.3)', async () => {
      const mockGetReceipts = jest.spyOn(PaymentService, 'getReceipts')
        .mockResolvedValue({ receipts: [] });

      const { getByTestId, getByText } = await renderPanel();

      await fireEvent.press(getByTestId('payment-receipts-toggle'));

      await waitFor(() => {
        expect(getByTestId('receipts-empty')).toBeTruthy();
        expect(getByText('noPaymentHistory')).toBeTruthy();
      });

      mockGetReceipts.mockRestore();
    });

    it('should display error with retry button when ledger is unavailable (Req 11.2)', async () => {
      const mockGetReceipts = jest.spyOn(PaymentService, 'getReceipts')
        .mockRejectedValue(new PaymentService.LedgerUnavailableError('Ledger unavailable'));

      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('payment-receipts-toggle'));

      await waitFor(() => {
        expect(getByTestId('receipts-error')).toBeTruthy();
        expect(getByTestId('receipts-retry-btn')).toBeTruthy();
      });

      mockGetReceipts.mockRestore();
    });

    it('should retry fetching receipts when retry button is pressed (Req 11.2)', async () => {
      const mockGetReceipts = jest.spyOn(PaymentService, 'getReceipts')
        .mockRejectedValueOnce(new PaymentService.LedgerUnavailableError('Ledger unavailable'))
        .mockResolvedValueOnce({ receipts: [] });

      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('payment-receipts-toggle'));

      await waitFor(() => {
        expect(getByTestId('receipts-error')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('receipts-retry-btn'));

      await waitFor(() => {
        expect(getByTestId('receipts-empty')).toBeTruthy();
      });

      expect(mockGetReceipts).toHaveBeenCalledTimes(2);
      mockGetReceipts.mockRestore();
    });

    it('should not show stale data during retry (Req 11.2)', async () => {
      const mockReceipts: PaymentService.PaymentReceipt[] = [
        {
          id: 'receipt-1',
          razorpayTxnId: 'txn_123',
          amountPaise: 4900,
          status: 'success',
          subscriptionStart: '2024-01-01T00:00:00Z',
          subscriptionEnd: '2024-01-31T23:59:59Z',
          receivedAt: '2024-01-01T10:30:00Z',
        },
      ];

      const mockGetReceipts = jest.spyOn(PaymentService, 'getReceipts')
        .mockResolvedValueOnce({ receipts: mockReceipts })
        .mockRejectedValueOnce(new PaymentService.LedgerUnavailableError('Ledger unavailable'));

      const { getByTestId, queryByTestId } = await renderPanel();

      // Open panel - first call succeeds
      await fireEvent.press(getByTestId('payment-receipts-toggle'));
      await waitFor(() => {
        expect(getByTestId('receipts-list')).toBeTruthy();
      });

      // Close panel
      await fireEvent.press(getByTestId('payment-receipts-toggle'));
      await waitFor(() => {
        expect(queryByTestId('receipts-list')).toBeNull();
      });

      // Reopen - second call fails
      await fireEvent.press(getByTestId('payment-receipts-toggle'));
      await waitFor(() => {
        expect(getByTestId('receipts-error')).toBeTruthy();
      });

      expect(queryByTestId('receipts-list')).toBeNull();
      expect(queryByTestId('receipt-receipt-1')).toBeNull();

      mockGetReceipts.mockRestore();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── 5. Sign Out Tests (Req 10.1–10.4) ─────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  describe('Sign Out', () => {
    it('should render the sign out button', async () => {
      const { getByTestId } = await renderPanel();

      expect(getByTestId('sign-out-btn')).toBeTruthy();
    });

    it('should call signOut and onSignedOut when sign out button is pressed', async () => {
      const mockSignOut = jest.spyOn(AuthService, 'signOut')
        .mockResolvedValue(undefined);

      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('sign-out-btn'));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
        expect(mockOnSignedOut).toHaveBeenCalledTimes(1);
      });

      mockSignOut.mockRestore();
    });

    it('should show loading indicator during sign out', async () => {
      let resolveSignOut: () => void;
      const mockSignOut = jest.spyOn(AuthService, 'signOut')
        .mockImplementation(() => new Promise<void>((resolve) => { resolveSignOut = resolve; }));

      const { getByTestId } = await renderPanel();

      // Start sign-out without awaiting — we need to check busy state mid-flight
      const pressPromise = fireEvent.press(getByTestId('sign-out-btn'));

      // The sign-out mock holds — button should become busy
      await waitFor(() => {
        expect(getByTestId('sign-out-btn').props.accessibilityState?.busy).toBe(true);
      });

      // Release the sign-out mock and let it complete
      resolveSignOut!();
      await pressPromise;

      await waitFor(() => {
        expect(mockOnSignedOut).toHaveBeenCalled();
      });

      mockSignOut.mockRestore();
    });

    it('should call onSignedOut even if signOut fails (Req 10.3)', async () => {
      const mockSignOut = jest.spyOn(AuthService, 'signOut')
        .mockRejectedValue(new Error('Network error'));

      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('sign-out-btn'));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
        expect(mockOnSignedOut).toHaveBeenCalledTimes(1);
      });

      mockSignOut.mockRestore();
    });

    it('should disable sign out button while signing out to prevent double-tap', async () => {
      let resolveSignOut: () => void;
      const mockSignOut = jest.spyOn(AuthService, 'signOut')
        .mockImplementation(() => new Promise<void>((resolve) => { resolveSignOut = resolve; }));

      const { getByTestId } = await renderPanel();

      const signOutButton = getByTestId('sign-out-btn');

      // Start first press — doesn't await so subsequent presses can happen while busy
      const firstPress = fireEvent.press(signOutButton);

      // Wait until sign-out is in progress (button disabled/busy)
      await waitFor(() => {
        expect(signOutButton.props.accessibilityState?.busy).toBe(true);
      });

      // Additional presses while sign-out is in flight — should be no-ops
      await fireEvent.press(signOutButton);
      await fireEvent.press(signOutButton);

      // Resolve the sign-out and wait for completion
      resolveSignOut!();
      await firstPress;

      await waitFor(() => {
        expect(mockOnSignedOut).toHaveBeenCalled();
      });

      // signOut should only have been called once despite multiple presses
      expect(mockSignOut).toHaveBeenCalledTimes(1);

      mockSignOut.mockRestore();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── Integration Tests ─────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration', () => {
    it('should render all five settings sub-features', async () => {
      const { getByTestId } = await renderPanel();

      expect(getByTestId('lang-btn-gu-IN')).toBeTruthy();
      expect(getByTestId('theme-toggle-switch')).toBeTruthy();
      expect(getByTestId('edit-profile-btn')).toBeTruthy();
      expect(getByTestId('payment-receipts-toggle')).toBeTruthy();
      expect(getByTestId('sign-out-btn')).toBeTruthy();
    });

    it('should allow interacting with multiple features independently', async () => {
      mockSetTheme.mockResolvedValue(undefined);
      const mockSignOut = jest.spyOn(AuthService, 'signOut')
        .mockResolvedValue(undefined);

      const { getByTestId } = await renderPanel();

      await fireEvent.press(getByTestId('lang-btn-en-IN'));
      expect(mockChangeLocale).toHaveBeenCalledWith('en-IN');

      await fireEvent(getByTestId('theme-toggle-switch'), 'valueChange', true);
      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith('dark');
      });

      await fireEvent.press(getByTestId('edit-profile-btn'));
      expect(mockOnEditProfile).toHaveBeenCalledTimes(1);

      expect(mockChangeLocale).toHaveBeenCalledTimes(1);
      expect(mockSetTheme).toHaveBeenCalledTimes(1);
      expect(mockOnEditProfile).toHaveBeenCalledTimes(1);

      mockSignOut.mockRestore();
    });
  });
});
