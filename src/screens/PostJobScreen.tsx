/**
 * PostJobScreen — lets a Recruiter post a new job vacancy.
 *
 * Fields:
 *   - title      (with autocomplete from getAutocompleteSuggestions)
 *   - salary     (numeric, ₹)
 *   - area       (text)
 *   - description (multiline, optional)
 *   - job_type   (toggle: Chhutak | Fixed)
 *
 * Shows field-level validation errors inline, same pattern as RecruiterProfileScreen.
 * On success → brief success message and form reset.
 * On VacancyValidationError → maps server errors to field errors.
 * On other errors → generic error message.
 *
 * Implements:
 *   - Req 5.1: All required fields validated; record not created on invalid input
 *   - Req 5.3: New job titles automatically added to master_dictionary
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { IconKey } from '../components/IconRegistry';
import { useTheme } from '../hooks/useTheme';
import { getAutocompleteSuggestions } from '../services/autocompleteService';
import {
  createVacancy,
  VacancyValidationError,
  JobType,
} from '../services/JobService';

// ─── Navigation prop shape ────────────────────────────────────────────────────

export interface PostJobNavigationProp {
  navigateBack(): void;
}

export interface PostJobScreenProps {
  navigation: PostJobNavigationProp;
}

// ─── Local form types ─────────────────────────────────────────────────────────

interface FormErrors {
  title?: string;
  salary?: string;
  area?: string;
  description?: string;
  job_type?: string;
}

// ─── Local validation ─────────────────────────────────────────────────────────

function validateLocally(
  title: string,
  salary: string,
  area: string,
  t: (key: string) => string,
): FormErrors {
  const errors: FormErrors = {};

  if (title.trim().length === 0) {
    errors.title = t('fieldRequired');
  }

  if (salary.trim().length === 0) {
    errors.salary = t('fieldRequired');
  } else {
    const salaryNum = parseFloat(salary);
    if (!Number.isFinite(salaryNum) || salaryNum <= 0) {
      errors.salary = t('salaryInvalid');
    }
  }

  if (area.trim().length === 0) {
    errors.area = t('fieldRequired');
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PostJobScreen({ navigation }: PostJobScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  // ── Form state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [salary, setSalary] = useState('');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [jobType, setJobType] = useState<JobType>('chhutak');

  // ── UI state ────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // ── Autocomplete state ──────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Autocomplete fetch with debounce ────────────────────────────────────
  const handleTitleChange = useCallback((text: string) => {
    setTitle(text);
    if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
    setSavedOk(false);

    if (autocompleteDebounce.current) {
      clearTimeout(autocompleteDebounce.current);
    }

    if (text.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    autocompleteDebounce.current = setTimeout(async () => {
      try {
        const results = await getAutocompleteSuggestions(text);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 200);
  }, [errors.title]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autocompleteDebounce.current) {
        clearTimeout(autocompleteDebounce.current);
      }
    };
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setTitle(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
  }, [errors.title]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (saving) return;
    setSaveError(null);
    setSavedOk(false);
    setShowSuggestions(false);

    const localErrors = validateLocally(title, salary, area, t);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      await createVacancy({
        title: title.trim(),
        salary: parseFloat(salary),
        area: area.trim(),
        description: description.trim().length > 0 ? description.trim() : undefined,
        job_type: jobType,
      });

      // Success: show message and reset form
      setSavedOk(true);
      setTitle('');
      setSalary('');
      setArea('');
      setDescription('');
      setJobType('chhutak');
    } catch (err) {
      if (err instanceof VacancyValidationError) {
        const serverErrors: FormErrors = {};
        for (const fe of err.fields) {
          (serverErrors as Record<string, string>)[fe.field] = fe.message;
        }
        setErrors(serverErrors);
      } else {
        setSaveError(t('jobPostError'));
      }
    } finally {
      setSaving(false);
    }
  }, [saving, title, salary, area, description, jobType, t]);

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
          <Icon name="recruiter" size={40} color={tokens.primary} />
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            {t('postJobTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            {t('postJobSubtitle')}
          </Text>
        </View>

        {/* ── Job Title (with autocomplete) ── */}
        <FieldGroup
          iconName="skills"
          label={t('jobTitle')}
          error={errors.title}
          tokens={tokens}
        >
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={title}
            onChangeText={handleTitleChange}
            placeholder={t('titlePlaceholder')}
            placeholderTextColor={tokens.textDisabled}
            returnKeyType="next"
            accessibilityLabel={t('jobTitle')}
            testID="post-job-title-input"
          />
          {showSuggestions ? (
            <TouchableOpacity
              onPress={() => setShowSuggestions(false)}
              style={styles.autocompleteCloseBtn}
              accessibilityLabel="close suggestions"
            >
              <Icon name="cancel" size={16} color={tokens.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </FieldGroup>

        {/* ── Autocomplete dropdown ── */}
        {showSuggestions ? (
          <View
            style={[
              styles.suggestionsContainer,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.suggestionItem, { borderBottomColor: tokens.border }]}
                  onPress={() => handleSelectSuggestion(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item}
                >
                  <Icon name="autocomplete" size={14} color={tokens.textSecondary} />
                  <Text style={[styles.suggestionText, { color: tokens.textPrimary }]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}

        {/* ── Salary ── */}
        <FieldGroup
          iconName="salary"
          label={`${t('salary')} (₹)`}
          error={errors.salary}
          tokens={tokens}
        >
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={salary}
            onChangeText={(text) => {
              // Allow digits and a single decimal point
              const cleaned = text.replace(/[^0-9.]/g, '');
              setSalary(cleaned);
              if (errors.salary) setErrors((e) => ({ ...e, salary: undefined }));
              setSavedOk(false);
            }}
            placeholder={t('salaryPlaceholder')}
            placeholderTextColor={tokens.textDisabled}
            keyboardType="decimal-pad"
            returnKeyType="next"
            accessibilityLabel={t('salary')}
            testID="post-job-salary-input"
          />
        </FieldGroup>

        {/* ── Area ── */}
        <FieldGroup
          iconName="location"
          label={t('area')}
          error={errors.area}
          tokens={tokens}
        >
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={area}
            onChangeText={(text) => {
              setArea(text);
              if (errors.area) setErrors((e) => ({ ...e, area: undefined }));
              setSavedOk(false);
            }}
            placeholder={t('areaPlaceholder')}
            placeholderTextColor={tokens.textDisabled}
            returnKeyType="next"
            accessibilityLabel={t('area')}
            testID="post-job-area-input"
          />
        </FieldGroup>

        {/* ── Description (optional) ── */}
        <FieldGroup
          iconName="edit"
          label={t('description')}
          error={errors.description}
          tokens={tokens}
        >
          <TextInput
            style={[styles.multilineInput, { color: tokens.textPrimary }]}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (errors.description) setErrors((e) => ({ ...e, description: undefined }));
              setSavedOk(false);
            }}
            placeholder={t('descriptionPlaceholder')}
            placeholderTextColor={tokens.textDisabled}
            multiline
            numberOfLines={3}
            returnKeyType="default"
            accessibilityLabel={t('description')}
            testID="post-job-description-input"
          />
        </FieldGroup>

        {/* ── Job Type toggle ── */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Icon name={jobType === 'chhutak' ? 'chhutak' : 'fixed'} size={20} color={tokens.textSecondary} />
            <Text style={[styles.labelText, { color: tokens.textSecondary }]}>{t('jobType')}</Text>
          </View>
          <View style={styles.jobTypeRow}>
            <TouchableOpacity
              style={[
                styles.jobTypeBtn,
                {
                  backgroundColor: jobType === 'chhutak' ? tokens.primary : tokens.surface,
                  borderColor: jobType === 'chhutak' ? tokens.primary : tokens.border,
                },
              ]}
              onPress={() => {
                setJobType('chhutak');
                setSavedOk(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('chhutak')}
              accessibilityState={{ selected: jobType === 'chhutak' }}
              testID="post-job-type-chhutak"
            >
              <Icon
                name="chhutak"
                size={18}
                color={jobType === 'chhutak' ? tokens.background : tokens.textSecondary}
              />
              <Text
                style={[
                  styles.jobTypeBtnText,
                  { color: jobType === 'chhutak' ? tokens.background : tokens.textPrimary },
                ]}
              >
                {t('chhutak')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.jobTypeBtn,
                {
                  backgroundColor: jobType === 'fixed' ? tokens.primary : tokens.surface,
                  borderColor: jobType === 'fixed' ? tokens.primary : tokens.border,
                },
              ]}
              onPress={() => {
                setJobType('fixed');
                setSavedOk(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('fixed')}
              accessibilityState={{ selected: jobType === 'fixed' }}
              testID="post-job-type-fixed"
            >
              <Icon
                name="fixed"
                size={18}
                color={jobType === 'fixed' ? tokens.background : tokens.textSecondary}
              />
              <Text
                style={[
                  styles.jobTypeBtnText,
                  { color: jobType === 'fixed' ? tokens.background : tokens.textPrimary },
                ]}
              >
                {t('fixed')}
              </Text>
            </TouchableOpacity>
          </View>
          {errors.job_type ? (
            <View style={styles.errorRow}>
              <Icon name="error" size={14} color={tokens.error} />
              <Text
                style={[styles.fieldError, { color: tokens.error }]}
                accessibilityRole="alert"
              >
                {errors.job_type}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Generic error ── */}
        {saveError ? (
          <View
            style={[
              styles.errorBox,
              { borderColor: tokens.error, backgroundColor: tokens.surface },
            ]}
          >
            <Icon name="error" size={18} color={tokens.error} />
            <Text
              style={[styles.errorText, { color: tokens.error }]}
              accessibilityRole="alert"
            >
              {saveError}
            </Text>
          </View>
        ) : null}

        {/* ── Success message ── */}
        {savedOk ? (
          <View
            style={[
              styles.successBox,
              { borderColor: tokens.success, backgroundColor: tokens.surface },
            ]}
          >
            <Icon name="success" size={18} color={tokens.success} />
            <Text style={[styles.successText, { color: tokens.success }]}>
              {t('jobPostSuccess')}
            </Text>
          </View>
        ) : null}

        {/* ── Submit button ── */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: saving ? tokens.primaryDisabled : tokens.primary },
          ]}
          onPress={handleSubmit}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t('postJob')}
          accessibilityState={{ disabled: saving, busy: saving }}
          testID="post-job-submit-button"
        >
          {saving ? (
            <ActivityIndicator color={tokens.background} size="small" />
          ) : (
            <View style={styles.saveButtonInner}>
              <Icon name="save" size={20} color={tokens.background} />
              <Text style={[styles.saveButtonText, { color: tokens.background }]}>
                {t('postJob')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── FieldGroup sub-component ─────────────────────────────────────────────────

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
          <Text
            style={[styles.fieldError, { color: tokens.error }]}
            accessibilityRole="alert"
          >
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
  multilineInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  autocompleteCloseBtn: {
    paddingLeft: 8,
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 200,
    overflow: 'hidden',
    marginTop: -8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 15,
    flex: 1,
  },
  jobTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  jobTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  jobTypeBtnText: {
    fontSize: 15,
    fontWeight: '600',
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    flexWrap: 'wrap',
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
