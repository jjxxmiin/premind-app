import { useEffect, useState } from 'react';

import { createAnswerRecorder } from './answer-recorder.web';
import type { AnswerRecorder } from './answer-recorder.types';

export function useAnswerRecorder(): AnswerRecorder {
  const [recorder] = useState(createAnswerRecorder);
  useEffect(() => () => recorder.release(), [recorder]);
  return recorder;
}
