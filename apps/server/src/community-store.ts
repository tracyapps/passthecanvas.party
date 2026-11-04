import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { CANVAS_SHAPES, cleanPartySettings, type CanvasShape, type PracticePiece, DEFAULT_PARTY_SETTINGS, INITIALS_COLOR_KEYS, roomIdFor, sanitizeAvatarDesign, type CalendarEvent, type CommunityHome, type InitialsColor, type ProfileInput, type SavedAvatar, type ScheduleInput, type ScheduledParty, type StudioProfile, type SharedParty } from '@ptc/shared';

export class CommunityError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface CommunityStore {
  home(user: string): Promise<CommunityHome>;
  saveProfile(user: string, profile: ProfileInput): Promise<void>;
  setPhoto(user: string, contentType: string, bytes: Buffer): Promise<{ photo: string }>;
  clearPhoto(user: string): Promise<void>;
  photo(user: string, id: string): Promise<{ contentType: string; bytes: Buffer }>;
  avatars(user: string): Promise<SavedAvatar[]>;
  saveAvatar(user: string, input: { id: string | null; name: string; design: unknown }): Promise<{ id: string }>;
  deleteAvatar(user: string, id: string): Promise<void>;
  setDefaultAvatar(user: string, id: string | null): Promise<void>;
  updateParty(user: string, party: string, input: ScheduleInput): Promise<void>;
  calendarToken(user: string, rotate: boolean): Promise<{ token: string }>;
  calendarFeed(token: string): Promise<{ events: CalendarEvent[] }>;
  saveGallery(user: string, archiveId: string, title: string): Promise<void>;
  practice(user: string): Promise<PracticePiece[]>;
  practiceFile(user: string, id: string, kind: 'image' | 'thumb' | 'strokes'): Promise<{ contentType: string; bytes: Buffer; gzip: boolean }>;
  savePractice(user: string, input: { id: string | null; title: string; shape: CanvasShape; image: Buffer; thumb: { contentType: string; bytes: Buffer }; strokes: Buffer | null }): Promise<{ id: string }>;
  deletePractice(user: string, id: string): Promise<void>;
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
const profileColumns = 'p.id, p.name, p.bio, p.avatar, p.links, p.photo_version AS photo, p.default_avatar AS "defaultAvatarId", p.share, p.allow_requests AS "allowRequests", p.email_invites AS "emailInvites", p.email_reminders AS "emailReminders"';
const partyColumns = `s.id, s.title, s.starts_at AS "startsAt", s.time_zone AS "timeZone", s.duration_minutes AS "durationMinutes", s.settings, p.name AS "hostName"`;
/** Who may see a profile (and its photo): yourself, shared profiles, and friends or pending friends. */
const canSee = `(p.user_id=$1 OR p.share OR EXISTS(SELECT 1 FROM studio_friendships f WHERE $1 IN(f.low_id,f.high_id) AND p.user_id IN(f.low_id,f.high_id) AND state IN('accepted','pending')))`;
/** Older profiles stored { mark, color }; only the color is used now. */
function profileRow(row: StudioProfile): StudioProfile {
  const color = INITIALS_COLOR_KEYS.includes(row.avatar?.color as InitialsColor) ? row.avatar.color : 'teal';
  return { ...row, avatar: { color }, links: Array.isArray(row.links) ? row.links : [], photo: row.photo ?? null, defaultAvatarId: row.defaultAvatarId ?? null };
}
function partyRow(row: Omit<ScheduledParty, 'settings' | 'roomId'> & { settings: unknown }): ScheduledParty {
  return { ...row, settings: cleanPartySettings(row.settings) ?? { ...DEFAULT_PARTY_SETTINGS, timing: { ...DEFAULT_PARTY_SETTINGS.timing, partyMinutes: row.durationMinutes } }, roomId: roomIdFor(row.id) };
}
function requireRow<T>(row: T | undefined, message = 'This item is unavailable.'): T {
  if (!row) throw new CommunityError(404, message);
  return row;
}
function privatePreferences(profile: StudioProfile): StudioProfile { return { ...profileRow(profile), emailInvites: false, emailReminders: false, defaultAvatarId: null }; }
// Keep every authorization condition in the write query, so concurrent changes cannot bypass it.
export function postgresCommunityStore(db: pg.Pool): CommunityStore {
  return {
    async home(user) {
      const [profile, friends, incoming, outgoing, parties, history, mail, galleries] = await Promise.all([
        db.query(`SELECT ${profileColumns} FROM studio_profiles p WHERE user_id=$1`, [user]),
        db.query(`SELECT ${profileColumns} FROM studio_friendships f JOIN studio_profiles p ON p.user_id=CASE WHEN f.low_id=$1 THEN f.high_id ELSE f.low_id END WHERE $1 IN (f.low_id,f.high_id) AND state='accepted' ORDER BY p.name LIMIT 200`, [user]),
        db.query(`SELECT ${profileColumns} FROM studio_friendships f JOIN studio_profiles p ON p.user_id=f.sender WHERE $1 IN (f.low_id,f.high_id) AND f.sender<>$1 AND state='pending' ORDER BY created_at LIMIT 100`, [user]),
        db.query(`SELECT ${profileColumns} FROM studio_friendships f JOIN studio_profiles p ON p.user_id=CASE WHEN f.low_id=$1 THEN f.high_id ELSE f.low_id END WHERE f.sender=$1 AND state='pending' ORDER BY created_at LIMIT 100`, [user]),
        db.query(`SELECT ${partyColumns}, s.host_id=$1 AS hosting, COALESCE(i.response,'yes') AS response, s.cancelled FROM studio_scheduled_parties s JOIN studio_profiles p ON p.user_id=s.host_id LEFT JOIN studio_party_invites i ON i.party_id=s.id AND i.user_id=$1 WHERE s.host_id=$1 OR i.user_id=$1 ORDER BY s.starts_at DESC LIMIT 100`, [user]),
        db.query('SELECT party_id AS id,title,ended_at AS "endedAt",artwork_count AS "artworkCount" FROM studio_party_history WHERE user_id=$1 ORDER BY ended_at DESC LIMIT 100', [user]),
        db.query('SELECT party_id AS \"partyId\",kind,state FROM studio_mail_outbox WHERE user_id=$1 ORDER BY due_at DESC LIMIT 100', [user]),
        db.query('SELECT archive_id AS "archiveId", title, saved_at AS "savedAt" FROM studio_saved_galleries WHERE user_id=$1 ORDER BY saved_at DESC LIMIT 200', [user]),
      ]);
      return { profile: profile.rows[0] ? profileRow(profile.rows[0]) : null, friends: friends.rows.map(privatePreferences), incoming: incoming.rows.map(privatePreferences), outgoing: outgoing.rows.map(privatePreferences), parties: parties.rows.map(partyRow), history: history.rows, galleries: galleries.rows, avatars: [], mail: mail.rows };
    },
    async saveProfile(user, value) {
      await db.query(`INSERT INTO studio_profiles(user_id,id,name,bio,avatar,links,share,allow_requests,email_invites,email_reminders) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10) ON CONFLICT(user_id) DO UPDATE SET name=EXCLUDED.name,bio=EXCLUDED.bio,avatar=EXCLUDED.avatar,links=EXCLUDED.links,share=EXCLUDED.share,allow_requests=EXCLUDED.allow_requests,email_invites=EXCLUDED.email_invites,email_reminders=EXCLUDED.email_reminders`, [user, randomUUID(), value.name, value.bio, JSON.stringify({ color: value.avatar.color }), JSON.stringify(value.links), value.share, value.allowRequests, value.emailInvites, value.emailReminders]);
    },
    async setPhoto(user, contentType, bytes) {
      const version = randomBytes(9).toString('base64url');
      const result = await db.query(`WITH saved AS (INSERT INTO studio_profile_photos(user_id,content_type,bytes) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$1) ON CONFLICT(user_id) DO UPDATE SET content_type=EXCLUDED.content_type,bytes=EXCLUDED.bytes,updated_at=now() RETURNING user_id) UPDATE studio_profiles SET photo_version=$4 WHERE user_id IN (SELECT user_id FROM saved) RETURNING id`, [user, contentType, bytes, version]);
      if (!result.rowCount) throw new CommunityError(409, 'Save your profile first, then add a photo.');
      return { photo: version };
    },
    async clearPhoto(user) {
      await db.query('DELETE FROM studio_profile_photos WHERE user_id=$1', [user]);
      await db.query('UPDATE studio_profiles SET photo_version=NULL WHERE user_id=$1', [user]);
    },
    async photo(user, id) {
      const result = await db.query(`SELECT ph.content_type AS "contentType", ph.bytes FROM studio_profiles p JOIN studio_profile_photos ph ON ph.user_id=p.user_id WHERE p.id=$2 AND ${canSee}`, [user, id]);
      return requireRow(result.rows[0]);
    },
    async avatars(user) {
      const result = await db.query('SELECT id, name, design, updated_at AS "updatedAt" FROM studio_avatars WHERE user_id=$1 ORDER BY created_at LIMIT 24', [user]);
      return result.rows.flatMap((row) => { const design = sanitizeAvatarDesign(row.design); return design ? [{ ...row, design }] : []; });
    },
    async saveAvatar(user, input) {
      const design = sanitizeAvatarDesign(input.design);
      if (!design) throw new CommunityError(400, 'That avatar could not be saved. Try a simpler drawing.');
      if (input.id) {
        const result = await db.query('UPDATE studio_avatars SET name=$3, design=$4::jsonb, updated_at=now() WHERE id=$2 AND user_id=$1 RETURNING id', [user, input.id, input.name, JSON.stringify(design)]);
        if (!result.rowCount) throw new CommunityError(404, 'This avatar is unavailable.');
        return { id: input.id };
      }
      const id = randomUUID();
      const result = await db.query(`INSERT INTO studio_avatars(id,user_id,name,design) SELECT $1,$2,$3,$4::jsonb WHERE EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$2) AND (SELECT count(*) FROM studio_avatars WHERE user_id=$2)<24 RETURNING id`, [id, user, input.name, JSON.stringify(design)]);
      if (!result.rowCount) throw new CommunityError(409, 'Save your profile first. You can keep up to 24 avatars.');
      // The first avatar you make becomes your default.
      await db.query('UPDATE studio_profiles SET default_avatar=$2 WHERE user_id=$1 AND default_avatar IS NULL', [user, id]);
      return { id };
    },
    async deleteAvatar(user, id) {
      const result = await db.query('DELETE FROM studio_avatars WHERE id=$2 AND user_id=$1 RETURNING id', [user, id]);
      if (!result.rowCount) throw new CommunityError(404, 'This avatar is unavailable.');
      await db.query('UPDATE studio_profiles SET default_avatar=NULL WHERE user_id=$1 AND default_avatar=$2', [user, id]);
    },
    async setDefaultAvatar(user, id) {
      const result = await db.query(`UPDATE studio_profiles SET default_avatar=$2 WHERE user_id=$1 AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM studio_avatars WHERE id=$2 AND user_id=$1)) RETURNING id`, [user, id]);
      if (!result.rowCount) throw new CommunityError(404, 'This avatar is unavailable.');
    },
    async updateParty(user, party, input) {
      const result = await db.query('UPDATE studio_scheduled_parties SET title=$3, starts_at=$4, time_zone=$5, duration_minutes=$6, settings=$7::jsonb WHERE id=$2 AND host_id=$1 AND NOT cancelled RETURNING id', [user, party, input.title, input.startsAt, input.timeZone, input.durationMinutes, JSON.stringify(input.settings)]);
      if (!result.rowCount) throw new CommunityError(404, 'This party is unavailable.');
    },
    async calendarToken(user, rotate) {
      // The feed link is a read-only secret for your own party list; replacing it stops the old one.
      const token = randomBytes(24).toString('base64url');
      if (!rotate) {
        const existing = await db.query('SELECT token FROM studio_calendar_feeds WHERE user_id=$1', [user]);
        if (existing.rows[0]) return { token: existing.rows[0].token };
      }
      const result = await db.query('INSERT INTO studio_calendar_feeds(user_id,token) SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$1) ON CONFLICT(user_id) DO UPDATE SET token=EXCLUDED.token, created_at=now() RETURNING user_id', [user, token]);
      if (!result.rowCount) throw new CommunityError(409, 'Save your profile first.');
      return { token };
    },
    async calendarFeed(token) {
      const owner = await db.query('SELECT user_id FROM studio_calendar_feeds WHERE token=$1', [token]);
      const user = requireRow(owner.rows[0], 'This calendar link was replaced.').user_id as string;
      const parties = await db.query(`SELECT ${partyColumns}, s.cancelled FROM studio_scheduled_parties s JOIN studio_profiles p ON p.user_id=s.host_id LEFT JOIN studio_party_invites i ON i.party_id=s.id AND i.user_id=$1 WHERE (s.host_id=$1 OR i.response IN ('yes','pending')) AND s.starts_at > now() - interval '60 days' ORDER BY s.starts_at LIMIT 200`, [user]);
      return { events: parties.rows.map((row) => { const party = partyRow(row); return { id: party.id, title: party.title, startsAt: new Date(party.startsAt).toISOString(), durationMinutes: party.durationMinutes, description: `Art party hosted by ${party.hostName}. ${party.settings.description}`.trim(), cancelled: party.cancelled }; }) };
    },
    async practice(user) {
      const result = await db.query('SELECT id, title, shape, width, height, strokes IS NOT NULL AS "hasStrokes", created_at AS "createdAt", updated_at AS "updatedAt" FROM studio_practice_pieces WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200', [user]);
      return result.rows;
    },
    async practiceFile(user, id, kind) {
      const column = kind === 'image' ? "image, 'image/png' AS type" : kind === 'thumb' ? 'thumb AS image, thumb_type AS type' : "strokes AS image, 'application/json' AS type";
      const result = await db.query(`SELECT ${column} FROM studio_practice_pieces WHERE id=$2 AND user_id=$1`, [user, id]);
      const row = requireRow(result.rows[0]);
      if (!row.image) throw new CommunityError(404, 'This piece has no painting data.');
      return { contentType: row.type, bytes: row.image, gzip: kind === 'strokes' };
    },
    async savePractice(user, input) {
      const { width, height } = CANVAS_SHAPES[input.shape];
      if (input.id) {
        const result = await db.query('UPDATE studio_practice_pieces SET title=$3, shape=$4, width=$5, height=$6, image=$7, thumb=$8, thumb_type=$9, strokes=$10, updated_at=now() WHERE id=$2 AND user_id=$1 RETURNING id', [user, input.id, input.title, input.shape, width, height, input.image, input.thumb.bytes, input.thumb.contentType, input.strokes]);
        if (!result.rowCount) throw new CommunityError(404, 'This piece is unavailable.');
        return { id: input.id };
      }
      const id = randomUUID();
      const result = await db.query(`INSERT INTO studio_practice_pieces(id,user_id,title,shape,width,height,image,thumb,thumb_type,strokes) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 WHERE EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$2) AND (SELECT count(*) FROM studio_practice_pieces WHERE user_id=$2)<100 RETURNING id`, [id, user, input.title, input.shape, width, height, input.image, input.thumb.bytes, input.thumb.contentType, input.strokes]);
      if (!result.rowCount) throw new CommunityError(409, 'Save your profile first. You can keep up to 100 practice pieces.');
      return { id };
    },
    async deletePractice(user, id) {
      const result = await db.query('DELETE FROM studio_practice_pieces WHERE id=$2 AND user_id=$1 RETURNING id', [user, id]);
      if (!result.rowCount) throw new CommunityError(404, 'This piece is unavailable.');
    },
    async saveGallery(user, archiveId, title) {
      // Only galleries that exist (the archive table appears with the first saved party).
      const table = await db.query("SELECT to_regclass('party_archives') IS NOT NULL AS ok");
      if (!table.rows[0]?.ok) throw new CommunityError(404, 'This gallery is unavailable.');
      const result = await db.query(`INSERT INTO studio_saved_galleries(user_id,archive_id,title) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$1) AND EXISTS(SELECT 1 FROM party_archives WHERE id=$2) AND (SELECT count(*) FROM studio_saved_galleries WHERE user_id=$1)<500 ON CONFLICT(user_id,archive_id) DO UPDATE SET title=EXCLUDED.title RETURNING archive_id`, [user, archiveId, title]);
      if (!result.rowCount) throw new CommunityError(404, 'This gallery is unavailable.');
    },
    async profile(user, id) {
      const result = await db.query(`SELECT ${profileColumns} FROM studio_profiles p WHERE id=$2 AND ${canSee}`, [user, id]);
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
      const result = await db.query(`INSERT INTO studio_scheduled_parties(id,host_id,title,starts_at,time_zone,duration_minutes,share_digest,settings) SELECT $1,$2,$3,$4,$5,$6,$7,$8::jsonb WHERE EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$2) AND (SELECT count(*) FROM studio_scheduled_parties WHERE host_id=$2 AND starts_at>now() AND NOT cancelled)<30 RETURNING id`, [id, user, input.title, input.startsAt, input.timeZone, input.durationMinutes, digest(token), JSON.stringify(input.settings)]);
      if (!result.rowCount) throw new CommunityError(409, 'Save your profile first, or finish an existing scheduled party.');
      return { id, token };
    },
    async invite(user, party, friend) {
      const result = await db.query(`INSERT INTO studio_party_invites(party_id,user_id) SELECT s.id,p.user_id FROM studio_scheduled_parties s JOIN studio_profiles p ON p.id=$3 WHERE s.id=$2 AND s.host_id=$1 AND p.user_id<>$1 AND NOT s.cancelled AND s.starts_at+make_interval(mins=>s.duration_minutes)>now() AND EXISTS(SELECT 1 FROM studio_friendships f WHERE f.state='accepted' AND $1 IN(f.low_id,f.high_id) AND p.user_id IN(f.low_id,f.high_id)) AND (SELECT count(*) FROM studio_party_invites WHERE party_id=s.id)<50 ON CONFLICT DO NOTHING RETURNING user_id`, [user, party, friend]);
      if (!result.rowCount) throw new CommunityError(409, 'Invite unavailable. Choose a connected friend who has not already been invited.');
    },
    async respondParty(user, party, response) {
      const result = await db.query(`UPDATE studio_party_invites i SET response=$3 FROM studio_scheduled_parties s WHERE i.party_id=s.id AND s.id=$2 AND i.user_id=$1 AND NOT s.cancelled AND s.starts_at+make_interval(mins=>s.duration_minutes)>now() RETURNING i.user_id`, [user, party, response]);
      if (!result.rowCount) throw new CommunityError(404, 'This invitation is unavailable.');
    },
    async sharedParty(token) {
      const result = await db.query(`SELECT ${partyColumns} FROM studio_scheduled_parties s JOIN studio_profiles p ON p.user_id=s.host_id WHERE share_digest=$1 AND NOT cancelled AND starts_at+make_interval(mins=>duration_minutes)>now()`, [digest(token)]);
      // A shared link reveals the invitation, never the guest list or account identifiers.
      const row = requireRow(result.rows[0], 'This invitation has expired or was replaced.');
      const { title, startsAt, timeZone, durationMinutes, hostName } = row;
      return { title, startsAt, timeZone, durationMinutes, hostName, description: cleanPartySettings(row.settings)?.description ?? '' };
    },
    async joinShared(user, token) {
      const result = await db.query(`INSERT INTO studio_party_invites(party_id,user_id,response) SELECT s.id,$1,'yes' FROM studio_scheduled_parties s WHERE share_digest=$2 AND NOT cancelled AND starts_at+make_interval(mins=>duration_minutes)>now() AND host_id<>$1 AND EXISTS(SELECT 1 FROM studio_profiles WHERE user_id=$1) AND (SELECT count(*) FROM studio_party_invites WHERE party_id=s.id)<50 ON CONFLICT(party_id,user_id) DO UPDATE SET response='yes' RETURNING user_id`, [user, digest(token)]);
      if (!result.rowCount) throw new CommunityError(409, 'Save your profile first. This invitation may also have expired or reached its guest limit.');
    },
    async cancel(user, party) {
      const result = await db.query('UPDATE studio_scheduled_parties SET cancelled=true WHERE id=$2 AND host_id=$1 RETURNING id', [user, party]);
      if (!result.rowCount) throw new CommunityError(404, 'This party is unavailable.');
    },
    async rotateLink(user, party) {
      const token = randomBytes(32).toString('base64url');
      const result = await db.query('UPDATE studio_scheduled_parties SET share_digest=$3 WHERE id=$2 AND host_id=$1 AND NOT cancelled AND starts_at+make_interval(mins=>duration_minutes)>now() RETURNING id', [user, party, digest(token)]);
      if (!result.rowCount) throw new CommunityError(404, 'This party is unavailable.');
      return { token };
    },
  };
}
