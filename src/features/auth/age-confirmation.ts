/**
 * 가입 화면의 "[필수] 만 14세 이상이에요" 체크 상태(2026-09-26 개정 개인정보처리방침: 가입 기록에 남긴다).
 *
 * 이메일 가입과 간편 가입(구글, 카카오)이 학생 서버에 `age_over_14` 로 보낸다. 로그인 화면의 간편 로그인은
 * 체크를 받지 않았으니 보내지 않는다(서버는 없으면 기록만 비운다). 훅과 스토어를 거쳐 넘기는 대신 여기에
 * 한 값으로 둔다 — 가입 화면이 켜고 끄고, API 클라이언트가 읽는다.
 */
let confirmed = false;

export function setAgeConfirmed(value: boolean): void {
  confirmed = value;
}

/** 요청 본문에 붙일 값: 체크했으면 `{ age_over_14: true }`, 아니면 빈 객체. */
export function ageConfirmationField(): { age_over_14?: true } {
  return confirmed ? { age_over_14: true } : {};
}
