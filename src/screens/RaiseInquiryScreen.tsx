/**
 * RaiseInquiryScreen — lets a subscribed Job Seeker raise a Seeker Pool inquiry.
 *
 * Fields:
 *   - skills      (up to 10 from Master Dictionary, with autocomplete)
 *   - expected_pay (numeric ₹/day)
 *
 * Behaviour:
 *   - Blocks unsubscribed seekers → shows SubscriptionPrompt (Req 7.6)
 *   - Blocks if seeker already has one active inquiry → shows deactivation option (Req 7.4)
 *   - On successful deactivation of existing → re-enables form for new submission
 *
 * Implements:
 *   - Req 7.1: Create inquiry with skills + expected pay
 *   - Req 7.4: Block second active inquiry; show deactivation CTA
 *   - Req 7.6: Unsubscribed seeker → SubscriptionPrompt
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
import { SubscriptionPrompt } from '../components/SubscriptionPrompt';
import { useTheme } from '../hooks/useTheme';
import { getAutocompleteSuggestions } from '../services/autocompleteService';
import {
  createInquiry,
  deactivateInquiry,
  ActiveInquiryExistsError,
  SubscriptionRequiredError,
  SeekerInquiry,
} from '../services/SeekerPoolService';

// ─── Navigation prop shape ────────────────────────────────────────────────────

export interface RaiseInquiryNavigationProp {
  navigateBack(): void;
}

export interface RaiseInquiryScreenProps {
  navigation: RaiseInquiryNavigationProp;
  /** The user's role — passed to SubscriptionPrompt for correct fee display. */
  role?: 'seeker' | 'recruiter' | null;
}

// ─── Local form error shape ───────────────────────────────────────────────────

interface FormErrors {
  skills?: string;
  expected_pay?: string;
}

// ─── Local validation ─────────────────────────────────────────────────────────

function validateLocally(
  skills: string[],
  expectedPay: string,
  t: (key: string) => string,
): FormErrors {
  const errors: FormErrors = {};

  if (skills.length === 0) {
    errors.skills = t('skillsMin');
  }

  if (expectedPay.trim().length === 0) {
    errors.expected_pay = t('fieldRequired');
  } else {
    const pay = parseFloat(expectedPay);
    if (!Number.isFinite(pay) || pay <= 0) {
      errors.expected_pay = t('expectedPayInvalid');
    }
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RaiseInquiryScreen({ role }: RaiseInquiryScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  // ── Form state ──────────────────────────────────────────────────────────
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [expectedPay, setExpectedPay] = useState('');

  // ── UI state ────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // ── Active-inquiry conflict state (Req 7.4) ─────────────────────────────
  const [conflictInquiry, setConflictInquiry] = useState<SeekerInquiry | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateSuccess, setDeactivateSuccess] = useState(false);

  // ── Subscription prompt state (Req 7.6) ────────────────────────────────
  const [showSubPrompt, setShowSubPrompt] = useState(false);

  // ── Autocomplete state ──────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Autocomplete fetch with debounce ────────────────────────────────────
  const handleSkillInputChange = useCallback(
    (text: string) => {
      setSkillInput(text);
      if (errors.skills) setErrors((e) => ({ ...e, skills: undefined }));

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
          // Filter out already-added skills
          const filtered = results.filter((s) => !skills.includes(s));
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
        } catch {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }, 200);
    },
    [errors.skills, skills],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autocompleteDebounce.current) {
        clearTimeout(autocompleteDebounce.current);
      }
    };
  }, []);

  // ── Add skill from suggestion ────────────────────────────────────────────
  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      if (skills.includes(suggestion)) {
        // already added — just clear the input
        setSkillInput('');
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      if (skills.length >= 10) return; // max 10 enforced in UI
      setSkills((prev) => [...prev, suggestion]);
      setSkillInput('');
      setSuggestions([]);
      setShowSuggestions(false);
      if (errors.skills) setErrors((e) => ({ ...e, skills: undefined }));
    },
    [skills, errors.skills],
  );

  // ── Add skill on "enter" (free-text fallback) ────────────────────────────
  const handleAddSkillManual = useCallback(() => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (skills.includes(trimmed)) {
      setSkillInput('');
      return;
    }
    if (skills.length >= 10) return;
    setSkills((prev) => [...prev, trimmed]);
    setSkillInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (errors.skills) setErrors((e) => ({ ...e, skills: undefined }));
  }, [skillInput, skills, errors.skills]);

  // ── Remove a skill chip ──────────────────────────────────────────────────
  const handleRemoveSkill = useCallback((skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  }, []);

  // ── Deactivate existing inquiry (Req 7.4) ───────────────────────────────
  const handleDeactivateExisting = useCallback(async () => {
    if (!conflictInquiry || deactivating) return;
    setDeactivateError(null);
    setDeactivating(true);
    try {
      await deactivateInquiry(conflictInquiry.id);
      setConflictInquiry(null);
      setDeactivateSuccess(true);
      // Auto-clear success banner after 3 s
      setTimeout(() => setDeactivateSuccess(false), 3000);
    } catch (err) {
      setDeactivateError(
        err instanceof Error ? err.message : t('deactivateError'),
      );
    } finally {
      setDeactivating(false);
    }
  }, [conflictInquiry, deactivating, t]);

  // ── Submit inquiry ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (saving) return;
    setSaveError(null);
    setSavedOk(false);
    setConflictInquiry(null);
    setDeactivateError(null);
    setShowSuggestions(false);

    const localErrors = validateLocally(skills, expectedPay, t);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      await createInquiry({
        skills,
        expected_pay: parseFloat(expectedPay),
      });

      // Success: show message and reset form
      setSavedOk(true);
      setSkills([]);
      setExpectedPay('');
    } catch (err) {
      if (err instanceof SubscriptionRequiredError) {
        // Req 7.6: show subscription prompt
        setShowSubPrompt(true);
      } else if (err instanceof ActiveInquiryExistsError) {
        // Req 7.4: show deactivation option
        setConflictInquiry(err.existingInquiry);
      } else {
        setSaveError(t('inquirySubmitError'));
      }
    } finally {
      setSaving(false);
    }
  }, [saving, skills, expectedPay, t]);

  // ─── Render ───────────────────────────────────────────────────────────────

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
          <Icon name="inquiry" size={40} color={tokens.primary} />
          <Text style={[styles.screenTitle, { color: tokens.textPrimary }]}>
            {t('raiseInquiryTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            {t('raiseInquirySubtitle')}
          </Text>
        </View>

        {/* ── Deactivate success notice ── */}
        {deactivateSuccess ? (
          <View
            style={[
              styles.successBox,
              { borderColor: tokens.success, backgroundColor: tokens.surface },
            ]}
          >
            <Icon name="success" size={18} color={tokens.success} />
            <Text style={[styles.successText, { color: tokens.success }]}>
              {t('deactivateSuccess')}
            </Text>
          </View>
        ) : null}

        {/* ── Active inquiry conflict banner (Req 7.4) ── */}
        {conflictInquiry ? (
          <View
            style={[
              styles.conflictBox,
              { borderColor: tokens.warning ?? tokens.error, backgroundColor: tokens.surface },
            ]}
            testID="active-inquiry-conflict-banner"
          >
            <View style={styles.conflictHeader}>
              <Icon name="warning" size={18} color={tokens.warning ?? tokens.error} />
              <Text
                style={[styles.conflictTitle, { color: tokens.warning ?? tokens.error }]}
                accessibilityRole="alert"
              >
                {t('activeInquiryExists')}
              </Text>
            </View>
            {deactivateError ? (
              <Text style={[styles.conflictErrorText, { color: tokens.error }]}>
                {deactivateError}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.deactivateButton,
                {
                  backgroundColor: deactivating
                    ? tokens.primaryDisabled
                    : tokens.warning ?? tokens.error,
                },
              ]}
              onPress={handleDeactivateExisting}
              disabled={deactivating}
              accessibilityRole="button"
              accessibilityLabel={t('deactivateExisting')}
              testID="deactivate-existing-inquiry-button"
            >
              {deactivating ? (
                <ActivityIndicator color={tokens.background} size="small" />
              ) : (
                <View style={styles.deactivateButtonInner}>
                  <Icon name="deactivate" size={18} color={tokens.background} />
                  <Text style={[styles.deactivateButtonText, { color: tokens.background }]}>
                    {t('deactivateExisting')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Skills field ── */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Icon name="skills" size={20} color={tokens.textSecondary} />
            <Text style={[styles.labelText, { color: tokens.textSecondary }]}>
              {t('skills')}
            </Text>
            <Text style={[styles.skillCounter, { color: tokens.textDisabled }]}>
              {`${skills.length}/10`}
            </Text>
          </View>

          {/* Skill chips */}
          {skills.length > 0 ? (
            <View style={styles.chipsRow}>
              {skills.map((skill) => (
                <View
                  key={skill}
                  style={[
                    styles.chip,
                    { backgroundColor: tokens.primary + '18', borderColor: tokens.primary },
                  ]}
                  testID={`skill-chip-${skill}`}
                >
                  <Text style={[styles.chipText, { color: tokens.primary }]}>{skill}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveSkill(skill)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('removeSkill')} ${skill}`}
                    testID={`remove-skill-${skill}`}
                  >
                    <Icon name="cancel" size={14} color={tokens.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          {/* Skill input row (hidden if 10 skills already added) */}
          {skills.length < 10 ? (
            <View
              style={[
                styles.inputRow,
                {
                  borderColor: errors.skills ? tokens.error : tokens.border,
                  backgroundColor: tokens.surface,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: tokens.textPrimary }]}
                value={skillInput}
                onChangeText={handleSkillInputChange}
                placeholder={t('skillsPlaceholder')}
                placeholderTextColor={tokens.textDisabled}
                returnKeyType="done"
                onSubmitEditing={handleAddSkillManual}
                accessibilityLabel={t('skills')}
                testID="skill-input"
              />
              {showSuggestions ? (
                <TouchableOpacity
                  onPress={() => setShowSuggestions(false)}
                  style={styles.clearBtn}
                  accessibilityLabel="close suggestions"
                >
                  <Icon name="cancel" size={16} color={tokens.textSecondary} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={handleAddSkillManual}
                disabled={skillInput.trim().length === 0}
                style={styles.addSkillBtn}
                accessibilityRole="button"
                accessibilityLabel={t('addSkill')}
                testID="add-skill-button"
              >
                <Icon
                  name="save"
                  size={18}
                  color={
                    skillInput.trim().length === 0 ? tokens.textDisabled : tokens.primary
                  }
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.maxSkillsNote,
                { backgroundColor: tokens.surface, borderColor: tokens.border },
              ]}
            >
              <Icon name="warning" size={14} color={tokens.textSecondary} />
              <Text style={[styles.maxSkillsText, { color: tokens.textSecondary }]}>
                {t('maxSkillsReached')}
              </Text>
            </View>
          )}

          {/* Autocomplete dropdown */}
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
                    style={[
                      styles.suggestionItem,
                      { borderBottomColor: tokens.border },
                    ]}
                    onPress={() => handleSelectSuggestion(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item}
                    testID={`suggestion-${item}`}
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

          {errors.skills ? (
            <View style={styles.errorRow}>
              <Icon name="error" size={14} color={tokens.error} />
              <Text
                style={[styles.fieldError, { color: tokens.error }]}
                accessibilityRole="alert"
                testID="skills-error"
              >
                {errors.skills}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Expected Pay field ── */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Icon name="salary" size={20} color={tokens.textSecondary} />
            <Text style={[styles.labelText, { color: tokens.textSecondary }]}>
              {t('expectedPayLabel')}
            </Text>
          </View>
          <View
            style={[
              styles.inputRow,
              {
                borderColor: errors.expected_pay ? tokens.error : tokens.border,
                backgroundColor: tokens.surface,
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: tokens.textPrimary }]}
              value={expectedPay}
              onChangeText={(text) => {
                // Allow digits and a single decimal point
                const cleaned = text.replace(/[^0-9.]/g, '');
                setExpectedPay(cleaned);
                if (errors.expected_pay) {
                  setErrors((e) => ({ ...e, expected_pay: undefined }));
                }
                setSavedOk(false);
              }}
              placeholder={t('expectedPayPlaceholder')}
              placeholderTextColor={tokens.textDisabled}
              keyboardType="decimal-pad"
              returnKeyType="done"
              accessibilityLabel={t('expectedPay')}
              testID="expected-pay-input"
            />
          </View>
          {errors.expected_pay ? (
            <View style={styles.errorRow}>
              <Icon name="error" size={14} color={tokens.error} />
              <Text
                style={[styles.fieldError, { color: tokens.error }]}
                accessibilityRole="alert"
                testID="expected-pay-error"
              >
                {errors.expected_pay}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Generic submit error ── */}
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
              testID="submit-error"
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
            <Text
              style={[styles.successText, { color: tokens.success }]}
              testID="submit-success"
            >
              {t('inquirySubmitSuccess')}
            </Text>
          </View>
        ) : null}

        {/* ── Submit button ── */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                saving || !!conflictInquiry
                  ? tokens.primaryDisabled
                  : tokens.primary,
            },
          ]}
          onPress={handleSubmit}
          disabled={saving || !!conflictInquiry}
          accessibilityRole="button"
          accessibilityLabel={t('raiseInquiry')}
          accessibilityState={{
            disabled: saving || !!conflictInquiry,
            busy: saving,
          }}
          testID="raise-inquiry-submit-button"
        >
          {saving ? (
            <ActivityIndicator color={tokens.background} size="small" />
          ) : (
            <View style={styles.submitButtonInner}>
              <Icon name="inquiry" size={20} color={tokens.background} />
              <Text style={[styles.submitButtonText, { color: tokens.background }]}>
                {t('raiseInquiry')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Subscription prompt (Req 7.6) ── */}
      <SubscriptionPrompt
        visible={showSubPrompt}
        role={role ?? 'seeker'}
        onDismiss={() => setShowSubPrompt(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  // ── Conflict banner (Req 7.4) ──
  conflictBox: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conflictTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
  },
  conflictErrorText: {
    fontSize: 13,
    flexWrap: 'wrap',
  },
  deactivateButton: {
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  deactivateButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deactivateButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Field group ──
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
    flex: 1,
  },
  skillCounter: {
    fontSize: 12,
  },
  // ── Skill chips ──
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // ── Input row ──
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
  clearBtn: {
    paddingLeft: 8,
  },
  addSkillBtn: {
    paddingLeft: 8,
  },
  // ── Max skills note ──
  maxSkillsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  maxSkillsText: {
    fontSize: 13,
    flex: 1,
    flexWrap: 'wrap',
  },
  // ── Autocomplete ──
  suggestionsContainer: {
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 200,
    overflow: 'hidden',
    marginTop: -4,
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
  // ── Error / success inline ──
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
    flex: 1,
    flexWrap: 'wrap',
  },
  // ── Submit button ──
  submitButton: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  submitButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
