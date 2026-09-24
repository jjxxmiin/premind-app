import { router } from 'expo-router';
import {
  Check,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  Minus,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react-native';
import { useEffect, useReducer, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  AppText,
  Button,
  Card,
  ListRow,
  ProgressBar,
  Screen,
  SegmentedControl,
  StatusBadge,
  Toast,
  useToast,
} from '@/components/ui';
import {
  autoRenewLine,
  cancelLine,
  formatRenewalDate,
  manageSubscriptionUrl,
  priceCopy,
  renewalFact,
  type BillingSurface,
} from '@/features/billing/purchase-copy';
import {
  initialPurchaseState,
  purchaseReducer,
} from '@/features/billing/purchase-machine';
import { syncStorePurchase } from '@/features/billing/sync-subscription';
import { usePlanStatus } from '@/features/billing/use-plan-status';
import { decorative } from '@/lib/a11y';
import { goBackOrReplace } from '@/lib/navigation';
import {
  PRODUCT_IDS,
  configureBilling,
  getStoreAppUserId,
  getStoreEntitlement,
  getStoreOffering,
  isStoreBillingAvailable,
  purchaseStorePackage,
  restoreStorePurchases,
  type StoreEntitlement,
  type StoreOffering,
} from '@/services/billing';
import { useAppStore } from '@/state/app-store';
import {
  PLAN_BENEFITS,
  PLAN_PRICES,
  PRIVACY_URL,
  SUBSCRIPTION_WEB_URL,
  TERMS_URL,
  type BillingCycle,
} from '@/data/subscription-plans';
import { colors, iconSizes, radii, spacing } from '@/theme/tokens';

const cycleOptions = [
  { value: 'monthly', label: '월간' },
  { value: 'yearly', label: '연간 (2개월 무료)' },
] as const;

const SUPPORT_EMAIL = 'support@camorix.com';
/** A mail app is not a payment link, so this is allowed in a native build. */
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  '[PREMIND] 구독 문의',
)}`;

/** Toast sits above the bottom bar (52pt button + 12 + 20 padding). */
const TOAST_ABOVE_BAR = 104;

function openUrl(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** One fact of the subscription: its name on the left, its value on the right. */
function ManageFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.manageRow}>
      <AppText tone="muted" variant="meta">
        {label}
      </AppText>
      <AppText tabular variant="itemTitle">
        {value}
      </AppText>
    </View>
  );
}

/**
 * The subscription screen.
 *
 * Decided 2026-09-07: on Android 스탠다드 is bought here, through Google Play
 * billing (RevenueCat). Play checks this screen closely, so the block above
 * the button always states the exact charge, its period, that it renews by
 * itself, and where to cancel — and 구매 복원, 이용약관, 개인정보 처리방침 are
 * all reachable without scrolling past the fold twice.
 *
 * Three surfaces share it. The store surface sells; the web build keeps its
 * own checkout; a native build with no RevenueCat key (Expo Go, or a build
 * that shipped without the key) renders everything except the purchase and
 * says why, instead of crashing on a missing native module.
 */
export default function SubscriptionScreen() {
  const { session } = useAppStore();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [offering, setOffering] = useState<StoreOffering | null>(null);
  const [entitlement, setEntitlement] = useState<StoreEntitlement | null>(null);
  const [state, dispatch] = useReducer(purchaseReducer, initialPurchaseState);
  const toast = useToast();
  const planStatus = usePlanStatus();

  const price = PLAN_PRICES.standard;
  const storeBilling = isStoreBillingAvailable();
  const isWeb = Platform.OS === 'web';
  // Where a purchase can start from this screen.
  const canBuyHere = isWeb || storeBilling;
  const surface: BillingSurface = isWeb
    ? 'web'
    : Platform.OS === 'ios'
      ? 'appstore'
      : 'play';
  // The account's plan (server) or a live store entitlement; either counts.
  const subscribed = state.entitled || planStatus.plan === 'standard';
  const usage = planStatus.usage;
  const busy = state.busy;

  const storePackage = cycle === 'monthly' ? offering?.monthly : offering?.yearly;
  const copy = priceCopy(
    cycle,
    price,
    storePackage?.priceString ?? null,
    storePackage?.perMonthString ?? null,
  );

  // The renewal date the server knows, or the one the store just told us.
  const renewsAtIso = planStatus.renewsAt ?? entitlement?.expiresAt ?? null;
  const renewsText = renewalFact(renewsAtIso, subscribed);
  const planName = subscribed ? '스탠다드' : '무료';
  const planLine = formatRenewalDate(renewsAtIso)
    ? `지금 요금제 ${planName} / 다음 갱신일 ${renewsText}`
    : `지금 요금제 ${planName}`;
  // Play requires the manage link to point at the exact product, so a known
  // entitlement wins; before it loads, the cycle on screen is the best guess.
  const manageProductId =
    entitlement?.productId ?? storePackage?.productId ?? PRODUCT_IDS[cycle];

  useEffect(() => {
    if (!storeBilling) return;
    let cancelled = false;
    void (async () => {
      // The signed-in user id, so a purchase follows the account rather than
      // the handset: reinstalling or signing in elsewhere keeps 스탠다드.
      const ready = await configureBilling(session?.user.id ?? null);
      if (!ready || cancelled) return;
      const [nextOffering, current] = await Promise.all([
        getStoreOffering(),
        getStoreEntitlement(),
      ]);
      if (cancelled) return;
      setOffering(nextOffering);
      if (current) {
        setEntitlement(current);
        dispatch({ type: 'entitlement:known', entitled: current.active });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, storeBilling]);

  /**
   * Hand the receipt to our server, then re-read the plan.
   *
   * RevenueCat's webhook would get there eventually; this makes the quota and
   * the badge correct before the buyer can wonder whether it worked.
   */
  const syncAndRefresh = async () => {
    dispatch({ type: 'sync:start' });
    const appUserId = await getStoreAppUserId();
    const outcome = await syncStorePurchase(appUserId);
    await planStatus.refresh();
    if (outcome.status === 'pending') {
      dispatch({ type: 'sync:pending' });
    } else if (outcome.status === 'failed') {
      dispatch({ type: 'sync:failed' });
    } else {
      dispatch({ type: 'sync:done' });
    }
  };

  const purchase = async () => {
    if (!storePackage) return;
    dispatch({ type: 'purchase:start' });
    const result = await purchaseStorePackage(storePackage.identifier);
    dispatch({ type: 'purchase:settle', result });
    if (result.status !== 'purchased') return;
    if (result.entitled) toast.show('스탠다드가 시작됐어요');
    const current = await getStoreEntitlement();
    if (current) setEntitlement(current);
    await syncAndRefresh();
  };

  const restore = async () => {
    dispatch({ type: 'restore:start' });
    const result = await restoreStorePurchases();
    dispatch({ type: 'restore:settle', result });
    if (result.status !== 'restored') return;
    setEntitlement(result.entitlement);
    toast.show('구독을 복원했어요');
    await syncAndRefresh();
  };

  return (
    <Screen padded={false}>
      <AppHeader
        onBack={() => goBackOrReplace('/(tabs)/profile')}
        title="구독"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <StatusBadge
            label={subscribed ? '스탠다드 이용 중' : '무료 이용 중'}
            tone={subscribed ? 'positive' : 'neutral'}
          />
          <AppText variant="pageTitle">더 많이 담고, 오래 남겨요</AppText>
          <AppText tone="muted" variant="body">
            무료로도 모든 기능을 쓸 수 있어요. 스탠다드는 처리 분량과 보관을 늘려 줘요.
          </AppText>
          {/* The plan and its renewal date sit above the fold: a learner who
              opens this screen worried about being charged should not have to
              scroll past a price table to find out what they are on. */}
          <AppText tabular tone="soft" variant="meta">
            {planLine}
          </AppText>
        </View>

        {usage ? (
          <Card style={styles.usageCard} variant="soft">
            <View style={styles.usageHead}>
              <AppText variant="itemTitle">이번 달 처리 분량</AppText>
              <AppText tabular tone="muted" variant="meta">
                {`${usage.minutes_used}분 / ${usage.minutes_limit}분`}
              </AppText>
            </View>
            <ProgressBar
              max={Math.max(1, usage.minutes_limit)}
              tone="ink"
              value={usage.minutes_used}
            />
            <AppText tone="faint" variant="badge">
              {usage.minutes_used >= usage.minutes_limit
                ? '이번 달 분량을 다 썼어요. 다음 달 1일에 다시 채워져요.'
                : `${formatRenewalDate(usage.period_end) ?? '다음 달'}에 다시 채워져요.`}
            </AppText>
          </Card>
        ) : null}

        {canBuyHere && !subscribed ? (
          <>
            <SegmentedControl<BillingCycle>
              onChange={setCycle}
              options={cycleOptions}
              value={cycle}
            />

            <Card style={styles.planCard} variant="soft">
              <View style={styles.planHead}>
                <AppText variant="heading">스탠다드</AppText>
                <StatusBadge label="추천" tone="brand" />
              </View>
              <AppText variant="display">{copy.headline}</AppText>
              {copy.subline ? (
                <AppText tone="muted" variant="meta">
                  {copy.subline}
                </AppText>
              ) : null}
            </Card>
          </>
        ) : null}

        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="heading">
            스탠다드에 들어 있어요
          </AppText>
          <Card padding={false}>
            <View style={styles.tableHead}>
              <AppText style={styles.labelCell} tone="muted" variant="meta">
                혜택
              </AppText>
              <AppText
                align="center"
                style={styles.valueCell}
                tone="muted"
                variant="meta"
              >
                무료
              </AppText>
              <AppText align="center" style={styles.valueCell} variant="label">
                스탠다드
              </AppText>
            </View>
            {PLAN_BENEFITS.map((benefit, index) => (
              <View
                key={benefit.key}
                style={[
                  styles.tableRow,
                  index < PLAN_BENEFITS.length - 1
                    ? styles.tableRowDivider
                    : null,
                ]}
              >
                <AppText style={styles.labelCell} variant="body">
                  {benefit.label}
                </AppText>
                <View style={styles.valueCell}>
                  {benefit.free === false ? (
                    <Minus
                      {...decorative}
                      accessibilityLabel="없음"
                      color={colors.textFaint}
                      size={iconSizes.inline}
                      strokeWidth={2}
                    />
                  ) : (
                    <AppText align="center" tone="muted" variant="meta">
                      {benefit.free}
                    </AppText>
                  )}
                </View>
                <View style={styles.valueCell}>
                  {benefit.standard === true ? (
                    <Check
                      {...decorative}
                      accessibilityLabel="포함"
                      color={colors.text}
                      size={iconSizes.section}
                      strokeWidth={2.4}
                    />
                  ) : (
                    <AppText align="center" variant="label">
                      {benefit.standard}
                    </AppText>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </View>

        {/* Google Play requires all four of these sentences to be visible
            before the purchase button, so they are one block that cannot be
            split up by a later redesign. */}
        {canBuyHere && !subscribed ? (
          <Card style={styles.termsCard} variant="soft">
            <AppText accessibilityRole="header" variant="itemTitle">
              결제 안내
            </AppText>
            <AppText tone="muted" variant="body">
              {copy.billingLine}
            </AppText>
            <AppText tone="muted" variant="body">
              {autoRenewLine(cycle)}
            </AppText>
            <AppText tone="muted" variant="body">
              {cancelLine(surface)}
            </AppText>
          </Card>
        ) : null}

        <Card padding={false}>
          <View style={styles.manageCopy}>
            <AppText accessibilityRole="header" variant="heading">
              구독을 관리해요
            </AppText>
            <AppText tone="muted" variant="body">
              {canBuyHere
                ? surface === 'web'
                  ? '결제와 해지는 PREMIND 웹에서 진행돼요.'
                  : `결제와 해지는 ${surface === 'appstore' ? 'App Store' : 'Google Play'} 구독에서 관리돼요.`
                : '지금 버전에서는 앱에서 바로 구독할 수 없어요. 스토어에서 앱을 업데이트하면 구독할 수 있어요.'}
            </AppText>
          </View>
          <View style={styles.manageFacts}>
            <ManageFact label="지금 요금제" value={planName} />
            <ManageFact label="다음 갱신일" value={renewsText} />
            {usage ? (
              <ManageFact
                label="이번 달 처리 분량"
                value={`${usage.minutes_used}분 / ${usage.minutes_limit}분`}
              />
            ) : null}
          </View>
          {storeBilling && subscribed ? (
            <ListRow
              compact
              leadingIcon={CreditCard}
              onPress={() => openUrl(manageSubscriptionUrl(surface, manageProductId))}
              showChevron
              subtitle={
                surface === 'appstore'
                  ? 'App Store에서 해지하거나 결제 수단을 바꿔요'
                  : 'Google Play에서 해지하거나 결제 수단을 바꿔요'
              }
              title="구독 관리"
            />
          ) : null}
          {/* Not shown to a non-subscriber: the bottom bar already carries
              구매 복원 there, and two of the same action reads as two. */}
          {storeBilling && subscribed ? (
            <ListRow
              compact
              disabled={busy !== null}
              leadingIcon={RotateCcw}
              onPress={() => void restore()}
              subtitle="다른 기기에서 산 구독을 가져와요"
              title="구매 복원"
            />
          ) : null}
          <ListRow
            compact
            divider={false}
            leadingIcon={Mail}
            onPress={() => openUrl(SUPPORT_MAILTO)}
            subtitle={SUPPORT_EMAIL}
            title="문의하기"
          />
        </Card>

        <Card padding={false}>
          <ListRow
            compact
            leadingIcon={FileText}
            onPress={() => openUrl(TERMS_URL)}
            showChevron
            title="이용약관"
          />
          <ListRow
            compact
            divider={false}
            leadingIcon={ShieldCheck}
            onPress={() => openUrl(PRIVACY_URL)}
            showChevron
            title="개인정보 처리방침"
          />
        </Card>

        {state.notice ? (
          <AppText
            accessibilityLiveRegion="polite"
            tone={state.notice.tone}
            variant="meta"
          >
            {state.notice.text}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        {subscribed ? (
          <Button
            fullWidth
            onPress={() => router.back()}
            size="large"
            variant="secondary"
          >
            돌아가기
          </Button>
        ) : isWeb ? (
          <>
            <Button
              fullWidth
              onPress={() => openUrl(SUBSCRIPTION_WEB_URL)}
              rightIcon={
                <ExternalLink
                  color={colors.textInverse}
                  size={iconSizes.inline}
                />
              }
              size="large"
              variant="primary"
            >
              웹에서 구독하기
            </Button>
            <Button
              fullWidth
              onPress={() => router.back()}
              size="medium"
              variant="ghost"
            >
              나중에 할게요
            </Button>
          </>
        ) : storeBilling ? (
          <>
            {/* A disabled button with no reason beside it is the thing people
                tap twice and then give up on. The store answers with no
                products while the app's subscriptions are still being set up
                or reviewed, so say that rather than showing a dead control. */}
            {!storePackage ? (
              <AppText accessibilityRole="alert" tone="muted" variant="meta">
                지금은 구독 상품을 불러올 수 없어요. 스토어에 상품이 준비되면
                바로 구독할 수 있어요.
              </AppText>
            ) : null}
            <Button
              disabled={!storePackage || busy !== null}
              fullWidth
              loading={busy === 'purchase' || busy === 'sync'}
              onPress={() => void purchase()}
              size="large"
              variant="primary"
            >
              구독 시작하기
            </Button>
            <Button
              disabled={busy !== null}
              fullWidth
              loading={busy === 'restore'}
              onPress={() => void restore()}
              size="medium"
              variant="ghost"
            >
              구매 복원
            </Button>
          </>
        ) : (
          <Button
            fullWidth
            onPress={() => router.back()}
            size="large"
            variant="secondary"
          >
            돌아가기
          </Button>
        )}
      </View>

      <Toast bottom={TOAST_ABOVE_BAR} message={toast.message} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  intro: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  planCard: {
    gap: spacing.sm,
  },
  termsCard: {
    gap: spacing.sm,
  },
  usageCard: {
    gap: spacing.sm,
  },
  usageHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableHead: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  tableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
  },
  tableRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  labelCell: {
    flex: 1.4,
    minWidth: 0,
  },
  valueCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  manageCopy: {
    gap: spacing.sm,
    padding: spacing.gutter,
  },
  manageFacts: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  manageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  studentCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  studentIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  flex: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  bottomBar: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
  },
});
