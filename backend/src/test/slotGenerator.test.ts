import { describe, it, expect } from '@jest/globals';
import { generateSlotsForPeriod, combineDateAndTime } from '../utils/slotGenerator.js';

describe('generateSlotsForPeriod', () => {
  it('09:00–10:00, 15min → 4 slots at 00, 15, 30, 45', () => {
    const slots = generateSlotsForPeriod('09:00', '10:00', 15);
    expect(slots).toEqual([
      { start: '09:00', end: '09:15' },
      { start: '09:15', end: '09:30' },
      { start: '09:30', end: '09:45' },
      { start: '09:45', end: '10:00' },
    ]);
  });

  it('09:00–10:00, 30min → 2 slots at 00, 30', () => {
    const slots = generateSlotsForPeriod('09:00', '10:00', 30);
    expect(slots).toEqual([
      { start: '09:00', end: '09:30' },
      { start: '09:30', end: '10:00' },
    ]);
  });

  it('09:00–09:15, 15min → 1 slot at 00', () => {
    const slots = generateSlotsForPeriod('09:00', '09:15', 15);
    expect(slots).toEqual([
      { start: '09:00', end: '09:15' },
    ]);
  });

  it('09:00–09:10, 15min → 0 slots (gap < duration)', () => {
    const slots = generateSlotsForPeriod('09:00', '09:10', 15);
    expect(slots).toEqual([]);
  });
});

describe('combineDateAndTime', () => {
  it('serializes 09:00 IST as +05:30', () => {
    const result = combineDateAndTime('2026-06-10', '09:00');
    expect(result).toBe('2026-06-10T09:00:00+05:30');
  });
});
