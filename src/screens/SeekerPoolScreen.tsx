/**
 * SeekerPoolScreen — lets a subscribed Recruiter browse the public Seeker Pool.
 *
 * Displays all active Job Seeker Inquiries as a scrollable list. Each entry shows:
 *   - Seeker name
 *   - Skills (as chips)
 *   - Expected pay (₹/day)
 *   - "Contact" button that reveals the seeker's mobile number inline on tap
 *
 * Implements:
 *   - Req 7.2: List active inquiries for subscribed recruiters with contact reveal
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
import { listSeekerPool, SeekerPoolEntry } from '../services/SeekerPoolService';

// ─── Sub-type for pool entries with resolved name ────────────────────────────

/**
 * The server returns `PublicSeekerInquiry` which has `seekerName` (camelCase).
 * The mobile `SeekerPoolEntry` extends `SeekerInquiry` with `seeker_name`.
 * We handle both shapes here via a unified display type.
 */
interface DisplayEntry {
  id: string;
  seekerName: string;
  mobile: string;
  skills: string[];
  expected_pay: string;
}

function toDisplayEntry(entry: SeekerPoolEntry): DisplayEntry {
  return {
    id: entry.id,
    // The server returns `seekerName` in PublicSeekerInquiry; the mobile type
    // uses `seeker_name`. Handle both so the screen works regardless of
    // which field name the backend actually sends.
    seekerName:
      (entry as unknown as { seekerName?: string | null }).seekerName ??
      entry.seeker_name ??
      '—',
    mobile: entry.mobile,
    skills: entry.skills,
    expected_pay: entry.expected_pay,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SeekerPoolScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Tracks which entry has its contact number revealed (Req 7.2)
  const [revealedId, setRevealedId] = useState<string | null>(null);

  // ── Fetch pool ─────────────────────────────────────────────────────────────

  const fetchPool = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setRevealedId(null);
    try {
      const data = await listSeekerPool();
      setEntries(data.map(toDisplayEntry));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('seekerPoolError');
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchPool();
  }, [fetchPool]);

  // ── Toggle contact reveal ──────────────────────────────────────────────────

  const handleContactToggle = useCallback((id: string) => {
    setRevealedId((prev) => (prev === id ? null : id));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Icon name="pool" size={28} color={tokens.primary} />
        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
          {t('seekerPoolTitle')}
        </Text>
      </View>

      {/* ── Loading state ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={tokens.primary}
            accessibilityLabel={t('loadingInquiries')}
            testID="seeker-pool-loading"
          />
          <Text style={[styles.statusText, { color: tokens.textSecondary }]}>
            {t('loadingInquiries')}
          </Text>
        </View>
      ) : fetchError ? (
        /* ── Error state ── */
        <View style={styles.centered}>
          <Icon name="error" size={40} color={tokens.error} />
          <Text
            style={[styles.statusText, { color: tokens.error }]}
            accessibilityRole="alert"
            testID="seeker-pool-error"
          >
            {fetchError}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: tokens.primary }]}
            onPress={() => { void fetchPool(); }}
            accessibilityRole="button"
            accessibilityLabel={t('retryButton')}
            testID="seeker-pool-retry-button"
          >
            <Icon name="retry" size={18} color={tokens.background} />
            <Text style={[styles.retryButtonText, { color: tokens.background }]}>
              {t('retryButton')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        /* ── Empty state ── */
        <View style={styles.centered} testID="seeker-pool-empty">
          <Icon name="empty_state" size={64} color={tokens.textDisabled} />
          <Text style={[styles.statusText, { color: tokens.textSecondary }]}>
            {t('seekerPoolEmpty')}
          </Text>
        </View>
      ) : (
        /* ── Seeker entry list ── */
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          testID="seeker-pool-list"
          renderItem={({ item }) => (
            <SeekerEntryCard
              entry={item}
              tokens={tokens}
              t={t}
              isContactRevealed={revealedId === item.id}
              onContactToggle={handleContactToggle}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── SeekerEntryCard sub-component ───────────────────────────────────────────

interface SeekerEntryCardProps {
  entry: DisplayEntry;
  tokens: ReturnType<typeof useTheme>['tokens'];
  t: (key: string) => string;
  isContactRevealed: boolean;
  onContactToggle(id: string): void;
}

function SeekerEntryCard({
  entry,
  tokens,
  t,
  isContactRevealed,
  onContactToggle,
}: SeekerEntryCardProps): React.ReactElement {
  return (
    <View
      style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
      testID={`seeker-entry-${entry.id}`}
    >
      {/* ── Seeker name ── */}
      <View style={styles.nameRow}>
        <Icon name="profile" size={18} color={tokens.primary} />
        <Text
          style={[styles.seekerName, { color: tokens.textPrimary }]}
          numberOfLines={1}
          testID={`seeker-name-${entry.id}`}
        >
          {entry.seekerName}
        </Text>
      </View>

      {/* ── Skills label + chips ── */}
      <View style={styles.skillsSection}>
        <View style={styles.skillsLabelRow}>
          <Icon name="skills" size={14} color={tokens.textSecondary} />
          <Text style={[styles.skillsLabel, { color: tokens.textSecondary }]}>
            {t('skillsLabel')}
          </Text>
        </View>
        <View style={styles.chipsRow}>
          {entry.skills.map((skill) => (
            <View
              key={skill}
              style={[
                styles.chip,
                {
                  backgroundColor: tokens.primary + '18',
                  borderColor: tokens.primary,
                },
              ]}
              testID={`skill-chip-${entry.id}-${skill}`}
            >
              <Text style={[styles.chipText, { color: tokens.primary }]}>
                {skill}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Expected pay ── */}
      <View style={styles.payRow}>
        <Icon name="salary" size={16} color={tokens.textSecondary} />
        <Text style={[styles.payLabel, { color: tokens.textSecondary }]}>
          {t('expectedPayPerDay')}
        </Text>
        <Text
          style={[styles.payAmount, { color: tokens.textPrimary }]}
          testID={`expected-pay-${entry.id}`}
        >
          ₹{entry.expected_pay}
        </Text>
      </View>

      {/* ── Contact button / revealed number ── */}
      {isContactRevealed ? (
        <TouchableOpacity
          style={[
            styles.contactRevealedRow,
            { backgroundColor: tokens.success + '18', borderColor: tokens.success },
          ]}
          onPress={() => { onContactToggle(entry.id); }}
          accessibilityRole="button"
          accessibilityLabel={entry.mobile}
          testID={`contact-reveal-${entry.id}`}
        >
          <Icon name="phone" size={18} color={tokens.success} />
          <Text
            style={[styles.mobileText, { color: tokens.success }]}
            testID={`mobile-number-${entry.id}`}
          >
            {entry.mobile}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.contactButton, { backgroundColor: tokens.primary }]}
          onPress={() => { onContactToggle(entry.id); }}
          accessibilityRole="button"
          accessibilityLabel={t('contactButton')}
          testID={`contact-button-${entry.id}`}
        >
          <Icon name="contact" size={18} color={tokens.background} />
          <Text style={[styles.contactButtonText, { color: tokens.background }]}>
            {t('contactButton')}
          </Text>
        </TouchableOpacity>
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  // ── States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  statusText: {
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
    gap: 12,
  },
  // ── Name row
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seekerName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  // ── Skills
  skillsSection: {
    gap: 6,
  },
  skillsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skillsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // ── Pay row
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payLabel: {
    fontSize: 13,
    flex: 1,
  },
  payAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  // ── Contact button
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    paddingVertical: 11,
    minHeight: 44,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Revealed contact
  contactRevealedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
  },
  mobileText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    flex: 1,
  },
});
