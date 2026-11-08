// The video/audio call. LiveKit carries the media; this class is the thin
// glue the UI talks to. Nothing is ever recorded — publishing is camera and
// microphone only, and only when the guest chose "camera" presence.

import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication
} from 'livekit-client';
import type { Presence } from '@ptc/shared';
import { partyUrl } from '../party/origin';
import { savedDevices } from './devices';

/** Where the call is at, in plain words for the UI. */
export type CallStatus = 'off' | 'connecting' | 'in-call' | 'unavailable' | 'error';

/** One guest's video, as the UI needs it. track is null when the camera is off. */
export interface GuestVideo {
  identity: string; // the party member id (we pass it when minting the token)
  name: string;
  track: MediaStreamTrack | null;
  speaking: boolean;
}

export class Call {
  status = $state<CallStatus>('off');
  /** One short human sentence when something needs explaining. */
  note = $state('');
  micOn = $state(true);
  camOn = $state(true);
  /** Our own camera track, for the tile and the 360° room marker. */
  localVideo = $state<MediaStreamTrack | null>(null);
  videos = $state<GuestVideo[]>([]);

  /**
   * Save data: other guests' video is not downloaded (their avatar or
   * initials show instead); voices still play. Remembered in this browser.
   */
  saveData = $state(readSaveData());
  /** LiveKit thinks our connection is struggling (a hint to turn on Save data). */
  weakConnection = $state(false);

  private room: Room | null = null;
  /** Leaving or handing video away invalidates every unfinished join. */
  private generation = 0;
  private speaking = new Set<string>();
  /** Save data was switched on for a weak connection this call (only once). */
  private autoSaved = false;

  /**
   * Join the party's video room. Fails softly: if the server has no LiveKit
   * keys yet (or the browser blocks the camera), the party still works —
   * painting and chat never depended on video.
   */
  async join(partyId: string, name: string, identity: string, presence: Presence) {
    if (this.status === 'connecting' || this.status === 'in-call') return;
    const generation = ++this.generation;
    this.status = 'connecting';
    this.note = '';

    // 1. Ask the party server for a short-lived token.
    let token: string;
    let url: string | null;
    try {
      const params = new URLSearchParams({ party: partyId, name, identity });
      const response = await fetch(partyUrl(`/api/token?${params}`));
      if (generation !== this.generation) return;
      if (response.status === 503) {
        this.status = 'unavailable';
        this.note = 'Video is not set up on the server yet.';
        return;
      }
      if (!response.ok) throw new Error(`token endpoint said ${response.status}`);
      ({ token, url } = await response.json());
    } catch {
      if (generation !== this.generation) return;
      this.status = 'error';
      this.note = 'Could not reach the video server.';
      return;
    }
    if (generation !== this.generation) return;
    if (!url) {
      this.status = 'unavailable';
      this.note = 'Video is not set up on the server yet.';
      return;
    }

    // 2. Connect, then publish mic + camera (avatar guests join quietly).
    let room: Room | null = null;
    try {
      // The camera, mic and speakers chosen in the device check, if any.
      const devices = savedDevices();
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        ...(devices.cameraId ? { videoCaptureDefaults: { deviceId: devices.cameraId } } : {}),
        ...(devices.micId ? { audioCaptureDefaults: { deviceId: devices.micId } } : {}),
        ...(devices.speakerId ? { audioOutput: { deviceId: devices.speakerId } } : {})
      });
      this.room = room;
      this.listenToRoom(room);
      await room.connect(url, token);
      if (generation !== this.generation) { void room.disconnect(); return; }
      this.applySaveData();

      if (presence === 'camera') {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (generation !== this.generation) { void room.disconnect(); return; }
        await room.localParticipant.setCameraEnabled(true);
        if (generation !== this.generation) { void room.disconnect(); return; }
      } else {
        this.micOn = false;
        this.camOn = false;
      }
      this.refreshLocalVideo();
      this.refreshVideos();
      this.status = 'in-call';
    } catch (error) {
      if (generation !== this.generation) { void room?.disconnect(); return; }
      console.warn('[call]', error);
      this.status = 'error';
      this.note = 'Could not join video. Check camera and microphone permissions.';
      this.room = null;
      void room?.disconnect();
    }
  }

  /** Swap camera ↔ avatar mid-party. Coming on camera turns the mic on too; going to avatar leaves the mic as it was. */
  async setPresence(presence: Presence) {
    const room = this.room;
    if (!room) return;
    try {
      const camera = presence === 'camera';
      if (camera && !this.micOn) {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (this.room !== room) { void room.disconnect(); return; }
        this.micOn = true;
      }
      await room.localParticipant.setCameraEnabled(camera);
      if (this.room !== room) { void room.disconnect(); return; }
      this.camOn = camera;
      this.refreshLocalVideo();
    } catch {
      if (this.room === room) this.note = 'Camera or microphone could not be changed. Check their permissions.';
    }
  }

  async toggleMic() {
    const room = this.room;
    if (!room) return;
    try {
      const on = !this.micOn;
      await room.localParticipant.setMicrophoneEnabled(on);
      if (this.room !== room) { void room.disconnect(); return; }
      this.micOn = on;
    } catch {
      if (this.room === room) this.note = 'Microphone could not be changed. Check its permission.';
    }
  }

  async toggleCam() {
    const room = this.room;
    if (!room) return;
    try {
      const on = !this.camOn;
      await room.localParticipant.setCameraEnabled(on);
      if (this.room !== room) { void room.disconnect(); return; }
      this.camOn = on;
      this.refreshLocalVideo();
    } catch {
      if (this.room === room) this.note = 'Camera could not be changed. Check its permission.';
    }
  }

  /** Turn Save data on or off: (un)subscribe from everyone's camera. */
  setSaveData(on: boolean) {
    this.saveData = on;
    this.note = "";
    try {
      localStorage.setItem(SAVE_DATA_KEY, on ? '1' : '0');
    } catch {
      // No storage: it just won't be remembered.
    }
    this.applySaveData();
    this.refreshVideos();
  }

  private applySaveData() {
    if (!this.room) return;
    for (const participant of this.room.remoteParticipants.values()) {
      const camera = participant.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
      camera?.setSubscribed(!this.saveData);
    }
  }

  leave() {
    this.generation += 1;
    const room = this.room;
    this.room = null;
    void room?.disconnect();
    this.status = 'off';
    this.videos = [];
    this.localVideo = null;
    this.micOn = true;
    this.camOn = true;
    this.weakConnection = false;
    this.autoSaved = false;
  }

  // ---------- internals ----------

  private listenToRoom(room: Room) {
    // One refresh after every event keeps this simple; parties are small.
    const refresh = () => {
      if (this.room !== room) return;
      this.refreshVideos();
      this.refreshLocalVideo();
    };
    room.on(RoomEvent.ParticipantConnected, refresh);
    room.on(RoomEvent.ParticipantDisconnected, refresh);
    room.on(RoomEvent.TrackSubscribed, refresh);
    room.on(RoomEvent.TrackUnsubscribed, refresh);
    room.on(RoomEvent.TrackMuted, refresh);
    room.on(RoomEvent.TrackUnmuted, refresh);
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      if (this.room !== room) return;
      this.speaking = new Set(speakers.map((s) => s.identity));
      this.refreshVideos();
    });
    // New cameras follow Save data too.
    room.on(RoomEvent.TrackPublished, (publication) => {
      if (this.room !== room) return;
      if (publication.source === Track.Source.Camera && this.saveData) publication.setSubscribed(false);
    });
    // A weak connection drops guests' video once, automatically, so voices
    // stay clear (see ACCESSIBILITY.md). Turning Save data off again wins:
    // we don't switch it back on during this call.
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (this.room !== room) return;
      if (participant.identity !== room.localParticipant.identity) return;
      this.weakConnection = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost;
      if (this.weakConnection && !this.saveData && !this.autoSaved) {
        this.autoSaved = true;
        this.saveData = true;
        this.applySaveData();
        this.refreshVideos();
        this.note = "Weak connection: guests' video is paused so voices stay clear. Turn Save data off to bring it back.";
      }
    });
    room.on(RoomEvent.Disconnected, () => {
      if (this.room === room && this.status === 'in-call') this.leave();
    });
  }

  private refreshVideos() {
    if (!this.room) return;
    const entries: GuestVideo[] = [];
    for (const participant of this.room.remoteParticipants.values()) {
      entries.push({
        identity: participant.identity,
        name: participant.name || participant.identity,
        track: cameraTrackOf(participant),
        speaking: this.speaking.has(participant.identity)
      });
    }
    this.videos = entries;
  }

  private refreshLocalVideo() {
    if (!this.room) return;
    const publication = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
    // LiveKit wraps tracks; the browser-facing MediaStreamTrack is what <video> wants.
    this.localVideo = publication?.videoTrack?.mediaStreamTrack ?? null;
  }
}

const SAVE_DATA_KEY = 'ptc-save-data';
/** Save data starts on when the browser asks for it (Data Saver), or when chosen before. */
function readSaveData(): boolean {
  try {
    const saved = localStorage.getItem(SAVE_DATA_KEY);
    if (saved !== null) return saved === '1';
  } catch {
    // fall through
  }
  return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
}

/** The participant's camera track, or null when it's off or not subscribed. */
function cameraTrackOf(participant: RemoteParticipant): MediaStreamTrack | null {
  const publication = participant.getTrackPublication(Track.Source.Camera) as
    | RemoteTrackPublication
    | undefined;
  if (!publication || !publication.isSubscribed || publication.isMuted) return null;
  return publication.videoTrack?.mediaStreamTrack ?? null;
}

/** Point a <video> element at a track. Pass null to clear it. */
export function attachTrack(el: HTMLVideoElement, track: MediaStreamTrack | null) {
  // A fresh MediaStream per element lets two elements share one track
  // (the dock tile and the 360° room marker both show your camera).
  el.srcObject = track ? new MediaStream([track]) : null;
  if (track) void el.play().catch(() => {}); // autoplay can refuse before a user gesture; that's fine
}
