// Station search through the Radio Browser directory (radio-browser.info).
// Only the host's browser searches. Nothing is relayed: each guest's own
// browser plays the station's stream after they press Listen.

export interface Station {
  id: string;
  name: string;
  streamUrl: string; // always https
  tags: string[];
  country: string;
  codec: string;
  bitrate: number;
}

// Radio Browser runs several mirrors; try them in order until one answers.
export const MIRRORS = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];

/** Shortcut searches for the radio panel. */
export const MOODS = ['lofi', 'jazz', 'classical', 'indie', 'soul', 'ambient'];

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Search by name, or by tag when `byTag` is set. Returns at most 20 playable https stations. */
export async function searchStations(query: string, byTag = false, fetcher: Fetcher = fetch): Promise<Station[]> {
  const text = query.trim().slice(0, 60);
  if (!text) return [];
  const params = new URLSearchParams({
    [byTag ? 'tag' : 'name']: text,
    hidebroken: 'true',
    is_https: 'true',
    order: 'clickcount',
    reverse: 'true',
    limit: '40'
  });
  let lastError: unknown = null;
  for (const mirror of MIRRORS) {
    try {
      const response = await fetcher(`${mirror}/json/stations/search?${params}`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`Radio Browser answered ${response.status}`);
      return toStations(await response.json());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The radio directory could not be reached.');
}

/** Keep only stations a browser can play safely: https stream, a name, no duplicates. */
export function toStations(raw: unknown): Station[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const stations: Station[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    const streamUrl = String(item.url_resolved || item.url || '');
    const name = String(item.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name || !/^https:\/\//.test(streamUrl) || seen.has(streamUrl)) continue;
    seen.add(streamUrl);
    stations.push({
      id: String(item.stationuuid ?? streamUrl),
      name,
      streamUrl,
      tags: String(item.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 4),
      country: String(item.country ?? ''),
      codec: String(item.codec ?? ''),
      bitrate: Number(item.bitrate) || 0
    });
    if (stations.length >= 20) break;
  }
  return stations;
}
