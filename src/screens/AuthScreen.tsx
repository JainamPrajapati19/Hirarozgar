/**
 * AuthScreen — mobile number registration & OTP authentication.
 *
 * Implements:
 *   - Req 2.1  10-digit mobile number validation
 *   - Req 2.3  Inline error for invalid format; OTP not sent on invalid input
 *   - Req 2.5  Wrong OTP error + retry; lock after 3 consecutive failures
 *
 * Two-step flow:
 *   Step 1 — Phone input
 *   Step 2 — OTP entry (6 digits, 10-minute countdown, retry button, lock UI)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { sendOtp, verifyOtp } from '../services/AuthService';

// ─── Constants ────────────────────────────────────────────────────────────────

/** OTP TTL in seconds (10 minutes). */
const OTP_TTL_SECONDS = 10 * 60;

/** Maximum consecutive wrong OTP attempts before the field is locked. */
const MAX_OTP_ATTEMPTS = 3;

// ─── Navigation prop shape ────────────────────────────────────────────────────
// Kept minimal so the screen is not tightly coupled to any navigation library.

export interface AuthScreenNavigationProp {
  /**
   * Replace the current route with the given screen name.
   * Used after successful OTP verification.
   */
  replace(screen: 'RoleSelector' | 'Dashboard'): void;
}

export interface AuthScreenProps {
  navigation: AuthScreenNavigationProp;
}

// ─── Step enum ────────────────────────────────────────────────────────────────

type Step = 'phone' | 'otp';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format seconds as mm:ss. */
function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Returns true when `value` is exactly 10 decimal digits. */
function isValidMobile(value: string): boolean {
  return /^\d{10}$/.test(value);
}

/** Returns true when `value` is exactly 6 decimal digits. */
function isValidOtp(value: string): boolean {
  return /^\d{6}$/.test(value);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AuthScreen
 *
 * Renders either the phone-input step or the OTP-entry step depending on
 * internal `step` state.  Navigation is delegated to the parent via the
 * `navigation` prop so this screen is navigation-library agnostic.
 */
export function AuthScreen({ navigation }: AuthScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('phone');

  // ── Phone step state ────────────────────────────────────────────────────────
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [sendOtpError, setSendOtpError] = useState<string | null>(null);

  // ── OTP step state ──────────────────────────────────────────────────────────
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  /** Countdown in seconds. Starts at OTP_TTL_SECONDS, counts down to 0. */
  const [countdown, setCountdown] = useState(OTP_TTL_SECONDS);
  /** True once the countdown reaches zero. */
  const [otpExpired, setOtpExpired] = useState(false);
  /** Number of consecutive wrong OTP attempts. */
  const [wrongAttempts, setWrongAttempts] = useState(0);
  /** True when the field is locked (3 consecutive wrong attempts or server-locked). */
  const [otpLocked, setOtpLocked] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Start / reset the countdown interval ──────────────────────────────────
  const startCountdown = useCallback(() => {
    setCountdown(OTP_TTL_SECONDS);
    setOtpExpired(false);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          setOtpExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);
  }, []);

  // ─── Cleanup interval on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // ─── Phone step handlers ────────────────────────────────────────────────────

  const handleMobileChange = useCallback((text: string) => {
    // Accept only digits; max 10 characters
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);
    // Clear errors on edit
    if (mobileError) setMobileError(null);
    if (sendOtpError) setSendOtpError(null);
  }, [mobileError, sendOtpError]);

  const handleSendOtp = useCallback(async () => {
    // Req 2.1 / 2.3 — validate before sending
    if (!isValidMobile(mobile)) {
      setMobileError(t('invalidMobile'));
      return;
    }
    setMobileError(null);
    setSendOtpError(null);
    setSendingOtp(true);
    try {
      await sendOtp(mobile);
      // Transition to OTP step and start countdown
      setOtp('');
      setOtpError(null);
      setWrongAttempts(0);
      setOtpLocked(false);
      startCountdown();
      setStep('otp');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error');
      setSendOtpError(msg);
    } finally {
      setSendingOtp(false);
    }
  }, [mobile, t, startCountdown]);

  // ─── OTP step handlers ──────────────────────────────────────────────────────

  const handleOtpChange = useCallback((text: string) => {
    // Accept only digits; max 6 characters
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    if (otpError) setOtpError(null);
  }, [otpError]);

  const handleVerifyOtp = useCallback(async () => {
    if (!isValidOtp(otp)) return;
    setOtpError(null);
    setVerifyingOtp(true);
    try {
      const result = await verifyOtp(mobile, otp);
      // Req 2.4 — navigate based on whether a role exists in the session
      if (result.role) {
        navigation.replace('Dashboard');
      } else {
        navigation.replace('RoleSelector');
      }
    } catch (err) {
      const lockedError = err as Error & { locked?: boolean };
      const newAttempts = wrongAttempts + 1;

      if (lockedError.locked || newAttempts >= MAX_OTP_ATTEMPTS) {
        // Req 2.5 — lock after 3 consecutive wrong attempts
        setOtpLocked(true);
        setWrongAttempts(newAttempts);
        setOtpError(t('otpLocked'));
      } else {
        setWrongAttempts(newAttempts);
        setOtpError(t('invalidOtp'));
      }
    } finally {
      setVerifyingOtp(false);
    }
  }, [otp, mobile, wrongAttempts, navigation, t]);

  /** Request a new OTP — resets all OTP state and re-sends. */
  const handleRequestNewOtp = useCallback(async () => {
    setSendOtpError(null);
    setSendingOtp(true);
    try {
      await sendOtp(mobile);
      setOtp('');
      setOtpError(null);
      setWrongAttempts(0);
      setOtpLocked(false);
      startCountdown();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error');
      setSendOtpError(msg);
    } finally {
      setSendingOtp(false);
    }
  }, [mobile, t, startCountdown]);

  // ─── Derived values ─────────────────────────────────────────────────────────

  /** True when the OTP input and Verify button should be disabled. */
  const otpInputDisabled = otpLocked || otpExpired || verifyingOtp;

  /** True when the Verify OTP button should be active. */
  const canVerify = isValidOtp(otp) && !otpInputDisabled;

  /** True when the "Request New OTP" CTA should be shown. */
  const showRetry = otpLocked || otpExpired;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: tokens.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── App name header ── */}
        <Text style={[styles.appName, { color: tokens.primary }]}>
          {t('appName')}
        </Text>

        {step === 'phone' ? (
          <PhoneStep
            mobile={mobile}
            mobileError={mobileError}
            sendOtpError={sendOtpError}
            sending={sendingOtp}
            onChangeText={handleMobileChange}
            onSend={handleSendOtp}
            tokens={tokens}
            t={t}
          />
        ) : (
          <OtpStep
            mobile={mobile}
            otp={otp}
            otpError={otpError}
            sendOtpError={sendOtpError}
            verifying={verifyingOtp}
            sending={sendingOtp}
            countdown={countdown}
            otpExpired={otpExpired}
            otpLocked={otpLocked}
            otpInputDisabled={otpInputDisabled}
            canVerify={canVerify}
            showRetry={showRetry}
            onChangeOtp={handleOtpChange}
            onVerify={handleVerifyOtp}
            onRequestNew={handleRequestNewOtp}
            tokens={tokens}
            t={t}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── PhoneStep sub-component ──────────────────────────────────────────────────

interface PhoneStepProps {
  mobile: string;
  mobileError: string | null;
  sendOtpError: string | null;
  sending: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
  tokens: ReturnType<typeof useTheme>['tokens'];
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function PhoneStep({
  mobile,
  mobileError,
  sendOtpError,
  sending,
  onChangeText,
  onSend,
  tokens,
  t,
}: PhoneStepProps): React.ReactElement {
  const canSend = isValidMobile(mobile) && !sending;

  return (
    <View style={styles.stepContainer}>
      {/* ── Input row ── */}
      <View
        style={[
          styles.inputRow,
          {
            borderColor: mobileError ? tokens.error : tokens.border,
            backgroundColor: tokens.surface,
          },
        ]}
      >
        <Icon
          name="phone"
          size={22}
          color={mobileError ? tokens.error : tokens.textSecondary}
          testID="auth-phone-icon"
        />
        <TextInput
          style={[styles.input, { color: tokens.textPrimary }]}
          value={mobile}
          onChangeText={onChangeText}
          placeholder={t('enterMobile')}
          placeholderTextColor={tokens.textDisabled}
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={onSend}
          accessible
          accessibilityLabel={t('mobileInputLabel')}
          accessibilityHint={t('invalidMobile')}
          testID="auth-mobile-input"
        />
      </View>

      {/* ── Inline validation error (Req 2.3) ── */}
      {mobileError ? (
        <View style={styles.errorRow}>
          <Icon name="error" size={16} color={tokens.error} testID="auth-mobile-error-icon" />
          <Text
            style={[styles.errorText, { color: tokens.error }]}
            accessibilityRole="alert"
            testID="auth-mobile-error"
          >
            {mobileError}
          </Text>
        </View>
      ) : null}

      {/* ── API-level send error ── */}
      {sendOtpError ? (
        <View style={styles.errorRow}>
          <Icon name="error" size={16} color={tokens.error} />
          <Text
            style={[styles.errorText, { color: tokens.error }]}
            accessibilityRole="alert"
            testID="auth-send-error"
          >
            {sendOtpError}
          </Text>
        </View>
      ) : null}

      {/* ── Send OTP button ── */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          {
            backgroundColor: canSend ? tokens.primary : tokens.primaryDisabled,
          },
        ]}
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={t('sendOtp')}
        accessibilityState={{ disabled: !canSend, busy: sending }}
        testID="auth-send-otp-button"
      >
        {sending ? (
          <ActivityIndicator color={tokens.background} size="small" />
        ) : (
          <Text style={[styles.primaryButtonText, { color: tokens.background }]}>
            {t('sendOtp')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── OtpStep sub-component ────────────────────────────────────────────────────

interface OtpStepProps {
  mobile: string;
  otp: string;
  otpError: string | null;
  sendOtpError: string | null;
  verifying: boolean;
  sending: boolean;
  countdown: number;
  otpExpired: boolean;
  otpLocked: boolean;
  otpInputDisabled: boolean;
  canVerify: boolean;
  showRetry: boolean;
  onChangeOtp: (text: string) => void;
  onVerify: () => void;
  onRequestNew: () => void;
  tokens: ReturnType<typeof useTheme>['tokens'];
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function OtpStep({
  mobile,
  otp,
  otpError,
  sendOtpError,
  verifying,
  sending,
  countdown,
  otpExpired,
  otpLocked,
  otpInputDisabled,
  canVerify,
  showRetry,
  onChangeOtp,
  onVerify,
  onRequestNew,
  tokens,
  t,
}: OtpStepProps): React.ReactElement {
  const countdownColor = countdown <= 60 ? tokens.warning : tokens.textSecondary;

  return (
    <View style={styles.stepContainer}>
      {/* ── "OTP sent to" confirmation ── */}
      <Text
        style={[styles.sentToText, { color: tokens.textSecondary }]}
        testID="auth-otp-sent-to"
      >
        {t('otpSentTo', { mobile })}
      </Text>

      {/* ── Countdown timer ── */}
      {!otpExpired && !otpLocked ? (
        <Text
          style={[styles.countdown, { color: countdownColor }]}
          accessibilityLiveRegion="polite"
          testID="auth-countdown"
        >
          {t('otpTimeRemaining', { time: formatCountdown(countdown) })}
        </Text>
      ) : null}

      {/* ── OTP input row ── */}
      <View
        style={[
          styles.inputRow,
          {
            borderColor: otpError
              ? tokens.error
              : otpInputDisabled
              ? tokens.border
              : tokens.border,
            backgroundColor: otpInputDisabled
              ? tokens.backgroundSecondary
              : tokens.surface,
            opacity: otpInputDisabled ? 0.6 : 1,
          },
        ]}
      >
        <Icon
          name={otpLocked ? 'lock' : 'otp'}
          size={22}
          color={otpError ? tokens.error : tokens.textSecondary}
          testID="auth-otp-icon"
        />
        <TextInput
          style={[styles.input, { color: tokens.textPrimary }]}
          value={otp}
          onChangeText={onChangeOtp}
          placeholder={t('enterOtp')}
          placeholderTextColor={tokens.textDisabled}
          keyboardType="number-pad"
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={onVerify}
          editable={!otpInputDisabled}
          secureTextEntry
          accessible
          accessibilityLabel={t('otpInputLabel')}
          accessibilityState={{ disabled: otpInputDisabled }}
          testID="auth-otp-input"
        />
      </View>

      {/* ── OTP error (wrong / locked / expired) ── */}
      {otpError ? (
        <View style={styles.errorRow}>
          <Icon name="error" size={16} color={tokens.error} />
          <Text
            style={[styles.errorText, { color: tokens.error }]}
            accessibilityRole="alert"
            testID="auth-otp-error"
          >
            {otpError}
          </Text>
        </View>
      ) : null}

      {/* ── API-level resend error ── */}
      {sendOtpError ? (
        <View style={styles.errorRow}>
          <Icon name="error" size={16} color={tokens.error} />
          <Text
            style={[styles.errorText, { color: tokens.error }]}
            accessibilityRole="alert"
            testID="auth-resend-error"
          >
            {sendOtpError}
          </Text>
        </View>
      ) : null}

      {/* ── Verify OTP button ── */}
      {!showRetry ? (
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: canVerify ? tokens.primary : tokens.primaryDisabled,
            },
          ]}
          onPress={onVerify}
          disabled={!canVerify}
          accessibilityRole="button"
          accessibilityLabel={t('verifyOtp')}
          accessibilityState={{ disabled: !canVerify, busy: verifying }}
          testID="auth-verify-otp-button"
        >
          {verifying ? (
            <ActivityIndicator color={tokens.background} size="small" />
          ) : (
            <Text style={[styles.primaryButtonText, { color: tokens.background }]}>
              {t('verifyOtp')}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {/* ── Request New OTP CTA (shown when locked or expired) ── */}
      {showRetry ? (
        <TouchableOpacity
          style={[
            styles.retryButton,
            {
              borderColor: tokens.primary,
            },
          ]}
          onPress={onRequestNew}
          disabled={sending}
          accessibilityRole="button"
          accessibilityLabel={t('requestNewOtp')}
          accessibilityState={{ busy: sending }}
          testID="auth-request-new-otp-button"
        >
          {sending ? (
            <ActivityIndicator color={tokens.primary} size="small" />
          ) : (
            <View style={styles.retryButtonInner}>
              <Icon name="retry" size={18} color={tokens.primary} />
              <Text style={[styles.retryButtonText, { color: tokens.primary }]}>
                {t('requestNewOtp')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 0.5,
  },
  stepContainer: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    letterSpacing: 1.5,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    flexWrap: 'wrap',
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  retryButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginTop: 8,
    minHeight: 52,
  },
  retryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sentToText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  countdown: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
});
