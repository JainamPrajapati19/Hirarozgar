/**
 * RoleSelectorScreen — presented to new users immediately after first OTP
 * verification.  Renders two large icon-labelled cards for Job Seeker and
 * Recruiter role selection, then calls POST /profile/role.
 *
 * Implements:
 *   - Req 3.1: Role selector presented on first login
 *   - Req 3.4: Duplicate role assignment blocked (server returns 409, handled here)
 *   - Req 3.6: Role immutable after assignment
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { assignRole, Role } from '../services/ProfileService';

// ─── Navigation prop shape ────────────────────────────────────────────────────

export interface RoleSelectorNavigationProp {
  /** Navigate to the Job Seeker profile collection screen. */
  navigateToSeekerProfile(): void;
  /** Navigate to the Recruiter profile collection screen. */
  navigateToRecruiterProfile(): void;
}

export interface RoleSelectorScreenProps {
  navigation: RoleSelectorNavigationProp;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RoleSelectorScreen
 *
 * Shows two large cards:
 *   1. Job Seeker  — icon: job_seeker
 *   2. Recruiter   — icon: recruiter
 *
 * On tap, calls POST /profile/role and navigates to the appropriate
 * profile collection screen on success.
 */
export function RoleSelectorScreen({ navigation }: RoleSelectorScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectRole = useCallback(async (role: Role) => {
    if (assigning) return;
    setAssigning(true);
    setError(null);

    try {
      await assignRole(role);
      if (role === 'seeker') {
        navigation.navigateToSeekerProfile();
      } else {
        navigation.navigateToRecruiterProfile();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('roleAssignError');
      setError(msg);
    } finally {
      setAssigning(false);
    }
  }, [assigning, navigation, t]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: tokens.background },
      ]}
    >
      {/* ── Header ── */}
      <Text style={[styles.appName, { color: tokens.primary }]}>
        {t('appName')}
      </Text>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>
        {t('selectRoleTitle')}
      </Text>
      <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
        {t('selectRoleSubtitle')}
      </Text>

      {/* ── Loading overlay ── */}
      {assigning ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={tokens.primary} size="large" />
          <Text style={[styles.loadingText, { color: tokens.textSecondary }]}>
            {t('assigningRole')}
          </Text>
        </View>
      ) : null}

      {/* ── Error message ── */}
      {error ? (
        <View style={[styles.errorBox, { borderColor: tokens.error, backgroundColor: tokens.surface }]}>
          <Icon name="error" size={18} color={tokens.error} />
          <Text
            style={[styles.errorText, { color: tokens.error }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        </View>
      ) : null}

      {/* ── Role cards ── */}
      <View style={styles.cardsContainer}>
        {/* Job Seeker card */}
        <RoleCard
          iconName="job_seeker"
          label={t('jobSeeker')}
          description={t('jobSeekerRoleDesc')}
          onPress={() => handleSelectRole('seeker')}
          disabled={assigning}
          tokens={tokens}
          testID="role-card-seeker"
        />

        {/* Recruiter card */}
        <RoleCard
          iconName="recruiter"
          label={t('recruiter')}
          description={t('recruiterRoleDesc')}
          onPress={() => handleSelectRole('recruiter')}
          disabled={assigning}
          tokens={tokens}
          testID="role-card-recruiter"
        />
      </View>
    </ScrollView>
  );
}

// ─── RoleCard sub-component ───────────────────────────────────────────────────

import { IconKey } from '../components/IconRegistry';

interface RoleCardProps {
  iconName: IconKey;
  label: string;
  description: string;
  onPress: () => void;
  disabled: boolean;
  tokens: ReturnType<typeof useTheme>['tokens'];
  testID?: string;
}

function RoleCard({
  iconName,
  label,
  description,
  onPress,
  disabled,
  tokens,
  testID,
}: RoleCardProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: tokens.card,
          borderColor: tokens.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Icon name={iconName} size={72} color={tokens.primary} />
      <Text style={[styles.cardLabel, { color: tokens.textPrimary }]}>
        {label}
      </Text>
      <Text style={[styles.cardDesc, { color: tokens.textSecondary }]}>
        {description}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  loadingRow: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    flexWrap: 'wrap',
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
    width: '100%',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 28,
    gap: 12,
    minWidth: 140,
    flex: 1,
    maxWidth: 180,
    // Shadow (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    // Elevation (Android)
    elevation: 3,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
