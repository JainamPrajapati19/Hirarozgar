/**
 * SettingsPanel — full wiring for all settings sub-features.
 *
 * Sub-features:
 *  1. Language selector (Gujarati / Hindi / English with icons) → changeLocale()  — Req 1.5
 *  2. Theme toggle (Light / Dark with icons)                    → setTheme()      — Req 9.1
 *  3. Edit Profile action                                       → onEditProfile() — Req 3.5
 *  4. Payment Receipts inline section                          → GET /payment/receipts — Req 11.1–11.3
 *  5. Sign Out                                                  → POST /auth/signout  — Req 10.1–10.4
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { IconKey } from './IconRegistry';
import { useTheme } from '../hooks/useTheme';
import { useLocale } from '../hooks/useLocale';
import { Locale, SUPPORTED_LOCALES } from '../i18n';
import { signOut } from '../services/AuthService';
import {
  getReceipts,
  PaymentReceipt,
  LedgerUnavailableError,
} from '../services/PaymentService';
import { ThemeTokens } from '../theme/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Callbacks injected by the parent navigator/screen so that SettingsPanel
 * can trigger navigation without importing a navigation library directly.
 */
export interface SettingsPanelProps {
  /** Called after sign-out completes (success or failure). Navigate to Welcome Screen. */
  onSignedOut: () => void;
  /** Called when the user taps "Edit Profile". Navigate to the profile edit screen. */
  onEditProfile: () => void;
}

// ─── Language option config ───────────────────────────────────────────────────

interface LocaleOption {
  locale: Locale;
  label: string;
  shortLabel: string;
  iconName: IconKey;
}

const LOCALE_OPTIONS: LocaleOption[] = [
  { locale: 'gu-IN', label: 'ગુજરાતી', shortLabel: 'ગુ',  iconName: 'language' },
  { locale: 'hi-IN', label: 'हिन्दी',  shortLabel: 'हि',  iconName: 'language' },
  { locale: 'en-IN', label: 'English', shortLabel: 'EN', iconName: 'language' },
];

// ─── Receipt loading state ────────────────────────────────────────────────────

type ReceiptsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; receipts: PaymentReceipt[] }
  | { status: 'error'; message: string };

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SettingsPanel
 *
 * Renders all five settings sub-features in a scrollable list.
 *
 * Sign-Out flow (Req 10.1–10.4):
 *  1. Shows a loading indicator while the async sign-out runs.
 *  2. After completion (success OR error), calls `onSignedOut` to
 *     navigate to the Welcome Screen.
 *  3. Never shows a cleanup-related error to the user (Req 10.3).
 *
 * Payment Receipts (Req 11.1–11.3):
 *  - Tapping the row expands an inline section that fetches GET /payment/receipts.
 *  - Shows receipts newest-first, empty state, or error + retry button.
 *  - Previously loaded stale data is not shown during a retry (Req 11.2).
 */
export function SettingsPanel({ onSignedOut, onEditProfile }: SettingsPanelProps) {
  const { t } = useTranslation();
  const { theme, tokens, setTheme } = useTheme();
  const { locale, changeLocale } = useLocale();

  const [signingOut, setSigningOut] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [receiptsState, setReceiptsState] = useState<ReceiptsState>({ status: 'idle' });

  // Used to cancel in-flight fetch if the panel closes.
  const fetchAbortRef = useRef<boolean>(false);

  // ── Fetch receipts ────────────────────────────────────────────────────────
  const fetchReceipts = useCallback(async () => {
    fetchAbortRef.current = false;
    setReceiptsState({ status: 'loading' });
    try {
      const response = await getReceipts();
      if (fetchAbortRef.current) return;
      // Receipts from API are already newest-first (ordered by the server per Req 11.1)
      setReceiptsState({ status: 'loaded', receipts: response.receipts });
    } catch (err) {
      if (fetchAbortRef.current) return;
      if (err instanceof LedgerUnavailableError) {
        // Req 11.2: ledger unavailable → show error + retry; do NOT show stale data
        setReceiptsState({ status: 'error', message: err.message });
      } else {
        setReceiptsState({
          status: 'error',
          message: (err instanceof Error ? err.message : null) ?? t('error'),
        });
      }
    }
  }, [t]);

  // ── Toggle receipts panel ─────────────────────────────────────────────────
  const handleToggleReceipts = useCallback(() => {
    if (!receiptsOpen) {
      setReceiptsOpen(true);
      void fetchReceipts();
    } else {
      // Cancel any in-flight fetch when collapsing
      fetchAbortRef.current = true;
      setReceiptsOpen(false);
      setReceiptsState({ status: 'idle' });
    }
  }, [receiptsOpen, fetchReceipts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fetchAbortRef.current = true;
    };
  }, []);

  // ── Sign-Out handler ───────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // signOut() never throws; it handles all failures internally (Req 10.3).
      await signOut();
    } catch {
      // Silently swallow any unexpected errors — Req 10.3 mandates redirect
      // regardless of cleanup success.
    } finally {
      // Always navigate to Welcome Screen regardless of sign-out outcome (Req 10.3).
      setSigningOut(false);
      onSignedOut();
    }
  }, [signingOut, onSignedOut]);

  // ── Theme toggle ──────────────────────────────────────────────────────────
  const handleThemeToggle = useCallback(
    async (value: boolean) => {
      await setTheme(value ? 'dark' : 'light');
    },
    [setTheme],
  );

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── 1. Language Selector (Req 1.5) ──────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <SectionHeader label={t('language')} iconName="language" tokens={tokens} />
      <View style={[styles.row, styles.languageRow]}>
        {LOCALE_OPTIONS.map(({ locale: loc, label, shortLabel, iconName }) => {
          const isActive = locale === loc;
          return (
            <TouchableOpacity
              key={loc}
              style={[
                styles.langButton,
                {
                  backgroundColor: isActive
                    ? tokens.primary
                    : tokens.backgroundSecondary,
                  borderColor: isActive ? tokens.primary : tokens.border,
                },
              ]}
              onPress={() => changeLocale(loc)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
              testID={`lang-btn-${loc}`}
            >
              <Icon
                name={iconName}
                size={16}
                color={isActive ? tokens.background : tokens.textSecondary}
              />
              <Text
                style={[
                  styles.langButtonText,
                  { color: isActive ? tokens.background : tokens.textPrimary },
                ]}
              >
                {shortLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Divider color={tokens.border} />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── 2. Theme Toggle (Req 9.1) ─────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <View style={[styles.row, styles.settingRow]}>
        <View style={styles.rowLeft}>
          <Icon name="theme" size={24} color={tokens.textPrimary} />
          <Text style={[styles.rowLabel, { color: tokens.textPrimary }]}>
            {t('theme')}
          </Text>
        </View>
        <View style={styles.themeToggleGroup}>
          <Icon
            name="theme"
            size={16}
            color={theme === 'light' ? tokens.primary : tokens.textSecondary}
          />
          <Text
            style={[
              styles.themeLabel,
              { color: theme === 'light' ? tokens.primary : tokens.textSecondary },
            ]}
          >
            {t('lightTheme')}
          </Text>
          <Switch
            value={theme === 'dark'}
            onValueChange={handleThemeToggle}
            trackColor={{ false: tokens.border, true: tokens.primary }}
            thumbColor={tokens.background}
            accessibilityRole="switch"
            accessibilityLabel={`${t('theme')}: ${
              theme === 'dark' ? t('darkTheme') : t('lightTheme')
            }`}
            testID="theme-toggle-switch"
          />
          <Text
            style={[
              styles.themeLabel,
              { color: theme === 'dark' ? tokens.primary : tokens.textSecondary },
            ]}
          >
            {t('darkTheme')}
          </Text>
          <Icon
            name="theme"
            size={16}
            color={theme === 'dark' ? tokens.primary : tokens.textSecondary}
          />
        </View>
      </View>

      <Divider color={tokens.border} />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── 3. Edit Profile (Req 3.5) ─────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <TouchableOpacity
        style={[styles.row, styles.settingRow]}
        onPress={onEditProfile}
        accessibilityRole="button"
        accessibilityLabel={t('editProfile')}
        testID="edit-profile-btn"
      >
        <View style={styles.rowLeft}>
          <Icon name="edit" size={24} color={tokens.textPrimary} />
          <Text style={[styles.rowLabel, { color: tokens.textPrimary }]}>
            {t('editProfile')}
          </Text>
        </View>
        <Icon name="back" size={18} color={tokens.textSecondary} />
      </TouchableOpacity>

      <Divider color={tokens.border} />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── 4. Payment Receipts (Req 11.1–11.3) ──────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <TouchableOpacity
        style={[styles.row, styles.settingRow]}
        onPress={handleToggleReceipts}
        accessibilityRole="button"
        accessibilityLabel={t('paymentReceipts')}
        accessibilityState={{ expanded: receiptsOpen }}
        testID="payment-receipts-toggle"
      >
        <View style={styles.rowLeft}>
          <Icon name="receipt" size={24} color={tokens.textPrimary} />
          <Text style={[styles.rowLabel, { color: tokens.textPrimary }]}>
            {t('paymentReceipts')}
          </Text>
        </View>
        {/* Chevron icon — rotate when open */}
        <Icon
          name={receiptsOpen ? 'deactivate' : 'back'}
          size={18}
          color={tokens.textSecondary}
        />
      </TouchableOpacity>

      {/* Inline receipts panel */}
      {receiptsOpen ? (
        <ReceiptsPanel
          state={receiptsState}
          tokens={tokens}
          onRetry={() => void fetchReceipts()}
          t={t}
        />
      ) : null}

      <Divider color={tokens.border} />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── 5. Sign Out (Req 10.1–10.4) ─────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <TouchableOpacity
        style={[styles.row, styles.settingRow, signingOut && styles.rowDisabled]}
        onPress={() => void handleSignOut()}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel={t('signOut')}
        accessibilityState={{ busy: signingOut }}
        testID="sign-out-btn"
      >
        <View style={styles.rowLeft}>
          <Icon name="logout" size={24} color={tokens.error} />
          <Text style={[styles.rowLabel, { color: tokens.error }]}>
            {t('signOut')}
          </Text>
        </View>
        {signingOut ? (
          <ActivityIndicator size="small" color={tokens.error} />
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

// ─── ReceiptsPanel ────────────────────────────────────────────────────────────

interface ReceiptsPanelProps {
  state: ReceiptsState;
  tokens: ThemeTokens;
  onRetry: () => void;
  t: (key: string) => string;
}

function ReceiptsPanel({ state, tokens, onRetry, t }: ReceiptsPanelProps) {
  // ── Loading ──────────────────────────────────────────────────────────────
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <View
        style={[styles.receiptsPanel, { backgroundColor: tokens.surface }]}
        testID="receipts-loading"
      >
        <ActivityIndicator size="small" color={tokens.primary} />
        <Text style={[styles.receiptsPanelText, { color: tokens.textSecondary }]}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  // ── Error + retry (Req 11.2) ─────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <View
        style={[
          styles.receiptsPanel,
          styles.receiptsPanelError,
          { backgroundColor: tokens.surface, borderColor: tokens.error },
        ]}
        testID="receipts-error"
      >
        <View style={styles.receiptsErrorRow}>
          <Icon name="error" size={20} color={tokens.error} />
          <Text
            style={[styles.receiptsPanelText, { color: tokens.error }]}
            accessibilityRole="alert"
          >
            {state.message}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: tokens.primary }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('retry')}
          testID="receipts-retry-btn"
        >
          <Icon name="retry" size={16} color={tokens.background} />
          <Text style={[styles.retryButtonText, { color: tokens.background }]}>
            {t('retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Empty state (Req 11.3) ───────────────────────────────────────────────
  if (state.receipts.length === 0) {
    return (
      <View
        style={[styles.receiptsPanel, { backgroundColor: tokens.surface }]}
        testID="receipts-empty"
      >
        <Icon name="empty_state" size={40} color={tokens.textDisabled} />
        <Text style={[styles.receiptsPanelText, { color: tokens.textSecondary }]}>
          {t('noPaymentHistory')}
        </Text>
      </View>
    );
  }

  // ── Records newest-first (Req 11.1) ─────────────────────────────────────
  return (
    <View
      style={[styles.receiptsPanel, { backgroundColor: tokens.surface }]}
      testID="receipts-list"
    >
      <FlatList
        data={state.receipts}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.receiptDivider, { backgroundColor: tokens.border }]} />
        )}
        renderItem={({ item }) => (
          <ReceiptRow receipt={item} tokens={tokens} t={t} />
        )}
      />
    </View>
  );
}

// ─── ReceiptRow ───────────────────────────────────────────────────────────────

interface ReceiptRowProps {
  receipt: PaymentReceipt;
  tokens: ThemeTokens;
  t: (key: string) => string;
}

function ReceiptRow({ receipt, tokens, t }: ReceiptRowProps) {
  // Format amount: amountPaise → ₹ rupees
  const amountRupees = (receipt.amountPaise / 100).toFixed(2);
  const paymentDate = formatDate(receipt.receivedAt);
  const subStart = receipt.subscriptionStart ? formatDate(receipt.subscriptionStart) : '—';
  const subEnd = receipt.subscriptionEnd ? formatDate(receipt.subscriptionEnd) : '—';

  return (
    <View style={styles.receiptRow} testID={`receipt-${receipt.id}`}>
      {/* ── Amount & Date header ── */}
      <View style={styles.receiptHeader}>
        <View style={styles.receiptHeaderLeft}>
          <Icon name="payment" size={20} color={tokens.primary} />
          <Text style={[styles.receiptAmount, { color: tokens.textPrimary }]}>
            ₹{amountRupees}
          </Text>
        </View>
        <Text style={[styles.receiptDate, { color: tokens.textSecondary }]}>
          {paymentDate}
        </Text>
      </View>

      {/* ── Transaction ID ── */}
      <View style={styles.receiptDetail}>
        <Icon name="receipt" size={14} color={tokens.textSecondary} />
        <Text
          style={[styles.receiptDetailLabel, { color: tokens.textSecondary }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {t('transactionId')}: {receipt.razorpayTxnId}
        </Text>
      </View>

      {/* ── Subscription window ── */}
      <View style={styles.receiptDetail}>
        <Icon name="subscription" size={14} color={tokens.textSecondary} />
        <Text style={[styles.receiptDetailLabel, { color: tokens.textSecondary }]}>
          {t('subscriptionStart')}: {subStart}
        </Text>
      </View>
      <View style={styles.receiptDetail}>
        <Icon name="subscription" size={14} color={tokens.textSecondary} />
        <Text style={[styles.receiptDetailLabel, { color: tokens.textSecondary }]}>
          {t('subscriptionEnd')}: {subEnd}
        </Text>
      </View>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  iconName: IconKey;
  tokens: ThemeTokens;
}

function SectionHeader({ label, iconName, tokens }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Icon name={iconName} size={18} color={tokens.textSecondary} />
      <Text style={[styles.sectionHeaderText, { color: tokens.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

interface DividerProps {
  color: string;
}

function Divider({ color }: DividerProps) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string to a human-readable local date.
 * E.g. "2024-06-15T10:30:00Z" → "15 Jun 2024"
 */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingRow: {
    minHeight: 52,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '400',
  },
  rowDisabled: {
    opacity: 0.6,
  },

  // ── Language buttons ───────────────────────────────────────────────────
  languageRow: {
    gap: 8,
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 72,
  },
  langButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Theme toggle ───────────────────────────────────────────────────────
  themeToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeLabel: {
    fontSize: 13,
  },

  // ── Divider ────────────────────────────────────────────────────────────
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },

  // ── Receipts panel ────────────────────────────────────────────────────
  receiptsPanel: {
    borderRadius: 10,
    marginBottom: 8,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  receiptsPanelError: {
    borderWidth: 1,
    alignItems: 'stretch',
  },
  receiptsPanelText: {
    fontSize: 14,
    textAlign: 'center',
  },
  receiptsErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 4,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Receipt row ────────────────────────────────────────────────────────
  receiptRow: {
    paddingVertical: 10,
    gap: 4,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  receiptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  receiptDate: {
    fontSize: 12,
  },
  receiptDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiptDetailLabel: {
    fontSize: 12,
    flex: 1,
    flexWrap: 'wrap',
  },
  receiptDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
});
