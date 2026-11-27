import { describe, expect, test } from 'bun:test'
import { resolveCategoryIcon, resolveCategoryIconName } from './category-icons'

describe('category icons', () => {
  test('known category names map to defaults', () => {
    expect(resolveCategoryIconName('Food')).toBe('food')
    expect(resolveCategoryIconName('Health')).toBe('health')
    expect(resolveCategoryIconName('Salary')).toBe('wallet')
  })

  test('unknown categories fall back to tag', () => {
    expect(resolveCategoryIconName('Adhoc')).toBe('tag')
  })

  test('stored icon overrides the name default', () => {
    expect(resolveCategoryIconName('Food', 'gift')).toBe('gift')
  })

  test('unknown stored icons fall back to the name default', () => {
    expect(resolveCategoryIconName('Food', 'not-an-icon')).toBe('food')
  })

  test('resolves icon data', () => {
    expect(resolveCategoryIcon('Adhoc')).toBeDefined()
  })
})
