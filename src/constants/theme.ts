// Theme Constants: Modern Pastel & Airy Luxury Palette
// Soft Pastel Backgrounds, Pastel Tinted Accents, Crisp Deep Slate Typography

export const Colors = {
  // Brand Colors (Soft Indigo / Periwinkle Pastel Primary)
  primary: '#4F46E5',       // Vibrant Soft Indigo
  primaryLight: '#6366F1',  // Light Indigo
  primaryDark: '#3730A3',   // Deep Indigo
  primaryMuted: '#EEF2FF',  // Soft Periwinkle Pastel Tint

  // Accent & Action
  accent: '#4F46E5',        // Main CTA
  accentLight: '#818CF8',
  accentMuted: '#E0E7FF',   // Very Soft Lavender-Blue

  // Pastel Teal / Mint (Attendance & Optimal Performance)
  teal: '#059669',          // Clean Emerald Teal
  tealLight: '#D1FAE5',     // Soft Mint Pastel Background
  tealDark: '#065F46',      // Deep Mint Text

  // Pastel Amber / Gold (Rewards & Points)
  gold: '#D97706',          // Warm Amber
  goldLight: '#FEF3C7',     // Soft Buttercup Pastel
  goldDark: '#92400E',      // Deep Honey Text

  // Pastel Coral / Rose (Alerts & Interventions)
  error: '#E11D48',         // Modern Rose / Crimson
  errorLight: '#FFE4E6',    // Soft Blossom Pastel
  errorDark: '#9F1239',     // Deep Rose Text

  // Backgrounds (Airy, Clean Cloud-Soft Canvas)
  background: '#F6F8FC',    // Fresh Soft Cloud White
  white: '#FFFFFF',
  lightGray: '#F1F5F9',
  surface: '#FFFFFF',

  // Text Colors (Refined Modern Slate Typography)
  textPrimary: '#0F172A',   // Deep Slate Headline
  textSecondary: '#334155', // Readable Body
  textTertiary: '#64748B',  // Muted Label
  textMuted: '#94A3B8',

  // Borders & Shadows (Subtle, Soft & Modern)
  border: '#E2E8F0',
  borderLight: '#EDF2F7',
  borderDark: '#CBD5E1',
  shadow: '#334155',

  // Curated Pastel Colors (Soft, Modern, Friendly & Luminous)
  pastels: {
    // Mint / Sage (Attendance / Positive Health)
    mintBg: '#ECFDF5',
    mintBorder: '#A7F3D0',
    mintText: '#065F46',

    // Ice Blue / Sky (Students / Classes)
    iceBg: '#F0F7FF',
    iceBorder: '#BAE6FD',
    iceText: '#0369A1',

    // Lavender / Periwinkle (Behavior / Focus)
    lavenderBg: '#F5F3FF',
    lavenderBorder: '#DDD6FE',
    lavenderText: '#6D28D9',

    // Soft Peach / Apricot (Alerts / Watchlist)
    peachBg: '#FFF7ED',
    peachBorder: '#FED7AA',
    peachText: '#C2410C',

    // Butter / Champagne (Rewards / Milestones)
    champagneBg: '#FEFCE8',
    champagneBorder: '#FEF08A',
    champagneText: '#854D0E',

    // Blossom Rose / Soft Coral (Needs Support)
    roseBg: '#FFF1F2',
    roseBorder: '#FECDD3',
    roseText: '#9F1239',

    // Cool Slate (Neutral meters & tracks)
    slateBg: '#F1F5F9',
    slateBorder: '#E2E8F0',
    slateText: '#475569',
  },
};

// Spacing system (8pt grid)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border Radius
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  hero: 32,
  full: 9999,
};

// Soft Pastel Shadow Styles
export const Shadows = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  large: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  capsule: {
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
};
