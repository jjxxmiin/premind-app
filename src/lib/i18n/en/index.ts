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
 * 영역 사전을 하나로. 영역마다 파일 하나(갈래가 제 파일만 고친다). 같은 키가 둘이면 앞이 이긴다 —
 * 공통 사전이 맨 앞.
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
