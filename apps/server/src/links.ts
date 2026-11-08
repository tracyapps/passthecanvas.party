// One-time link codes: how an artist adds a second device or window (a
// tablet for the canvas, a phone for the room and video) to their own seat.
// A code works once, for LINK_SECONDS, and only joins that one artist in
// that one party. It never grants account access.

import { randomInt } from 'node:crypto';
import { LINK_ALPHABET, LINK_CODE, LINK_SECONDS, type LinkRole } from '@ptc/shared';

export interface LinkTicket {
  code: string;
  partyId: string;
  memberId: string;
  role: LinkRole;
  expiresAt: number;
}

const tickets = new Map<string, LinkTicket>(); // code → ticket
const byMember = new Map<string, string>(); // "party/member" → code

function memberKey(partyId: string, memberId: string) {
  return `${partyId}/${memberId}`;
}

function newCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += LINK_ALPHABET[randomInt(LINK_ALPHABET.length)];
    if (!tickets.has(code)) return code;
  }
}

/** A fresh code for this artist. Any earlier code of theirs stops working. */
export function createLink(partyId: string, memberId: string, role: LinkRole, now = Date.now()): LinkTicket {
  cancelLink(partyId, memberId);
  const ticket: LinkTicket = { code: newCode(), partyId, memberId, role, expiresAt: now + LINK_SECONDS * 1000 };
  tickets.set(ticket.code, ticket);
  byMember.set(memberKey(partyId, memberId), ticket.code);
  return ticket;
}

export function cancelLink(partyId: string, memberId: string) {
  const key = memberKey(partyId, memberId);
  const code = byMember.get(key);
  if (code) tickets.delete(code);
  byMember.delete(key);
}

/** Look a code up without using it (to find its party). Expired codes are dropped. */
export function peekLink(code: string, now = Date.now()): LinkTicket | null {
  if (!LINK_CODE.test(code)) return null;
  const ticket = tickets.get(code);
  if (!ticket) return null;
  if (ticket.expiresAt <= now) {
    cancelLink(ticket.partyId, ticket.memberId);
    return null;
  }
  return ticket;
}

/** Use a code (once) for this party. */
export function takeLink(code: string, partyId: string, now = Date.now()): LinkTicket | null {
  const ticket = peekLink(code, now);
  if (!ticket || ticket.partyId !== partyId) return null;
  cancelLink(ticket.partyId, ticket.memberId);
  return ticket;
}

// ---------- slowing down guessing ----------

const attempts = new Map<string, { count: number; resetAt: number }>();

/** At most `limit` code tries per address per window. */
export function allowAttempt(key: string, now = Date.now(), limit = 20, windowMs = 10 * 60_000): boolean {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

// Sweep expired codes and old counters once a minute.
setInterval(() => {
  const now = Date.now();
  for (const ticket of [...tickets.values()]) if (ticket.expiresAt <= now) cancelLink(ticket.partyId, ticket.memberId);
  for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
}, 60_000).unref();
