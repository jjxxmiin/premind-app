import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Children, Fragment, isValidElement, useState, type PropsWithChildren } from 'react';
import { Linking, Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Surface } from '@/components/speak/SpeakKit';
import {
  AppText,
  BottomSheetModal,
  Button,
  Dialog,
  IconButton,
  Screen,
  SettingsRow,
  Wordmark,
} from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/data/subscription-plans';
import { planLabel, usageLine, usePlanStatus } from '@/features/billing/use-plan-status';
import { decorative } from '@/lib/a11y';
import { isDemoSession } from '@/services/api/session-manager';
import { requestStudyNotificationPermission } from '@/services/notifications';
import { useAppStore } from '@/state/app-store';
import { inputReset } from '@/theme/input-reset';
import { colors, radii, sizes, spacing } from '@/theme/tokens';
import { APP_LOCALE_LABELS, setLocale, useLocale, useT } from '@/lib/i18n';

type ProfileDialog = 'about' | 'logout' | 'delete' | null;

const SUPPORT_MAILTO = 'mailto:support@camorix.com';

/**
 * The settings screen: a profile card, then groups of plain rows, each group
 * one white card with a caption above it. The destructive rows sit last in
 * red text. On a wide window the column stays at a reading width.
 */
export default function ProfileScreen() {
  const t = useT();
  const locale = useLocale();
  const {
    deleteAccount,
    error,
    logout,
    session,
    settings,
    updateSettings,
  } = useAppStore();
  const [dialog, setDialog] = useState<ProfileDialog>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const displayName = session?.user.name?.trim() || t('PREMIND 사용자');
  const initial = Array.from(displayName)[0] ?? 'P';
  const demoAccount = isDemoSession(session);
  const planStatus = usePlanStatus();
  const deletionConfirmed = deleteConfirmation.trim() === t('탈퇴합니다');

  const handleNotificationsToggle = async (next: boolean) => {
    setNotificationError(null);
    if (!next) {
      updateSettings({ notificationsEnabled: false });
      return;
    }
    try {
      const granted = await requestStudyNotificationPermission();
      updateSettings({ notificationsEnabled: granted });
      if (!granted) {
        setNotificationError(
          Platform.OS === 'web'
            ? '이 환경에서는 알림을 지원하지 않아요. 앱에서 켜 주세요.'
            : '알림 권한이 꺼져 있어요. 기기 설정에서 PREMIND 알림을 허용해 주세요.',
        );
      }
    } catch {
      setNotificationError('알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const openUrl = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setDialog(null);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletionConfirmed) return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      setDialog(null);
    } catch (caught) {
      setDeleteError(
        caught instanceof Error && caught.message
          ? caught.message
          : '계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deletingAccount) return;
    setDialog(null);
    setDeleteConfirmation('');
    setDeleteError(null);
  };

  return (
    <Screen
      background="soft"
      contentStyle={styles.screenContent}
      maxWidth={720}
      padded={false}
      safeAreaEdges={['top', 'left', 'right']}
      scroll
      scrollViewProps={{ showsVerticalScrollIndicator: false }}
    >
      <AppHeader
        brand
        right={
          <IconButton
            icon={Bell}
            label={t('알림')}
            onPress={() => router.push('/notifications')}
          />
        }
      />

      <View style={styles.content}>
        <Surface style={styles.profileCard} tone="raised">
          <View
            accessibilityLabel={`${displayName}, ${session?.user.email ?? ''}`}
            style={styles.profileRow}
          >
            <View {...decorative} style={styles.avatar}>
              <AppText tone="brand" variant="heading">
                {initial}
              </AppText>
            </View>
            <View style={styles.profileCopy}>
              <View style={styles.nameRow}>
                <AppText numberOfLines={1} style={styles.name} variant="heading">
                  {displayName}
                </AppText>
              </View>
            </View>
          </View>

          {demoAccount ? (
            // The login route only exists while signed out (`Stack.Protected`),
            // so pushing to it from inside the demo did nothing at all. Leaving
            // the demo is what puts the login screen back on the stack.
            <Button
              disabled={loggingOut}
              fullWidth
              loading={loggingOut}
              onPress={() => void handleLogout()}
              variant="primary"
            >
              {t('로그인하기')}
            </Button>
          ) : null}
        </Surface>

        <GroupCard>
          <SettingsRow
            // 영어를 못 읽는 사람도, 한국어를 못 읽는 사람도 찾게 두 말로(한 줄).
            onPress={() => setLocale(locale === 'en' ? 'ko' : 'en')}
            title={t('언어 / Language')}
            value={APP_LOCALE_LABELS[locale]}
          />
          <SettingsRow
            onToggle={(next) => void handleNotificationsToggle(next)}
            title={t('알림')}
            toggled={settings.notificationsEnabled}
          />
        </GroupCard>
        {notificationError ? (
          <AppText
            accessibilityRole="alert"
            style={styles.rowNote}
            tone="negative"
            variant="badge"
          >
            {t(notificationError)}
          </AppText>
        ) : null}

        <GroupCard>
          <SettingsRow
            description={usageLine(planStatus.usage, locale) ?? undefined}
            onPress={() => router.push('/subscription')}
            title={t('구독')}
            value={planStatus.loading ? '' : planLabel(planStatus.plan, locale)}
          />
        </GroupCard>

        <GroupCard>
          <SettingsRow onPress={() => router.push('/guide')} title={t('사용 가이드')} />
          <SettingsRow
            onPress={() => openUrl(SUPPORT_MAILTO)}
            title={t('문의하기')}
          />
          {/* 이용약관, 개인정보 처리방침, 버전은 한 줄(정보) 뒤 시트에 모은다. */}
          <SettingsRow
            onPress={() => setDialog('about')}
            title={t.ctx('settings', '정보')}
            value={appVersion}
          />
        </GroupCard>

        <GroupCard>
          <SettingsRow
            onPress={() => setDialog('logout')}
            title={t(demoAccount ? '데모 종료' : '로그아웃')}
            tone="negative"
          />
          <SettingsRow
            onPress={() => {
              setDeleteConfirmation('');
              setDeleteError(null);
              setDialog('delete');
            }}
            title={t(demoAccount ? '데모 초기화' : '회원 탈퇴')}
            tone="negative"
          />
        </GroupCard>

        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <AppText tone="negative" variant="meta">
              {t(error)}
            </AppText>
          </View>
        ) : null}
      </View>

      <BottomSheetModal
        onClose={() => setDialog(null)}
        title={t.ctx('settings', '정보')}
        visible={dialog === 'about'}
      >
        <View style={styles.aboutContent}>
          <Wordmark width={120} />
          <AppText tone="muted" variant="meta">
            PREMIND {appVersion}
          </AppText>
          <AppText align="center" tone="faint" variant="badge">
            Expo SDK {Constants.expoConfig?.sdkVersion ?? '57'} / {Platform.OS}
          </AppText>
        </View>
        <GroupCard>
          <SettingsRow onPress={() => openUrl(TERMS_URL)} title={t('이용약관')} />
          <SettingsRow onPress={() => openUrl(PRIVACY_URL)} title={t('개인정보 처리방침')} />
        </GroupCard>
      </BottomSheetModal>

      <Dialog
        cancel={{ label: t('취소'), onPress: () => setDialog(null), disabled: loggingOut }}
        confirm={{
          label: t(demoAccount ? '데모 종료' : '로그아웃'),
          loading: loggingOut,
          onPress: () => void handleLogout(),
        }}
        description={t(
          demoAccount
            ? '데모를 종료하고 로그인 화면으로 돌아가요.'
            : '이 기기에 저장된 원본은 그대로 남고, 마인드팩은 다시 로그인하면 볼 수 있어요.',
        )}
        onRequestClose={() => setDialog(null)}
        title={t(demoAccount ? '데모를 종료할까요?' : '로그아웃할까요?')}
        visible={dialog === 'logout'}
      />

      <Dialog
        cancel={{ label: t('취소'), onPress: closeDeleteDialog, disabled: deletingAccount }}
        confirm={{
          label: t(demoAccount ? '초기화' : '탈퇴하기'),
          disabled: !deletionConfirmed,
          loading: deletingAccount,
          onPress: () => void handleDeleteAccount(),
        }}
        description={t(
          demoAccount
            ? '이 기기의 데모 자료를 모두 지워요. 다시 들어오면 예시 자료가 새로 만들어져요.'
            : '폴더, 자료, 마인드팩이 모두 지워져요. 되돌릴 수 없어요.',
        )}
        onRequestClose={closeDeleteDialog}
        title={t(demoAccount ? '데모를 초기화할까요?' : '정말 탈퇴할까요?')}
        visible={dialog === 'delete'}
      >
        <View style={styles.deleteField}>
          <AppText tone="soft" variant="meta">
            {t('계속하려면 ‘탈퇴합니다’를 입력해 주세요.')}
          </AppText>
          <TextInput
            accessibilityLabel={t('회원 탈퇴 확인 문구')}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!deletingAccount}
            onChangeText={setDeleteConfirmation}
            placeholder={t('탈퇴합니다')}
            placeholderTextColor={colors.textFaint}
            style={[styles.deleteInput, inputReset]}
            value={deleteConfirmation}
          />
          {deleteError ? (
            <AppText accessibilityRole="alert" tone="negative" variant="badge">
              {t(deleteError)}
            </AppText>
          ) : null}
        </View>
      </Dialog>
    </Screen>
  );
}

/**
 * A group of settings rows on one white card over the grey screen, with a
 * hairline between rows (2026-09-26: no caption above; the space between
 * cards is what separates the groups).
 */
function GroupCard({ children }: PropsWithChildren) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Surface padding={0} tone="raised">
      <View style={styles.groupRows}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View {...decorative} style={styles.rowDivider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl,
  },
  content: {
    gap: spacing.xl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  profileCard: {
    gap: spacing.gutter,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.full,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  groupRows: {
    paddingHorizontal: spacing.gutter,
  },
  rowDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  profileCopy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  rowNote: {
    marginTop: -spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  errorBox: {
    backgroundColor: colors.negativeSoft,
    borderRadius: radii.alert,
    padding: spacing.md,
  },
  aboutContent: {
    alignItems: 'center',
    gap: spacing.gutter,
    marginBottom: spacing.xl,
  },
  deleteField: {
    gap: spacing.sm,
  },
  deleteInput: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    borderWidth: 1,
    color: colors.text,
    minHeight: sizes.input,
    paddingHorizontal: spacing.md,
  },
});
