// Mirlo Blue - Nightwing Dark Mode Theme Tokens
export const theme = {
  colors: {
    // Void Obsidian Backgrounds
    background: "#070b14",
    surface: "#0d1424",
    surfaceElevated: "#131e35",
    surfaceGloss: "rgba(19, 30, 53, 0.75)",
    surfaceGlassBorder: "rgba(0, 210, 255, 0.18)",
    surfaceCardBorder: "rgba(255, 255, 255, 0.08)",

    // Nightwing Electric Blue & Cyan Accents
    primary: "#00d2ff",
    primaryGlow: "rgba(0, 210, 255, 0.35)",
    primaryGradientStart: "#00d2ff",
    primaryGradientEnd: "#0066ff",
    secondaryAccent: "#38bdf8",
    activeBadge: "#00e5ff",
    notificationDot: "#ff3b69",
    logo: "#ffd60a",

    // Typography
    textPrimary: "#f8fafc",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    textCyan: "#38bdf8",

    // Player & Transport
    progressTrack: "#1e293b",
    progressFill: "#00d2ff",
    playButtonBg: "#00d2ff",
    playButtonIcon: "#070b14",
  },
  typography: {
    fontFamily: undefined,
    h1: { fontSize: 24, fontWeight: "700" as const, color: "#f8fafc" },
    h2: { fontSize: 18, fontWeight: "700" as const, color: "#f8fafc", letterSpacing: 0.5 },
    sectionHeader: {
      fontSize: 13,
      fontWeight: "800" as const,
      color: "#00d2ff",
      letterSpacing: 1.5,
      textTransform: "uppercase" as const,
    },
    body: { fontSize: 14, color: "#94a3b8" },
    caption: { fontSize: 12, color: "#64748b" },
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    full: 9999,
  },
  shadows: {
    glossCard: {
      shadowColor: "#00d2ff",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
    neonGlow: {
      shadowColor: "#00d2ff",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 6,
    },
  },
};
