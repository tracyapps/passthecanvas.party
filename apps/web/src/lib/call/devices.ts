// The camera, microphone and speakers someone picked in the device check.
// Device ids only mean something in this browser, so they're kept here
// (never on the server). Nothing is recorded.

export interface DeviceChoice {
  cameraId: string | null;
  micId: string | null;
  speakerId: string | null;
}
const KEY = 'ptc-devices-v1';

export function savedDevices(): DeviceChoice {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const id = (v: unknown) => (typeof v === 'string' && v.length < 300 ? v : null);
    return { cameraId: id(raw?.cameraId), micId: id(raw?.micId), speakerId: id(raw?.speakerId) };
  } catch {
    return { cameraId: null, micId: null, speakerId: null };
  }
}

export function saveDevices(choice: DeviceChoice): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
    return true;
  } catch {
    return false;
  }
}
