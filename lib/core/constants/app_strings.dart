/// User-facing copy shared by multiple features.
abstract final class AppStrings {
  static const appName = 'PREMIND';
  static const appTagline = '강의를 기록하고\nAI로 정리하고\n바로 공유하세요.';

  static const home = '홈';
  static const lectures = '강의';
  static const sharing = '공유';
  static const myPage = '마이';

  static const continueWithGoogle = 'Google로 계속하기';
  static const continueWithApple = 'Apple로 계속하기';
  static const continueWithEmail = '이메일로 계속하기';
  static const developmentLogin = '개발용 로그인';
  static const authenticationComingSoon = '실제 인증 연결을 준비하고 있어요.';
  static const retry = '다시 시도';

  static const emailLoginTitle = '이메일로 로그인';
  static const emailLoginDescription = '가입한 이메일과 비밀번호를 입력해 주세요.';
  static const emailFieldLabel = '이메일';
  static const emailFieldHint = 'name@example.com';
  static const passwordFieldLabel = '비밀번호';
  static const passwordFieldHint = '비밀번호를 입력해 주세요';
  static const login = '로그인';
  static const emailInvalidError = '올바른 이메일 주소를 입력해 주세요.';
  static const passwordEmptyError = '비밀번호를 입력해 주세요.';
  static const loginFailedCredentials = '이메일 또는 비밀번호가 맞지 않아요.';
  static const loginFailedRateLimited = '로그인 시도가 많았어요. 잠시 후 다시 시도해 주세요.';
  static const loginFailedNetwork = '서버에 연결하지 못했어요. 네트워크를 확인해 주세요.';
  static const loginFailedUnknown = '로그인하지 못했어요. 다시 시도해 주세요.';
}
