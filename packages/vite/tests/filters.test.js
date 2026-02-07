import { describe, expect, it } from 'vitest';

import picomatch from 'picomatch';

import { gjsFilter } from '../src/template-tag';
import { hbsFilter } from '../src/hbs';

console.log({ gjsFilter, hbsFilter });

const betterExpect = expect.soft;

function test(filter, str) {
  return filter.id.include[0].test(str);
}

describe('template-tag', () => {
  const expect = betterExpect;

  describe('hbsFilter', () => {
    let ext = 'hbs';

    it('matches', () => {
      expect(test(hbsFilter, `foo.${ext}`)).toBeTruthy();
      expect(test(hbsFilter, `app/foo.${ext}`)).toBeTruthy();
      expect(test(hbsFilter, `app/foo.${ext}`)).toBeTruthy();
      expect(test(hbsFilter, `app/foo.hbs.${ext}`)).toBeTruthy();
      expect(test(hbsFilter, `app/foo.js.${ext}`)).toBeTruthy();
      expect(test(hbsFilter, `app/foo.ts.${ext}`)).toBeTruthy();
      expect(test(hbsFilter, `app/foo.${ext}?t=123`)).toBeTruthy();
      expect(test(hbsFilter, `app/foo.${ext}?f=foo.hbs`)).toBeTruthy();
      expect(test(hbsFilter, `app/foo.${ext}.${ext}?f=foo.hbs`)).toBeTruthy();
      expect(test(hbsFilter, `app/hbs/foo.${ext}`)).toBeTruthy();
      expect(test(hbsFilter, `app/hbs/foo.${ext}`)).toBeTruthy();
    })

    it('non-matches', () => {
      expect(test(hbsFilter, `app/foo.${ext}.js`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo.${ext}.js?pretend.hbs`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo.${ext}.md`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo.${ext}.md?foo.hbs`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo.${ext}.md?from=foo.hbs`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo/${ext}`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo/${ext}.js`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo.${ext}.hbs.ts`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo.${ext}.hbs.ts?x=hbs.${ext}`)).toBeFalsy();
      expect(test(hbsFilter, `app/foo.${ext}.hbs.ts?x=foo.hbs.${ext}`)).toBeFalsy();
    });

  });

  describe.each([{ ext: 'gjs' }, { ext: 'gts'}])('gjsFilter: $ext', ({ ext}) => {
    it('matches', () => {
      expect(test(gjsFilter, `foo.${ext}`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.${ext}`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.${ext}`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.gjs.${ext}`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.gts.${ext}`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.js.${ext}`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.ts.${ext}`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.${ext}?t=123`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.${ext}?f=foo.gjs`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.${ext}.${ext}?f=foo.gjs`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.gjs.${ext}?f=foo.gjs`)).toBeTruthy();
      expect(test(gjsFilter, `app/foo.gts.${ext}?f=foo.gjs`)).toBeTruthy();
      expect(test(gjsFilter, `app/gjs/foo.${ext}`)).toBeTruthy();
      expect(test(gjsFilter, `app/gts/foo.${ext}`)).toBeTruthy();
    })

    it('non-matches', () => {
      expect(test(gjsFilter, `app/foo.${ext}.js`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.js?pretend.gjs`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.md`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.md?foo.gjs`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.md?from=foo.gjs`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.md?from=foo.gjs`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo/${ext}`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo/${ext}.js`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.gjs.ts`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.gts.ts`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.gjs.ts?x=gjs.${ext}`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.gts.ts?x=gts.${ext}`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.gjs.ts?x=foo.gjs.${ext}`)).toBeFalsy();
      expect(test(gjsFilter, `app/foo.${ext}.gts.ts?x=foo.gts.${ext}`)).toBeFalsy();
    });
  });
});



