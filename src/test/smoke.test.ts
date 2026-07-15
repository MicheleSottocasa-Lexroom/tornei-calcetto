import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/cn';

describe('cn', () => {
  it('unisce le classi e ignora i valori falsy', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});
