import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adminNav, groupForPath, studentNav, teacherNav } from '../frontend/src/components/layout/nav.ts';

describe('dashboard navigation groups', () => {
  const navigations = [studentNav, teacherNav, adminNav];

  it('keeps every sidebar route in exactly one navigational location', () => {
    for (const navigation of navigations) {
      const routes = [
        navigation.home.href,
        ...navigation.groups.flatMap((group) => group.items.map((item) => item.href)),
      ];
      assert.equal(new Set(routes).size, routes.length);
    }
  });

  it('opens the group containing the current page', () => {
    for (const navigation of navigations) {
      for (const group of navigation.groups) {
        for (const item of group.items) {
          assert.equal(groupForPath(navigation.groups, item.href), group.id);
          assert.equal(groupForPath(navigation.groups, `${item.href}/details`), group.id);
        }
      }
    }
  });

  it('keeps each role home outside the collapsible groups', () => {
    for (const navigation of navigations) {
      assert.equal(groupForPath(navigation.groups, navigation.home.href), undefined);
    }
  });
});
