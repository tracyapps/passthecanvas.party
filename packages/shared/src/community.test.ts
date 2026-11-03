import { describe, expect, it } from 'vitest';
import { blankDesign, cleanPartySettings, cleanSocialLink, cutoutSvg, DEFAULT_PARTY_SETTINGS, initialsOf, roomIdFor, sanitizeAvatarDesign } from './community';
import { CUTOUT_SHAPES } from './cutouts';

describe('profile bits', () => {
  it('makes initials', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('  tapps ')).toBe('T');
    expect(initialsOf('Mary Ann Evans')).toBe('ME');
    expect(initialsOf('')).toBe('?');
  });
  it('keeps safe social links only', () => {
    expect(cleanSocialLink({ kind: 'instagram', value: 'https://www.instagram.com/tapps' })).toEqual({ kind: 'instagram', value: 'https://www.instagram.com/tapps' });
    expect(cleanSocialLink({ kind: 'instagram', value: 'https://evil.example/instagram.com' })).toBeNull();
    expect(cleanSocialLink({ kind: 'website', value: 'javascript:alert(1)' })).toBeNull();
    expect(cleanSocialLink({ kind: 'website', value: 'http://plain.example' })).toBeNull();
    expect(cleanSocialLink({ kind: 'discord', value: '@paint_person' })).toEqual({ kind: 'discord', value: 'paint_person' });
    expect(cleanSocialLink({ kind: 'mastodon', value: 'https://mastodon.art/@tapps' })?.value).toBe('https://mastodon.art/@tapps');
  });
});

describe('cutout avatars', () => {
  it('has the papr.world shapes', () => {
    expect(CUTOUT_SHAPES.length).toBeGreaterThan(50);
    expect(new Set(CUTOUT_SHAPES.map((s) => s.key)).size).toBe(CUTOUT_SHAPES.length);
  });
  it('validates designs and refuses junk', () => {
    const design = { ...blankDesign(), strokes: [{ medium: 'pastel', color: '#AA3300', width: 7, points: [10, 20.04, 30, 40] }] };
    expect(sanitizeAvatarDesign(design)?.strokes[0]).toEqual({ medium: 'pastel', color: '#aa3300', width: 7, points: [10, 20, 30, 40] });
    expect(sanitizeAvatarDesign({ ...design, shape: 'nope' })).toBeNull();
    expect(sanitizeAvatarDesign({ ...design, strokes: [{ ...design.strokes[0], color: 'red"/><script>' }] })).toBeNull();
    expect(sanitizeAvatarDesign({ ...design, strokes: [{ ...design.strokes[0], points: [1, 2, 3] }] })).toBeNull();
  });
  it('renders SVG with no room for markup', () => {
    const svg = cutoutSvg({ ...blankDesign(), strokes: [{ medium: 'pencil', color: '#112233', width: 1.6, points: [10, 10, 20, 20, 30, 15] }] }, { id: 'x"><b', title: 'Me <3' });
    expect(svg).toContain('clip-path="url(#cut-xb)"');
    expect(svg).not.toContain('<b');
    expect(svg).toContain('<title>Me 3</title>');
  });
});

describe('party settings', () => {
  it('accepts the defaults and refuses out-of-range values', () => {
    expect(cleanPartySettings(DEFAULT_PARTY_SETTINGS)).toEqual(DEFAULT_PARTY_SETTINGS);
    expect(cleanPartySettings({ ...DEFAULT_PARTY_SETTINGS, maxGuests: 99 })).toBeNull();
    expect(cleanPartySettings({ ...DEFAULT_PARTY_SETTINGS, timing: { ...DEFAULT_PARTY_SETTINGS.timing, turnSeconds: 5 } })).toBeNull();
  });
  it('gives a scheduled party a safe room id', () => {
    expect(roomIdFor('6912ad9f-f468-4d18-a637-343f06e8ad7c')).toMatch(/^p-[0-9a-f]{20}$/);
  });
});
