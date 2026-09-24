import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  AppText,
  BottomSheetModal,
  Button,
  Dialog,
  IconButton,
  Screen,
  SettingsGroup,
  SettingsRow,
  StatusBadge,
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

type ProfileDialog = 'about' | 'logout' | 'delete' | null;

const SUPPORT_MAILTO = 'mailto:support@camorix.com';

/**
 * The settings screen is one calm list: a profile row, then groups of plain
 * rows. Groups are separated by a full-bleed band of the soft canvas rather
 * than by cards, and the destructive rows sit last in red text.
 */
export default function ProfileScreen() {
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
  const displayName = session?.user.name?.trim() || 'PREMIND 사용자';
  const initial = Array.from(displayName)[0] ?? 'P';
  const demoAccount = isDemoSession(session);
  const planStatus = usePlanStatus();
  const deletionConfirmed = deleteConfirmation.trim() === '탈퇴합니다';

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
      contentStyle={styles.screenContent}
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
            label="알림"
            onPress={() => router.push('/notifications')}
          />
        }
      />

      <View style={styles.content}>
        <View accessibilityLabel={`${displayName}, ${session?.user.email ?? ''}`} style={styles.profileRow}>
          <View {...decorative} style={styles.avatar}>
            <AppText variant="itemTitle">{initial}</AppText>
          </View>
          <View style={styles.profileCopy}>
            <View style={styles.nameRow}>
              <AppText numberOfLines={1} style={styles.name} variant="itemTitle">
                {displayName}
              </AppText>
              {demoAccount ? <StatusBadge label="데모" tone="brand" /> : null}
            </View>
            {session?.user.email ? (
              <AppText numberOfLines={1} tone="muted" variant="meta">
                {session.user.email}
              </AppText>
            ) : null}
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
            로그인하기
          </Button>
        ) : null}

        <Band />

        <SettingsGroup title="앱 설정">
          <SettingsRow
            description="마인드팩이 준비되면 알려드려요"
            onToggle={(next) => void handleNotificationsToggle(next)}
            title="알림"
            toggled={settings.notificationsEnabled}
          />
          {notificationError ? (
            <View style={styles.rowNote}>
              <AppText accessibilityRole="alert" tone="negative" variant="badge">
                {notificationError}
              </AppText>
            </View>
          ) : null}
        </SettingsGroup>

        <Band />

        <SettingsGroup title="구독과 결제">
          <SettingsRow
            description={usageLine(planStatus.usage) ?? '처리 분량과 보관을 늘려요'}
            onPress={() => router.push('/subscription')}
            title="구독"
            value={planStatus.loading ? '' : planLabel(planStatus.plan)}
          />
        </SettingsGroup>

        <Band />

        <SettingsGroup title="정보">
          <SettingsRow onPress={() => router.push('/guide')} title="사용 가이드" />
          <SettingsRow
            description="support@camorix.com"
            onPress={() => openUrl(SUPPORT_MAILTO)}
            title="문의하기"
          />
          <SettingsRow onPress={() => openUrl(TERMS_URL)} title="이용약관" />
          <SettingsRow onPress={() => openUrl(PRIVACY_URL)} title="개인정보 처리방침" />
          <SettingsRow
            onPress={() => setDialog('about')}
            title="버전 정보"
            value={appVersion}
          />
        </SettingsGroup>

        <Band />

        <SettingsGroup title="계정">
          <SettingsRow
            onPress={() => setDialog('logout')}
            title={demoAccount ? '데모 종료' : '로그아웃'}
            tone="negative"
          />
          <SettingsRow
            onPress={() => {
              setDeleteConfirmation('');
              setDeleteError(null);
              setDialog('delete');
            }}
            title={demoAccount ? '데모 초기화' : '회원 탈퇴'}
            tone="negative"
          />
        </SettingsGroup>

        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <AppText tone="negative" variant="meta">
              {error}
            </AppText>
          </View>
        ) : null}
      </View>

      <BottomSheetModal
        onClose={() => setDialog(null)}
        title="버전 정보"
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
      </BottomSheetModal>

      <Dialog
        cancel={{ label: '취소', onPress: () => setDialog(null), disabled: loggingOut }}
        confirm={{
          label: demoAccount ? '데모 종료' : '로그아웃',
          loading: loggingOut,
          onPress: () => void handleLogout(),
        }}
        description={
          demoAccount
            ? '데모를 종료하고 로그인 화면으로 돌아가요.'
            : '이 기기에 저장된 원본은 그대로 남고, 마인드팩은 다시 로그인하면 볼 수 있어요.'
        }
        onRequestClose={() => setDialog(null)}
        title={demoAccount ? '데모를 종료할까요?' : '로그아웃할까요?'}
        visible={dialog === 'logout'}
      />

      <Dialog
        cancel={{ label: '취소', onPress: closeDeleteDialog, disabled: deletingAccount }}
        confirm={{
          label: demoAccount ? '초기화' : '탈퇴하기',
          disabled: !deletionConfirmed,
          loading: deletingAccount,
          onPress: () => void handleDeleteAccount(),
        }}
        description={
          demoAccount
            ? '이 기기의 데모 자료를 모두 지워요. 다시 들어오면 예시 자료가 새로 만들어져요.'
            : '폴더, 자료, 마인드팩이 모두 지워져요. 되돌릴 수 없어요.'
        }
        onRequestClose={closeDeleteDialog}
        title={demoAccount ? '데모를 초기화할까요?' : '정말 탈퇴할까요?'}
        visible={dialog === 'delete'}
      >
        <View style={styles.deleteField}>
          <AppText tone="soft" variant="meta">
            계속하려면 ‘탈퇴합니다’를 입력해 주세요.
          </AppText>
          <TextInput
            accessibilityLabel="회원 탈퇴 확인 문구"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!deletingAccount}
            onChangeText={setDeleteConfirmation}
            placeholder="탈퇴합니다"
            placeholderTextColor={colors.textFaint}
            style={[styles.deleteInput, inputReset]}
            value={deleteConfirmation}
          />
          {deleteError ? (
            <AppText accessibilityRole="alert" tone="negative" variant="badge">
              {deleteError}
            </AppText>
          ) : null}
        </View>
      </Dialog>
    </Screen>
  );
}

/** The 8pt strip of soft canvas that separates settings groups. */
function Band() {
  return <View {...decorative} style={styles.band} />;
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.full,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
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
  band: {
    backgroundColor: colors.backgroundSoft,
    height: spacing.sm,
    marginHorizontal: -spacing.gutter,
  },
  rowNote: {
    paddingBottom: spacing.sm,
  },
  errorBox: {
    backgroundColor: colors.negativeSoft,
    borderRadius: radii.alert,
    padding: spacing.md,
  },
  aboutContent: {
    alignItems: 'center',
    gap: spacing.gutter,
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
