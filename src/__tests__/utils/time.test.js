import { describe, it, expect } from 'vitest';
import { msToDisplay, blockStartTime, blocksToTotalDuration } from '../../utils/time';

describe('msToDisplay', () => {
  it('returns seconds only below 60s', () => {
    expect(msToDisplay(5000)).toBe('5s');
    expect(msToDisplay(1000)).toBe('1s');
    expect(msToDisplay(59000)).toBe('59s');
  });

  it('returns m:ss at exactly 60s', () => {
    expect(msToDisplay(60000)).toBe('1:00');
  });

  it('returns m:ss above 60s', () => {
    expect(msToDisplay(90000)).toBe('1:30');
    expect(msToDisplay(3600000)).toBe('60:00');
  });

  it('pads seconds to two digits', () => {
    expect(msToDisplay(65000)).toBe('1:05');
    expect(msToDisplay(601000)).toBe('10:01');
  });

  it('uses ceil so partial seconds round up', () => {
    expect(msToDisplay(1001)).toBe('2s');
    expect(msToDisplay(1500)).toBe('2s');
    expect(msToDisplay(2000)).toBe('2s');
  });

  it('handles 0ms', () => {
    expect(msToDisplay(0)).toBe('0s');
  });
});

describe('blockStartTime', () => {
  const blocks = [
    { id: 'a', type: 'work', duration: 10 },
    { id: 'b', type: 'rest', duration: 5 },
    { id: 'c', type: 'work', duration: 20 },
  ];

  it('returns 0 for first block', () => {
    expect(blockStartTime(blocks, 0)).toBe(0);
  });

  it('returns cumulative duration for later blocks', () => {
    expect(blockStartTime(blocks, 1)).toBe(10);
    expect(blockStartTime(blocks, 2)).toBe(15);
  });

  it('returns total duration for index === length (past end)', () => {
    expect(blockStartTime(blocks, 3)).toBe(35);
  });

  it('handles single block', () => {
    expect(blockStartTime([{ duration: 7 }], 0)).toBe(0);
  });

  it('handles empty array', () => {
    expect(blockStartTime([], 0)).toBe(0);
  });
});

describe('blocksToTotalDuration', () => {
  it('sums all block durations', () => {
    const blocks = [{ duration: 10 }, { duration: 5 }, { duration: 20 }];
    expect(blocksToTotalDuration(blocks)).toBe(35);
  });

  it('returns 0 for empty array', () => {
    expect(blocksToTotalDuration([])).toBe(0);
  });

  it('handles single block', () => {
    expect(blocksToTotalDuration([{ duration: 42 }])).toBe(42);
  });
});
