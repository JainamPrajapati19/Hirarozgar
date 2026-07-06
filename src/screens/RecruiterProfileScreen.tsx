/**
 * RecruiterProfileScreen — collects Recruiter profile data:
 *   company_name, contact_name, alt_phone (10 digits),
 *   office_address (≤200 chars).
 *
 * Shows field-level validation errors inline.
 * On persistence failure, retains role and shows retry option.
 *
 * Implements:
 *   - Req 3.3: Recruiter fields collected and persisted
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
import { IconKey } from '../components/IconRegistry';
import { useTheme } from '../hooks/useTheme';
import {
  updateProfile,
  RecruiterProfile,
  FieldValidationError,
} from '../services/ProfileService';

// ─── Navigation prop shape ────────────────────────────────────────────────────

export interface RecruiterProfileNavigationProp {
  /** Navigate to the Dashboard after successful save. */
  navigateToDashboard(): void;
  /** Navigate to Settings after a save failure so user can retry later. */
  navigateToSettings(): void;
}

export interface RecruiterProfileScreenProps {
  navigation: RecruiterProfileNavigationProp;
  /** When `true`, opened from Settings (edit mode) rather than onboarding. */
  editMode?: boolean;
  /** Pre-filled values when opened in edit mode. */
  initialValues?: Partial<RecruiterProfile>;
}

// ─── Field validation ─────────────────────────────────────────────────────────

interface FormErrors {
  company_name?: string;
  contact_name?: string;
  alt_phone?: string;
  office_address?: string;
}

const PHONE_RE = /^\d{10}$/;

function validateLocally(
  company_name: string,
  contact_name: string,
  alt_phone: string,
  office_address: string,
  t: (key: string) => string,
): FormErrors {
  const errors: FormErrors = {};

  if (company_name.trim().length === 0) {
    errors.company_name = t('fieldRequired');
  }

  if (contact_name.trim().length === 0) {
    errors.contact_name = t('fieldRequired');
  }

  if (alt_phone.length > 0 && !PHONE_RE.test(alt_phone)) {
    errors.alt_phone = t('altPhoneInvalid');
  }

  if (office_address.trim().length > 200) {
    errors.office_address = t('officeAddressMaxLength');
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecruiterProfileScreen({
  navigation,
  editMode = false,
  initialValues = {},
}: RecruiterProfileScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const [companyName, setCompanyName] = useState(initialValues.company_name ?? '');
  const [contactName, setContactName] = useState(initialValues.contact_name ?? '');
  const [altPhone, setAltPhone] = useState(initialValues.alt_phone ?? '');
  const [officeAddress, setOfficeAddress] = useState(initialValues.office_address ?? '');

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaveError(null);
    setSavedOk(false);

    const localErrors = validateLocally(companyName, contactName, altPhone, officeAddress, t);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const payload: Partial<RecruiterProfile> = {
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      alt_phone: altPhone.length > 0 ? altPhone : null,
      office_address: officeAddress.trim().length > 0 ? officeAddress.trim() : null,
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
        // Req 3.3: on persistence failure, role is retained; retry from Settings
        setSaveError(t('profileSaveError'));
      }
    } finally {
      setSaving(false);
    }
  }, [saving, companyName, contactName, altPhone, officeAddress, t, editMode, navigation]);

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
            {t('recruiterProfileTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            {t('recruiterProfileSubtitle')}
          </Text>
        </View>

        {/* ── Company Name ── */}
        <FieldGroup
          iconName="company"
          label={t('companyName')}
          error={errors.company_name}
          tokens={tokens}
        >
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={companyName}
            onChangeText={(text) => {
              setCompanyName(text);
              if (errors.company_name) setErrors((e) => ({ ...e, company_name: undefined }));
            }}
            placeholder={t('companyName')}
            placeholderTextColor={tokens.textDisabled}
            returnKeyType="next"
            accessibilityLabel={t('companyName')}
            testID="recruiter-company-name-input"
          />
        </FieldGroup>

        {/* ── Contact Name ── */}
        <FieldGroup
          iconName="contact"
          label={t('contactName')}
          error={errors.contact_name}
          tokens={tokens}
        >
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={contactName}
            onChangeText={(text) => {
              setContactName(text);
              if (errors.contact_name) setErrors((e) => ({ ...e, contact_name: undefined }));
            }}
            placeholder={t('contactName')}
            placeholderTextColor={tokens.textDisabled}
            returnKeyType="next"
            accessibilityLabel={t('contactName')}
            testID="recruiter-contact-name-input"
          />
        </FieldGroup>

        {/* ── Alt Phone ── */}
        <FieldGroup
          iconName="phone"
          label={t('altPhone')}
          error={errors.alt_phone}
          tokens={tokens}
        >
          <TextInput
            style={[styles.input, { color: tokens.textPrimary }]}
            value={altPhone}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '').slice(0, 10);
              setAltPhone(digits);
              if (errors.alt_phone) setErrors((e) => ({ ...e, alt_phone: undefined }));
            }}
            placeholder="10-digit number"
            placeholderTextColor={tokens.textDisabled}
            keyboardType="number-pad"
            maxLength={10}
            returnKeyType="next"
            accessibilityLabel={t('altPhone')}
            testID="recruiter-alt-phone-input"
          />
        </FieldGroup>

        {/* ── Office Address ── */}
        <FieldGroup
          iconName="location"
          label={t('officeAddress')}
          error={errors.office_address}
          tokens={tokens}
        >
          <TextInput
            style={[styles.multilineInput, { color: tokens.textPrimary }]}
            value={officeAddress}
            onChangeText={(text) => {
              setOfficeAddress(text);
              if (errors.office_address) setErrors((e) => ({ ...e, office_address: undefined }));
            }}
            placeholder={t('officeAddress')}
            placeholderTextColor={tokens.textDisabled}
            maxLength={200}
            multiline
            numberOfLines={3}
            returnKeyType="default"
            accessibilityLabel={t('officeAddress')}
            testID="recruiter-office-address-input"
          />
        </FieldGroup>

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
                  testID="recruiter-retry-settings-button"
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
          testID="recruiter-save-button"
        >
          {saving ? (
            <ActivityIndicator color={tokens.background} size="small" />
          ) : (
            <View style={styles.saveButtonInner}>
              <Icon name="save" size={20} color={tokens.background} />
              <Text style={[styles.saveButtonText, { color: tokens.background }]}>
                {t('save')}
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
  multilineInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
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
