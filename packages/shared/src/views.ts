// Seat views: the same room seen from different seats.
//
// The *global seat map* is spots.json (directions from the middle of the
// room). Blender's seat_views.py also writes seats/geometry.json: where each
// seat's head is in 3D, and where each seat view's camera is and which way it
// faces. From those, any view's marker positions are plain math, so the room
// tool can move a seat once and every view follows.
//
// Units: meters (Blender's world). Angles: degrees, Photo Sphere Viewer style
// (yaw 0 = image center, + to the right; pitch + up).

import type { Spot } from './spots';

export type Vec3 = [number, number, number];

/** A 360° camera: where it is and its forward/right/up directions. */
export interface ViewCamera {
  eye: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
}

export interface SeatGeometry {
  room: string;
  center: ViewCamera;
  /** One camera per seat that has a rendered view. */
  views: Record<string, ViewCamera & { hidden: string[] }>;
  /** Where each seat's avatar/video shows, in 3D. */
  markers: Record<string, Vec3>;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec3) => Math.sqrt(dot(a, a));
const unit = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));
const DEG = Math.PI / 180;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Where a 3D point appears from a camera. */
export function anglesFrom(camera: ViewCamera, point: Vec3): { yaw: number; pitch: number } {
  const d = unit(sub(point, camera.eye));
  const yaw = Math.atan2(dot(d, camera.right), dot(d, camera.forward)) / DEG;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dot(d, camera.up)))) / DEG;
  return { yaw: round1(((yaw + 180) % 360 + 360) % 360 - 180), pitch: round1(pitch) };
}

/** The direction a yaw/pitch looks, from a camera. */
export function directionFrom(camera: ViewCamera, yaw: number, pitch: number): Vec3 {
  const y = yaw * DEG;
  const p = pitch * DEG;
  return unit(add(add(scale(camera.forward, Math.cos(p) * Math.cos(y)), scale(camera.right, Math.cos(p) * Math.sin(y))), scale(camera.up, Math.sin(p))));
}

/**
 * Two rays that should meet at one seat (one from the middle of the room,
 * one from a seat view): the point halfway along their closest approach.
 * Parallel rays → null.
 */
export function triangulate(a: { origin: Vec3; dir: Vec3 }, b: { origin: Vec3; dir: Vec3 }): Vec3 | null {
  const w = sub(a.origin, b.origin);
  const aa = dot(a.dir, a.dir), bb = dot(b.dir, b.dir), ab = dot(a.dir, b.dir);
  const aw = dot(a.dir, w), bw = dot(b.dir, w);
  const denom = aa * bb - ab * ab;
  if (Math.abs(denom) < 1e-6) return null;
  const s = (ab * bw - bb * aw) / denom;
  const t = (aa * bw - ab * aw) / denom;
  if (s <= 0 || t <= 0) return null; // the rays meet behind a camera
  return scale(add(add(a.origin, scale(a.dir, s)), add(b.origin, scale(b.dir, t))), 0.5);
}

/** Move a marker along the center's ray to a new yaw/pitch, keeping its distance. */
export function moveAlongCenter(geometry: SeatGeometry, spotId: string, yaw: number, pitch: number): Vec3 | null {
  const old = geometry.markers[spotId];
  if (!old) return null;
  const distance = length(sub(old, geometry.center.eye));
  return add(geometry.center.eye, scale(directionFrom(geometry.center, yaw, pitch), distance));
}

/** One seat view's spots.json content: every other visible seat, re-aimed from that seat. */
export function spotsForView(geometry: SeatGeometry, viewId: string, spots: Spot[]): Spot[] {
  const view = geometry.views[viewId];
  if (!view) return [];
  return spots
    .filter((spot) => spot.id !== viewId && geometry.markers[spot.id] && !view.hidden.includes(spot.id))
    .map((spot) => ({ ...spot, ...anglesFrom(view, geometry.markers[spot.id]!) }));
}

const finite3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000);
const SAFE_ID = /^[a-z0-9_]{2,60}$/;

/** Validate a geometry file from the room tool or disk. Null when anything is off. */
export function sanitizeGeometry(input: unknown): SeatGeometry | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const camera = (c: unknown): ViewCamera | null => {
    if (!c || typeof c !== 'object') return null;
    const v = c as Record<string, unknown>;
    return finite3(v.eye) && finite3(v.forward) && finite3(v.right) && finite3(v.up) ? { eye: v.eye, forward: v.forward, right: v.right, up: v.up } : null;
  };
  if (typeof raw.room !== 'string' || !/^[a-z0-9-]{2,20}$/.test(raw.room)) return null;
  const center = camera(raw.center);
  if (!center || !raw.views || typeof raw.views !== 'object' || !raw.markers || typeof raw.markers !== 'object') return null;
  const views: SeatGeometry['views'] = {};
  for (const [id, v] of Object.entries(raw.views as Record<string, unknown>)) {
    const cam = camera(v);
    const hidden = (v as { hidden?: unknown }).hidden;
    if (!SAFE_ID.test(id) || !cam || !Array.isArray(hidden) || hidden.length > 64 || !hidden.every((h) => typeof h === 'string' && SAFE_ID.test(h))) return null;
    views[id] = { ...cam, hidden: [...hidden] as string[] };
  }
  const markers: SeatGeometry['markers'] = {};
  for (const [id, m] of Object.entries(raw.markers as Record<string, unknown>)) {
    if (!SAFE_ID.test(id) || !finite3(m)) return null;
    markers[id] = m;
  }
  if (Object.keys(views).length > 64 || Object.keys(markers).length > 64) return null;
  return { room: raw.room, center, views, markers };
}

/**
 * The room tool's "put this seat's marker where I clicked", from any view.
 *
 * - From the middle of the room: the marker turns to the click, same distance.
 * - From a seat view: the click gives a direction, not a depth, so the marker
 *   goes on the clicked ray at the point nearest the seat's middle-of-room
 *   ray (it stays where the middle view expects it, and lands exactly where
 *   you clicked here). If the rays don't meet usefully, it keeps its distance
 *   from this seat's eye instead.
 *
 * Returns the new 3D marker and the seat's new middle-of-room yaw/pitch
 * (spots.json), or null when the seat has no marker yet.
 */
export function placeFromView(geometry: SeatGeometry, viewId: string, spot: { id: string; yaw: number; pitch: number }, yaw: number, pitch: number): { marker: Vec3; yaw: number; pitch: number } | null {
  if (viewId === 'center') {
    const marker = moveAlongCenter(geometry, spot.id, yaw, pitch);
    return marker ? { marker, yaw, pitch } : null;
  }
  const view = geometry.views[viewId];
  const old = geometry.markers[spot.id];
  if (!view || !old) return null;
  const clicked = directionFrom(view, yaw, pitch);
  const meet = triangulate({ origin: geometry.center.eye, dir: directionFrom(geometry.center, spot.yaw, spot.pitch) }, { origin: view.eye, dir: clicked });
  let depth = meet ? dot(sub(meet, view.eye), clicked) : 0;
  if (!(depth > 0.3 && depth < 30)) depth = length(sub(old, view.eye));
  const marker = add(view.eye, scale(clicked, depth));
  return { marker, ...anglesFrom(geometry.center, marker) };
}
