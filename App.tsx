import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Icon } from './src/components/Icon';
import { ThemeProvider } from './src/components/ThemeProvider';
import { LanguageProvider } from './src/components/LanguageProvider';
import { useLocale } from './src/hooks/useLocale';
import { useTheme } from './src/hooks/useTheme';
import { JobSeekerDashboardScreen } from './src/screens/JobSeekerDashboardScreen';
import { RecruiterDashboardScreen } from './src/screens/RecruiterDashboardScreen';
import { PostJobScreen } from './src/screens/PostJobScreen';
import { SettingsPanelScreen } from './src/screens/SettingsPanelScreen';
import { SeekerProfileScreen } from './src/screens/SeekerProfileScreen';
import { RecruiterProfileScreen } from './src/screens/RecruiterProfileScreen';
// Import IconRegistry to trigger validation at module load (Req 1.4)
import './src/components/IconRegistry';

// ─── App screen identifiers ───────────────────────────────────────────────────

type Screen =
  | 'demo'
  | 'seeker-dashboard'
  | 'recruiter-dashboard'
  | 'post-job'
  | 'settings'
  | 'seeker-profile-edit'
  | 'recruiter-profile-edit'
  | 'welcome';

/**
 * Main app content demonstrating i18n, LanguageProvider, and ThemeProvider wiring.
 *
 * Both the Job Seeker and Recruiter dashboards have a Settings button that opens
 * the SettingsPanelScreen. From Settings, the user can:
 *  - Change language (Req 1.5)
 *  - Toggle theme (Req 9.1)
 *  - Edit their profile (navigates to role-appropriate profile screen) (Req 3.5)
 *  - View payment receipts (Req 11.1–11.3)
 *  - Sign out (Req 10.1–10.4)
 */
function AppContent() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { theme, tokens } = useTheme();

  const [screen, setScreen] = useState<Screen>('demo');
  /**
   * Track which dashboard to return to after settings/profile edit.
   * 'seeker' | 'recruiter' — set when navigating to settings from a dashboard.
   */
  const [callerDashboard, setCallerDashboard] = useState<'seeker' | 'recruiter'>('seeker');

  // ── Helper: go back to whichever dashboard opened settings ───────────────
  const navigateBackToDashboard = () => {
    setScreen(callerDashboard === 'recruiter' ? 'recruiter-dashboard' : 'seeker-dashboard');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Seeker Dashboard
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'seeker-dashboard') {
    return (
      <>
        <JobSeekerDashboardScreen
          role="seeker"
          navigation={{
            navigateToSettings: () => {
              setCallerDashboard('seeker');
              setScreen('settings');
            },
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recruiter Dashboard
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'recruiter-dashboard') {
    return (
      <>
        <RecruiterDashboardScreen
          navigation={{
            navigateToPostJob: () => setScreen('post-job'),
            navigateToSettings: () => {
              setCallerDashboard('recruiter');
              setScreen('settings');
            },
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Post Job
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'post-job') {
    return (
      <>
        <PostJobScreen
          navigation={{ navigateBack: () => setScreen('recruiter-dashboard') }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settings Panel (Req 1.5, 3.5, 9.1, 10.1, 11.1)
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'settings') {
    return (
      <>
        <SettingsPanelScreen
          navigation={{
            navigateBack: navigateBackToDashboard,
            navigateToWelcome: () => setScreen('welcome'),
            navigateToEditProfile: () => {
              // Navigate to the role-appropriate profile edit screen
              setScreen(
                callerDashboard === 'recruiter'
                  ? 'recruiter-profile-edit'
                  : 'seeker-profile-edit',
              );
            },
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Seeker Profile Edit (from Settings)
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'seeker-profile-edit') {
    return (
      <>
        <SeekerProfileScreen
          editMode
          navigation={{
            navigateToDashboard: () => setScreen('seeker-dashboard'),
            navigateToSettings: () => setScreen('settings'),
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recruiter Profile Edit (from Settings)
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'recruiter-profile-edit') {
    return (
      <>
        <RecruiterProfileScreen
          editMode
          navigation={{
            navigateToDashboard: () => setScreen('recruiter-dashboard'),
            navigateToSettings: () => setScreen('settings'),
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Welcome / Auth (post sign-out destination)
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'welcome') {
    return (
      <View style={[styles.container, { backgroundColor: tokens.background }]}>
        <Icon name="home" size={64} color={tokens.primary} />
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('welcome')}</Text>
        <Text style={[styles.locale, { color: tokens.textSecondary }]}>
          {t('signOut')} {/* Placeholder — replace with real AuthScreen once wired */}
        </Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Default demo screen
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('welcome')}</Text>
      <Text style={[styles.locale, { color: tokens.textSecondary }]}>
        Current locale: {locale}
      </Text>
      <Text style={[styles.locale, { color: tokens.textSecondary }]}>
        Current theme: {theme}
      </Text>

      {/* Icon demo — show a few icons to verify IconRegistry works */}
      <View style={styles.iconDemo}>
        <Text style={[styles.demoTitle, { color: tokens.textPrimary }]}>Icon Demo:</Text>
        <View style={styles.iconRow}>
          <Icon name="home" size={32} color={tokens.textPrimary} />
          <Icon name="settings" size={32} color={tokens.textPrimary} />
          <Icon name="profile" size={32} color={tokens.textPrimary} />
          <Icon name="logout" size={32} color={tokens.textPrimary} />
        </View>
        <View style={styles.iconRow}>
          <Icon name="job_seeker" size={32} color={tokens.textPrimary} />
          <Icon name="recruiter" size={32} color={tokens.textPrimary} />
          <Icon name="apply" size={32} color={tokens.textPrimary} />
          <Icon name="search" size={32} color={tokens.textPrimary} />
        </View>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  locale: {
    fontSize: 14,
  },
  iconDemo: {
    marginTop: 30,
    alignItems: 'center',
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
});
