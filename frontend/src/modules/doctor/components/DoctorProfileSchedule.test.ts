import { describe, expect, it } from 'vitest';
import { splitOccupancy } from './DoctorProfileSchedule';

describe('doctor schedule occupancy', () => {
  it('clips and merges overlapping appointments and holds within an available interval', () => {
    const interval = { startAt: '2026-01-01T01:00:00Z', endAt: '2026-01-01T04:00:00Z' };
    const result = splitOccupancy([interval], [
      { startAt: '2026-01-01T00:30:00Z', endAt: '2026-01-01T01:30:00Z' },
      { startAt: '2026-01-01T01:15:00Z', endAt: '2026-01-01T02:00:00Z' },
      { startAt: '2026-01-01T03:00:00Z', endAt: '2026-01-01T05:00:00Z' },
    ]);
    expect(result.map((x) => [x.startAt, x.endAt, x.busy])).toEqual([
      ['2026-01-01T01:00:00.000Z', '2026-01-01T02:00:00.000Z', true],
      ['2026-01-01T02:00:00.000Z', '2026-01-01T03:00:00.000Z', false],
      ['2026-01-01T03:00:00.000Z', '2026-01-01T04:00:00.000Z', true],
    ]);
  });
});
