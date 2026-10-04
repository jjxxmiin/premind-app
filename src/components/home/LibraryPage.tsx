import { createElement, type PropsWithChildren } from 'react';
import { Platform, View } from 'react-native';

export function LibraryPage({
  active,
  children,
  width,
}: PropsWithChildren<{ active: boolean; width: number }>) {
  if (Platform.OS === 'web') {
    return createElement('div', {
      'aria-hidden': !active,
      inert: !active,
      style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width },
    }, children);
  }

  return (
    <View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={{ flex: 1, width }}
    >
      {children}
    </View>
  );
}
