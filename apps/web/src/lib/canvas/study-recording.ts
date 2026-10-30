import type { PaintingSelection } from './painting-selection';
import type { StrokePoint } from '@ptc/shared';
export interface RecordedStamp {
  at: number;
  owner: string;
  contribution: number;
  selection: PaintingSelection;
  size: number;
  intensity: number;
  point: StrokePoint;
  angle: number;
  index: number;
}
export interface StudyRecording {
  format: 'ptc-study-stamps'; version: 1; renderer: 'study-tips-2026-10-29';
  width: number; height: number; truncated: boolean;
  contributions: { id: number; owner: string }[];
  stamps: RecordedStamp[];
}
export function newRecording(width: number, height: number): StudyRecording {
  return { format: 'ptc-study-stamps', version: 1, renderer: 'study-tips-2026-10-29', width, height, truncated: false, contributions: [], stamps: [] };
}
export function recordStamp(recording: StudyRecording, stamp: RecordedStamp): void {
  if (recording.stamps.length >= 50000) { recording.truncated = true; return; }
  // Copy emitted settings and points, including stationary spray. UI rotation,
  // pan and window size never enter the artwork coordinates in the journal.
  recording.stamps.push(structuredClone(stamp));
}
