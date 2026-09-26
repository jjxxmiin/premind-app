import * as Linking from 'expo-linking';
import {
  BarChart3,
  Gauge,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  Star,
  Home,
  Mail,
  Mic,
  Upload,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppText, Card, Screen, useReducedMotion } from '@/components/ui';
import { decorative } from '@/lib/a11y';
import { goBackOrReplace } from '@/lib/navigation';
import { useT } from '@/lib/i18n';
import { colors, iconSizes, motion, radii, sizes, spacing } from '@/theme/tokens';

const SUPPORT_MAILTO = 'mailto:support@camorix.com';

/** The product loop, in the order a first-time user meets it. */
const loop: { icon: LucideIcon; label: string }[] = [
  { icon: Mic, label: '녹음, 올리기' },
  { icon: BookOpenCheck, label: '마인드팩' },
  { icon: Gauge, label: '복습' },
  { icon: BarChart3, label: '연습' },
];

interface GuideStep {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  lines: string[];
}

const steps: GuideStep[] = [
  {
    id: 'start',
    title: '시작하기',
    summary: '가입하면 바로 시작할 수 있어요',
    icon: Home,
    lines: [
      '이메일이나 소셜 계정으로 가입하면 바로 무료로 시작해요.',
      '녹음 탭을 누르거나 파일을 올리면 첫 마인드팩이 만들어져요.',
      '알림과 녹음 품질은 MY 탭에서 언제든 바꿀 수 있어요.',
    ],
  },
  {
    id: 'capture',
    title: '녹음, 올리기',
    summary: '녹음 / 영상, 음성, 문서 / 유튜브 링크',
    icon: Upload,
    lines: [
      '녹음하면 원본을 기기에 먼저 저장해요.',
      '영상, 음성 파일을 올려도 같은 방식으로 마인드팩을 만들어요.',
      'PDF와 PPTX는 쪽 단위로 읽어서 같은 마인드팩을 만들어요. 소리가 없으니 평가만 빼고 다 돼요.',
      '공개 유튜브 링크를 붙여 넣으면 내려받지 않고 대본을 만들어요.',
      '끊긴 업로드는 같은 자료로 이어서 올려요. 중복이 생기지 않아요.',
    ],
  },
  {
    id: 'pack',
    title: '마인드팩',
    summary: '대본 / 요약 / 마인드맵 / 문제 / 질문',
    icon: BookOpenCheck,
    lines: [
      '대본의 시점을 누르면 그 순간으로 바로 이동해요.',
      '요약은 한눈에 보기와 꼭 기억할 내용으로 짧게 정리돼요. 확인한 내용은 체크해 두세요.',
      '마인드맵은 개념 사이의 관계를 그림으로 보여줘요.',
      '아래의 "이 자료에 물어보기"를 누르면 대본을 근거로 답해 줘요.',
    ],
  },
  {
    id: 'lens',
    title: '복습과 연습',
    summary: '복습 탭 / 연습 탭',
    icon: BarChart3,
    lines: [
      '복습 탭은 푼 문제와 확인한 핵심 내용으로 자료마다 이해도를 계산해요.',
      '헷갈린 개념은 다시 들을 시점과 함께 알려줘요.',
      '연습 탭의 발표는 내 발표나 스피치 연습을 녹음하면 구조, 명료성, 근거, 전달력을 채점해요.',
      '연습 탭의 면접은 질문에 타이머 맞춰 답하고, 내가 한 말을 전사문과 피드백으로 돌아봐요.',
      '먼저 고칠 것 하나만 다음 연습에서 바꿔 보세요.',
    ],
  },
  {
    id: 'plan',
    title: '무료와 스탠다드',
    summary: '무료로도 모든 기능을 써요',
    icon: Star,
    lines: [
      '녹음, 올리기, 마인드팩, 질문, 평가까지 무료로 모두 써요.',
      '무료는 한 달에 120분까지 처리해요. 스탠다드는 1,200분까지 늘어나요.',
      '지금 어떤 요금제인지는 MY 탭의 구독에서 확인해요.',
    ],
  },
];

export default function GuideScreen() {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(steps[0]?.id ?? null);

  const openSupport = () => {
    void Linking.openURL(SUPPORT_MAILTO).catch(() => undefined);
  };

  return (
    <Screen
      maxWidth={720}
      padded={false}
      scroll
      scrollViewProps={{ showsVerticalScrollIndicator: false }}
    >
      <AppHeader onBack={() => goBackOrReplace('/(tabs)/profile')} title={t('사용 가이드')} />
      <View style={styles.content}>
        <View style={styles.heading}>
          <AppText variant="pageTitle">{t('녹음 한 번으로 복습까지')}</AppText>
          <AppText tone="muted" variant="body">
            {t('처음이라면 순서대로 따라해 보세요')}
          </AppText>
        </View>

        <Card
          accessibilityLabel={t('전체 흐름: {items}', {
            items: loop.map((item) => t(item.label)).join(', '),
          })}
          style={styles.loopCard}
        >
          <AppText tone="muted" variant="label">
            {t('전체 흐름')}
          </AppText>
          <View style={styles.loopRow}>
            {loop.map((item, index) => (
              <View key={item.label} style={styles.loopItemWrap}>
                <LoopTile icon={item.icon} label={t(item.label)} />
                {index < loop.length - 1 ? (
                  <ChevronRight
                    {...decorative}
                    color={colors.textFaint}
                    size={iconSizes.dense}
                    strokeWidth={2}
                    style={styles.loopArrow}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </Card>

        <Card padding={false}>
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              number={index + 1}
              onToggle={() =>
                setOpenId((current) => (current === step.id ? null : step.id))
              }
              open={openId === step.id}
              step={step}
            />
          ))}
          <Pressable
            accessibilityHint={t('메일 앱이 열려요')}
            accessibilityLabel={t('문의하기')}
            accessibilityRole="button"
            onPress={openSupport}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.supportRow,
              hovered ? styles.rowHovered : null,
              pressed ? styles.rowPressed : null,
            ]}
          >
            <View style={styles.supportIcon}>
              <Mail
                {...decorative}
                color={colors.text}
                size={iconSizes.section}
                strokeWidth={1.9}
              />
            </View>
            <View style={styles.flex}>
              <AppText variant="itemTitle">{t('문의하기')}</AppText>
              <AppText tone="muted" variant="meta">
                support@camorix.com
              </AppText>
            </View>
            <ChevronRight
              {...decorative}
              color={colors.textFaint}
              size={iconSizes.section}
              strokeWidth={1.8}
            />
          </Pressable>
        </Card>
      </View>
    </Screen>
  );
}

function LoopTile({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.loopItem}>
      <View style={styles.loopTile}>
        <Icon
          {...decorative}
          color={colors.brand}
          size={iconSizes.section}
          strokeWidth={2}
        />
      </View>
      <AppText align="center" numberOfLines={1} variant="badge">
        {label}
      </AppText>
    </View>
  );
}

function StepRow({
  number,
  onToggle,
  open,
  step,
}: {
  number: number;
  onToggle: () => void;
  open: boolean;
  step: GuideStep;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const [rotation] = useState(() => new Animated.Value(open ? 1 : 0));
  const Icon = step.icon;

  // Follows `open` rather than the press, so a row closed by another row
  // opening turns its chevron back too.
  useEffect(() => {
    const animation = Animated.timing(rotation, {
      duration: reduced ? 0 : motion.duration.standard,
      toValue: open ? 1 : 0,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [open, reduced, rotation]);

  return (
    <View style={styles.stepBlock}>
      <Pressable
        accessibilityHint={t.ctx('guide', open ? '접어요' : '펼쳐요')}
        accessibilityLabel={`${number}. ${t.ctx('guide', step.title)}. ${t(step.summary)}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          styles.stepHeader,
          hovered ? styles.rowHovered : null,
          pressed ? styles.rowPressed : null,
        ]}
      >
        <View style={[styles.stepIcon, open ? styles.stepIconOpen : null]}>
          <Icon
            {...decorative}
            color={open ? colors.textInverse : colors.brand}
            size={iconSizes.section}
            strokeWidth={2}
          />
        </View>
        <View style={styles.flex}>
          <AppText numberOfLines={1} variant="itemTitle">
            <AppText tabular tone="faint" variant="itemTitle">
              {`${number}  `}
            </AppText>
            {t.ctx('guide', step.title)}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="meta">
            {t(step.summary)}
          </AppText>
        </View>
        <Animated.View
          {...decorative}
          style={{
            transform: [
              {
                rotate: rotation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
          <ChevronDown color={colors.textFaint} size={iconSizes.section} strokeWidth={1.8} />
        </Animated.View>
      </Pressable>
      {open ? (
        <View style={styles.stepBody}>
          {step.lines.map((line, index) => (
            <View key={line} style={styles.stepLine}>
              <View style={styles.stepBullet}>
                <AppText tabular tone="brand" variant="badge">
                  {index + 1}
                </AppText>
              </View>
              <AppText style={styles.flex} tone="soft" variant="body">
                {t(line)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  heading: {
    gap: spacing.xs,
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  loopCard: {
    gap: spacing.md,
  },
  loopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  loopItemWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  loopItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  loopTile: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.input,
    height: sizes.button,
    justifyContent: 'center',
    width: sizes.button,
  },
  loopArrow: {
    marginBottom: spacing.xl,
  },
  stepBlock: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  stepIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.input,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  stepIconOpen: {
    backgroundColor: colors.brand,
  },
  stepBody: {
    gap: spacing.md,
    paddingBottom: spacing.gutter,
    paddingLeft: spacing.gutter + sizes.iconButton + spacing.md,
    paddingRight: spacing.gutter,
  },
  stepLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepBullet: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.full,
    height: sizes.badge,
    justifyContent: 'center',
    width: sizes.badge,
  },
  supportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
  },
  supportIcon: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radii.input,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  rowHovered: {
    backgroundColor: colors.surfaceElevated,
  },
  rowPressed: {
    backgroundColor: colors.backgroundSoft,
  },
});
