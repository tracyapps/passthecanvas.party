// Account mail never includes a webcam image, attendee email list or tracking pixel.
import { randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import pg from 'pg';
import { initializeCommunitySchema } from './community.ts';
interface Mail { to: string; subject: string; text: string; key: string }
export interface MailProvider { verifiedEmail(user: string): Promise<string | null>; send(mail: Mail): Promise<string> }

export async function queueAccountMail(db: pg.Pool): Promise<void> {
  const invitees = await db.query(`SELECT s.id AS party,i.user_id AS recipient FROM studio_scheduled_parties s JOIN studio_party_invites i ON i.party_id=s.id JOIN studio_profiles p ON p.user_id=i.user_id WHERE NOT s.cancelled AND s.starts_at>now() AND i.response='pending' AND p.email_invites AND NOT EXISTS(SELECT 1 FROM studio_mail_outbox o WHERE o.party_id=s.id AND o.user_id=i.user_id AND o.kind='invitation') AND EXISTS(SELECT 1 FROM studio_friendships f WHERE f.state='accepted' AND s.host_id IN(f.low_id,f.high_id) AND i.user_id IN(f.low_id,f.high_id)) LIMIT 500`);
  for (const row of invitees.rows) await db.query(`INSERT INTO studio_mail_outbox(id,party_id,user_id,kind,due_at) VALUES($1,$2,$3,'invitation',now()) ON CONFLICT DO NOTHING`,[randomUUID(),row.party,row.recipient]);
  const reminders = await db.query(`SELECT s.id AS party,p.user_id AS recipient,s.starts_at FROM studio_scheduled_parties s JOIN studio_profiles p ON p.email_reminders AND (p.user_id=s.host_id OR EXISTS(SELECT 1 FROM studio_party_invites i WHERE i.party_id=s.id AND i.user_id=p.user_id AND i.response='yes')) WHERE NOT s.cancelled AND s.starts_at>now() AND NOT EXISTS(SELECT 1 FROM studio_mail_outbox o WHERE o.party_id=s.id AND o.user_id=p.user_id AND o.kind='reminder') LIMIT 500`);
  for (const row of reminders.rows) await db.query(`INSERT INTO studio_mail_outbox(id,party_id,user_id,kind,due_at) VALUES($1,$2,$3,'reminder',$4::timestamptz-interval '15 minutes') ON CONFLICT DO NOTHING`,[randomUUID(),row.party,row.recipient,row.starts_at]);
}
export async function deliverAccountMail(db: pg.Pool, provider: MailProvider, origin: string): Promise<void> {
  // Stop uncertain deliveries before the provider's 24-hour idempotency window ends.
  await db.query("UPDATE studio_mail_outbox SET state='failed' WHERE state IN('pending','processing') AND first_attempt_at<now()-interval '23 hours'");
  const claimed = await db.query(`UPDATE studio_mail_outbox SET state='processing',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,now()),lease_until=now()+interval '2 minutes' WHERE id IN(SELECT id FROM studio_mail_outbox WHERE due_at<=now() AND attempts<5 AND (state='pending' OR (state='processing' AND lease_until<now())) ORDER BY due_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`);
  for (const job of claimed.rows) {
    try {
      const result = await db.query(`SELECT s.title,s.starts_at,s.time_zone,p.name AS host_name FROM studio_scheduled_parties s JOIN studio_profiles p ON p.user_id=s.host_id JOIN studio_profiles recipient ON recipient.user_id=$2 LEFT JOIN studio_party_invites i ON i.party_id=s.id AND i.user_id=$2 WHERE s.id=$1 AND NOT s.cancelled AND s.starts_at>now() AND (($3='reminder' AND recipient.email_reminders AND (s.host_id=$2 OR i.response='yes')) OR ($3='invitation' AND recipient.email_invites AND i.response='pending' AND EXISTS(SELECT 1 FROM studio_friendships f WHERE f.state='accepted' AND s.host_id IN(f.low_id,f.high_id) AND $2 IN(f.low_id,f.high_id))))`,[job.party_id,job.user_id,job.kind]);
      const party = result.rows[0];
      if (!party) { await db.query("UPDATE studio_mail_outbox SET state='skipped',lease_until=NULL WHERE id=$1",[job.id]); continue; }
      const email = await provider.verifiedEmail(job.user_id);
      if (!email) { await db.query("UPDATE studio_mail_outbox SET state='skipped',lease_until=NULL WHERE id=$1",[job.id]); continue; }
      // A permission change during the email lookup must still prevent delivery.
      const consent = await db.query(`SELECT 1 FROM studio_profiles p JOIN studio_scheduled_parties s ON s.id=$2 WHERE p.user_id=$1 AND NOT s.cancelled AND s.starts_at>now() AND CASE WHEN $3='reminder' THEN p.email_reminders AND (s.host_id=p.user_id OR EXISTS(SELECT 1 FROM studio_party_invites i WHERE i.party_id=s.id AND i.user_id=p.user_id AND i.response='yes')) ELSE p.email_invites AND EXISTS(SELECT 1 FROM studio_party_invites i WHERE i.party_id=s.id AND i.user_id=p.user_id AND i.response='pending') AND EXISTS(SELECT 1 FROM studio_friendships f WHERE f.state='accepted' AND s.host_id IN(f.low_id,f.high_id) AND p.user_id IN(f.low_id,f.high_id)) END`,[job.user_id,job.party_id,job.kind]);
      if (!consent.rowCount) { await db.query("UPDATE studio_mail_outbox SET state='skipped',lease_until=NULL WHERE id=$1",[job.id]); continue; }
      const when = new Date(party.starts_at).toLocaleString('en-US',{timeZone:party.time_zone,dateStyle:'full',timeStyle:'short'});
      const reminder = job.kind === 'reminder';
      const providerId = await provider.send({to:email,key:`ptc-account-mail-${job.id}`,subject: reminder ? `Your art party is coming up: ${party.title}` : `${party.host_name} invited you to ${party.title}`,text:`${reminder ? 'A little room for play is coming up.' : 'A connected friend invited you to an art party.'}\n\n${party.title}\nHosted by ${party.host_name}\n${when} (${party.time_zone})\n\nOpen your studio to view the invitation or RSVP:\n${origin}/account\n\nLive multiplayer is still in development.\n\nYou asked to receive ${reminder ? 'party reminders' : 'invitations from friends'}. Turn these off in your studio profile at ${origin}/account. No camera or microphone media is recorded.`});
      await db.query("UPDATE studio_mail_outbox SET state='sent',provider_id=$2,lease_until=NULL WHERE id=$1",[job.id,providerId]);
    } catch {
      // Never log addresses, provider response bodies or credentials.
      await db.query("UPDATE studio_mail_outbox SET state=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,due_at=now()+interval '5 minutes',lease_until=NULL WHERE id=$1",[job.id]);
    }
  }
}
export function configuredAccountMail(): () => void {
  const { ACCOUNT_EMAIL_ENABLED,RESEND_API_KEY,RESEND_FROM,CLERK_SECRET_KEY,DATABASE_URL,ACCOUNT_SITE_ORIGIN } = process.env;
  if (ACCOUNT_EMAIL_ENABLED!=='1' || !RESEND_API_KEY || !RESEND_FROM || !CLERK_SECRET_KEY || !DATABASE_URL || !ACCOUNT_SITE_ORIGIN) return () => {};
  const url = new URL(ACCOUNT_SITE_ORIGIN);
  if (url.protocol!=='https:' || url.origin!==ACCOUNT_SITE_ORIGIN || /[\r\n]/.test(RESEND_FROM)) throw new Error('Invalid account mail configuration');
  const pool = new pg.Pool({connectionString:DATABASE_URL,max:2,connectionTimeoutMillis:5000,query_timeout:5000});
  const clerk = createClerkClient({secretKey:CLERK_SECRET_KEY});
  const provider: MailProvider = {
    async verifiedEmail(user) {
      const account = await clerk.users.getUser(user);
      const email = account.emailAddresses.find(item=>item.id===account.primaryEmailAddressId && item.verification?.status==='verified');
      return email?.emailAddress ?? null;
    },
    async send(mail) {
      const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':mail.key},body:JSON.stringify({from:RESEND_FROM,to:[mail.to],subject:mail.subject,text:mail.text}),signal:AbortSignal.timeout(15000)});
      const value = await response.json() as {id?:string};
      if (!response.ok || !value.id) throw new Error('Mail provider unavailable');
      return value.id;
    }
  };
  let running = false; let stopped = false; let initialized = false;
  async function tick() {
    if (running || stopped) return;
    running=true;
    try { if (!initialized) { await initializeCommunitySchema(pool); initialized=true; } await queueAccountMail(pool); for (let index=0; index<10; index++) await deliverAccountMail(pool,provider,url.origin); }
    catch { console.error('[account-mail] Delivery unavailable; jobs remain in the database.'); }
    finally { running=false; }
  }
  const timer=setInterval(()=>void tick(),60000); timer.unref(); void tick();
  return () => { stopped=true; clearInterval(timer); void pool.end(); };
}
