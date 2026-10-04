import type { ComponentType, ReactNode } from 'react';

export interface PracticeScreenModule {
  default: ComponentType<{ switcher?: ReactNode }>;
}

let interviewRequest: Promise<PracticeScreenModule> | undefined;
let presentationRequest: Promise<PracticeScreenModule> | undefined;

export function loadInterviewScreen(): Promise<PracticeScreenModule> {
  return interviewRequest ??= import('./InterviewHome')
    .then(({ InterviewHome }) => ({ default: InterviewHome }))
    .catch((error: unknown) => {
      interviewRequest = undefined;
      throw error;
    });
}

export function loadPresentationScreen(): Promise<PracticeScreenModule> {
  return presentationRequest ??= import('./PresentationHome')
    .then(({ PresentationHome }) => ({ default: PresentationHome }))
    .catch((error: unknown) => {
      presentationRequest = undefined;
      throw error;
    });
}
