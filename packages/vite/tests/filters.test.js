import { describe, expect, it } from 'vitest';

import { gjsFilter } from '../src/template-tag';
import { hbsFilter } from '../src/hbs';


const betterExpect = expect.soft;

describe('template-tag', () => {
  const expect = betterExpect;

  describe('hbsFilter', () => {
    let ext = 'hbs';

    it('matches', () => {
      expect(hbsFilter(`foo.${ext}`)).toBeTruthy();
      expect(hbsFilter(`app/foo.${ext}`)).toBeTruthy();
      expect(hbsFilter(`app/foo.${ext}`)).toBeTruthy();
      expect(hbsFilter(`app/foo.hbs.${ext}`)).toBeTruthy();
      expect(hbsFilter(`app/foo.js.${ext}`)).toBeTruthy();
      expect(hbsFilter(`app/foo.ts.${ext}`)).toBeTruthy();
      expect(hbsFilter(`app/foo.${ext}?t=123`)).toBeTruthy();
      expect(hbsFilter(`app/foo.${ext}?f=foo.hbs`)).toBeTruthy();
      expect(hbsFilter(`app/foo.${ext}.${ext}?f=foo.hbs`)).toBeTruthy();
      expect(hbsFilter(`app/hbs/foo.${ext}`)).toBeTruthy();
      expect(hbsFilter(`app/hbs/foo.${ext}`)).toBeTruthy();
    })

    it('non-matches', () => {
      expect(hbsFilter(`app/foo.${ext}.js`)).toBeFalsy();
      expect(hbsFilter(`app/foo.${ext}.js?pretend.hbs`)).toBeFalsy();
      expect(hbsFilter(`app/foo.${ext}.md`)).toBeFalsy();
      expect(hbsFilter(`app/foo.${ext}.md?foo.hbs`)).toBeFalsy();
      expect(hbsFilter(`app/foo.${ext}.md?from=foo.hbs`)).toBeFalsy();
      expect(hbsFilter(`app/foo/${ext}`)).toBeFalsy();
      expect(hbsFilter(`app/foo/${ext}.js`)).toBeFalsy();
      expect(hbsFilter(`app/foo.${ext}.hbs.ts`)).toBeFalsy();
      expect(hbsFilter(`app/foo.${ext}.hbs.ts?x=hbs.${ext}`)).toBeFalsy();
      expect(hbsFilter(`app/foo.${ext}.hbs.ts?x=foo.hbs.${ext}`)).toBeFalsy();
    });

  });

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



