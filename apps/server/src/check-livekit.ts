// A read-only setup check. Never print credentials, tokens or room details.
import { RoomServiceClient } from 'livekit-server-sdk';

const url = process.env.LIVEKIT_URL?.trim();
const key = process.env.LIVEKIT_API_KEY?.trim();
const secret = process.env.LIVEKIT_API_SECRET?.trim();

async function checkLiveKit() {
  if (!url || !key || !secret || url.includes('YOUR-PROJECT')) {
    console.error('LiveKit setup is incomplete. Fill LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in apps/server/.env. See docs/PHASE-1-TEST.md.');
    process.exitCode = 1;
    return;
  }

  let endpoint: URL;
  try {
    endpoint = new URL(url);
    if (endpoint.protocol !== 'wss:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
      throw new Error('Expected a secure project WebSocket URL.');
    }
  } catch {
    console.error('LIVEKIT_URL must be the project WebSocket URL: wss://your-project.livekit.cloud, with no path, credentials or query.');
    process.exitCode = 1;
    return;
  }

  // The management API uses HTTPS; browsers connect to the same host with WSS.
  endpoint.protocol = 'https:';
  const client = new RoomServiceClient(endpoint.origin, key, secret, { requestTimeout: 10, failover: false });
  try {
    await client.listRooms();
    console.log('LiveKit accepted the project credentials. No rooms or media were created.');
    console.log('Next: run the browser checklist in docs/PHASE-1-TEST.md. Camera, microphone and shared painting are not verified by this command.');
  } catch {
    // Provider errors can contain connection details, so keep this message fixed.
    console.error('LiveKit could not verify the credentials. Check that all three values belong to the same project, and check your internet connection.');
    process.exitCode = 1;
  }
}

await checkLiveKit();
