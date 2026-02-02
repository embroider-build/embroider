import { describe, expect, it } from 'vitest';

import { gjsFilter } from '../src/template-tag';


const betterExpect = expect.soft;

describe('template-tag', () => {
  const expect = betterExpect;

  describe.each([{ ext: 'gjs' }, { ext: 'gts'}])('gjsFilter: $ext', ({ ext}) => {
    it('matches', () => {
      expect(gjsFilter(`foo.${ext}`)).toBeTruthy();
      expect(gjsFilter(`app/foo.${ext}`)).toBeTruthy();
      expect(gjsFilter(`app/foo.${ext}`)).toBeTruthy();
      expect(gjsFilter(`app/foo.gjs.${ext}`)).toBeTruthy();
      expect(gjsFilter(`app/foo.gts.${ext}`)).toBeTruthy();
      expect(gjsFilter(`app/foo.js.${ext}`)).toBeTruthy();
      expect(gjsFilter(`app/foo.ts.${ext}`)).toBeTruthy();
      expect(gjsFilter(`app/foo.${ext}?t=123`)).toBeTruthy();
      expect(gjsFilter(`app/foo.${ext}?f=foo.gjs`)).toBeTruthy();
      expect(gjsFilter(`app/foo.${ext}.${ext}?f=foo.gjs`)).toBeTruthy();
      expect(gjsFilter(`app/foo.gjs.${ext}?f=foo.gjs`)).toBeTruthy();
      expect(gjsFilter(`app/foo.gts.${ext}?f=foo.gjs`)).toBeTruthy();
      expect(gjsFilter(`app/gjs/foo.${ext}`)).toBeTruthy();
      expect(gjsFilter(`app/gts/foo.${ext}`)).toBeTruthy();
    })

    it('non-matches', () => {
      expect(gjsFilter(`app/foo.${ext}.js`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.js?pretend.gjs`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.md`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.md?foo.gjs`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.md?from=foo.gjs`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.md?from=foo.gjs`)).toBeFalsy();
      expect(gjsFilter(`app/foo/${ext}`)).toBeFalsy();
      expect(gjsFilter(`app/foo/${ext}.js`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.gjs.ts`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.gts.ts`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.gjs.ts?x=gjs.${ext}`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.gts.ts?x=gts.${ext}`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.gjs.ts?x=foo.gjs.${ext}`)).toBeFalsy();
      expect(gjsFilter(`app/foo.${ext}.gts.ts?x=foo.gts.${ext}`)).toBeFalsy();
    });
  });
});



