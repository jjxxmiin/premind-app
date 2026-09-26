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
  XCircle,
} from 'lucide-react-native';
import { useEffect, useReducer, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  AppText,
  Button,
  Card,
  Dialog,
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
  REFUND_POLICY_URL,
  refundLine,
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
import {
  cancelWebSubscription,
  fetchWebSubscription,
  resumeWebSubscription,
  type WebSubscription,
} from '@/features/billing/web-subscription';
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
import {
  interviewServerAvailable,
  startWebCheckout,
} from '@/features/interview/interview-api';
import { useAppStore } from '@/state/app-store';
import {
  PLAN_BENEFITS,
  PLAN_PRICES,
  PRIVACY_URL,
  SUBSCRIPTION_WEB_URL,
  TERMS_URL,
  type BillingCycle,
} from '@/data/subscription-plans';
import { colors, iconSizes, spacing } from '@/theme/tokens';
import { useLocale, useT } from '@/lib/i18n';
import { fmtWon } from '@/lib/i18n/core';
import { useLayout } from '@/lib/layout';

const cycleOptions = [
  { value: 'monthly', label: '월간' },
  { value: 'yearly', label: '연간 (2개월 무료)' },
] as const;

const SUPPORT_EMAIL = 'support@camorix.com';

/** 2026-09-26 덜어내기: 요금제 카드에 먼저 보이는 줄. 나머지는 "혜택 모두 보기" 안에. */
const PRIMARY_BENEFITS: readonly string[] = ['minutes', 'lens', 'interview', 'retention'];
/** A mail app is not a payment link, so this is allowed in a native build. */
const supportMailto = (subject: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

/** Toast sits above the bottom bar (52pt button + 12 + 20 padding). */
const TOAST_ABOVE_BAR = 104;

function openUrl(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/**
 * One plan as a card: name, price (while it can be bought here), then every
 * line of the offer with this plan's value. 스탠다드 wears the brand border
 * while it is the one on offer.
 */
function PlanCard({
  current,
  expanded,
  plan,
  price,
  priceNote,
  recommended,
  wide,
}: {
  current: boolean;
  /** Every line of the offer; folded, only the lines people ask about first. */
  expanded: boolean;
  plan: 'free' | 'standard';
  price: string | null;
  priceNote: string | null;
  recommended: boolean;
  wide: boolean;
}) {
  const t = useT();
  const standard = plan === 'standard';
  return (
    <Card
      style={[
        styles.planCard,
        styles.flat,
        wide ? styles.planCardWide : null,
        recommended ? styles.planCardOffer : null,
      ]}
    >
      <View style={styles.planHead}>
        <AppText variant="heading">{t(standard ? '스탠다드' : '무료')}</AppText>
        {current ? (
          <StatusBadge label={t('이용 중')} tone={standard ? 'positive' : 'neutral'} />
        ) : null}
      </View>
      {price ? (
        <View style={styles.planPrice}>
          <AppText tabular variant="display">
            {price}
          </AppText>
          {/* Holds the line on the free card too, so side-by-side lists start level. */}
          <AppText tone="muted" variant="meta">
            {priceNote ?? ' '}
          </AppText>
        </View>
      ) : null}
      {expanded || standard || wide ? <View style={styles.planDivider} /> : null}
      <View style={styles.benefits}>
        {/* 폰에서 무료 카드는 이름만: 줄마다의 비교는 "혜택 모두 보기" 안에. */}
        {PLAN_BENEFITS.filter((benefit) =>
          expanded || (PRIMARY_BENEFITS.includes(benefit.key) && (standard || wide)),
        ).map((benefit) => {
          const value = standard ? benefit.standard : benefit.free;
          return (
            <View key={benefit.key} style={styles.benefitRow}>
              {value === false ? (
                <Minus
                  {...decorative}
                  color={colors.textFaint}
                  size={iconSizes.inline}
                  strokeWidth={2}
                />
              ) : (
                <Check
                  {...decorative}
                  color={standard ? colors.brand : colors.textMuted}
                  size={iconSizes.inline}
                  strokeWidth={2.4}
                />
              )}
              <AppText
                numberOfLines={2}
                style={styles.benefitLabel}
                tone={value === false ? 'faint' : 'soft'}
                variant="body"
              >
                {t(benefit.label)}
              </AppText>
              <AppText
                align="right"
                tabular
                tone={value === false ? 'faint' : standard ? 'default' : 'muted'}
                variant={standard ? 'label' : 'meta'}
              >
                {value === false
                  ? t.ctx('plan', '없음')
                  : value === true
                    ? t.ctx('plan', '포함')
                    : t.ctx('plan', value)}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
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
  const t = useT();
  const locale = useLocale();
  const { session } = useAppStore();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [allBenefits, setAllBenefits] = useState(false);
  const [webCheckout, setWebCheckout] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });
  const [offering, setOffering] = useState<StoreOffering | null>(null);
  const [entitlement, setEntitlement] = useState<StoreEntitlement | null>(null);
  const [state, dispatch] = useReducer(purchaseReducer, initialPurchaseState);
  const toast = useToast();
  const planStatus = usePlanStatus();
  const { breakpoint } = useLayout();
  const wide = breakpoint !== 'compact';

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
    locale,
  );

  // The renewal date the server knows, or the one the store just told us.
  const renewsAtIso = planStatus.renewsAt ?? entitlement?.expiresAt ?? null;
  const renewsText = renewalFact(renewsAtIso, subscribed, locale);
  const planName = t(subscribed ? '스탠다드' : '무료');
  const planLine = formatRenewalDate(renewsAtIso)
    ? t('지금 요금제 {planName} / 다음 갱신일 {renewsText}', { planName, renewsText })
    : t('지금 요금제 {planName}', { planName });
  // 웹(Polar)에서 결제한 구독은 여기서 바로 해지 예약, 해지 취소(2026-09-26). 스토어 구독은 스토어에서.
  const [webSub, setWebSub] = useState<WebSubscription | null>(null);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [webBusy, setWebBusy] = useState(false);
  useEffect(() => {
    if (planStatus.plan !== 'standard') return;
    let alive = true;
    void fetchWebSubscription().then((sub) => {
      if (alive) setWebSub(sub);
    });
    return () => {
      alive = false;
    };
  }, [planStatus.plan]);
  const webManaged = webSub?.source === 'web';
  const webEnd = formatRenewalDate(webSub?.renewsAt ?? renewsAtIso, locale) ?? '';
  const changeWebCancel = async (cancel: boolean) => {
    setWebBusy(true);
    try {
      const next = await (cancel ? cancelWebSubscription() : resumeWebSubscription());
      setWebSub(next);
      setCancelAsk(false);
      toast.show(
        cancel
          ? t('해지를 예약했어요. {date}까지는 스탠다드를 그대로 써요.', { date: webEnd })
          : t('해지를 취소했어요. 스탠다드가 계속돼요.'),
      );
      await planStatus.refresh();
    } catch (error: unknown) {
      setCancelAsk(false);
      toast.show(t(error instanceof Error && error.message ? error.message : '구독을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setWebBusy(false);
    }
  };
  const minutesText = (used: number, limit: number) =>
    t('{used}분 / {limit}분', { used, limit });
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
    if (result.entitled) toast.show(t('스탠다드가 시작됐어요'));
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
    toast.show(t('구독을 복원했어요'));
    await syncAndRefresh();
  };

  return (
    <Screen background="soft" padded={false}>
      <AppHeader
        onBack={() => goBackOrReplace('/(tabs)/profile')}
        title={t('구독')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <AppText variant="pageTitle">{t('더 많이 담고, 오래 남겨요')}</AppText>
          {/* The plan and its renewal date sit above the fold: a learner who
              opens this screen worried about being charged should not have to
              scroll past a price table to find out what they are on. */}
          {subscribed ? (
            <AppText tabular tone="soft" variant="meta">
              {planLine}
            </AppText>
          ) : null}
        </View>

        {usage ? (
          <Card style={[styles.usageCard, styles.flat]}>
            <View style={styles.usageHead}>
              <AppText variant="itemTitle">{t('이번 달 처리 분량')}</AppText>
              <AppText tabular tone="muted" variant="meta">
                {minutesText(usage.minutes_used, usage.minutes_limit)}
              </AppText>
            </View>
            <ProgressBar
              max={Math.max(1, usage.minutes_limit)}
              tone="ink"
              value={usage.minutes_used}
            />
            <AppText tone="faint" variant="badge">
              {usage.minutes_used >= usage.minutes_limit
                ? t('이번 달 분량을 다 썼어요. 다음 달 1일에 다시 채워져요.')
                : locale === 'en'
                  ? formatRenewalDate(usage.period_end, 'en')
                    ? `Refills on ${formatRenewalDate(usage.period_end, 'en')}.`
                    : 'Refills next month.'
                  : `${formatRenewalDate(usage.period_end) ?? '다음 달'}에 다시 채워져요.`}
            </AppText>
          </Card>
        ) : null}

        {canBuyHere && !subscribed ? (
          <View style={wide ? styles.cycleWide : null}>
            <SegmentedControl<BillingCycle>
              onChange={setCycle}
              options={cycleOptions.map((option) => ({ ...option, label: t(option.label) }))}
              value={cycle}
            />
          </View>
        ) : null}

        {/* Two plans side by side from a tablet up; on a phone the one on
            offer comes first. Each card carries its own column of the old
            comparison table, so nothing the table said is lost. */}
        <View style={[styles.plans, wide ? styles.plansWide : null]}>
          {(wide ? (['free', 'standard'] as const) : (['standard', 'free'] as const)).map(
            (plan) => (
              <PlanCard
                current={plan === 'standard' ? subscribed : !subscribed}
                expanded={allBenefits}
                key={plan}
                plan={plan}
                // 폰에서는 무료 카드의 0원을 뺀다. 나란히 놓는 넓은 화면은 두 목록 높이를 맞추려고 둔다.
                price={
                  canBuyHere && !subscribed
                    ? plan === 'standard'
                      ? copy.headline
                      : wide
                        ? fmtWon(0, locale)
                        : null
                    : null
                }
                priceNote={
                  canBuyHere && !subscribed && plan === 'standard' ? copy.subline : null
                }
                recommended={plan === 'standard' && !subscribed}
                wide={wide}
              />
            ),
          )}
        </View>
        <Button
          accessibilityState={{ expanded: allBenefits }}
          onPress={() => setAllBenefits((open) => !open)}
          size="small"
          style={styles.moreBenefits}
          variant="ghost"
          >
          {allBenefits ? t.ctx('fold', '접기') : t('혜택 모두 보기')}
        </Button>

        {/* Google Play requires all four of these sentences to be visible
            before the purchase button, so they are one block that cannot be
            split up by a later redesign. */}
        {canBuyHere && !subscribed ? (
          <Card style={[styles.termsCard, styles.flat]}>
            <AppText accessibilityRole="header" variant="itemTitle">
              {t('결제 안내')}
            </AppText>
            <AppText tone="muted" variant="body">
              {copy.billingLine}
            </AppText>
            <AppText tone="muted" variant="body">
              {autoRenewLine(cycle, locale)}
            </AppText>
            <AppText tone="muted" variant="body">
              {cancelLine(surface, locale)}
            </AppText>
            {/* 전자상거래법 제17조 제6항: 청약철회 기준을 결제 전에 알린다(환불규정 제3조, 2026-09-26). */}
            <AppText tone="faint" variant="meta">
              {refundLine(locale)}{' '}
              <AppText
                accessibilityRole="link"
                onPress={() => openUrl(REFUND_POLICY_URL)}
                style={styles.refundLink}
                tone="faint"
                variant="meta"
              >
                {t('환불규정')}
              </AppText>
            </AppText>
          </Card>
        ) : null}

        <Card padding={false} style={styles.flat}>
          <View style={[styles.manageCopy, styles.manageCopyDivider]}>
            <AppText accessibilityRole="header" variant="heading">
              {t('구독을 관리해요')}
            </AppText>
            <AppText tone="muted" variant="body">
              {canBuyHere
                ? webManaged
                  ? t('웹에서 결제한 구독이에요. 해지해도 이번 기간이 끝날 때까지 스탠다드를 써요.')
                  : surface === 'web'
                  ? t('결제와 해지는 PREMIND 웹에서 진행돼요.')
                  : t('결제와 해지는 {store} 구독에서 관리돼요.', {
                      store: surface === 'appstore' ? 'App Store' : 'Google Play',
                    })
                : t('지금 버전에서는 앱에서 바로 구독할 수 없어요. 스토어에서 앱을 업데이트하면 구독할 수 있어요.')}
            </AppText>
          </View>
          {storeBilling && subscribed ? (
            <ListRow
              compact
              leadingIcon={CreditCard}
              onPress={() => openUrl(manageSubscriptionUrl(surface, manageProductId))}
              showChevron
              subtitle={t(
                surface === 'appstore'
                  ? 'App Store에서 해지하거나 결제 수단을 바꿔요'
                  : 'Google Play에서 해지하거나 결제 수단을 바꿔요',
              )}
              title={t('구독 관리')}
            />
          ) : null}
          {webManaged && !webSub?.cancelAtPeriodEnd ? (
            <ListRow
              compact
              disabled={webBusy}
              leadingIcon={XCircle}
              onPress={() => setCancelAsk(true)}
              showChevron
              subtitle={t('{date}까지 쓰고 그 뒤로 결제되지 않아요', { date: webEnd })}
              title={t('구독 해지')}
            />
          ) : null}
          {webManaged && webSub?.cancelAtPeriodEnd ? (
            <ListRow
              compact
              disabled={webBusy}
              leadingIcon={RotateCcw}
              onPress={() => void changeWebCancel(false)}
              subtitle={t('{date}에 해지돼요. 누르면 계속 써요', { date: webEnd })}
              title={t('해지 취소')}
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
              subtitle={t('다른 기기에서 산 구독을 가져와요')}
              title={t('구매 복원')}
            />
          ) : null}
          <ListRow
            compact
            divider={false}
            leadingIcon={Mail}
            onPress={() => openUrl(supportMailto(t('[PREMIND] 구독 문의')))}
            title={t('문의하기')}
          />
        </Card>

        <Card padding={false} style={styles.flat}>
          <ListRow
            compact
            leadingIcon={FileText}
            onPress={() => openUrl(TERMS_URL)}
            showChevron
            title={t('이용약관')}
          />
          <ListRow
            compact
            divider={false}
            leadingIcon={ShieldCheck}
            onPress={() => openUrl(PRIVACY_URL)}
            showChevron
            title={t('개인정보 처리방침')}
          />
        </Card>

        {state.notice ? (
          <AppText
            accessibilityLiveRegion="polite"
            tone={state.notice.tone}
            variant="meta"
          >
            {t(state.notice.text)}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={[styles.barInner, wide ? styles.barInnerWide : null]}>
          {subscribed ? (
            <Button
              fullWidth
              onPress={() => router.back()}
              size="large"
              variant="secondary"
            >
              {t('돌아가기')}
            </Button>
          ) : isWeb ? (
            <>
              {webCheckout.error ? (
                <AppText accessibilityRole="alert" tone="muted" variant="meta">
                  {t(webCheckout.error)}
                </AppText>
              ) : null}
              <Button
                disabled={webCheckout.busy}
                fullWidth
                onPress={() => {
                  setWebCheckout({ busy: true, error: null });
                  // The student server opens a Polar checkout for this account
                  // (premind-recorder-api /api/interview/checkout); the webhook
                  // turns 스탠다드 on. No server configured (demo build) → the
                  // pricing page instead.
                  if (!interviewServerAvailable()) {
                    openUrl(SUBSCRIPTION_WEB_URL);
                    setWebCheckout({ busy: false, error: null });
                    return;
                  }
                  const back =
                    typeof window !== 'undefined' ? window.location.href : SUBSCRIPTION_WEB_URL;
                  startWebCheckout(back, cycle)
                    .then((url) => {
                      if (typeof window !== 'undefined') window.location.assign(url);
                      else openUrl(url);
                    })
                    .catch((error: unknown) => {
                      setWebCheckout({
                        busy: false,
                        error:
                          error instanceof Error && error.message
                            ? error.message
                            : '결제 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.',
                      });
                    });
                }}
                rightIcon={
                  <ExternalLink
                    color={colors.textInverse}
                    size={iconSizes.inline}
                  />
                }
                size="large"
                variant="primary"
              >
                {t('스탠다드 구독하기')}
              </Button>
              <Button
                fullWidth
                onPress={() => router.back()}
                size="medium"
                variant="ghost"
              >
                {t('나중에 할게요')}
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
                  {t('지금은 구독 상품을 불러올 수 없어요. 스토어에 상품이 준비되면 바로 구독할 수 있어요.')}
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
                {t('구독 시작하기')}
              </Button>
              <Button
                disabled={busy !== null}
                fullWidth
                loading={busy === 'restore'}
                onPress={() => void restore()}
                size="medium"
                variant="ghost"
              >
                {t('구매 복원')}
              </Button>
            </>
          ) : (
            <Button
              fullWidth
              onPress={() => router.back()}
              size="large"
              variant="secondary"
            >
              {t('돌아가기')}
            </Button>
          )}
        </View>
      </View>

      <Dialog
        cancel={{ label: t('계속 쓰기'), onPress: () => setCancelAsk(false), variant: 'secondary' }}
        confirm={{ label: t('해지하기'), loading: webBusy, onPress: () => void changeWebCancel(true), variant: 'danger' }}
        description={t('{date}까지는 스탠다드를 그대로 쓰고, 그 뒤로는 결제되지 않아요. 언제든 해지를 취소할 수 있어요.', { date: webEnd })}
        onRequestClose={() => setCancelAsk(false)}
        title={t('구독을 해지할까요?')}
        visible={cancelAsk}
      />
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
  cycleWide: {
    maxWidth: 420,
  },
  plans: {
    gap: spacing.md,
  },
  plansWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  planCard: {
    gap: spacing.md,
  },
  planCardWide: {
    flex: 1,
    minWidth: 0,
  },
  planCardOffer: {
    borderColor: colors.brand,
    borderWidth: 1.5,
  },
  planPrice: {
    gap: spacing.xxs,
  },
  planDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  benefits: {
    gap: spacing.md,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  benefitLabel: {
    flex: 1,
    minWidth: 0,
  },
  termsCard: {
    gap: spacing.sm,
  },
  refundLink: {
    textDecorationLine: 'underline',
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
  manageCopy: {
    gap: spacing.sm,
    padding: spacing.gutter,
  },
  manageCopyDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flat: {
    borderColor: colors.transparent,
  },
  moreBenefits: {
    alignSelf: 'center',
  },
  bottomBar: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter,
  },
  barInner: {
    gap: spacing.md,
  },
  // On a wide window the buttons sit under the 스탠다드 card, not across
  // the whole column.
  barInnerWide: {
    alignSelf: 'flex-end',
    gap: spacing.sm,
    maxWidth: 420,
    width: '100%',
  },
});
