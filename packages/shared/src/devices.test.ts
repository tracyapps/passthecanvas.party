import { describe, expect, it } from 'vitest';
import { cleanDeviceLabel, deviceLabel, LINK_CODE, normalizeLinkCode } from './protocol';

describe('device links', () => {
  it('tidies typed codes', () => {
    expect(normalizeLinkCode(' k7p-3qm ')).toBe('K7P3QM');
    expect(LINK_CODE.test('K7P3QM')).toBe(true);
    expect(LINK_CODE.test('K7P3Q0')).toBe(false); // no zero: it looks like O
  });
  it('names devices plainly', () => {
    expect(deviceLabel('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('iPad');
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('iPad'); // iPadOS asks for desktop sites
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac');
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile')).toBe('Android phone');
    expect(cleanDeviceLabel('<b>iPad</b>')).toBe('biPadb');
    expect(cleanDeviceLabel('')).toBe('Browser');
  });
});
