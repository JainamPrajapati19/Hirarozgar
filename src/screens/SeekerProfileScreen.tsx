/**
 * SeekerProfileScreen — collects Job Seeker profile data:
 *   full_name (≤100 chars), age (1–99), experience_years (0–99),
 *   experience_months (0–11).
 *
 * Shows field-level validation errors inline.
 * On persistence failure, retains role and shows retry option.
 *
 * Implements:
 *   - Req 3.2: Seeker fields collected and persisted
 *   - Req 3.5: Profile editable from Settings; persists within 3 s
 */

import React, { useCallback, useState } from 'react';
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
import {
  updateProfile,
  SeekerProfile,
  FieldValidationError,
} from '../services/ProfileService';

// ─── Navigation prop shape ────────────────────────────────────────────────────

export interface SeekerProfileNavigationProp {
  /** Navigate to the Dashboard after successful save. */
  navigateToDashboard(): void;
  /** Navigate to Settings after a save failure so user can retry later. */
  navigateToSettings(): void;
}

export interface SeekerProfileScreenProps {
  navigation: SeekerProfileNavigationProp;
  /** When `true`, this is opened from Settings (edit mode) rather than onboarding. */
  editMode?: boolean;
  /** Pre-filled values when opened in edit mode. */
  initialValues?: Partial<SeekerProfile>;
}

// ─── Field validation ─────────────────────────────────────────────────────────

interface FormErrors {
  full_name?: string;
  age?: string;
  experience_years?: string;
  experience_months?: string;
}

function validateLocally(
  full_name: string,
  age: string,
  experience_years: string,
  experience_months: string,
  t: (key: string) => string,
): FormErrors {
  const errors: FormErrors = {};

  if (full_name.trim().length === 0) {
    errors.full_name = t('fieldRequired');
  } else if (full_name.trim().length > 100) {
    errors.full_name = t('fullNameMaxLength');
  }

  if (age.length > 0) {
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 99) {
      errors.age = t('ageRange');
    }
  }

  if (experience_years.length > 0) {
    const yearsNum = parseInt(experience_years, 10);
    if (isNaN(yearsNum) || yearsNum < 0 || yearsNum > 99) {
      errors.experience_years = t('experienceYearsRange');
    }
  }

  if (experience_months.length > 0) {
    const monthsNum = parseInt(experience_months, 10);
    if (isNaN(monthsNum) || monthsNum < 0 || monthsNum > 11) {
      errors.experience_months = t('experienceMonthsRange');
    }
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SeekerProfileScreen({
  navigation,
  editMode = false,
  initialValues = {},
}: SeekerProfileScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const [fullName, setFullName] = useState(initialValues.full_name ?? '');
  const [age, setAge] = useState(
    initialValues.age != null ? String(initialValues.age) : '',
  );
  const [expYears, setExpYears] = useState(
    initialValues.experience_years != null
      ? String(initialValues.experience_years)
      : '',
  );
  const [expMonths, setExpMonths] = useState(
    initialValues.experience_months != null
      ? String(initialValues.experience_months)
      : '',
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaveError(null);
    setSavedOk(false);

    const localErrors = validateLocally(fullName, age, expYears, expMonths, t);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const payload: Partial<SeekerProfile> = {
      full_name: fullName.trim(),
      age: age.length > 0 ? parseInt(age, 10) : null,
      experience_years: expYears.length > 0 ? parseInt(expYears, 10) : null,
      experience_months: expMonths.length > 0 ? parseInt(expMonths, 10) : null,
    };

    try {
      await updateProfile(payload);
      setSavedOk(true);
      if (!editMode) {
        navigation.navigateToDashboard();
      }
    } catch (err) {
      if (err instanceof FieldValidationError) {
        const serverErrors: FormErrors = {};
        for (const fe of err.fields) {
          (serverErrors as Record<string, string>)[fe.field] = fe.message;
        }
        setErrors(serverErrors);
      } else {
        // Req 3.2: on persistence failure, role is retained; retry from Settings
        setSaveError(t('profileSaveError'));
      }
    } finally {
      setSaving(false);
    }
  }, [saving, fullName, age, expYears, expMonths, t, editMode, navigation]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: tokens.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Icon name="profile" size={40} color={tokens.primary} />
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            {t('seekerProfileTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            {t('seekerProfileSubtitle')}
          </Text>
        </View>

        {/* ── Full Name ── */}
        <FieldGroup
          iconName="profile"
          label={t('fullName')}
          error={errors.full_name}
          tokens={tokens}
        >
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (errors.full_name) setErrors((e) => ({ ...e, full_name: undefined }));
            }}
            placeholder={t('fullName')}
            placeholderTextColor={tokens.textDisabled}
            maxLength={100}
            returnKeyType="next"
            accessibilityLabel={t('fullName')}
            testID="seeker-full-name-input"
          />
        </FieldGroup>

        {/* ── Age ── */}
        <FieldGroup
          iconName="profile"
          label={t('age')}
          error={errors.age}
          tokens={tokens}
        >
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={age}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '').slice(0, 2);
              setAge(digits);
              if (errors.age) setErrors((e) => ({ ...e, age: undefined }));
            }}
            placeholder="1–99"
            placeholderTextColor={tokens.textDisabled}
            keyboardType="number-pad"
            maxLength={2}
            returnKeyType="next"
            accessibilityLabel={t('age')}
            testID="seeker-age-input"
          />
        </FieldGroup>

        {/* ── Experience ── */}
        <View style={styles.fieldLabel}>
          <Icon name="history" size={20} color={tokens.textSecondary} />
          <Text style={[styles.labelText, { color: tokens.textSecondary }]}>
            {t('experienceLabel')}
          </Text>
        </View>
        <View style={styles.experienceRow}>
          {/* Years */}
          <View style={styles.experienceField}>
            <View
              style={[
                styles.inputRow,
                {
                  borderColor: errors.experience_years ? tokens.error : tokens.border,
                  backgroundColor: tokens.surface,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: tokens.textPrimary }]}
                value={expYears}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, 2);
                  setExpYears(digits);
                  if (errors.experience_years)
                    setErrors((e) => ({ ...e, experience_years: undefined }));
                }}
                placeholder="0"
                placeholderTextColor={tokens.textDisabled}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
                accessibilityLabel={t('years')}
                testID="seeker-exp-years-input"
              />
            </View>
            <Text style={[styles.unitLabel, { color: tokens.textSecondary }]}>
              {t('yearsLabel')}
            </Text>
            {errors.experience_years ? (
              <Text style={[styles.fieldError, { color: tokens.error }]}>
                {errors.experience_years}
              </Text>
            ) : null}
          </View>

          {/* Months */}
          <View style={styles.experienceField}>
            <View
              style={[
                styles.inputRow,
                {
                  borderColor: errors.experience_months ? tokens.error : tokens.border,
                  backgroundColor: tokens.surface,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: tokens.textPrimary }]}
                value={expMonths}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, 2);
                  setExpMonths(digits);
                  if (errors.experience_months)
                    setErrors((e) => ({ ...e, experience_months: undefined }));
                }}
                placeholder="0"
                placeholderTextColor={tokens.textDisabled}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                accessibilityLabel={t('months')}
                testID="seeker-exp-months-input"
              />
            </View>
            <Text style={[styles.unitLabel, { color: tokens.textSecondary }]}>
              {t('monthsLabel')}
            </Text>
            {errors.experience_months ? (
              <Text style={[styles.fieldError, { color: tokens.error }]}>
                {errors.experience_months}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── Save error ── */}
        {saveError ? (
          <View style={[styles.errorBox, { borderColor: tokens.error, backgroundColor: tokens.surface }]}>
            <Icon name="error" size={18} color={tokens.error} />
            <View style={styles.errorContent}>
              <Text
                style={[styles.errorText, { color: tokens.error }]}
                accessibilityRole="alert"
              >
                {saveError}
              </Text>
              {!editMode ? (
                <TouchableOpacity
                  onPress={navigation.navigateToSettings}
                  accessibilityRole="button"
                  accessibilityLabel={t('retryFromSettings')}
                  testID="seeker-retry-settings-button"
                >
                  <Text style={[styles.retryLink, { color: tokens.primary }]}>
                    {t('retryFromSettings')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── Success message (edit mode) ── */}
        {savedOk && editMode ? (
          <View style={[styles.successBox, { borderColor: tokens.success, backgroundColor: tokens.surface }]}>
            <Icon name="success" size={18} color={tokens.success} />
            <Text style={[styles.successText, { color: tokens.success }]}>
              {t('profileSaved')}
            </Text>
          </View>
        ) : null}

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: saving ? tokens.primaryDisabled : tokens.primary },
          ]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t('save')}
          accessibilityState={{ disabled: saving, busy: saving }}
          testID="seeker-save-button"
        >
          {saving ? (
            <ActivityIndicator color={tokens.background} size="small" />
          ) : (
            <View style={styles.saveButtonInner}>
              <Icon name="save" size={20} color={tokens.background} />
              <Text style={[styles.saveButtonText, { color: tokens.background }]}>
                {saving ? t('savingProfile') : t('save')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── FieldGroup sub-component ─────────────────────────────────────────────────

import { IconKey } from '../components/IconRegistry';

interface FieldGroupProps {
  iconName: IconKey;
  label: string;
  error?: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
  children: React.ReactNode;
}

function FieldGroup({ iconName, label, error, tokens, children }: FieldGroupProps): React.ReactElement {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabel}>
        <Icon name={iconName} size={20} color={tokens.textSecondary} />
        <Text style={[styles.labelText, { color: tokens.textSecondary }]}>{label}</Text>
      </View>
      <View
        style={[
          styles.inputRow,
          {
            borderColor: error ? tokens.error : tokens.border,
            backgroundColor: tokens.surface,
          },
        ]}
      >
        {children}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Icon name="error" size={14} color={tokens.error} />
          <Text style={[styles.fieldError, { color: tokens.error }]} accessibilityRole="alert">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fieldError: {
    fontSize: 12,
    flex: 1,
    flexWrap: 'wrap',
  },
  experienceRow: {
    flexDirection: 'row',
    gap: 16,
  },
  experienceField: {
    flex: 1,
    gap: 4,
  },
  unitLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorContent: {
    flex: 1,
    gap: 4,
  },
  errorText: {
    fontSize: 13,
    flexWrap: 'wrap',
  },
  retryLink: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  saveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
