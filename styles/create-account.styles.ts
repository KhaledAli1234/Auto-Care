import { StyleSheet } from 'react-native';
import { APP_COLORS } from '@/constants/app-colors';

const C = APP_COLORS;

export const createAccountStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
  },
  backLabel: {
    color: C.text,
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logoIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    color: C.text,
    fontSize: 12,
    fontWeight: '700',
  },
  logoAi: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  appTitle: {
    color: C.text,
    fontSize: 12,
    marginTop: 2,
  },
  viewChatButton: {
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewChatText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: C.textMuted,
    fontSize: 14,
    marginBottom: 28,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  form: {
    gap: 6,
    marginBottom: 24,
  },
  label: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    height: 52,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    fontSize: 15,
    color: C.text,
  },
  inputFocused: {
    borderColor: C.accent,
    backgroundColor: '#1E2538',
  },
  inputError: {
    borderColor: 'rgba(255, 59, 48, 0.6)',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  selectBox: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBoxError: {
    borderWidth: 1,
    borderColor: C.error,
  },
  inputPlaceholder: {
    color: C.textMuted,
    fontSize: 15,
    flex: 1,
  },
  errorText: {
    color: C.error,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  continueButton: {
    height: 52,
    backgroundColor: C.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 12,
  },
  continueText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  footerText: {
    color: C.textMuted,
    fontSize: 13,
  },
  signInLink: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    maxHeight: '50%',
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalOptionText: {
    color: C.text,
    fontSize: 16,
  },
});
