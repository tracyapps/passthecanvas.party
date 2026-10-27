// Mints a short-lived LiveKit token so a guest can join the party's video room.
import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';

export async function makeLiveKitToken(partyId: string, displayName: string): Promise<string> {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) throw new Error('LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing in .env');

  const token = new AccessToken(key, secret, {
    identity: randomUUID(),
    name: displayName,
    ttl: '6h' // a long party, but not forever
  });
  token.addGrant({ roomJoin: true, room: partyId, canPublish: true, canSubscribe: true });
  return token.toJwt();
}
