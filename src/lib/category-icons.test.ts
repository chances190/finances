import { describe, expect, test } from 'bun:test'
import { resolveCategoryIconName } from './category-icons'

describe('category icons', () => {
  test('known names resolve and unknown names fall back to tag', () => {
    expect(resolveCategoryIconName('Food')).toBe('food')
    expect(resolveCategoryIconName('Health')).toBe('health')
    expect(resolveCategoryIconName('Adhoc')).toBe('tag')
  })

  test('stored icons override the name and unknown stored icons fall back', () => {
    expect(resolveCategoryIconName('Food', 'gift')).toBe('gift')
    expect(resolveCategoryIconName('Food', 'not-an-icon')).toBe('food')
  })
})
