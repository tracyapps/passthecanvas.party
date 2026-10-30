import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { CommunityHome, ScheduleInput, StudioProfile, SharedParty } from '@ptc/shared';

export class CommunityError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface CommunityStore {
  home(user: string): Promise<CommunityHome>;
  saveProfile(user: string, profile: Omit<StudioProfile, 'id'>): Promise<void>;
  profile(user: string, id: string): Promise<StudioProfile>;
  requestFriend(user: string, id: string): Promise<void>;
  respondFriend(user: string, id: string, action: 'accept' | 'decline' | 'remove'): Promise<void>;
  schedule(user: string, input: ScheduleInput): Promise<{ id: string; token: string }>;
  invite(user: string, party: string, friend: string): Promise<void>;
  respondParty(user: string, party: string, response: 'yes' | 'no'): Promise<void>;
  sharedParty(token: string): Promise<SharedParty>;
  joinShared(user: string, token: string): Promise<void>;
  cancel(user: string, party: string): Promise<void>;
  rotateLink(user: string, party: string): Promise<{ token: string }>;
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const profileColumns = 'p.id, p.name, p.bio, p.avatar, p.share, p.allow_requests AS "allowRequests", p.email_invites AS "emailInvites", p.email_reminders AS "emailReminders"';
const partyColumns = `s.id, s.title, s.starts_at AS "startsAt", s.time_zone AS "timeZone", s.duration_minutes AS "durationMinutes", p.name AS "hostName"`;
function requireRow<T>(row: T | undefined, message = 'This item is unavailable.'): T {
  if (!row) throw new CommunityError(404, message);
  return row;
}
function privatePreferences(profile: StudioProfile): StudioProfile { return { ...profile, emailInvites: false, emailReminders: false }; }
// Keep every authorization condition in the write query, so concurrent changes cannot bypass it.
export function postgresCommunityStore(db: pg.Pool): CommunityStore {
  return {
    async home(user) {
      const [profile, friends, incoming, outgoing, parties, history, mail] = await Promise.all([
        db.query(`SELECT ${profileColumns} FROM studio_profiles p WHERE user_id=$1`, [user]),
        db.query(`SELECT ${profileColumns} FROM studio_friendships f JOIN studio_profiles p ON p.user_id=CASE WHEN f.low_id=$1 THEN f.high_id ELSE f.low_id END WHERE $1 IN (f.low_id,f.high_id) AND state='accepted' ORDER BY p.name LIMIT 200`, [user]),
        db.query(`SELECT ${profileColumns} FROM studio_friendships f JOIN studio_profiles p ON p.user_id=f.sender WHERE $1 IN (f.low_id,f.high_id) AND f.sender<>$1 AND state='pending' ORDER BY created_at LIMIT 100`, [user]),
        db.query(`SELECT ${profileColumns} FROM studio_friendships f JOIN studio_profiles p ON p.user_id=CASE WHEN f.low_id=$1 THEN f.high_id ELSE f.low_id END WHERE f.sender=$1 AND state='pending' ORDER BY created_at LIMIT 100`, [user]),
        db.query(`SELECT ${partyColumns}, s.host_id=$1 AS hosting, COALESCE(i.response,'yes') AS response, s.cancelled FROM studio_scheduled_parties s JOIN studio_profiles p ON p.user_id=s.host_id LEFT JOIN studio_party_invites i ON i.party_id=s.id AND i.user_id=$1 WHERE s.host_id=$1 OR i.user_id=$1 ORDER BY s.starts_at DESC LIMIT 100`, [user]),
        db.query('SELECT party_id AS id,title,ended_at AS "endedAt",artwork_count AS "artworkCount" FROM studio_party_history WHERE user_id=$1 ORDER BY ended_at DESC LIMIT 100', [user]),
        db.query('SELECT party_id AS \"partyId\",kind,state FROM studio_mail_outbox WHERE user_id=$1 ORDER BY due_at DESC LIMIT 100', [user]),
      ]);
      return { profile: profile.rows[0] ?? null, friends: friends.rows.map(privatePreferences), incoming: incoming.rows.map(privatePreferences), outgoing: outgoing.rows.map(privatePreferences), parties: parties.rows, history: history.rows, mail: mail.rows };
    },
    async saveProfile(user, value) {
      await db.query(`INSERT INTO studio_profiles(user_id,id,name,bio,avatar,share,allow_requests,email_invites,email_reminders) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9) ON CONFLICT(user_id) DO UPDATE SET name=EXCLUDED.name,bio=EXCLUDED.bio,avatar=EXCLUDED.avatar,share=EXCLUDED.share,allow_requests=EXCLUDED.allow_requests,email_invites=EXCLUDED.email_invites,email_reminders=EXCLUDED.email_reminders`, [user, randomUUID(), value.name, value.bio, JSON.stringify(value.avatar), value.share, value.allowRequests, value.emailInvites, value.emailReminders]);
    },
    async profile(user, id) {
      const result = await db.query(`SELECT ${profileColumns} FROM studio_profiles p WHERE id=$2 AND (user_id=$1 OR share OR EXISTS(SELECT 1 FROM studio_friendships f WHERE $1 IN(f.low_id,f.high_id) AND p.user_id IN(f.low_id,f.high_id) AND state IN('accepted','pending')))`, [user, id]);
      return privatePreferences(requireRow(result.rows[0]));
    },
    async requestFriend(user, id) {
      const result = await db.query(`INSERT INTO studio_friendships(low_id,high_id,sender,state) SELECT LEAST($1,p.user_id),GREATEST($1,p.user_id),$1,'pending' FROM studio_profiles p WHERE p.id=$2 AND p.user_id<>$1 AND p.share AND p.allow_requests AND EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$1) AND (SELECT count(*) FROM studio_friendships WHERE sender=$1 AND created_at>now()-interval '1 day')<20 ON CONFLICT DO NOTHING RETURNING sender`, [user, id]);
      if (!result.rowCount) throw new CommunityError(409, 'This friend request cannot be sent. It may already exist or requests may be off.');
    },
    async respondFriend(user, id, action) {
      const state = action === 'accept' ? 'accepted' : 'declined';
      const result = await db.query(`UPDATE studio_friendships f SET state=$3 FROM studio_profiles p WHERE p.id=$2 AND $1 IN(f.low_id,f.high_id) AND p.user_id IN(f.low_id,f.high_id) AND p.user_id<>$1 AND ${action === 'remove' ? "f.state='accepted'" : "f.state='pending' AND f.sender<>$1"} RETURNING sender`, [user, id, state]);
      if (!result.rowCount) throw new CommunityError(404, 'This friend request is unavailable.');
    },
    async schedule(user, input) {
      const id = randomUUID(); const token = randomBytes(32).toString('base64url');
      const result = await db.query(`INSERT INTO studio_scheduled_parties(id,host_id,title,starts_at,time_zone,duration_minutes,share_digest) SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$2) AND (SELECT count(*) FROM studio_scheduled_parties WHERE host_id=$2 AND starts_at>now() AND NOT cancelled)<30 RETURNING id`, [id, user, input.title, input.startsAt, input.timeZone, input.durationMinutes, digest(token)]);
      if (!result.rowCount) throw new CommunityError(409, 'Save your profile first, or finish an existing scheduled party.');
      return { id, token };
    },
    async invite(user, party, friend) {
      const result = await db.query(`INSERT INTO studio_party_invites(party_id,user_id) SELECT s.id,p.user_id FROM studio_scheduled_parties s JOIN studio_profiles p ON p.id=$3 WHERE s.id=$2 AND s.host_id=$1 AND p.user_id<>$1 AND NOT s.cancelled AND s.starts_at>now() AND EXISTS(SELECT 1 FROM studio_friendships f WHERE f.state='accepted' AND $1 IN(f.low_id,f.high_id) AND p.user_id IN(f.low_id,f.high_id)) AND (SELECT count(*) FROM studio_party_invites WHERE party_id=s.id)<50 ON CONFLICT DO NOTHING RETURNING user_id`, [user, party, friend]);
      if (!result.rowCount) throw new CommunityError(409, 'Invite unavailable. Choose a connected friend who has not already been invited.');
    },
    async respondParty(user, party, response) {
      const result = await db.query(`UPDATE studio_party_invites i SET response=$3 FROM studio_scheduled_parties s WHERE i.party_id=s.id AND s.id=$2 AND i.user_id=$1 AND NOT s.cancelled AND s.starts_at>now() RETURNING i.user_id`, [user, party, response]);
      if (!result.rowCount) throw new CommunityError(404, 'This invitation is unavailable.');
    },
    async sharedParty(token) {
      const result = await db.query(`SELECT ${partyColumns} FROM studio_scheduled_parties s JOIN studio_profiles p ON p.user_id=s.host_id WHERE share_digest=$1 AND NOT cancelled AND starts_at>now()`, [digest(token)]);
      // A shared link reveals the invitation, never the guest list or account identifiers.
      const row = requireRow(result.rows[0], 'This invitation has expired or was replaced.');
      const { title, startsAt, timeZone, durationMinutes, hostName } = row;
      return { title, startsAt, timeZone, durationMinutes, hostName };
    },
    async joinShared(user, token) {
      const result = await db.query(`INSERT INTO studio_party_invites(party_id,user_id,response) SELECT s.id,$1,'yes' FROM studio_scheduled_parties s WHERE share_digest=$2 AND NOT cancelled AND starts_at>now() AND host_id<>$1 AND EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$1) AND (SELECT count(*) FROM studio_party_invites WHERE party_id=s.id)<50 ON CONFLICT(party_id,user_id) DO UPDATE SET response='yes' RETURNING user_id`, [user, digest(token)]);
      if (!result.rowCount) throw new CommunityError(409, 'Save your profile first. This invitation may also have expired or reached its guest limit.');
    },
    async cancel(user, party) {
      const result = await db.query('UPDATE studio_scheduled_parties SET cancelled=true WHERE id=$2 AND host_id=$1 RETURNING id', [user, party]);
      if (!result.rowCount) throw new CommunityError(404, 'This party is unavailable.');
    },
    async rotateLink(user, party) {
      const token = randomBytes(32).toString('base64url');
      const result = await db.query('UPDATE studio_scheduled_parties SET share_digest=$3 WHERE id=$2 AND host_id=$1 AND NOT cancelled AND starts_at>now() RETURNING id', [user, party, digest(token)]);
      if (!result.rowCount) throw new CommunityError(404, 'This party is unavailable.');
      return { token };
    },
  };
}
