import type { Dataset } from '../lib/types';
export const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function mapView(data: Dataset, masks: bigint[], selected: number[], scale: number, showReach: boolean) {
  const all = [...data.areas, ...data.sites];
  const minLat = Math.min(...all.map(a=>a.lat))-.013, maxLat = Math.max(...all.map(a=>a.lat))+.013;
  const midLat = (minLat+maxLat)/2, aspect = Math.cos(midLat*Math.PI/180);
  const minLon = Math.min(...all.map(a=>a.lon))-.012, maxLon = Math.max(...all.map(a=>a.lon))+.012;
  const unit = Math.min(760/((maxLon-minLon)*aspect), 470/(maxLat-minLat));
  const x = (lon: number) => 40+(760-(maxLon-minLon)*aspect*unit)/2+(lon-minLon)*aspect*unit;
  const y = (lat: number) => 30+(470-(maxLat-minLat)*unit)/2+(maxLat-lat)*unit;
  const covered = selected.reduce((m,i)=>m|masks[i],0n);
  const circles = data.sites.map((s,i)=>showReach && selected.includes(i) ? `<circle cx="${x(s.lon)}" cy="${y(s.lat)}" r="${s.radius*scale/111.195*unit}" class="reach"/>` : '').join('');
  const lines = data.areas.map((a,i) => {
    const site = selected.find(j => (masks[j] & (1n<<BigInt(i))) !== 0n);
    return site === undefined ? '' : `<path class="connection" d="M${x(a.lon)},${y(a.lat)} L${x(data.sites[site].lon)},${y(data.sites[site].lat)}"/>`;
  }).join('');
  return `<svg viewBox="0 0 840 530" role="img" aria-label="Schematic geographic coverage diagram, not a street map. ${selected.length} selected collection sites.">
    <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#d7e1dc" stroke-width=".6"/></pattern></defs>
    <rect width="840" height="530" fill="#eef3ef"/><rect width="840" height="530" fill="url(#grid)"/>
    ${circles}${lines}
    ${data.areas.map((a,i)=>`<g><title>${escape(a.name)} · ${a.kg} kg · ${covered & (1n<<BigInt(i)) ? 'Covered':'Uncovered'}</title><circle cx="${x(a.lon)}" cy="${y(a.lat)}" r="5" class="demand ${covered & (1n<<BigInt(i)) ? 'covered':''}"/>${data.areas.length <= 40 ? `<text x="${x(a.lon)+10}" y="${y(a.lat)-9}" class="map-label">${escape(a.name)}</text>`:''}</g>`).join('')}
    ${data.sites.map((s,i)=>`<g><title>${escape(s.name)} · ₹${s.cost.toLocaleString('en-IN')} · ${selected.includes(i)?'Selected':'Candidate'}</title><rect x="${x(s.lon)-9}" y="${y(s.lat)-9}" width="18" height="18" rx="4" class="site ${selected.includes(i)?'selected':''}"/><text x="${x(s.lon)}" y="${y(s.lat)+3.5}" class="site-number">${i+1}</text></g>`).join('')}
    <g transform="translate(800 30)"><path d="M0 28V0M-5 7L0 0L5 7" stroke="#60776c" fill="none"/><text y="43" text-anchor="middle" class="map-label">N</text></g>
    <g transform="translate(30 500)"><path d="M0 -4V0H${unit/111.195}V-4" stroke="#60776c" fill="none"/><text y="-10" class="map-label">1 km</text></g>
  </svg>`;
}
