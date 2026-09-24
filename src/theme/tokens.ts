import type { TextStyle, ViewStyle } from 'react-native';

/**
 * PREMIND design tokens.
 *
 * The visual language is deliberately quiet: a white canvas, near-black type,
 * hairline borders, and one accent colour used only where attention is
 * earned (an active tab, a live recording, a primary "go" action). Depth is
 * expressed with borders and tone, not shadows. Prefer the semantic `colors`
 * aliases in components and feature code; reach for `palette` only when a
 * component owns a fixed decorative wash.
 */
export const palette = {
  accent50: '#FFF6F0',
  accent100: '#FEE9DB',
  accent200: '#FBCDB0',
  accent300: '#F5A574',
  accent400: '#EC7A3C',
  accent500: '#E25A1C',
  accent600: '#C94A12',
  accent700: '#A63B0E',
  accent800: '#7F2E0C',

  canvas: '#FFFFFF',
  canvasSoft: '#F7F7F8',
  canvasMuted: '#EFF0F3',
  paper: '#FFFFFF',
  paperWarm: '#FAFAFB',
  ink: '#17171B',
  inkSoft: '#34353B',
  muted: '#6B6E76',
  faint: '#8A8D96',
  line: '#ECEDF0',
  lineStrong: '#DCDEE3',
  brandHover: '#C94A12',
  brandSoft: '#FDEFE6',

  apricotSoft: '#FFF3EB',
  butterSoft: '#FFF7DF',
  sageSoft: '#EAF5EE',
  skySoft: '#EBF2FA',
  lavenderSoft: '#F0EDFA',

  stage950: '#0B0B0E',
  stage925: '#0E0E12',
  stage900: '#111114',
  stage850: '#16161B',
  stage800: '#1C1C22',
  stage700: '#26262E',
  mist50: '#F5F5F7',
  mist200: '#D6D6DD',
  mist400: '#9C9CAA',
  mist500: '#74747F',
  mist600: '#585860',

  positive400: '#5CC2A3',
  positive500: '#12906F',
  positive700: '#0B6B53',
  positiveSoft: '#E6F5EF',
  warning500: '#C07A0F',
  warning700: '#8D5A0B',
  warningSoft: '#FBF2DE',
  negative400: '#EE8A97',
  negative500: '#D62E42',
  negative700: '#A31F31',
  negativeSoft: '#FCEBED',
} as const;

export const colors = {
  background: palette.canvas,
  backgroundSoft: palette.canvasSoft,
  backgroundMuted: palette.canvasMuted,
  surface: palette.paper,
  surfaceElevated: palette.paperWarm,
  surfaceInverse: palette.stage900,
  text: palette.ink,
  textSoft: palette.inkSoft,
  textMuted: palette.muted,
  textFaint: palette.faint,
  textInverse: '#FFFFFF',
  border: palette.line,
  borderStrong: palette.lineStrong,
  /** The one accent. Active tab, live state, the single "go" action. */
  brand: palette.accent500,
  brandStrong: palette.accent600,
  brandPressed: palette.accent700,
  brandSoft: palette.brandSoft,
  brandSubtle: palette.accent50,
  brandText: palette.accent600,
  /** Filled CTAs are ink, not accent, so the accent keeps its meaning. */
  action: palette.ink,
  actionPressed: palette.inkSoft,
  positive: palette.positive500,
  positiveStrong: palette.positive700,
  positiveSoft: palette.positiveSoft,
  warning: palette.warning500,
  warningStrong: palette.warning700,
  warningSoft: palette.warningSoft,
  negative: palette.negative500,
  negativeStrong: palette.negative700,
  negativeSoft: palette.negativeSoft,
  stage: palette.stage900,
  stageRaised: palette.stage800,
  stageBorder: palette.stage700,
  stageText: palette.mist50,
  stageMuted: palette.mist400,
  overlay: 'rgba(17, 17, 20, 0.48)',
  overlaySoft: 'rgba(17, 17, 20, 0.08)',
  focusRing: 'rgba(226, 90, 28, 0.28)',
  transparent: 'transparent',
} as const;

export const chartColors = [
  '#E25A1C',
  '#12906F',
  '#7B61D6',
  '#3D7BE8',
  '#C0398F',
  '#8A8D96',
] as const;

export const ordinalColors = [
  '#FFA36B',
  '#F5874A',
  '#E86C2D',
  '#C94A12',
  '#A63B0E',
] as const;

/** Names must match the keys supplied to expo-font/useFonts. */
export const fontFamilies = {
  medium: 'Pretendard-Medium',
  bold: 'Pretendard-Bold',
  extraBold: 'Pretendard-ExtraBold',
  /** Kept loaded for legacy callers; new titles use `bold`/`extraBold`. */
  black: 'Pretendard-Black',
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  gutter: 20,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  massive: 64,
} as const;

export const radii = {
  badge: 6,
  chip: 999,
  input: 10,
  iconButton: 10,
  button: 12,
  tile: 14,
  alert: 12,
  largeButton: 12,
  modal: 20,
  card: 16,
  hero: 20,
  floating: 20,
  full: 999,
} as const;

export const sizes = {
  mobileGutter: 20,
  mobileHeader: 56,
  desktopSidebar: 256,
  compactSidebar: 68,
  buttonSmall: 36,
  button: 44,
  buttonLarge: 52,
  input: 48,
  iconButton: 40,
  segmentedControl: 40,
  chip: 34,
  badge: 22,
  minimumTouchTarget: 44,
  wordmarkMinimumWidth: 90,
  tabBar: 56,
} as const;

export const iconSizes = {
  badge: 12,
  dense: 14,
  inline: 16,
  section: 20,
  state: 28,
  tab: 22,
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  heroTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  pageTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  pageDescription: {
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  heading: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  itemTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  bodyStrong: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  meta: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  badge: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  button: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  buttonSmall: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  buttonLarge: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  numeric: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  metric: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

/**
 * Depth is rare. Cards sit flat on the canvas with a hairline border; only a
 * floating layer (a sheet, a sticky composer, a menu) casts a shadow.
 */
export const elevation = {
  flat: 0,
  low: 1,
  medium: 2,
  high: 4,
  floating: 8,
} as const;

export const shadows = {
  none: {},
  subtle: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: elevation.low,
  },
  card: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: elevation.medium,
  },
  raised: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: elevation.high,
  },
  floating: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: elevation.floating,
  },
} satisfies Record<string, ViewStyle>;

/** Motion values are shared by native and web implementations. */
export const motion = {
  duration: {
    instant: 90,
    fast: 140,
    standard: 220,
    deliberate: 320,
  },
  press: {
    buttonScale: 0.985,
    cardScale: 0.992,
  },
  spring: {
    damping: 19,
    mass: 0.9,
    stiffness: 230,
  },
  easing: {
    enter: (value: number) => 1 - Math.pow(1 - value, 3),
    standard: (value: number) =>
      value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2,
  },
} as const;

/** Stable proportions and colour washes for illustration-led surfaces. */
export const illustration = {
  /** Native ratio of the HD microphone cutout; prevents contain-fit downscaling. */
  heroAspectRatio: 1199 / 1312,
  mediaAspectRatio: 16 / 9,
  heroMaxWidth: 220,
  heroCompactWidth: 96,
  tones: {
    apricot: palette.apricotSoft,
    butter: palette.butterSoft,
    sage: palette.sageSoft,
    sky: palette.skySoft,
    lavender: palette.lavenderSoft,
  },
} as const;

export const theme = {
  palette,
  colors,
  chartColors,
  ordinalColors,
  fontFamilies,
  spacing,
  radii,
  sizes,
  iconSizes,
  typography,
  elevation,
  shadows,
  motion,
  illustration,
} as const;

export type PremindTheme = typeof theme;
