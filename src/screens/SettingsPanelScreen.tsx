/**
 * SettingsPanelScreen — a full-screen wrapper around the SettingsPanel component.
 *
 * Provides:
 *  - A header with a back button and "Settings" title
 *  - Navigation callbacks injected into <SettingsPanel>:
 *      onSignedOut   → caller navigates to Welcome Screen
 *      onEditProfile → caller navigates to the role-appropriate profile screen
 *
 * This thin wrapper keeps SettingsPanel free of navigation library imports
 * while giving the screen a proper header chrome for both dashboards.
 */

import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../components/Icon';
import { SettingsPanel } from '../components/SettingsPanel';
import { useTheme } from '../hooks/useTheme';

// ─── Navigation prop shape ────────────────────────────────────────────────────

export interface SettingsPanelNavigationProp {
  /** Navigate back to the caller's dashboard. */
  navigateBack(): void;
  /** Called after sign-out; navigate to the Welcome / Auth screen. */
  navigateToWelcome(): void;
  /** Navigate to role-appropriate profile edit screen. */
  navigateToEditProfile(): void;
}

export interface SettingsPanelScreenProps {
  navigation: SettingsPanelNavigationProp;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsPanelScreen({
  navigation,
}: SettingsPanelScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: tokens.background }]}
      testID="settings-panel-screen"
    >
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={navigation.navigateBack}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          testID="settings-back-btn"
        >
          <Icon name="back" size={24} color={tokens.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleRow}>
          <Icon name="settings" size={22} color={tokens.textPrimary} />
          <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
            {t('settings')}
          </Text>
        </View>

        {/* Spacer so title stays centred */}
        <View style={styles.headerRightSpacer} />
      </View>

      {/* ── Settings content ── */}
      <SettingsPanel
        onSignedOut={navigation.navigateToWelcome}
        onEditProfile={navigation.navigateToEditProfile}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRightSpacer: {
    minWidth: 36,
  },
});
