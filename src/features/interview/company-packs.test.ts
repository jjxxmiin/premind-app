import { COMMON_PACKS, COMPANY_PACKS, INTERVIEW_DISCLAIMER, getCompanyPack } from './company-packs';

const ALL = [...COMMON_PACKS, ...COMPANY_PACKS];

describe('question sets copied from the interview web', () => {
  it('has unique pack and question ids that resolve', () => {
    const packIds = ALL.map((pack) => pack.id);
    expect(new Set(packIds).size).toBe(packIds.length);
    for (const pack of ALL) {
      expect(getCompanyPack(pack.id)).toBe(pack);
      const ids = pack.questions.map((question) => question.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(pack.questions.length).toBeGreaterThanOrEqual(3);
      pack.questions.forEach((question, index) => {
        expect(question.order).toBe(index + 1);
        expect(question.prepDurationMs).toBeGreaterThan(0);
        expect(question.maxDurationMs).toBeGreaterThan(0);
        for (const traitId of question.traitIds) expect(pack.traits.some((trait) => trait.id === traitId)).toBe(true);
      });
    }
  });

  it('keeps a source for every company set and a date for every set', () => {
    for (const pack of COMPANY_PACKS) expect(pack.sourceUrl).toMatch(/^https?:\/\//);
    for (const pack of COMMON_PACKS) expect(pack.track).toBe('common');
    for (const pack of ALL) {
      expect(pack.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('shows no middot in anything a learner reads', () => {
    const text = JSON.stringify(ALL) + INTERVIEW_DISCLAIMER;
    expect(text).not.toContain('·');
  });

  it('is not presented as real interview questions', () => {
    expect(INTERVIEW_DISCLAIMER).toMatch('실제 면접 문항이나 합격 기준이 아니며');
    expect(getCompanyPack('missing')).toBeNull();
  });
});
