import { router, useLocalSearchParams } from 'expo-router';
import { FileSearch2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { StudyChat } from '@/components/StudyChat';
import { EmptyState, ErrorState, Screen } from '@/components/ui';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppStore } from '@/state/app-store';

/**
 * Whether the soft keyboard is on screen. iOS announces it before the
 * frames move (`will`), Android only once it is up (`did`); on web the
 * listener is inert and the answer stays false.
 */
function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * The one chat surface: header, a list that fills the screen, and the
 * composer pinned at the bottom outside the list.
 *
 * Keyboard layout, per platform:
 * - iOS: `KeyboardAvoidingView` pads the bottom by the overlap. RN measures
 *   the view with its `onLayout` frame, which is relative to the parent, so
 *   the offset must add back what sits above that parent: the status-bar
 *   inset the Screen applies as padding. The header is a sibling inside the
 *   same parent and is already in the frame's `y`.
 * - Android: the app is edge-to-edge (Expo SDK 57 always is), so the window
 *   never resizes for the keyboard and "resize" mode is a no-op. The same
 *   `padding` behaviour is used: React Native reads the keyboard height from
 *   the IME inset events and pads the bottom. The Screen leaves the bottom
 *   edge alone and the composer carries `insets.bottom` itself, dropped
 *   while the keyboard is up: the keyboard covers the navigation bar, so
 *   nothing between the composer and the window bottom may keep that inset.
 */
export default function MaterialChatScreen() {
  const params = useLocalSearchParams<{
    id: string;
    focus?: string | string[];
    ask?: string | string[];
  }>();
  const { materials } = useAppStore();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const material = materials.find((item) => item.id === params.id);
  const focus = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  /** A question to send on arrival, from 대본's 여기가 헷갈려요. */
  const ask = Array.isArray(params.ask) ? params.ask[0] : params.ask;

  if (!material) {
    return (
      <Screen padded={false}>
        <AppHeader onBack={() => goBackOrReplace('/(tabs)/library')} title="질문" />
        <View style={styles.stateContent}>
          <ErrorState
            description="이 자료를 찾을 수 없어요. 내 자료에서 다시 골라 주세요."
            onRetry={() => router.replace('/(tabs)/library')}
            retryLabel="내 자료 보기"
          />
        </View>
      </Screen>
    );
  }

  if (material.status !== 'ready') {
    return (
      <Screen padded={false}>
        <AppHeader
          onBack={() =>
            goBackOrReplace({ pathname: '/material/[id]', params: { id: material.id } })
          }
          title="질문"
        />
        <View style={styles.stateContent}>
          <EmptyState
            actionLabel="진행 보기"
            description="대본이 만들어지면 근거를 보며 질문할 수 있어요."
            icon={FileSearch2}
            onAction={() => router.replace({ pathname: '/processing/[id]', params: { id: material.id } })}
            title="아직 대본을 만드는 중이에요"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} safeAreaEdges={['top', 'right', 'left']}>
      <AppHeader
        divider
        onBack={() =>
          goBackOrReplace({ pathname: '/material/[id]', params: { id: material.id } })
        }
        title={material.title}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        keyboardVerticalOffset={insets.top}
        style={styles.fill}
      >
        <StudyChat
          // A question carried in from 대본 is already the reader's question;
          // opening the keyboard on top of its answer would be in the way.
          autoFocus={focus === '1' && !ask}
          bottomInset={keyboardVisible ? 0 : insets.bottom}
          initialQuestion={ask}
          material={material}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  stateContent: { flex: 1, justifyContent: 'center' },
});
