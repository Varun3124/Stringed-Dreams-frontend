import { toList, tagKey } from './tags';

describe('toList', () => {
  test('returns [] for empty values', () => {
    expect(toList(undefined)).toEqual([]);
    expect(toList(null)).toEqual([]);
    expect(toList('')).toEqual([]);
  });

  test('splits legacy comma-separated strings', () => {
    expect(toList('Blue, Red')).toEqual(['Blue', 'Red']);
  });

  test('de-duplicates case-insensitively', () => {
    expect(toList(['Blue', 'blue', 'Red'])).toEqual(['Blue', 'Red']);
  });
});

describe('tagKey', () => {
  test('normalises case and whitespace', () => {
    expect(tagKey('  Blue ')).toBe('blue');
    expect(tagKey(null)).toBe('');
  });
});
