// Account records never contain email addresses, OAuth tokens or call media.
// Shared by the account server (validation) and the web app (forms).

import { CUTOUT_SHAPES } from './cutouts';
import type { OrderMode } from './ring';

// ---------- the person's badge: photo, or initials on a chosen color ----------

/** Colors behind someone's initials. White text passes 4.5:1 on each fill. */
export const INITIALS_COLORS = {
  magenta: { label: 'Magenta', fill: '#ad175b' },
  teal: { label: 'Teal', fill: '#07616a' },
  violet: { label: 'Violet', fill: '#6336a5' },
  gold: { label: 'Ochre', fill: '#8a5a00' },
  orange: { label: 'Cadmium', fill: '#b23c0f' },
  green: { label: 'Sap green', fill: '#2f6b2f' },
  blue: { label: 'Cobalt', fill: '#1f4f9c' },
  charcoal: { label: 'Charcoal', fill: '#3b3631' }
} as const;
export type InitialsColor = keyof typeof INITIALS_COLORS;
export const INITIALS_COLOR_KEYS = Object.keys(INITIALS_COLORS) as InitialsColor[];

/** "Ada Lovelace" → "AL"; one word → its first two letters' first; empty → "?". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length === 1 ? [...words[0]!].slice(0, 1) : [words[0]!, words[words.length - 1]!].map((w) => [...w][0]);
  return letters.join('').toUpperCase();
}

// ---------- social links ----------

export const SOCIAL_KINDS = {
  website: { label: 'Website', hosts: [] as string[] },
  instagram: { label: 'Instagram', hosts: ['instagram.com'] },
  bluesky: { label: 'Bluesky', hosts: ['bsky.app'] },
  mastodon: { label: 'Mastodon', hosts: [] },
  threads: { label: 'Threads', hosts: ['threads.net', 'threads.com'] },
  tiktok: { label: 'TikTok', hosts: ['tiktok.com'] },
  youtube: { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  twitch: { label: 'Twitch', hosts: ['twitch.tv'] },
  discord: { label: 'Discord', hosts: ['discord.com', 'discord.gg'] },
  x: { label: 'X (Twitter)', hosts: ['x.com', 'twitter.com'] },
  facebook: { label: 'Facebook', hosts: ['facebook.com'] },
  behance: { label: 'Behance', hosts: ['behance.net'] },
  dribbble: { label: 'Dribbble', hosts: ['dribbble.com'] },
  etsy: { label: 'Etsy', hosts: ['etsy.com'] },
  kofi: { label: 'Ko-fi', hosts: ['ko-fi.com'] },
  patreon: { label: 'Patreon', hosts: ['patreon.com'] }
} as const;
export type SocialKind = keyof typeof SOCIAL_KINDS;
export const SOCIAL_KIND_KEYS = Object.keys(SOCIAL_KINDS) as SocialKind[];
export const MAX_SOCIAL_LINKS = 12;

/**
 * A profile link: always a full https:// URL, except Discord, which may also
 * be a plain username (Discord has no public profile URL for most people).
 */
export interface SocialLink {
  kind: SocialKind;
  value: string;
}

/** Clean one link, or null if it isn't safe to show. */
export function cleanSocialLink(input: unknown): SocialLink | null {
  if (!input || typeof input !== 'object') return null;
  const { kind, value } = input as Record<string, unknown>;
  if (typeof kind !== 'string' || !(kind in SOCIAL_KINDS) || typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > 200 || /[\u0000-\u001f\u007f\s]/.test(text)) return null;
  if (kind === 'discord' && /^@?[a-z0-9_.]{2,32}$/i.test(text)) return { kind, value: text.replace(/^@/, '') };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const hosts = SOCIAL_KINDS[kind as SocialKind].hosts as readonly string[];
  const host = url.hostname.replace(/^www\./, '');
  if (hosts.length && !hosts.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  return { kind: kind as SocialKind, value: url.href };
}

/** Where a link opens (a Discord username has no link). */
export function socialHref(link: SocialLink): string | null {
  return /^https:\/\//.test(link.value) ? link.value : null;
}

// ---------- cutout avatars (paper shapes you color in) ----------

/** The construction-paper stock a cutout is made of (from papr.world). */
export const PAPER_COLORS = {
  kraft: { label: 'Kraft brown', fill: '#c9a876' },
  newsprint: { label: 'Newsprint', fill: '#e8e2d0' },
  red: { label: 'Brick red', fill: '#c96a5b' },
  orange: { label: 'Pumpkin orange', fill: '#d99a5b' },
  yellow: { label: 'School-bus yellow', fill: '#e0c265' },
  green: { label: 'Clover green', fill: '#8fae72' },
  blue: { label: 'Pond blue', fill: '#7d9ec4' },
  purple: { label: 'Grape purple', fill: '#9a83b5' },
  pink: { label: 'Eraser pink', fill: '#dba3ad' },
  charcoal: { label: 'Charcoal gray', fill: '#6b675f' }
} as const;
export type PaperColor = keyof typeof PAPER_COLORS;

export const PAPER_PATTERNS = {
  plain: 'Plain',
  lined: 'Lined notebook',
  graph: 'Graph paper',
  'dot-grid': 'Dot grid',
  'torn-edge': 'Plain, torn edge'
} as const;
export type PaperPattern = keyof typeof PAPER_PATTERNS;

/** What you draw on the cutout with: the pencils and pastels from the art tools, plus crayon. */
export const CUTOUT_MEDIA = {
  pencil: { label: 'Pencil', hint: 'fine, grainy graphite', widths: [0.8, 1.6, 2.6] },
  pastel: { label: 'Soft pastel', hint: 'chalky, layers up', widths: [4, 7, 11] },
  crayon: { label: 'Crayon', hint: 'solid and waxy', widths: [2.5, 4.5, 7] }
} as const;
export type CutoutMedium = keyof typeof CUTOUT_MEDIA;

/** Named colors, because "swatch 7" is not a color anyone chose on purpose. */
export const CUTOUT_INKS = [
  { label: 'Graphite', color: '#3d3a35' },
  { label: 'Ink black', color: '#1f1b17' },
  { label: 'Cloud white', color: '#f6f2e8' },
  { label: 'Brick red', color: '#b3402e' },
  { label: 'Poppy orange', color: '#d97b2a' },
  { label: 'Sunflower yellow', color: '#e3b93b' },
  { label: 'Leaf green', color: '#4f8a3c' },
  { label: 'Teal', color: '#1f7a7a' },
  { label: 'Pond blue', color: '#3f6ea6' },
  { label: 'Berry purple', color: '#7c5296' },
  { label: 'Bubblegum pink', color: '#e07a96' },
  { label: 'Cocoa', color: '#6b4426' }
] as const;

export interface CutoutStroke {
  medium: CutoutMedium;
  color: string; // #rrggbb
  width: number;
  /** x,y pairs in the 130 × 180 sheet, one decimal place. */
  points: number[];
}
export interface AvatarDesign {
  v: 1;
  shape: string; // a CUTOUT_SHAPES key
  paper: { color: PaperColor; pattern: PaperPattern };
  strokes: CutoutStroke[];
}
export interface SavedAvatar {
  id: string;
  name: string;
  design: AvatarDesign;
  updatedAt: string;
}
export const SHEET = { width: 130, height: 180 } as const;
export const MAX_AVATARS = 24;
const MAX_STROKES = 400;
const MAX_STROKE_POINTS = 1200; // numbers, so 600 points
const MAX_TOTAL_POINTS = 24000;

export function blankDesign(shape = 'round-pal'): AvatarDesign {
  return { v: 1, shape, paper: { color: 'kraft', pattern: 'plain' }, strokes: [] };
}

/** Validate a design from a browser or the database. Null when anything structural is off. */
export function sanitizeAvatarDesign(input: unknown): AvatarDesign | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const paper = raw.paper as Record<string, unknown> | undefined;
  if (raw.v !== 1 || typeof raw.shape !== 'string' || !CUTOUT_SHAPES.some((s) => s.key === raw.shape)) return null;
  if (!paper || typeof paper.color !== 'string' || !(paper.color in PAPER_COLORS) || typeof paper.pattern !== 'string' || !(paper.pattern in PAPER_PATTERNS)) return null;
  if (!Array.isArray(raw.strokes) || raw.strokes.length > MAX_STROKES) return null;
  let total = 0;
  const strokes: CutoutStroke[] = [];
  for (const s of raw.strokes) {
    if (!s || typeof s !== 'object') return null;
    const { medium, color, width, points } = s as Record<string, unknown>;
    if (typeof medium !== 'string' || !(medium in CUTOUT_MEDIA)) return null;
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null;
    if (typeof width !== 'number' || !Number.isFinite(width) || width < 0.3 || width > 16) return null;
    if (!Array.isArray(points) || points.length < 2 || points.length % 2 || points.length > MAX_STROKE_POINTS) return null;
    if (!points.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -20 && n <= 200)) return null;
    total += points.length;
    if (total > MAX_TOTAL_POINTS) return null;
    strokes.push({ medium: medium as CutoutMedium, color: color.toLowerCase(), width: Math.round(width * 10) / 10, points: points.map((n) => Math.round(n * 10) / 10) });
  }
  return { v: 1, shape: raw.shape, paper: { color: paper.color as PaperColor, pattern: paper.pattern as PaperPattern }, strokes };
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function patternLayer(pattern: PaperPattern, ink: string): string {
  const { width, height } = SHEET;
  const parts: string[] = [];
  if (pattern === 'lined') for (let y = 14; y < height; y += 12) parts.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${ink}" stroke-width="0.6" opacity="0.5"/>`);
  else if (pattern === 'graph') {
    for (let y = 0; y <= height; y += 10) parts.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${ink}" stroke-width="0.45" opacity="0.45"/>`);
    for (let x = 0; x <= width; x += 10) parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${ink}" stroke-width="0.45" opacity="0.45"/>`);
  } else if (pattern === 'dot-grid') for (let y = 6; y < height; y += 10) for (let x = 6; x < width; x += 10) parts.push(`<circle cx="${x}" cy="${y}" r="0.7" fill="${ink}" opacity="0.5"/>`);
  return parts.join('');
}

/** A stroke's points as a smooth SVG path (midpoint quadratic curves). */
export function strokePath(points: number[]): string {
  if (points.length === 2) return `M${points[0]} ${points[1]} l0.01 0`;
  let d = `M${points[0]} ${points[1]}`;
  for (let i = 2; i + 3 < points.length; i += 2) {
    const mx = Math.round(((points[i]! + points[i + 2]!) / 2) * 10) / 10;
    const my = Math.round(((points[i + 1]! + points[i + 3]!) / 2) * 10) / 10;
    d += ` Q${points[i]} ${points[i + 1]} ${mx} ${my}`;
  }
  return d + ` L${points[points.length - 2]} ${points[points.length - 1]}`;
}

/**
 * Render a (sanitized!) design to an SVG string. Nothing user-typed reaches
 * the markup: colors are #rrggbb, keys come from fixed lists, numbers are finite.
 */
export function cutoutSvg(design: AvatarDesign, options: { shadow?: boolean; id?: string; title?: string } = {}): string {
  const { width, height } = SHEET;
  const shape = CUTOUT_SHAPES.find((s) => s.key === design.shape) ?? CUTOUT_SHAPES[0]!;
  const paper = PAPER_COLORS[design.paper.color] ?? PAPER_COLORS.kraft;
  const id = (options.id ?? 'a').replace(/[^a-z0-9-]/gi, '');
  const torn = design.paper.pattern === 'torn-edge';
  const edge = shade(paper.fill, 0.55);
  const strokes = design.strokes
    .map((s) => {
      const d = strokePath(s.points);
      if (s.medium === 'pencil') return `<path d="${d}" stroke="${s.color}" stroke-width="${s.width}" opacity="0.88" filter="url(#g-${id})"/>`;
      if (s.medium === 'pastel') return `<path d="${d}" stroke="${s.color}" stroke-width="${s.width}" opacity="0.62" filter="url(#p-${id})"/>`;
      return `<path d="${d}" stroke="${s.color}" stroke-width="${s.width}" filter="url(#c-${id})"/>`;
    })
    .join('');
  const title = options.title ? `<title>${options.title.replace(/[<>&"]/g, '')}</title>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">${title}` +
    `<defs><clipPath id="cut-${id}"><path d="${shape.path}"/></clipPath>` +
    // Pencil: graphite grain. Pastel: chalky, broken edges. Crayon: waxy speckle.
    // Filter areas cover the whole sheet: a stroke's own box ignores its width, so a flat line would vanish.
    `<filter id="g-${id}" filterUnits="userSpaceOnUse" x="-10" y="-10" width="150" height="200"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.4 -0.6"/><feComposite in="SourceGraphic" operator="in"/></filter>` +
    `<filter id="p-${id}" filterUnits="userSpaceOnUse" x="-10" y="-10" width="150" height="200"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" result="d"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -0.45" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>` +
    `<filter id="c-${id}" filterUnits="userSpaceOnUse" x="-10" y="-10" width="150" height="200"><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="5"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 4 -0.4"/><feComposite in="SourceGraphic" operator="in"/></filter>` +
    `</defs>` +
    (options.shadow ? `<path d="${shape.path}" transform="translate(2.5 3.5)" fill="#3d352d" opacity="0.2"/>` : '') +
    `<path d="${shape.path}" fill="${edge}" stroke="${edge}" stroke-width="${torn ? 4 : 2.4}" stroke-linejoin="round"${torn ? ' stroke-dasharray="3 1.6"' : ''}/>` +
    `<g clip-path="url(#cut-${id})"><rect width="${width}" height="${height}" fill="${paper.fill}"/>${patternLayer(design.paper.pattern, shade(paper.fill, -0.25))}` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${strokes}</g></g>` +
    `</svg>`
  );
}

// ---------- profiles ----------

/** @deprecated The first avatar mark set; kept so older saved profiles still load. */
export type AvatarMark = 'brush' | 'star' | 'cat' | 'swirl';
/** @deprecated Use InitialsColor. */
export type AvatarColor = 'magenta' | 'teal' | 'violet' | 'gold';
/** @deprecated The first avatar shape; profiles now store { color } only. */
export interface StudioAvatar { mark?: AvatarMark; color: InitialsColor }

export interface StudioProfile {
  id: string;
  name: string;
  bio: string;
  /** The color behind your initials when there's no photo. */
  avatar: StudioAvatar;
  /** A version token when a profile photo is uploaded; null for initials. */
  photo: string | null;
  links: SocialLink[];
  /** The cutout avatar used when you join a party as an avatar. */
  defaultAvatarId: string | null;
  share: boolean;
  allowRequests: boolean;
  emailInvites: boolean;
  emailReminders: boolean;
}
export type ProfileInput = Omit<StudioProfile, 'id' | 'photo' | 'defaultAvatarId'>;

// ---------- parties ----------

export type TimingMode = 'party' | 'turn';
export interface PartyTiming {
  /** 'party': a set party length, turns share it. 'turn': a set turn length, the party runs as long as it takes. */
  mode: TimingMode;
  partyMinutes: number;
  turnSeconds: number;
  /** Hellos and instructions before the first round. */
  introMinutes: number;
  /** Catching up and the reveal after the last round. */
  wrapMinutes: number;
}
export const DEFAULT_TIMING: PartyTiming = { mode: 'turn', partyMinutes: 60, turnSeconds: 180, introMinutes: 5, wrapMinutes: 10 };

export interface PartySettings {
  description: string;
  timing: PartyTiming;
  orderMode: OrderMode;
  maxGuests: number;
}
export const DEFAULT_PARTY_SETTINGS: PartySettings = { description: '', timing: DEFAULT_TIMING, orderMode: 'seats', maxGuests: 12 };

export function cleanTiming(input: unknown): PartyTiming | null {
  if (!input || typeof input !== 'object') return null;
  const t = input as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null);
  const mode = t.mode === 'party' || t.mode === 'turn' ? t.mode : null;
  const partyMinutes = int(t.partyMinutes, 15, 240);
  const turnSeconds = int(t.turnSeconds, 20, 600);
  const introMinutes = int(t.introMinutes, 0, 30);
  const wrapMinutes = int(t.wrapMinutes, 0, 30);
  if (!mode || partyMinutes === null || turnSeconds === null || introMinutes === null || wrapMinutes === null) return null;
  return { mode, partyMinutes, turnSeconds, introMinutes, wrapMinutes };
}

export function cleanPartySettings(input: unknown): PartySettings | null {
  if (!input || typeof input !== 'object') return null;
  const s = input as Record<string, unknown>;
  const timing = cleanTiming(s.timing);
  const description = typeof s.description === 'string' && s.description.length <= 600 && !/[\u0000-\u0009\u000b-\u001f\u007f]/.test(s.description) ? s.description.trim() : null;
  const orderMode = s.orderMode === 'seats' || s.orderMode === 'random' || s.orderMode === 'custom' ? s.orderMode : null;
  const maxGuests = Number.isInteger(s.maxGuests) && (s.maxGuests as number) >= 2 && (s.maxGuests as number) <= 24 ? (s.maxGuests as number) : null;
  if (!timing || description === null || !orderMode || maxGuests === null) return null;
  return { description, timing, orderMode, maxGuests };
}

export interface ScheduledParty {
  id: string;
  title: string;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  hostName: string;
  hosting: boolean;
  response: 'pending' | 'yes' | 'no';
  cancelled: boolean;
  settings: PartySettings;
  /** The live party room's id: /?party=<roomId>. */
  roomId: string;
}
export interface PartyHistory { id: string; title: string; endedAt: string; artworkCount: number }
/** A party gallery (archive) the person saved or was part of. */
export interface SavedGallery { archiveId: string; title: string; savedAt: string }
export interface CommunityHome {
  profile: StudioProfile | null;
  friends: StudioProfile[];
  incoming: StudioProfile[];
  outgoing: StudioProfile[];
  parties: ScheduledParty[];
  history: PartyHistory[];
  galleries: SavedGallery[];
  avatars: SavedAvatar[];
  mail: { partyId: string; kind: 'invitation' | 'reminder'; state: string }[];
}
export interface SharedParty { title: string; startsAt: string; timeZone: string; durationMinutes: number; hostName: string; description: string }
export interface ScheduleInput { title: string; startsAt: string; timeZone: string; durationMinutes: number; settings: PartySettings }

/** The live room id for a scheduled party (safe for /party/<id>). */
export function roomIdFor(scheduledId: string): string {
  return `p-${scheduledId.replace(/-/g, '').slice(0, 20).toLowerCase()}`;
}
