import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Call } from './call.svelte';
import { RoomEvent } from 'livekit-client';

interface TestRoom {
  disconnect: ReturnType<typeof vi.fn>;
  events: Map<string, () => void>;
  localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn>; setCameraEnabled: ReturnType<typeof vi.fn> };
}
const control = vi.hoisted(() => ({
  rooms: [] as TestRoom[],
  connect: () => Promise.resolve(),
  microphone: () => Promise.resolve(),
}));
vi.mock('livekit-client', async (original) => {
  const library = await original<typeof import('livekit-client')>();
  return { ...library, Room: class {
    remoteParticipants = new Map();
    events = new Map<string, () => void>();
    localParticipant = {
      identity: 'artist', getTrackPublication: () => undefined,
      setMicrophoneEnabled: vi.fn(() => control.microphone()),
      setCameraEnabled: vi.fn(async () => {}),
    };
    connect = vi.fn(() => control.connect());
    disconnect = vi.fn();
    on(event: string, callback: () => void) { this.events.set(event, callback); }
    constructor() { control.rooms.push(this); }
  } };
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tokenResponse = () => new Response(JSON.stringify({ token: 'test-token', url: 'wss://test.invalid' }));
beforeEach(() => {
  // The class's state fields are plain values here; these tests exercise async ownership.
  vi.stubGlobal('$state', <T>(value: T) => value);
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('fetch', vi.fn(async () => tokenResponse()));
  control.rooms.length = 0;
  control.connect = async () => {};
  control.microphone = async () => {};
});
afterEach(() => vi.unstubAllGlobals());

it('does not connect when camera/mic ownership moves during the token request', async () => {
  const token = deferred<Response>();
  vi.stubGlobal('fetch', () => token.promise);
  const call = new Call();
  const joining = call.join('party', 'Artist', 'artist', 'camera');
  call.leave();
  token.resolve(tokenResponse());
  await joining;
  expect(call.status).toBe('off');
  expect(control.rooms).toHaveLength(0);
});

it('does not publish after ownership moves during connection', async () => {
  const connection = deferred<void>();
  control.connect = () => connection.promise;
  const call = new Call();
  const joining = call.join('party', 'Artist', 'artist', 'camera');
  await vi.waitFor(() => expect(control.rooms).toHaveLength(1));
  call.leave();
  connection.resolve();
  await joining;
  expect(call.status).toBe('off');
  expect(control.rooms[0].localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  expect(control.rooms[0].localParticipant.setCameraEnabled).not.toHaveBeenCalled();
});

it('does not enable a camera after ownership moves while the microphone is starting', async () => {
  const mic = deferred<void>();
  control.microphone = () => mic.promise;
  const call = new Call();
  const joining = call.join('party', 'Artist', 'artist', 'camera');
  await vi.waitFor(() => expect(control.rooms[0]?.localParticipant.setMicrophoneEnabled).toHaveBeenCalled());
  call.leave();
  mic.resolve();
  await joining;
  expect(call.status).toBe('off');
  expect(control.rooms[0].localParticipant.setCameraEnabled).not.toHaveBeenCalled();
});

it('ignores an old connection failure and old disconnect events after a new join', async () => {
  const old = deferred<void>();
  control.connect = () => old.promise;
  const call = new Call();
  const joining = call.join('party', 'Artist', 'artist', 'avatar');
  await vi.waitFor(() => expect(control.rooms).toHaveLength(1));
  call.leave();
  control.connect = async () => {};
  await call.join('party', 'Artist', 'artist', 'avatar');
  expect(call.status).toBe('in-call');
  old.reject(new Error('old connection stopped'));
  await joining;
  control.rooms[0].events.get(RoomEvent.Disconnected)?.();
  expect(call.status).toBe('in-call');
  expect(control.rooms[1].disconnect).not.toHaveBeenCalled();
});

it('does not turn on the old camera when a presence change outlives a handoff', async () => {
  const call = new Call();
  await call.join('party', 'Artist', 'artist', 'avatar');
  const mic = deferred<void>();
  control.microphone = () => mic.promise;
  const changing = call.setPresence('camera');
  call.leave();
  mic.resolve();
  await changing;
  expect(call.status).toBe('off');
  expect(control.rooms[0].localParticipant.setCameraEnabled).not.toHaveBeenCalled();
});
