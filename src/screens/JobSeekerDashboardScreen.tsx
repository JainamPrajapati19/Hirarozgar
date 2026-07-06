/**
 * JobSeekerDashboardScreen — the home screen for subscribed Job Seekers.
 *
 * Implements:
 *   - Req 6.1: Renders active vacancies as JobCard list with title, salary (bold),
 *              area, job type badge (Green=Chhutak, Blue=Fixed), and Apply button.
 *   - Req 6.2: Apply button creates a job application record; disables and relabels
 *              after successful submission; shows error + retry on DB/network failure.
 *   - Req 6.3: Duplicate apply → blocked; "Already applied" label shown.
 *   - Req 6.4: Non-subscribed seeker taps Apply → SubscriptionPrompt shown.
 *   - Req 6.5: History Track tab shows all previous applications newest-first.
 *   - Req 8.1–8.3: Feed is served from Redis cache (handled server-side).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../components/Icon';
import { IconKey } from '../components/IconRegistry';
import { SubscriptionPrompt } from '../components/SubscriptionPrompt';
import { useTheme } from '../hooks/useTheme';
import {
  getJobFeed,
  applyToVacancy,
  getApplicationHistory,
  FeedVacancy,
  ApplicationHistoryItem,
  DuplicateApplicationError,
  SubscriptionRequiredError,
} from '../services/JobService';

// ─── Navigation prop shape ────────────────────────────────────────────────────

export interface JobSeekerDashboardNavigationProp {
  /** Navigate to the Settings Panel screen. */
  navigateToSettings?(): void;
}

export interface JobSeekerDashboardScreenProps {
  navigation?: JobSeekerDashboardNavigationProp;
  /** The user's role — passed down for subscription prompt fee display. */
  role?: 'seeker' | 'recruiter' | null;
}

// ─── Active tab type ──────────────────────────────────────────────────────────

type Tab = 'jobs' | 'history';

// ─── Component ────────────────────────────────────────────────────────────────

export function JobSeekerDashboardScreen({
  navigation,
  role,
}: JobSeekerDashboardScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('jobs');

  // ── Job feed state ────────────────────────────────────────────────────────
  const [vacancies, setVacancies] = useState<FeedVacancy[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  // ── Application state — track applied/errored per vacancy ─────────────────
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyErrorId, setApplyErrorId] = useState<string | null>(null);

  // ── Subscription prompt state ─────────────────────────────────────────────
  const [showSubPrompt, setShowSubPrompt] = useState(false);

  // ── History state ─────────────────────────────────────────────────────────
  const [history, setHistory] = useState<ApplicationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ── Fetch job feed ─────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setFeedRefreshing(true);
    } else {
      setFeedLoading(true);
    }
    setFeedError(null);
    try {
      const data = await getJobFeed();
      setVacancies(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error');
      setFeedError(message);
    } finally {
      setFeedLoading(false);
      setFeedRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  // ── Fetch history ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await getApplicationHistory();
      setHistory(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error');
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (activeTab === 'history') {
      void fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // ── Apply handler ──────────────────────────────────────────────────────────

  const handleApply = useCallback(
    async (vacancyId: string) => {
      if (applyingId) return;
      setApplyErrorId(null);
      setApplyingId(vacancyId);
      try {
        await applyToVacancy(vacancyId);
        setAppliedIds((prev) => new Set([...prev, vacancyId]));
      } catch (err) {
        if (err instanceof SubscriptionRequiredError) {
          // Req 6.4: show subscription prompt
          setShowSubPrompt(true);
        } else if (err instanceof DuplicateApplicationError) {
          // Req 6.3: mark as already applied
          setAppliedIds((prev) => new Set([...prev, vacancyId]));
        } else {
          // Req 6.2: show retry error
          setApplyErrorId(vacancyId);
        }
      } finally {
        setApplyingId(null);
      }
    },
    [applyingId],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View
      style={[styles.container, { backgroundColor: tokens.background }]}
      testID="seeker-dashboard"
    >
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <View style={styles.headerLeft}>
          <Icon name="job_seeker" size={28} color={tokens.primary} />
          <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
            {t('dashboard')}
          </Text>
        </View>
        {navigation?.navigateToSettings ? (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={navigation.navigateToSettings}
            accessibilityRole="button"
            accessibilityLabel={t('settings')}
            testID="seeker-dashboard-settings-btn"
          >
            <Icon name="settings" size={24} color={tokens.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Tab bar ── */}
      <View style={[styles.tabBar, { borderBottomColor: tokens.border }]}>
        <TabButton
          label={t('jobsTab')}
          iconName="home"
          active={activeTab === 'jobs'}
          tokens={tokens}
          onPress={() => setActiveTab('jobs')}
          testID="tab-jobs"
        />
        <TabButton
          label={t('historyTab')}
          iconName="history"
          active={activeTab === 'history'}
          tokens={tokens}
          onPress={() => setActiveTab('history')}
          testID="tab-history"
        />
      </View>

      {/* ── Tab content ── */}
      {activeTab === 'jobs' ? (
        <JobFeedTab
          vacancies={vacancies}
          loading={feedLoading}
          refreshing={feedRefreshing}
          error={feedError}
          appliedIds={appliedIds}
          applyingId={applyingId}
          applyErrorId={applyErrorId}
          tokens={tokens}
          t={t}
          onApply={handleApply}
          onRetryApply={(id) => { void handleApply(id); }}
          onRefresh={() => { void fetchFeed(true); }}
          onRetryFeed={() => { void fetchFeed(); }}
        />
      ) : (
        <HistoryTab
          history={history}
          loading={historyLoading}
          error={historyError}
          tokens={tokens}
          t={t}
          onRetry={() => { void fetchHistory(); }}
        />
      )}

      {/* ── Subscription prompt (Req 6.4) ── */}
      <SubscriptionPrompt
        visible={showSubPrompt}
        role={role ?? 'seeker'}
        onDismiss={() => setShowSubPrompt(false)}
      />
    </View>
  );
}

// ─── TabButton ────────────────────────────────────────────────────────────────

interface TabButtonProps {
  label: string;
  iconName: IconKey;
  active: boolean;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onPress(): void;
  testID?: string;
}

function TabButton({ label, iconName, active, tokens, onPress, testID }: TabButtonProps) {
  const color = active ? tokens.primary : tokens.textSecondary;
  return (
    <TouchableOpacity
      style={[
        styles.tabButton,
        active && { borderBottomWidth: 2, borderBottomColor: tokens.primary },
      ]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      testID={testID}
    >
      <Icon name={iconName} size={20} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── JobFeedTab ───────────────────────────────────────────────────────────────

interface JobFeedTabProps {
  vacancies: FeedVacancy[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  appliedIds: Set<string>;
  applyingId: string | null;
  applyErrorId: string | null;
  tokens: ReturnType<typeof useTheme>['tokens'];
  t: (key: string) => string;
  onApply(id: string): void;
  onRetryApply(id: string): void;
  onRefresh(): void;
  onRetryFeed(): void;
}

function JobFeedTab({
  vacancies,
  loading,
  refreshing,
  error,
  appliedIds,
  applyingId,
  applyErrorId,
  tokens,
  t,
  onApply,
  onRetryApply,
  onRefresh,
  onRetryFeed,
}: JobFeedTabProps): React.ReactElement {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color={tokens.primary}
          testID="feed-loading"
        />
        <Text style={[styles.loadingText, { color: tokens.textSecondary }]}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Icon name="error" size={40} color={tokens.error} />
        <Text
          style={[styles.errorText, { color: tokens.error }]}
          accessibilityRole="alert"
          testID="feed-error"
        >
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: tokens.primary }]}
          onPress={onRetryFeed}
          accessibilityRole="button"
          accessibilityLabel={t('retry')}
          testID="feed-retry-button"
        >
          <Icon name="retry" size={18} color={tokens.background} />
          <Text style={[styles.retryButtonText, { color: tokens.background }]}>
            {t('retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (vacancies.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.centered}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.primary]}
            tintColor={tokens.primary}
          />
        }
      >
        <Icon name="empty_state" size={64} color={tokens.textDisabled} />
        <Text
          style={[styles.emptyText, { color: tokens.textSecondary }]}
          testID="feed-empty"
        >
          {t('noJobsAvailable')}
        </Text>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={vacancies}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      testID="feed-list"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[tokens.primary]}
          tintColor={tokens.primary}
        />
      }
      renderItem={({ item }) => (
        <JobCard
          vacancy={item}
          tokens={tokens}
          t={t}
          hasApplied={appliedIds.has(item.id)}
          isApplying={applyingId === item.id}
          hasError={applyErrorId === item.id}
          onApply={() => onApply(item.id)}
          onRetry={() => onRetryApply(item.id)}
        />
      )}
    />
  );
}

// ─── JobCard ──────────────────────────────────────────────────────────────────

interface JobCardProps {
  vacancy: FeedVacancy;
  tokens: ReturnType<typeof useTheme>['tokens'];
  t: (key: string) => string;
  hasApplied: boolean;
  isApplying: boolean;
  hasError: boolean;
  onApply(): void;
  onRetry(): void;
}

function JobCard({
  vacancy,
  tokens,
  t,
  hasApplied,
  isApplying,
  hasError,
  onApply,
  onRetry,
}: JobCardProps): React.ReactElement {
  const isChhutak = vacancy.job_type === 'chhutak';
  const badgeColor = isChhutak ? tokens.badgeChhutak : tokens.badgeFixed;

  return (
    <View
      style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
      testID={`job-card-${vacancy.id}`}
    >
      {/* ── Title ── */}
      <Text
        style={[styles.cardTitle, { color: tokens.textPrimary }]}
        numberOfLines={2}
        testID={`job-title-${vacancy.id}`}
      >
        {vacancy.title}
      </Text>

      {/* ── Meta row: salary, area, badge ── */}
      <View style={styles.metaRow}>
        {/* Salary — bold (Req 6.1) */}
        <View style={styles.metaItem}>
          <Icon name="salary" size={14} color={tokens.textSecondary} />
          <Text
            style={[styles.salaryText, { color: tokens.textPrimary }]}
            testID={`job-salary-${vacancy.id}`}
          >
            ₹{vacancy.salary}
          </Text>
        </View>

        {/* Area */}
        <View style={styles.metaItem}>
          <Icon name="location" size={14} color={tokens.textSecondary} />
          <Text
            style={[styles.metaText, { color: tokens.textSecondary }]}
            testID={`job-area-${vacancy.id}`}
          >
            {vacancy.area}
          </Text>
        </View>

        {/* Job type badge — Green=Chhutak, Blue=Fixed (Req 6.1) */}
        <View
          style={[styles.badge, { borderColor: badgeColor, backgroundColor: `${badgeColor}18` }]}
          testID={`job-badge-${vacancy.id}`}
        >
          <Icon
            name={isChhutak ? 'chhutak' : 'fixed'}
            size={12}
            color={badgeColor}
          />
          <Text style={[styles.badgeText, { color: badgeColor }]}>
            {isChhutak ? t('chhutak') : t('fixed')}
          </Text>
        </View>
      </View>

      {/* ── Apply error row (Req 6.2) ── */}
      {hasError ? (
        <View style={styles.errorRow}>
          <Icon name="error" size={14} color={tokens.error} />
          <Text
            style={[styles.applyErrorText, { color: tokens.error }]}
            accessibilityRole="alert"
            testID={`job-apply-error-${vacancy.id}`}
          >
            {t('applyError')}
          </Text>
          <TouchableOpacity
            style={[styles.retrySmallButton, { borderColor: tokens.primary }]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('retry')}
            testID={`job-retry-apply-${vacancy.id}`}
          >
            <Icon name="retry" size={13} color={tokens.primary} />
            <Text style={[styles.retrySmallText, { color: tokens.primary }]}>
              {t('retry')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Apply button (Req 6.1, 6.2, 6.3) ── */}
      <TouchableOpacity
        style={[
          styles.applyButton,
          {
            backgroundColor: hasApplied
              ? tokens.success
              : isApplying
              ? tokens.primaryDisabled
              : tokens.primary,
          },
        ]}
        onPress={onApply}
        disabled={hasApplied || isApplying}
        accessibilityRole="button"
        accessibilityLabel={hasApplied ? t('applied') : t('applyNow')}
        accessibilityState={{ disabled: hasApplied || isApplying }}
        testID={`job-apply-button-${vacancy.id}`}
      >
        {isApplying ? (
          <ActivityIndicator size="small" color={tokens.background} />
        ) : (
          <View style={styles.applyButtonInner}>
            <Icon
              name={hasApplied ? 'success' : 'apply'}
              size={18}
              color={tokens.background}
            />
            <Text style={[styles.applyButtonText, { color: tokens.background }]}>
              {hasApplied ? t('applied') : t('applyNow')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

interface HistoryTabProps {
  history: ApplicationHistoryItem[];
  loading: boolean;
  error: string | null;
  tokens: ReturnType<typeof useTheme>['tokens'];
  t: (key: string) => string;
  onRetry(): void;
}

function HistoryTab({
  history,
  loading,
  error,
  tokens,
  t,
  onRetry,
}: HistoryTabProps): React.ReactElement {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color={tokens.primary}
          testID="history-loading"
        />
        <Text style={[styles.loadingText, { color: tokens.textSecondary }]}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Icon name="error" size={40} color={tokens.error} />
        <Text
          style={[styles.errorText, { color: tokens.error }]}
          accessibilityRole="alert"
          testID="history-error"
        >
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: tokens.primary }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('retry')}
          testID="history-retry-button"
        >
          <Icon name="retry" size={18} color={tokens.background} />
          <Text style={[styles.retryButtonText, { color: tokens.background }]}>
            {t('retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.centered}>
        <Icon name="history" size={64} color={tokens.textDisabled} />
        <Text
          style={[styles.emptyText, { color: tokens.textSecondary }]}
          testID="history-empty"
        >
          {t('noApplicationHistory')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      testID="history-list"
      renderItem={({ item }) => (
        <View
          style={[styles.historyCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}
          testID={`history-item-${item.id}`}
        >
          <View style={styles.metaItem}>
            <Icon name="history" size={16} color={tokens.textSecondary} />
            <Text
              style={[styles.historyText, { color: tokens.textPrimary }]}
              testID={`history-text-${item.id}`}
            >
              {item.formatted}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  settingsButton: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  // ── JobCard
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    flexWrap: 'wrap',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  salaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // ── Apply button
  applyButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 4,
  },
  applyButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // ── Apply error
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  applyErrorText: {
    fontSize: 13,
    flex: 1,
  },
  retrySmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retrySmallText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // ── History card
  historyCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  historyText: {
    fontSize: 14,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 20,
  },
});
