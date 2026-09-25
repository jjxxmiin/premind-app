import { Redirect } from 'expo-router';

/**
 * 옛 면접 탭 주소. 2026-09-26 부터 말하기 탭의 면접 쪽이다. interview.premind.co.kr 이 넘기는
 * premind.co.kr/app/interview 도 여기로 온다.
 */
export default function InterviewRedirect() {
  return <Redirect href={{ pathname: '/speak', params: { mode: 'interview' } }} />;
}
