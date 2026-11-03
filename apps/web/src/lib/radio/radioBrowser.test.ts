import { describe, expect, it } from 'vitest';
import { searchStations, toStations } from './radioBrowser';

const raw = [
  { stationuuid: 'a', name: '  Smooth   Jazz ', url_resolved: 'https://a.example/stream', tags: 'jazz,smooth,sax,piano,cool', country: 'Spain', codec: 'AAC', bitrate: 64 },
  { stationuuid: 'b', name: 'Plain http', url_resolved: 'http://b.example/stream' },
  { stationuuid: 'c', name: 'Duplicate', url_resolved: 'https://a.example/stream' },
  { stationuuid: 'd', name: '', url_resolved: 'https://d.example/stream' }
];

describe('radio directory', () => {
  it('keeps only named, unique https stations', () => {
    const stations = toStations(raw);
    expect(stations).toHaveLength(1);
    expect(stations[0]).toMatchObject({ name: 'Smooth Jazz', streamUrl: 'https://a.example/stream', tags: ['jazz', 'smooth', 'sax', 'piano'] });
    expect(toStations({ not: 'a list' })).toEqual([]);
  });

  it('falls through to the next mirror when one fails', async () => {
    const asked: string[] = [];
    const fetcher = async (url: string) => {
      asked.push(new URL(url).host);
      if (asked.length === 1) throw new Error('down');
      return new Response(JSON.stringify(raw));
    };
    const stations = await searchStations('jazz', true, fetcher);
    expect(asked).toHaveLength(2);
    expect(stations[0]!.name).toBe('Smooth Jazz');
  });

  it('does not search for nothing', async () => {
    expect(await searchStations('   ')).toEqual([]);
  });
});
