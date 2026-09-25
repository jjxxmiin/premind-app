import type { EnDict } from '../core';

import { EN_ACCOUNT } from './account';
import { EN_COMMON } from './common';
import { EN_HOME } from './home';
import { EN_INTERVIEW } from './interview';
import { EN_LENS } from './lens';
import { EN_MATERIAL } from './material';
import { EN_RECORDING } from './recording';
import { EN_SERVER } from './server';
import { EN_STUDY } from './study';

/**
 * 영역 사전을 하나로. 영역마다 파일 하나(갈래가 제 파일만 고친다). 같은 키가 둘이면 **뒤에 펼친 쪽이 이긴다**
 * (객체 펼치기) — 공통 사전이 맨 뒤라 가장 세다. 2026-09-26 합칠 때 영역 사이 같은 키 52개는 모두 같은 뜻의
 * 다른 말씨였다. 자리마다 뜻이 갈리는 짧은 말은 `자리|한국어` 키로 둔다.
 */
export const EN: EnDict = {
  ...EN_SERVER,
  ...EN_RECORDING,
  ...EN_ACCOUNT,
  ...EN_INTERVIEW,
  ...EN_LENS,
  ...EN_STUDY,
  ...EN_MATERIAL,
  ...EN_HOME,
  ...EN_COMMON,
};
