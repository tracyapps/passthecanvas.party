// The party server with fake sockets: reconnecting, linked devices and who
// may paint. No network; timers are faked so grace periods pass instantly.
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerMessage } from '@ptc/shared';
import { getParty } from './party.ts';

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  inbox: ServerMessage[] = [];
  send(data: string) {
    this.inbox.push(JSON.parse(data));
  }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.emit('close');
  }
  say(msg: object) {
    this.emit('message', Buffer.from(JSON.stringify(msg)));
  }
  last<T extends ServerMessage['type']>(type: T) {
    return [...this.inbox].reverse().find((m) => m.type === type) as Extract<ServerMessage, { type: T }> | undefined;
  }
}

let n = 0;
function newParty() {
  n += 1;
  return getParty(`test-party-${n}`);
}
function connect(party: ReturnType<typeof getParty>) {
  const ws = new FakeSocket();
  party.connect(ws as never, '127.0.0.1');
  return ws;
}
function joinAs(party: ReturnType<typeof getParty>, name: string) {
  const ws = connect(party);
  ws.say({ type: 'join', name, presence: 'avatar', device: 'Mac' });
  return ws;
}
const stroke = (canvasId: string, id = 's1') => ({ id, canvasId, tool: 'pencil', load: { medium: 'pencil', name: 'HB', colors: ['#333333'] }, wet: false, size: 4, intensity: 0.5, first: 0, stamps: [{ x: 10, y: 10, pressure: 0.5, angle: 0 }], done: true });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('reconnecting', () => {
  it('keeps the seat through a dropped connection and a rejoin', () => {
    const party = newParty();
    const ann = joinAs(party, 'Ann');
    const bob = joinAs(party, 'Bob');
    const welcome = ann.last('welcome')!;
    ann.close();
    vi.advanceTimersByTime(10_000);
    expect(bob.last('state')!.state.members.find((m) => m.id === welcome.youId)?.away).toBe(false);

    const back = connect(party);
    back.say({ type: 'rejoin', memberId: welcome.youId, deviceId: welcome.session.deviceId, key: welcome.session.key });
    expect(back.last('welcome')!.youId).toBe(welcome.youId);
    expect(back.last('devices')!.devices[0]).toMatchObject({ canvas: true, call: true, online: true });
  });

  it('marks an artist away after the grace period, then lets them leave', () => {
    const party = newParty();
    const ann = joinAs(party, 'Ann');
    const bob = joinAs(party, 'Bob');
    const id = ann.last('welcome')!.youId;
    ann.close();
    vi.advanceTimersByTime(46_000);
    const member = bob.last('state')!.state.members.find((m) => m.id === id);
    expect(member?.away).toBe(true);
    expect(member?.isHost).toBe(false);
    expect(bob.last('state')!.state.members.find((m) => m.name === 'Bob')?.isHost).toBe(true);
    vi.advanceTimersByTime(121_000);
    expect(bob.last('state')!.state.members.some((m) => m.id === id)).toBe(false);
  });

  it('refuses a wrong key', () => {
    const party = newParty();
    const ann = joinAs(party, 'Ann');
    const welcome = ann.last('welcome')!;
    const intruder = connect(party);
    intruder.say({ type: 'rejoin', memberId: welcome.youId, deviceId: welcome.session.deviceId, key: 'guess' });
    expect(intruder.last('rejected')?.reason).toBe('rejoin');
    expect(intruder.last('welcome')).toBeUndefined();
  });

  it('a second tab with the same seat replaces the first, which is told why', () => {
    const party = newParty();
    const ann = joinAs(party, 'Ann');
    const welcome = ann.last('welcome')!;
    const tab = connect(party);
    tab.say({ type: 'rejoin', memberId: welcome.youId, deviceId: welcome.session.deviceId, key: welcome.session.key });
    expect(ann.last('rejected')?.reason).toBe('rejoin');
    expect(ann.readyState).toBe(3);
    expect(tab.last('welcome')!.youId).toBe(welcome.youId);
  });

  it('leaving on purpose removes you at once', () => {
    const party = newParty();
    const ann = joinAs(party, 'Ann');
    const bob = joinAs(party, 'Bob');
    ann.say({ type: 'leave' });
    expect(bob.last('state')!.state.members.map((m) => m.name)).toEqual(['Bob']);
  });
});

describe('linked devices', () => {
  function linked(role: 'canvas' | 'room') {
    const party = newParty();
    const laptop = joinAs(party, 'Ann');
    const bob = joinAs(party, 'Bob');
    laptop.say({ type: 'makeLink', role });
    const code = laptop.last('linkCode')!.link!.code;
    const second = connect(party);
    second.say({ type: 'redeemLink', code, device: 'iPad' });
    return { party, laptop, bob, second, code };
  }

  it('a code joins the same artist, and works only once', () => {
    const { party, laptop, second, code } = linked('canvas');
    expect(second.last('welcome')!.youId).toBe(laptop.last('welcome')!.youId);
    expect(laptop.last('linkCode')!.link).toBeNull();
    const again = connect(party);
    again.say({ type: 'redeemLink', code });
    expect(again.last('rejected')?.reason).toBe('link');
    expect(second.last('state')!.state.members.length).toBe(2);
  });

  it('canvas role: the tablet paints, the laptop keeps the call', () => {
    const { laptop, second } = linked('canvas');
    const devices = second.last('devices')!;
    const mine = devices.devices.find((d) => d.id === devices.youDeviceId)!;
    expect(mine).toMatchObject({ label: 'iPad', canvas: true, call: false });
    expect(devices.devices.find((d) => d.id !== devices.youDeviceId)).toMatchObject({ canvas: false, call: true });
    void laptop;
  });

  it('only the canvas device paints; the other device mirrors it', () => {
    const { laptop, bob, second } = linked('canvas');
    laptop.say({ type: 'start' });
    const state = laptop.last('state')!.state;
    const mine = state.assignments[laptop.last('welcome')!.youId]!;
    const bobCanvas = state.assignments[bob.last('welcome')!.youId]!;
    laptop.inbox = [];
    second.inbox = [];
    bob.say({ type: 'watch', canvasId: mine });
    laptop.say({ type: 'stroke', stroke: stroke(mine, 'from-laptop') });
    expect(bob.last('stroke')).toBeUndefined();
    second.say({ type: 'stroke', stroke: stroke(mine, 'from-ipad') });
    expect(laptop.last('stroke')?.stroke.id).toBe('from-ipad');
    expect(second.last('stroke')).toBeUndefined();
    void bobCanvas;
  });

  it('pass from the laptop asks the tablet to finish and pass', () => {
    const { laptop, second } = linked('canvas');
    laptop.say({ type: 'start' });
    laptop.say({ type: 'passNow' });
    expect(second.last('passRequest')).toBeDefined();
    expect(laptop.last('state')!.state.passed).toEqual([]);
    second.say({ type: 'passNow' });
    expect(laptop.last('state')!.state.passed).toEqual([laptop.last('welcome')!.youId]);
  });

  it('room role moves the call; duties can move back by hand', () => {
    const { laptop, second } = linked('room');
    expect(second.last('devices')!.devices.find((d) => d.id === second.last('devices')!.youDeviceId)).toMatchObject({ canvas: false, call: true });
    laptop.say({ type: 'takeDuty', duty: 'call' });
    expect(second.last('devices')!.devices.find((d) => d.id === second.last('devices')!.youDeviceId)).toMatchObject({ call: false });
  });

  it('when a device stays gone, its duty moves to one that is here', () => {
    const { laptop, second } = linked('canvas');
    second.close();
    vi.advanceTimersByTime(46_000);
    const devices = laptop.last('devices')!;
    expect(devices.devices.find((d) => d.id === devices.youDeviceId)).toMatchObject({ canvas: true, call: true });
  });

  it('unlinking a device closes it and its key stops working', () => {
    const { party, laptop, second } = linked('canvas');
    const welcome = second.last('welcome')!;
    const ipadId = welcome.session.deviceId;
    laptop.say({ type: 'unlinkDevice', deviceId: ipadId });
    expect(second.readyState).toBe(3);
    const again = connect(party);
    again.say({ type: 'rejoin', memberId: welcome.youId, deviceId: ipadId, key: welcome.session.key });
    expect(again.last('rejected')).toBeDefined();
  });
});
