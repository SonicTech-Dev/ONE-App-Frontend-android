import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The bottom tab bar is absolutely positioned so screens render full-bleed behind
// it. Any scrollable screen inside the tab navigator must therefore reserve this
// much space at the end of its content, or the last rows sit under the bar.
export const TAB_BAR_BASE_HEIGHT = 68;

export const useTabBarHeight = () => {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE_HEIGHT + insets.bottom;
};

/** Bottom padding for a scroll container, plus optional breathing room. */
export const useBottomSpacing = (extra = 16) => useTabBarHeight() + extra;
