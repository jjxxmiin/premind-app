import { Redirect } from 'expo-router';

/** 옛 평가 탭 주소. 2026-09-26 부터 말하기 탭의 발표 쪽이다. */
export default function LensRedirect() {
  return <Redirect href={{ pathname: '/speak', params: { mode: 'presentation' } }} />;
}
