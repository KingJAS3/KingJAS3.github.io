/**
 * Shared color palette for the dashboard.
 * Using a central object means changing one value updates every component.
 * The theme is dark navy with high-contrast accent colors for readability.
 */
export const COLORS = {
  // Backgrounds (darkest to lightest)
  navy: '#0a1628',        // page background
  navyMid: '#0f1e38',     // panel backgrounds
  navyLight: '#1a2d4a',   // cards, dropdowns

  // Interactive / accent
  accent: '#4a9eff',      // primary blue highlight
  accentDim: '#2a6ec0',   // pressed/hover state
  gold: '#ffc947',        // secondary accent, totals
  green: '#4caf50',       // positive change
  red: '#f44336',         // negative change / warning

  // Text
  text: '#e8eaf0',        // primary text
  textDim: '#8899bb',     // secondary / label text
  textMuted: '#4a5a7a',   // disabled / placeholder

  // Structure
  border: '#2a3a5a',      // borders and dividers
  gridLine: '#1e2e4a',    // chart grid lines

  // Ordered palette for bar/treemap colors (cycles through for multiple series)
  bars: ['#4a9eff', '#ffc947', '#4caf50', '#ff6b6b', '#9c27b0', '#00bcd4', '#ff9800'],
}
