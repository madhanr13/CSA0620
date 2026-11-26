import '../styles/main.css';
import { loadCSV, csv, download } from '../lib/csv';
import { coverage } from '../lib/coverage';
import type { Dataset, Result } from '../lib/types';
import { mapView, escape } from '../components/map';
import { isDark, toggleTheme } from '../lib/theme';

const app = document.querySelector<HTMLDivElement>('#app')!;
let data: Dataset, masks: bigint[] = [], scale = 1, objective = 'cost', active: 'greedy'|'exact' = 'greedy';
let results: Partial<Record<'greedy'|'exact',Result>> = {}, worker: Worker | undefined, busy = false, showReach = true;
let tab = 'planner', source = 'Chennai demonstration', step = Infinity, message = '';
const money = (n: number) => '₹'+n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const icon = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 7h13l5 9-6 10H10L5 17" stroke="currentColor" stroke-width="2.5"/><path d="M5 8v9h9M21 21l-5-5 5-5" stroke="currentColor" stroke-width="2.5"/></svg>`;
async function sample() {
  stop();
  const [a,s] = await Promise.all(['/data/demand_areas.csv','/data/collection_sites.csv'].map(async p=>{const r=await fetch(p);if(!r.ok)throw new Error('Could not load sample dataset.');return r.text();}));
  data = { areas: loadCSV(a,'areas'), sites: loadCSV(s,'sites') }; scale=1; source='Chennai demonstration'; invalidate(); render();
}
function stop() { worker?.terminate(); worker=undefined; busy=false; }
function invalidate() { stop(); results={}; step=Infinity; masks=coverage(data,scale); message=''; }
function solve() {
  stop(); results={}; step=Infinity; busy=true; message='Running both algorithms…';
  worker = new Worker(new URL('../workers/solver.ts',import.meta.url),{type:'module'});
  worker.onmessage = ({data: payload}) => {
    if(payload.kind==='error') { message=payload.message; stop(); }
    else {
      results[payload.kind as 'greedy'|'exact']=payload.result;
      if(payload.kind==='exact') { stop(); message=payload.result.infeasible ? 'Uncovered areas remain. Increase the radius or add sites.' : payload.result.timedOut ? '4-second limit reached. Exact result is not proven optimal.' : 'Complete. Exact optimum verified.'; }
    }
    render();
  };
  worker.onerror=()=>{stop();message='Calculation failed. Try a smaller dataset or reload the page.';render();};
  worker.postMessage({masks,costs:data.sites.map(s=>objective==='cost'?s.cost:1),count:data.areas.length,limitMs:4000});
  render();
}
function render() {
  const result=results[active], selected=result ? result.selected.slice(0,step) : [];
  const covered=selected.reduce((m,i)=>m|masks[i],0n);
  const coveredAreas=data.areas.filter((_,i)=>Boolean(covered&(1n<<BigInt(i))));
  const kg=coveredAreas.reduce((sum,a)=>sum+a.kg,0), totalKg=data.areas.reduce((sum,a)=>sum+a.kg,0);
  const cost=selected.reduce((sum,i)=>sum+data.sites[i].cost,0);
  app.innerHTML=`
  <header class="topbar"><a class="brand" href="#" aria-label="Circuit home">${icon}<span>Circuit</span></a><span class="brand-description">E-waste planning</span><div class="header-actions"><a class="text-link" href="/data/README.md" target="_blank" rel="noopener">Data notes</a><button class="theme-toggle" id="theme-toggle" aria-label="Dark mode" aria-pressed="${isDark()}" title="${isDark()?'Switch to light mode':'Switch to dark mode'}"><svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5 8.5 8.5 0 1 0 20.5 13.2Z"/></svg><svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button></div></header>
  <div class="shell">
    <div class="heading"><div><h1>Collection planner</h1><p>Cover every area with fewer sites or lower cost.</p></div><button class="secondary export-button" id="export" ${!result?'disabled':''}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4"/></svg>Export CSV</button></div>
    <nav class="tabs" aria-label="Workspace"><button data-tab="planner" aria-current="${tab==='planner'?'page':'false'}" class="${tab==='planner'?'active':''}">Planner</button><button data-tab="dataset" aria-current="${tab==='dataset'?'page':'false'}" class="${tab==='dataset'?'active':''}">Data <span>${data.areas.length+data.sites.length}</span></button><button data-tab="method" aria-current="${tab==='method'?'page':'false'}" class="${tab==='method'?'active':''}">Method</button><div class="dataset-tag">${source==='Chennai demonstration'?'Chennai / Sample data':escape(source)}</div></nav>
    ${tab==='planner'?`
    <div class="workspace">
      <aside class="panel settings"><div class="panel-heading"><h2>Setup</h2></div>
        <div class="scenario"><strong>${source==='Chennai demonstration'?'Central Chennai': 'Custom dataset'}</strong><small>${data.areas.length} areas / ${data.sites.length} candidate sites</small></div>
        <div class="setting-section"><label class="field-label" for="objective">Objective</label><select id="objective"><option value="cost" ${objective==='cost'?'selected':''}>Minimum cost</option><option value="sites" ${objective==='sites'?'selected':''}>Minimum sites</option></select></div>
        <div class="setting-section"><div class="label-row"><label class="field-label" for="reach">Radius multiplier</label><output for="reach" id="reach-value">${scale.toFixed(2)}×</output></div><input id="reach" type="range" min=".5" max="1.8" step=".05" value="${scale}" aria-describedby="reach-note"/><div class="range-label"><span>0.5×</span><span>1.8×</span></div><p class="hint" id="reach-note">Scales each site's service radius.</p></div>
        <div class="run-controls"><button class="primary" id="run">${busy?'Cancel':'Run comparison'}</button><p class="config-foot">Greedy + exact set cover</p></div>
      </aside>
      <section class="panel map-panel"><div class="map-header"><div><h2>Coverage map</h2><p>${result?`${selected.length} selected sites / ${coveredAreas.length} areas covered`:'Run a comparison to view selected sites.'}</p></div><label class="toggle"><input id="show-reach" type="checkbox" ${showReach?'checked':''}/>Show radius</label></div>
        <div class="map-canvas">${mapView(data,masks,selected,scale,showReach)}</div>
        <div class="map-footer"><div class="legend"><span><i class="legend-demand"></i>Demand area</span><span><i class="legend-site"></i>Candidate site</span><span><i class="legend-selected"></i>Selected site</span></div><span>WGS84 · km</span></div>
      </section>
    </div>
    <div class="metrics"><div><span>Coverage</span><strong>${result?Math.round(coveredAreas.length/data.areas.length*100):'—'}<small>${result?'%':''}</small></strong><p>${coveredAreas.length} / ${data.areas.length} areas</p></div><div><span>Selected sites</span><strong>${result?selected.length:'—'}<small> / ${data.sites.length}</small></strong></div><div><span>Monthly cost</span><strong>${result?money(cost):'—'}</strong><p>INR / collection cycle</p></div><div><span>Covered demand</span><strong>${result?kg.toLocaleString('en-IN'):'—'}<small> kg</small></strong><p>Of ${totalKg.toLocaleString('en-IN')} kg in dataset</p></div></div>
    <section class="panel comparison"><div class="section-title"><div><h2>Results</h2><p>Select an algorithm to view its plan.</p></div><span class="subtle-chip">${objective==='cost'?'Minimum cost':'Minimum sites'}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Algorithm</th><th>Sites</th><th>Monthly cost</th><th>Runtime</th><th>Status</th></tr></thead><tbody>${(['greedy','exact'] as const).map(kind=>{const r=results[kind];return `<tr class="${active===kind?'chosen':''}"><td><label><input type="radio" name="algorithm" value="${kind}" ${active===kind?'checked':''}/><strong>${kind==='greedy'?'Greedy':'Exact'}</strong><span class="algorithm-detail">${kind==='greedy'?'Approximation':'Branch & bound'}</span></label></td><td>${r?r.selected.length:'—'}</td><td>${r?money(r.selected.reduce((sum,i)=>sum+data.sites[i].cost,0)):'—'}</td><td>${r?r.ms.toFixed(1)+' ms':'—'}</td><td><span class="status ${r?.infeasible?'warn':''}">${!r?(busy?'Running':'Not run'):r.infeasible?'Incomplete':r.optimal?'Optimal':r.timedOut?'Time limit':'Approximate'}</span></td></tr>`;}).join('')}</tbody></table></div>
      ${results.exact?.optimal && results.greedy?`<div class="result-summary">Greedy uses <strong>${results.exact.cost ? ((results.greedy.cost/results.exact.cost-1)*100).toFixed(1):'0'}% more ${objective==='cost'?'budget':'sites'}</strong> than the exact solution.</div>`:''}
      <div class="status-line" role="status" aria-live="polite">${escape(message)}</div>
    </section>
    ${result?`<section class="panel steps"><div class="section-title"><div><h2>${active==='greedy'?'Selection steps':'Selected sites'}</h2><p>${active==='greedy'?'Lowest cost per newly covered area at each step.':'Optimal set when verified; order shown is for display.'}${step!==Infinity?` Showing ${selected.length} of ${result.selected.length} sites.`:''}</p></div><div class="step-controls"><button class="secondary" id="next-step" ${step!==Infinity&&step>=result.selected.length?'disabled':''}>${step===Infinity?'Replay':'Next site'}</button><button class="text-button" id="all-steps">Show all</button></div></div><div class="step-list">${result.steps.map((s,i)=>`<div class="step-item ${i<selected.length?'visible-step':''}"><span class="step-index">${i+1}</span><div><strong>${escape(data.sites[s.site].name)}</strong><small>${s.added} new areas / ${money(data.sites[s.site].cost)}</small></div><span class="step-cost">${objective==='cost'?money(s.cost/Math.max(1,s.added)): (s.cost/Math.max(1,s.added)).toFixed(2)}<small> / area</small></span></div>`).join('')}</div></section>`:''}
    `:tab==='dataset'?datasetView():methodView()}
    <footer><span>Set cover / E-waste collection</span><a href="/data/README.md" target="_blank" rel="noopener">${source==='Chennai demonstration'?'Sample data':'Dataset notes'} / Straight-line coverage</a></footer>
  </div>`;
  bind();
}
function datasetView() {
  return `<section class="panel data-panel"><div class="section-title"><div><h2>Dataset</h2><p>Import areas and candidate sites. Coverage is calculated automatically.</p></div><button class="secondary" id="reset">Reset sample</button></div><div class="notice">The Chennai sample uses hypothetical sites, quantities, and costs. <a href="/data/README.md" target="_blank" rel="noopener">View assumptions</a></div><div class="data-actions"><label class="upload">Import areas<input id="areas-file" type="file" accept=".csv,text/csv"/></label><label class="upload">Import sites<input id="sites-file" type="file" accept=".csv,text/csv"/></label><button class="secondary" id="download-areas">Areas CSV</button><button class="secondary" id="download-sites">Sites CSV</button><button class="secondary" id="download-coverage">Coverage CSV</button></div><p class="hint">CSV / 1 MB max / 500 areas / 200 sites. Each import replaces its table.</p><p role="status" class="status-line">${escape(message)}</p><h3>Demand areas <span class="muted">${data.areas.length}</span></h3><div class="data-table table-wrap"><table><thead><tr><th>ID</th><th>Area</th><th>Latitude</th><th>Longitude</th><th>Demand (kg/month)</th></tr></thead><tbody>${data.areas.map(a=>`<tr><td>${escape(a.id)}</td><td>${escape(a.name)}</td><td>${a.lat}</td><td>${a.lon}</td><td>${a.kg}</td></tr>`).join('')}</tbody></table></div><h3>Candidate sites <span class="muted">${data.sites.length}</span></h3><div class="data-table table-wrap"><table><thead><tr><th>ID</th><th>Site</th><th>Latitude</th><th>Longitude</th><th>Radius (km)</th><th>Cost (INR/month)</th></tr></thead><tbody>${data.sites.map(s=>`<tr><td>${escape(s.id)}</td><td>${escape(s.name)}</td><td>${s.lat}</td><td>${s.lon}</td><td>${s.radius}</td><td>${money(s.cost)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function methodView() {
  return `<section class="panel method"><div class="section-title"><div><h2>How it works</h2><p>Choose collection sites so every demand area has a site within reach.</p></div></div><div class="method-grid"><article><span class="method-number">1</span><h3>Calculate coverage</h3><p>Each area is a point. A site covers it when the straight-line distance is within the site's radius.</p><code>distance(area, site) ≤ radius × multiplier</code></article><article><span class="method-number">2</span><h3>Choose sites</h3><p>Greedy picks the best cost per new area. Exact search checks alternatives to find the lowest total cost.</p><code>greedy score = cost ÷ new areas covered</code></article><article><span class="method-number">3</span><h3>Compare results</h3><p>Review coverage, cost, site count, and runtime. Select a result to see its sites on the map.</p><code>goal: cover all areas at minimum cost</code></article></div><div class="method-details"><details open><summary>Why set cover?</summary><p>The areas form a universe of elements. Each site's coverage is a subset. Selecting subsets that cover the universe is the set-cover problem. “Minimum sites” assigns every site a cost of 1; “Minimum cost” uses the CSV costs.</p></details><details><summary>Greedy vs. exact</summary><p>Greedy is fast but may choose more expensive sites overall. For feasible positive-cost instances, its approximation factor is at most Hₙ ≤ 1 + ln(n). Exact branch-and-bound proves an optimum only if its search finishes. After four seconds, the best result is returned as time-limited.</p></details><details><summary>Assumptions</summary><p>Distance uses the haversine formula, not roads. Covered demand is potential access, not measured collection. The model excludes capacity, routing, and schedules. Sample quantities and costs are illustrative.</p></details></div></section>`;
}
function on(id:string,fn:()=>void) { document.getElementById(id)?.addEventListener('click',fn); }
function bind() {
  on('theme-toggle',toggleTheme);
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab!;render();});
  on('run',()=>{if(busy){stop();message='Calculation cancelled. Any completed greedy result is retained.';render();}else solve();});
  on('reset',()=>void sample().catch(fail));
  document.getElementById('objective')?.addEventListener('change',e=>{objective=(e.target as HTMLSelectElement).value;invalidate();render();});
  document.getElementById('reach')?.addEventListener('change',e=>{scale=Number((e.target as HTMLInputElement).value);invalidate();render();});
  document.getElementById('reach')?.addEventListener('input',e=>{document.getElementById('reach-value')!.textContent=Number((e.target as HTMLInputElement).value).toFixed(2)+'×';});
  document.getElementById('show-reach')?.addEventListener('change',e=>{showReach=(e.target as HTMLInputElement).checked;render();});
  document.querySelectorAll<HTMLInputElement>('input[name="algorithm"]').forEach(r=>r.onchange=()=>{active=r.value as typeof active;step=Infinity;render();});
  on('next-step',()=>{step=step===Infinity?1:Math.min(step+1,results[active]!.selected.length);render();});
  on('all-steps',()=>{step=Infinity;render();});
  on('download-areas',()=>download('demand_areas.csv',csv([['id','name','lat','lon','kg'],...data.areas.map(a=>[a.id,a.name,a.lat,a.lon,a.kg])])));
  on('download-sites',()=>download('collection_sites.csv',csv([['id','name','lat','lon','radius','cost'],...data.sites.map(s=>[s.id,s.name,s.lat,s.lon,s.radius,s.cost])])));
  on('download-coverage',()=>download('coverage.csv',csv([['site_id','area_id','reach_multiplier'],...data.sites.flatMap((s,j)=>data.areas.flatMap((a,i)=>masks[j]&(1n<<BigInt(i))?[[s.id,a.id,scale]]:[]))])));
  on('export',()=>{
    const r=results[active];if(!r)return;
    download('collection_plan.csv',csv([['site_id','site_name','monthly_cost_inr','radius_km','algorithm','objective','optimal','infeasible','reach_multiplier'],...r.selected.map(i=>{const s=data.sites[i];return [s.id,s.name,s.cost,s.radius,active,objective,String(r.optimal),String(r.infeasible),scale];})]));
  });
  for(const kind of ['areas','sites'] as const) document.getElementById(`${kind}-file`)?.addEventListener('change',async e=>{
    const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;
    try {
      if(file.size>1_000_000)throw new Error('CSV exceeds 1 MB. Use a smaller file.');
      const text=await file.text();
      if(kind==='areas') data.areas=loadCSV(text,'areas');else data.sites=loadCSV(text,'sites');
      source='Custom dataset';invalidate();message=`Imported ${kind} from ${file.name}. Review both tables before solving.`;render();
    } catch(e){fail(e);}
  });
}
function fail(e: unknown) { message=e instanceof Error?e.message:'Something went wrong.';if(data)render();else app.innerHTML=`<main class="load-error"><h1>Unable to load the planner</h1><p>${escape(message)}</p><button onclick="location.reload()">Try again</button></main>`; }
app.innerHTML='<main class="load-error"><h1>Preparing your planning workspace…</h1></main>';
void sample().catch(fail);
