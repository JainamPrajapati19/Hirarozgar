/**
 * RecruiterDashboardScreen — lists the authenticated recruiter's vacancies
 * with live application counts and action buttons (Deactivate / Delete).
 *
 * Implements:
 *   - Req 5.4: Deactivate sets status='inactive'; Delete permanently removes
 *   - Req 5.5: Displays live application_count per vacancy
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import {
  getMyVacancies,
  deactivateVacancy,
  deleteVacancy,
  VacancyWithCount,
} from '../services/JobService';

// ─── Navigation prop shape ────────────────────────────────────────────────────

export interface RecruiterDashboardNavigationProp {
  /** Navigate to the Post Job screen. */
  navigateToPostJob(): void;
  /** Navigate to the Settings Panel screen. */
  navigateToSettings?(): void;
}

export interface RecruiterDashboardScreenProps {
  navigation: RecruiterDashboardNavigationProp;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecruiterDashboardScreen({
  navigation,
}: RecruiterDashboardScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const [vacancies, setVacancies] = useState<VacancyWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Track which vacancy is showing the delete confirmation inline
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Track in-flight action per vacancy to show per-card loading state
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getMyVacancies();
      setVacancies(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error');
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchVacancies();
  }, [fetchVacancies]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDeactivate = useCallback(
    async (vacancyId: string) => {
      if (actionInProgress) return;
      setActionInProgress(vacancyId);
      try {
        await deactivateVacancy(vacancyId);
        await fetchVacancies();
      } catch (err) {
        const message = err instanceof Error ? err.message : t('error');
        setFetchError(message);
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, fetchVacancies, t],
  );

  const handleDeleteConfirm = useCallback(
    async (vacancyId: string) => {
      if (actionInProgress) return;
      setActionInProgress(vacancyId);
      setConfirmDeleteId(null);
      try {
        await deleteVacancy(vacancyId);
        await fetchVacancies();
      } catch (err) {
        const message = err instanceof Error ? err.message : t('error');
        setFetchError(message);
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, fetchVacancies, t],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <View style={styles.headerLeft}>
          <Icon name="recruiter" size={28} color={tokens.primary} />
          <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
            {t('myVacancies')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.postJobButton, { backgroundColor: tokens.primary }]}
            onPress={navigation.navigateToPostJob}
            accessibilityRole="button"
            accessibilityLabel={t('postJob')}
            testID="recruiter-dashboard-post-job-button"
          >
            <Icon name="edit" size={16} color={tokens.background} />
            <Text style={[styles.postJobButtonText, { color: tokens.background }]}>
              {t('postJob')}
            </Text>
          </TouchableOpacity>
          {navigation.navigateToSettings ? (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={navigation.navigateToSettings}
              accessibilityRole="button"
              accessibilityLabel={t('settings')}
              testID="recruiter-dashboard-settings-btn"
            >
              <Icon name="settings" size={24} color={tokens.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Loading ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={tokens.primary}
            accessibilityLabel={t('loading')}
            testID="recruiter-dashboard-loading"
          />
          <Text style={[styles.loadingText, { color: tokens.textSecondary }]}>
            {t('loading')}
          </Text>
        </View>
      ) : fetchError ? (
        /* ── Error state ── */
        <View style={[styles.centered, styles.errorContainer]}>
          <Icon name="error" size={40} color={tokens.error} />
          <Text
            style={[styles.errorText, { color: tokens.error }]}
            accessibilityRole="alert"
            testID="recruiter-dashboard-error"
          >
            {fetchError}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: tokens.primary }]}
            onPress={() => { void fetchVacancies(); }}
            accessibilityRole="button"
            accessibilityLabel={t('retry')}
            testID="recruiter-dashboard-retry-button"
          >
            <Icon name="retry" size={18} color={tokens.background} />
            <Text style={[styles.retryButtonText, { color: tokens.background }]}>
              {t('retry')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : vacancies.length === 0 ? (
        /* ── Empty state ── */
        <View style={styles.centered}>
          <Icon name="empty_state" size={64} color={tokens.textDisabled} />
          <Text
            style={[styles.emptyText, { color: tokens.textSecondary }]}
            testID="recruiter-dashboard-empty"
          >
            {t('myVacancies')}
          </Text>
        </View>
      ) : (
        /* ── Vacancy list ── */
        <FlatList
          data={vacancies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          testID="recruiter-dashboard-list"
          renderItem={({ item }) => (
            <VacancyCard
              vacancy={item}
              tokens={tokens}
              t={t}
              confirmDeleteId={confirmDeleteId}
              actionInProgress={actionInProgress}
              onDeactivate={handleDeactivate}
              onDeleteRequest={setConfirmDeleteId}
              onDeleteConfirm={handleDeleteConfirm}
              onDeleteCancel={() => setConfirmDeleteId(null)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── VacancyCard sub-component ────────────────────────────────────────────────

interface VacancyCardProps {
  vacancy: VacancyWithCount;
  tokens: ReturnType<typeof useTheme>['tokens'];
  t: (key: string, opts?: Record<string, unknown>) => string;
  confirmDeleteId: string | null;
  actionInProgress: string | null;
  onDeactivate(id: string): void;
  onDeleteRequest(id: string): void;
  onDeleteConfirm(id: string): void;
  onDeleteCancel(): void;
}

function VacancyCard({
  vacancy,
  tokens,
  t,
  confirmDeleteId,
  actionInProgress,
  onDeactivate,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: VacancyCardProps): React.ReactElement {
  const isConfirmingDelete = confirmDeleteId === vacancy.id;
  const isActing = actionInProgress === vacancy.id;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.card,
          borderColor: tokens.border,
        },
      ]}
      testID={`vacancy-card-${vacancy.id}`}
    >
      {/* ── Title ── */}
      <Text
        style={[styles.cardTitle, { color: tokens.textPrimary }]}
        numberOfLines={2}
        testID={`vacancy-title-${vacancy.id}`}
      >
        {vacancy.title}
      </Text>

      {/* ── Meta row ── */}
      <View style={styles.metaRow}>
        {/* Salary */}
        <View style={styles.metaItem}>
          <Icon name="salary" size={14} color={tokens.textSecondary} />
          <Text
            style={[styles.salaryText, { color: tokens.textPrimary }]}
            testID={`vacancy-salary-${vacancy.id}`}
          >
            ₹{vacancy.salary}
          </Text>
        </View>

        {/* Area */}
        <View style={styles.metaItem}>
          <Icon name="location" size={14} color={tokens.textSecondary} />
          <Text style={[styles.metaText, { color: tokens.textSecondary }]}>
            {vacancy.area}
          </Text>
        </View>

        {/* Job type badge */}
        <View
          style={[
            styles.badge,
            {
              borderColor:
                vacancy.job_type === 'chhutak' ? tokens.badgeChhutak : tokens.badgeFixed,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color:
                  vacancy.job_type === 'chhutak' ? tokens.badgeChhutak : tokens.badgeFixed,
              },
            ]}
            testID={`vacancy-job-type-${vacancy.id}`}
          >
            {vacancy.job_type === 'chhutak' ? t('chhutak') : t('fixed')}
          </Text>
        </View>
      </View>

      {/* ── Application count ── */}
      <View style={styles.metaItem}>
        <Icon name="apply" size={14} color={tokens.textSecondary} />
        <Text
          style={[styles.metaText, { color: tokens.textSecondary }]}
          testID={`vacancy-app-count-${vacancy.id}`}
        >
          {vacancy.application_count} {t('apply')}
        </Text>
      </View>

      {/* ── Action buttons ── */}
      {!isConfirmingDelete ? (
        <View style={styles.actionRow}>
          {/* Deactivate — only when active */}
          {vacancy.status === 'active' ? (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderColor: tokens.warning, backgroundColor: tokens.surface },
              ]}
              onPress={() => { onDeactivate(vacancy.id); }}
              disabled={isActing}
              accessibilityRole="button"
              accessibilityLabel={t('deactivate')}
              testID={`vacancy-deactivate-${vacancy.id}`}
            >
              {isActing ? (
                <ActivityIndicator size="small" color={tokens.warning} />
              ) : (
                <>
                  <Icon name="deactivate" size={16} color={tokens.warning} />
                  <Text style={[styles.actionButtonText, { color: tokens.warning }]}>
                    {t('deactivate')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Delete — always visible */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { borderColor: tokens.error, backgroundColor: tokens.surface },
            ]}
            onPress={() => { onDeleteRequest(vacancy.id); }}
            disabled={isActing}
            accessibilityRole="button"
            accessibilityLabel={t('delete')}
            testID={`vacancy-delete-${vacancy.id}`}
          >
            <Icon name="delete" size={16} color={tokens.error} />
            <Text style={[styles.actionButtonText, { color: tokens.error }]}>
              {t('delete')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Inline delete confirmation ── */
        <View
          style={[styles.confirmRow, { borderColor: tokens.error }]}
          testID={`vacancy-confirm-delete-${vacancy.id}`}
        >
          <Icon name="warning" size={16} color={tokens.error} />
          <Text style={[styles.confirmText, { color: tokens.error }]}>
            {t('delete')}?
          </Text>
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: tokens.error }]}
            onPress={() => { onDeleteConfirm(vacancy.id); }}
            disabled={isActing}
            accessibilityRole="button"
            accessibilityLabel={t('delete')}
            testID={`vacancy-confirm-yes-${vacancy.id}`}
          >
            {isActing ? (
              <ActivityIndicator size="small" color={tokens.background} />
            ) : (
              <Text style={[styles.confirmButtonText, { color: tokens.background }]}>
                {t('delete')}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: tokens.border }]}
            onPress={onDeleteCancel}
            disabled={isActing}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            testID={`vacancy-confirm-no-${vacancy.id}`}
          >
            <Text style={[styles.cancelButtonText, { color: tokens.textSecondary }]}>
              {t('cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsButton: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  postJobButtonText: {
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
  errorContainer: {
    paddingTop: 24,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    flexWrap: 'wrap',
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
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
  },
  // ── List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  // ── Card
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
  // ── Meta
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
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // ── Actions
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 36,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Delete confirmation
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  confirmButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cancelButton: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
