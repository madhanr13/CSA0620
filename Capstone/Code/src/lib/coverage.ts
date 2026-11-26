import type { Dataset } from './types';
export function distance(a: {lat:number;lon:number}, b: {lat:number;lon:number}) {
  const rad = Math.PI / 180, dLat = (b.lat-a.lat)*rad, dLon = (b.lon-a.lon)*rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0,1-h)));
}
export function coverage(data: Dataset, scale = 1) {
  return data.sites.map(site => data.areas.reduce((mask, area, i) => distance(site, area) <= site.radius * scale ? mask | (1n << BigInt(i)) : mask, 0n));
}
