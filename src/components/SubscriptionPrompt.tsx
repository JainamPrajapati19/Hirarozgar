/**
 * SubscriptionPrompt — modal overlay shown when a gated action is attempted
 * without an active subscription.
 *
 * Implements:
 *   - Req 4.1: Job Seeker without active subscription → shows ₹49/month fee
 *   - Req 4.2: Recruiter without active subscription → shows ₹99/month fee
 *   - Req 4.3: "Pay Now" triggers UPI Intent deep-link within 3 s;
 *              shows "No UPI app found" error when no compatible app is installed
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { createOrder } from '../services/PaymentService';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Subscription fees by role (Req 4.1, 4.2). */
const MONTHLY_FEES: Record<string, string> = {
  seeker:    '₹49',
  recruiter: '₹99',
};

/** Timeout in ms within which the UPI app should launch (Req 4.3). */
const UPI_LAUNCH_TIMEOUT_MS = 3_000;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SubscriptionPromptProps {
  /** Whether the modal is visible. */
  visible: boolean;
  /**
   * The user's role — determines the fee shown.
   * If null/undefined, defaults to the seeker fee (₹49).
   */
  role: 'seeker' | 'recruiter' | null | undefined;
  /**
   * Called when the user dismisses the prompt (taps outside or Cancel).
   * The parent should set `visible = false` in response.
   */
  onDismiss: () => void;
  /**
   * Called after a payment order is successfully created and the UPI app
   * was launched (or attempted). The parent can use this to show a "waiting
   * for payment" state if needed.
   */
  onPaymentInitiated?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SubscriptionPrompt
 *
 * A modal overlay that:
 * 1. Displays the role-appropriate monthly fee (₹49 or ₹99).
 * 2. Shows a "Pay Now" button.
 * 3. On "Pay Now": calls POST /payment/create-order, then opens the UPI Intent
 *    deep-link via Linking.openURL within 3 s (Req 4.3).
 * 4. If no UPI app is installed: displays "No UPI app found" error (Req 4.3).
 * 5. Triggered from any gated-action attempt when subscription is inactive.
 */
export function SubscriptionPrompt({
  visible,
  role,
  onDismiss,
  onPaymentInitiated,
}: SubscriptionPromptProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive the fee label from role (Req 4.1, 4.2)
  const feeLabel = MONTHLY_FEES[role ?? 'seeker'] ?? MONTHLY_FEES['seeker']!;

  // Reset error state when prompt is dismissed/re-opened
  const handleDismiss = useCallback(() => {
    setError(null);
    setLoading(false);
    onDismiss();
  }, [onDismiss]);

  // ─── Pay Now handler ────────────────────────────────────────────────────────
  const handlePayNow = useCallback(async () => {
    if (loading) return;

    setError(null);
    setLoading(true);

    // Race the whole flow against the 3-second UPI launch deadline (Req 4.3)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('upi_timeout')),
        UPI_LAUNCH_TIMEOUT_MS,
      ),
    );

    try {
      // Step 1: Create order and get UPI deep-link from the server
      const order = await Promise.race([createOrder(), timeoutPromise]);

      // Step 2: Open UPI deep-link (Req 4.3)
      const canOpen = await Linking.canOpenURL(order.upiDeepLink);

      if (!canOpen) {
        // Req 4.3: no compatible UPI app installed
        setError(t('noUpiApp'));
        setLoading(false);
        return;
      }

      await Promise.race([Linking.openURL(order.upiDeepLink), timeoutPromise]);

      // UPI app launched successfully
      setLoading(false);
      onPaymentInitiated?.();
    } catch (err) {
      setLoading(false);

      if (err instanceof Error) {
        if (err.message === 'upi_timeout') {
          // Timed out — treat as no UPI app to surface an actionable message
          setError(t('noUpiApp'));
          return;
        }

        // Check if the error is from Linking (no UPI app installed on Android/iOS)
        // Both platforms throw when the scheme is not handled
        const msg = err.message.toLowerCase();
        if (
          msg.includes('no activity found') ||
          msg.includes('unable to open url') ||
          msg.includes('unsupported url') ||
          msg.includes('cannotopenurlscheme')
        ) {
          setError(t('noUpiApp'));
          return;
        }

        setError(err.message);
      } else {
        setError(t('error'));
      }
    }
  }, [loading, t, onPaymentInitiated]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
      accessible
      accessibilityViewIsModal
    >
      {/* Backdrop — tapping it dismisses the prompt */}
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: tokens.overlay }]}
        onPress={handleDismiss}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={t('cancel')}
        testID="subscription-prompt-backdrop"
      >
        {/* Card — stop tap propagation so tapping the card doesn't dismiss */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: tokens.card }]}
          activeOpacity={1}
          onPress={() => undefined /* Swallow taps on the card */}
          testID="subscription-prompt-card"
        >

          {/* ── Header icon ── */}
          <View style={styles.iconRow}>
            <Icon
              name="subscription"
              size={44}
              color={tokens.primary}
              testID="subscription-prompt-icon"
            />
          </View>

          {/* ── Title ── */}
          <Text
            style={[styles.title, { color: tokens.textPrimary }]}
            testID="subscription-prompt-title"
          >
            {t('subscriptionRequired')}
          </Text>

          {/* ── Fee display (role-appropriate) ── */}
          <View style={styles.feeRow}>
            <Icon
              name="payment"
              size={20}
              color={tokens.textSecondary}
              testID="subscription-prompt-payment-icon"
            />
            <Text
              style={[styles.feeLabel, { color: tokens.textSecondary }]}
              testID="subscription-prompt-fee-label"
            >
              {t('monthlyFee')}:
            </Text>
            <Text
              style={[styles.feeAmount, { color: tokens.primary }]}
              testID="subscription-prompt-fee-amount"
            >
              {feeLabel}/{t('months').toLowerCase()}
            </Text>
          </View>

          {/* ── Error message (e.g. "No UPI app found") ── */}
          {error ? (
            <View style={styles.errorRow}>
              <Icon
                name="error"
                size={16}
                color={tokens.error}
                testID="subscription-prompt-error-icon"
              />
              <Text
                style={[styles.errorText, { color: tokens.error }]}
                accessibilityRole="alert"
                testID="subscription-prompt-error"
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* ── Pay Now button ── */}
          <TouchableOpacity
            style={[
              styles.payButton,
              {
                backgroundColor: loading ? tokens.primaryDisabled : tokens.primary,
              },
            ]}
            onPress={handlePayNow}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('payNow')}
            accessibilityState={{ disabled: loading, busy: loading }}
            testID="subscription-prompt-pay-button"
          >
            {loading ? (
              <ActivityIndicator color={tokens.background} size="small" />
            ) : (
              <View style={styles.payButtonInner}>
                <Icon name="upi" size={20} color={tokens.background} />
                <Text style={[styles.payButtonText, { color: tokens.background }]}>
                  {t('payNow')}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Cancel button ── */}
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: tokens.border }]}
            onPress={handleDismiss}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            testID="subscription-prompt-cancel-button"
          >
            <Text style={[styles.cancelButtonText, { color: tokens.textSecondary }]}>
              {t('cancel')}
            </Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    gap: 16,
    // Shadow (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    // Shadow (Android)
    elevation: 8,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  feeLabel: {
    fontSize: 15,
  },
  feeAmount: {
    fontSize: 17,
    fontWeight: '700',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    flexWrap: 'wrap',
  },
  payButton: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 4,
  },
  payButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cancelButton: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '400',
  },
});
