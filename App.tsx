/**
 * App.tsx — HiraRozgar root navigator.
 *
 * Full navigation flow:
 *   auth → role-selector → seeker-profile / recruiter-profile
 *        → seeker-dashboard / recruiter-dashboard
 *        → post-job (recruiter only)
 *        → seeker-pool (recruiter only)
 *        → raise-inquiry (seeker only)
 *        → settings → edit-seeker-profile / edit-recruiter-profile
 *
 * On sign-out the user is returned to 'auth'.
 */

import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider } from './src/components/ThemeProvider';
import { LanguageProvider } from './src/components/LanguageProvider';

// Screen imports
import { AuthScreen } from './src/screens/AuthScreen';
import { RoleSelectorScreen } from './src/screens/RoleSelectorScreen';
import { SeekerProfileScreen } from './src/screens/SeekerProfileScreen';
import { RecruiterProfileScreen } from './src/screens/RecruiterProfileScreen';
import { JobSeekerDashboardScreen } from './src/screens/JobSeekerDashboardScreen';
import { RecruiterDashboardScreen } from './src/screens/RecruiterDashboardScreen';
import { PostJobScreen } from './src/screens/PostJobScreen';
import { SeekerPoolScreen } from './src/screens/SeekerPoolScreen';
import { RaiseInquiryScreen } from './src/screens/RaiseInquiryScreen';
import { SettingsPanelScreen } from './src/screens/SettingsPanelScreen';

// Trigger IconRegistry validation at startup (Req 1.4)
import './src/components/IconRegistry';

// ─── Screen type ──────────────────────────────────────────────────────────────

type Screen =
  | 'auth'
  | 'role-selector'
  | 'seeker-profile'
  | 'recruiter-profile'
  | 'seeker-dashboard'
  | 'recruiter-dashboard'
  | 'post-job'
  | 'seeker-pool'
  | 'raise-inquiry'
  | 'settings'
  | 'edit-seeker-profile'
  | 'edit-recruiter-profile';

// ─── AppContent ───────────────────────────────────────────────────────────────

function AppContent(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('auth');

  // Track which dashboard called settings so we can navigate back correctly.
  const [callerRole, setCallerRole] = useState<'seeker' | 'recruiter'>('seeker');

  const goToDashboard = (role: 'seeker' | 'recruiter') => {
    setCallerRole(role);
    setScreen(role === 'seeker' ? 'seeker-dashboard' : 'recruiter-dashboard');
  };

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (screen === 'auth') {
    return (
      <>
        <AuthScreen
          navigation={{
            replace: (dest) => {
              if (dest === 'RoleSelector') setScreen('role-selector');
              else if (dest === 'Dashboard') {
                // Role already set — go to appropriate dashboard.
                // We default to seeker; the dashboard will load the real role.
                setScreen('seeker-dashboard');
              }
            },
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Role Selector ─────────────────────────────────────────────────────────
  if (screen === 'role-selector') {
    return (
      <>
        <RoleSelectorScreen
          navigation={{
            navigateToSeekerProfile: () => setScreen('seeker-profile'),
            navigateToRecruiterProfile: () => setScreen('recruiter-profile'),
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Seeker Profile (onboarding) ───────────────────────────────────────────
  if (screen === 'seeker-profile') {
    return (
      <>
        <SeekerProfileScreen
          navigation={{
            navigateToDashboard: () => goToDashboard('seeker'),
            navigateToSettings: () => {
              setCallerRole('seeker');
              setScreen('settings');
            },
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Recruiter Profile (onboarding) ────────────────────────────────────────
  if (screen === 'recruiter-profile') {
    return (
      <>
        <RecruiterProfileScreen
          navigation={{
            navigateToDashboard: () => goToDashboard('recruiter'),
            navigateToSettings: () => {
              setCallerRole('recruiter');
              setScreen('settings');
            },
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Job Seeker Dashboard ──────────────────────────────────────────────────
  if (screen === 'seeker-dashboard') {
    return (
      <>
        <JobSeekerDashboardScreen
          role="seeker"
          navigation={{
            navigateToSettings: () => {
              setCallerRole('seeker');
              setScreen('settings');
            },
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Recruiter Dashboard ───────────────────────────────────────────────────
  if (screen === 'recruiter-dashboard') {
    return (
      <>
        <RecruiterDashboardScreen
          navigation={{
            navigateToPostJob: () => setScreen('post-job'),
            navigateToSettings: () => {
              setCallerRole('recruiter');
              setScreen('settings');
            },
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Post Job ──────────────────────────────────────────────────────────────
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

  // ── Seeker Pool ───────────────────────────────────────────────────────────
  if (screen === 'seeker-pool') {
    return (
      <>
        <SeekerPoolScreen />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Raise Inquiry ─────────────────────────────────────────────────────────
  if (screen === 'raise-inquiry') {
    return (
      <>
        <RaiseInquiryScreen
          navigation={{ navigateBack: () => setScreen('seeker-dashboard') }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  if (screen === 'settings') {
    return (
      <>
        <SettingsPanelScreen
          navigation={{
            navigateBack: () => goToDashboard(callerRole),
            navigateToWelcome: () => setScreen('auth'),
            navigateToEditProfile: () =>
              setScreen(
                callerRole === 'recruiter'
                  ? 'edit-recruiter-profile'
                  : 'edit-seeker-profile',
              ),
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Edit Seeker Profile (from Settings) ───────────────────────────────────
  if (screen === 'edit-seeker-profile') {
    return (
      <>
        <SeekerProfileScreen
          editMode
          navigation={{
            navigateToDashboard: () => goToDashboard('seeker'),
            navigateToSettings: () => setScreen('settings'),
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // ── Edit Recruiter Profile (from Settings) ────────────────────────────────
  if (screen === 'edit-recruiter-profile') {
    return (
      <>
        <RecruiterProfileScreen
          editMode
          navigation={{
            navigateToDashboard: () => goToDashboard('recruiter'),
            navigateToSettings: () => setScreen('settings'),
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // Fallback (should never be reached)
  return <></>;
}

// ─── Root export ──────────────────────────────────────────────────────────────

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
