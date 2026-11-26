import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exact, greedy } from '../src/algorithms/set-cover';
import { loadCSV, parseCSV } from '../src/lib/csv';
import { coverage, distance } from '../src/lib/coverage';
test('exact solver matches exhaustive optimum across deterministic weighted instances', () => {
  let seed=12345;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  for(let k=0;k<100;k++){
    const count=6, masks=Array.from({length:9},()=>BigInt(Math.floor(random()*64))),costs=masks.map(()=>1+Math.floor(random()*20));
    let optimum=Infinity;
    for(let subset=0;subset<512;subset++){
      let covered=0n,cost=0;
      for(let i=0;i<9;i++)if(subset&(1<<i)){covered|=masks[i];cost+=costs[i];}
      if(covered===63n)optimum=Math.min(optimum,cost);
    }
    const result=exact({masks,costs,count});
    if(optimum===Infinity)assert.equal(result.infeasible,true);
    else {assert.equal(result.cost,optimum);assert.equal(result.optimal,true);assert.equal(result.covered,count);}
  }
});
test('greedy selects minimum cost per new element and reports uncovered elements',()=>{
  const r=greedy({masks:[3n,6n,8n],costs:[2,4,1],count:5});
  assert.deepEqual(r.selected,[0,2,1]);assert.equal(r.covered,4);assert.equal(r.infeasible,true);
});
test('CSV quoting, BOM, duplicate IDs and invalid numeric values',()=>{
  assert.deepEqual(parseCSV('\uFEFFid,name\r\n1,"A, B"\r\n'),[['id','name'],['1','A, B']]);
  assert.throws(()=>loadCSV('id,name,lat,lon,kg\n1,A,91,80,5','areas'),/coordinates/);
  assert.throws(()=>loadCSV('id,name,lat,lon,kg\n1,A,13,80,5\n1,B,13,80,5','areas'),/Duplicate/);
  assert.throws(()=>loadCSV('id,name,lat,lon,radius,cost\n1,A,13,80,2,0','sites'),/positive/);
});
test('haversine and service radius produce correct coverage',()=>{
  assert.equal(distance({lat:13,lon:80},{lat:13,lon:80}),0);
  assert.ok(Math.abs(distance({lat:0,lon:0},{lat:0,lon:1})-111.195)<.01);
  assert.deepEqual(coverage({areas:[{id:'a',name:'A',lat:0,lon:0,kg:1},{id:'b',name:'B',lat:0,lon:1,kg:1}],sites:[{id:'s',name:'S',lat:0,lon:0,radius:1,cost:1}]}),[1n]);
});
