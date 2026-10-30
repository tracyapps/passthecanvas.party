import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import pg from 'pg';
import { queueAccountMail, deliverAccountMail, type MailProvider } from './account-mail';
import { createCommunityHandler, initializeCommunitySchema, validProfile, validSchedule } from './community';
import { postgresCommunityStore, type CommunityStore } from './community-store';

const profile = { name: 'Painter', bio: 'Making things', avatar: { color: 'teal', mark: 'cat' }, share: true, allowRequests: true, emailInvites: false, emailReminders: false } as const;
const schedule = { title: 'A little paint', startsAt: new Date(Date.now() + 86400000).toISOString(), timeZone: 'America/Chicago', durationMinutes: 60 };
describe('community validation', () => {
  it('rejects forged identifiers, unsupported avatars, unknown fields and bad dates', () => {
    expect(validProfile(profile)).toBe(true);
    expect(validProfile({ ...profile, userId: 'user_victim' })).toBe(false);
    expect(validProfile({ ...profile, avatar: { color: 'red', mark: 'remote-url' } })).toBe(false);
    expect(validProfile({ ...profile, bio: 'x\u0000Injected' })).toBe(false);
    expect(validSchedule(schedule)).toBe(true);
    expect(validSchedule({ ...schedule, startsAt: 'yesterday' })).toBe(false);
    expect(validSchedule({ ...schedule, startsAt: new Date(Date.now()-1).toISOString() })).toBe(false);
    expect(validSchedule({ ...schedule, timeZone: 'Fake/Zone' })).toBe(false);
    expect(validSchedule({ ...schedule, durationMinutes: 10000 })).toBe(false);
  });
});

const databaseUrl = process.env.PTC_TEST_DATABASE_URL;
// Real Postgres integration is opt-in and restricted to a local, isolated schema.
if (databaseUrl && !['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname)) throw new Error('Community tests require a local test Postgres.');
describe.skipIf(!databaseUrl)('community with real Postgres', () => {
  let admin: pg.Pool; let db: pg.Pool; let store: CommunityStore; let server: Server; let origin: string;
  const schema = `ptc_test_${process.pid}_${Date.now()}`;
  const headers = { Authorization: 'Bearer alice', Origin: 'https://canvas.example', 'Content-Type': 'application/json' };
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA ${schema}`);
    db = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    await initializeCommunitySchema(db); store = postgresCommunityStore(db);
    const handler = createCommunityHandler({ configured: true, origins: ['https://canvas.example'], async authenticate(token) { if (!['alice','bob','eve'].includes(token)) throw new Error(); return `user_${token}`; }, async store() { return store; } });
    server = createServer((req,res) => void handler(req,res));
    await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/account/community`;
  });
  beforeEach(async () => {
    await db.query('TRUNCATE studio_profiles,studio_friendships,studio_scheduled_parties,studio_party_invites,studio_party_history CASCADE');
    for (const user of ['alice','bob','eve']) await store.saveProfile(`user_${user}`, { ...profile, name: user });
  });
  afterAll(async () => {
    if (server) { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
    await db?.end();
    if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
  });
  async function id(user: string) { return (await store.home(`user_${user}`)).profile!.id; }
  async function connect() {
    await store.requestFriend('user_alice', await id('bob'));
    await store.respondFriend('user_bob', await id('alice'), 'accept');
  }
  it('isolates accounts and requires signature/origin acceptance before storage', async () => {
    expect((await fetch(origin)).status).toBe(401);
    expect((await fetch(origin, { headers: { ...headers, Authorization:'Bearer forged' } })).status).toBe(401);
    expect((await fetch(origin, { headers: { ...headers, Origin:'https://attacker.example' } })).status).toBe(403);
    const response = await fetch(origin+'?userId=user_bob',{headers});
    expect((await response.json()).profile.name).toBe('alice');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await fetch(origin+'/profile',{method:'PUT',headers,body:JSON.stringify({...profile,userId:'user_bob'})})).status).toBe(400);
    expect((await store.home('user_bob')).profile!.name).toBe('bob');
  });
  it('makes profile visibility explicit and never exposes provider IDs or emails', async () => {
    await store.saveProfile('user_bob',{...profile,share:false});
    await expect(store.profile('user_eve',await id('bob'))).rejects.toThrow();
    await expect(store.requestFriend('user_alice',await id('bob'))).rejects.toThrow();
    expect((await store.profile('user_bob',await id('bob'))).name).toBe('Painter');
    const exposed = await store.profile('user_eve',await id('alice'));
    expect(exposed).not.toHaveProperty('user_id'); expect(exposed).not.toHaveProperty('email');
  });
  it('requires mutual acceptance and does not let senders or outsiders accept', async () => {
    await store.requestFriend('user_alice',await id('bob'));
    expect((await store.home('user_bob')).incoming).toHaveLength(1);
    expect((await store.home('user_alice')).friends).toHaveLength(0);
    await expect(store.respondFriend('user_alice',await id('bob'),'accept')).rejects.toThrow();
    await expect(store.respondFriend('user_eve',await id('alice'),'accept')).rejects.toThrow();
    await expect(store.requestFriend('user_alice',await id('bob'))).rejects.toThrow();
    await store.respondFriend('user_bob',await id('alice'),'accept');
    expect((await store.home('user_bob')).friends[0]!.name).toBe('alice');
    await store.respondFriend('user_bob',await id('alice'),'remove');
    expect((await store.home('user_alice')).friends).toHaveLength(0);
    await expect(store.requestFriend('user_alice',await id('bob'))).rejects.toThrow();
  });
  it('honors requests-off, decline and self-request boundaries', async () => {
    await store.saveProfile('user_bob',{...profile,allowRequests:false});
    await expect(store.requestFriend('user_alice',await id('bob'))).rejects.toThrow();
    await expect(store.requestFriend('user_alice',await id('alice'))).rejects.toThrow();
    await store.saveProfile('user_bob',profile);
    await store.requestFriend('user_alice',await id('bob'));
    await store.respondFriend('user_bob',await id('alice'),'decline');
    await expect(store.requestFriend('user_alice',await id('bob'))).rejects.toThrow();
  });
  it('allows hosts to invite friends, while isolating guest lists and RSVPs', async () => {
    await connect(); const party = await store.schedule('user_alice',schedule);
    await expect(store.invite('user_eve',party.id,await id('bob'))).rejects.toThrow();
    await expect(store.invite('user_alice',party.id,await id('eve'))).rejects.toThrow();
    await expect(store.invite('user_alice',party.id,await id('alice'))).rejects.toThrow();
    await store.invite('user_alice',party.id,await id('bob'));
    expect((await store.home('user_bob')).parties[0]!.response).toBe('pending');
    expect((await store.home('user_eve')).parties).toHaveLength(0);
    await expect(store.respondParty('user_eve',party.id,'yes')).rejects.toThrow();
    await store.respondParty('user_bob',party.id,'yes');
    expect((await store.home('user_bob')).parties[0]!.response).toBe('yes');
    expect((await store.home('user_alice')).history).toHaveLength(0);
  });
  it('hashes, revokes and expires shared links without revealing attendees', async () => {
    const party = await store.schedule('user_alice',schedule);
    const saved = (await db.query('SELECT share_digest FROM studio_scheduled_parties')).rows[0].share_digest;
    expect(saved).not.toBe(party.token);
    expect(await store.sharedParty(party.token)).toEqual({ ...schedule, startsAt:expect.any(Date),hostName:'alice' });
    await store.joinShared('user_bob',party.token);
    expect((await store.home('user_bob')).parties[0]!.response).toBe('yes');
    await expect(store.rotateLink('user_eve',party.id)).rejects.toThrow();
    const replacement = await store.rotateLink('user_alice',party.id);
    await expect(store.sharedParty(party.token)).rejects.toThrow();
    await store.cancel('user_alice',party.id);
    await expect(store.sharedParty(replacement.token)).rejects.toThrow();
    await expect(store.joinShared('user_eve',replacement.token)).rejects.toThrow();
    const later = await store.schedule('user_alice',schedule);
    await db.query("UPDATE studio_scheduled_parties SET starts_at=now()-interval '1 day' WHERE id=$1",[later.id]);
    await expect(store.sharedParty(later.token)).rejects.toThrow();
  });
  it('rejects oversized bodies, unknown actions and forged attendance records', async () => {
    expect((await fetch(origin+'/profile',{method:'PUT',headers,body:'x'.repeat(8193)})).status).toBe(413);
    expect((await fetch(origin+'/history',{method:'POST',headers,body:JSON.stringify({id:'fake',title:'Fake party'})})).status).toBe(400);
    expect((await store.home('user_alice')).history).toEqual([]);
  });
  it('queues only opted-in account mail, uses a verified destination and deduplicates workers', async () => {
    await connect();
    const party = await store.schedule('user_alice',schedule);
    await store.invite('user_alice',party.id,await id('bob'));
    await queueAccountMail(db);
    expect((await db.query('SELECT * FROM studio_mail_outbox')).rowCount).toBe(0);
    await store.saveProfile('user_bob',{...profile,emailInvites:true});
    await queueAccountMail(db); await queueAccountMail(db);
    const deliveries: { to: string; key: string }[] = [];
    const provider: MailProvider = { async verifiedEmail(user) { expect(user).toBe('user_bob'); return 'verified@example.test'; }, async send(mail) { deliveries.push(mail); return 'provider_1'; } };
    await Promise.all([deliverAccountMail(db,provider,'https://canvas.example'),deliverAccountMail(db,provider,'https://canvas.example')]);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.to).toBe('verified@example.test');
    expect((await store.home('user_bob')).mail[0]!.state).toBe('sent');
    expect((await store.home('user_eve')).mail).toHaveLength(0);
  });
  it('rechecks opt-out during lookup and cancellation before reminders are sent', async () => {
    await connect();
    const party = await store.schedule('user_alice',{...schedule,startsAt:new Date(Date.now()+9*60000).toISOString()});
    await store.invite('user_alice',party.id,await id('bob'));
    await store.respondParty('user_bob',party.id,'yes');
    await store.saveProfile('user_bob',{...profile,emailReminders:true});
    await queueAccountMail(db);
    let sent=0;
    const provider: MailProvider = { async verifiedEmail() { await store.saveProfile('user_bob',profile); return 'verified@example.test'; }, async send() { sent++; return 'provider_1'; } };
    await deliverAccountMail(db,provider,'https://canvas.example');
    expect(sent).toBe(0);
    expect((await store.home('user_bob')).mail[0]!.state).toBe('skipped');
    await db.query('DELETE FROM studio_mail_outbox');
    await store.saveProfile('user_bob',{...profile,emailReminders:true});
    await queueAccountMail(db); await store.cancel('user_alice',party.id);
    await deliverAccountMail(db,provider,'https://canvas.example');
    expect(sent).toBe(0);
    expect((await store.home('user_bob')).mail[0]!.state).toBe('skipped');
  });
  it('retries with a stable delivery key and stops before the idempotency window expires', async () => {
    await connect(); const party=await store.schedule('user_alice',schedule);
    await store.invite('user_alice',party.id,await id('bob'));
    await store.saveProfile('user_bob',{...profile,emailInvites:true}); await queueAccountMail(db);
    const keys:string[]=[];
    const provider: MailProvider={ async verifiedEmail(){return 'verified@example.test';}, async send(mail){keys.push(mail.key); throw new Error('Ambiguous network outcome');} };
    await deliverAccountMail(db,provider,'https://canvas.example');
    await db.query('UPDATE studio_mail_outbox SET due_at=now()');
    await deliverAccountMail(db,provider,'https://canvas.example');
    expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
    await db.query("UPDATE studio_mail_outbox SET due_at=now(),first_attempt_at=now()-interval '24 hours'");
    await deliverAccountMail(db,provider,'https://canvas.example');
    expect(keys).toHaveLength(2); expect((await store.home('user_bob')).mail[0]!.state).toBe('failed');
  });

});
