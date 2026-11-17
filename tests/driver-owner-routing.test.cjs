const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../acces-proprietaire.html'),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('async function resolveAndOpen(session)'));
assert.ok(script,'owner access script exists');

function simulation(query,ownerRows,saved){
  const elements={};
  const el=id=>{
    if(!elements[id])elements[id]={
      textContent:'',disabled:false,value:'',
      classList:{toggle(){},remove(){}}
    };
    return elements[id];
  };
  const redirects=[],storage=new Map();
  if(saved)storage.set('digiy_driver_owner_slug',saved);
  const queryCalls=[];
  const queryApi={
    select(value){queryCalls.push(['select',value]);return this;},
    eq(field,value){queryCalls.push(['eq',field,value]);return this;},
    order(){return Promise.resolve({data:ownerRows,error:null})}
  };
  const db={
    from(table){queryCalls.push(['from',table]);return queryApi;},
    auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})}
  };
  const sandbox={
    document:{getElementById:el},URLSearchParams,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    location:{search:query,origin:'https://driver.digiylyfe.com',
      pathname:'/acces-proprietaire.html',replace:u=>redirects.push(u)},
    supabase:{createClient(){return db}},
    setTimeout(){throw new Error('No timers should run during simulation');},
  };
  sandbox.window=sandbox;
  // Export only the pure owner-resolution path. No network requests or live authentication.
  const safe=script.replace('openIfSession();','window.__resolveOwnerForTest=resolveAndOpen;');
  assert.notEqual(safe,script);
  vm.runInNewContext(safe,sandbox,{timeout:3000});
  return {
    run:()=>sandbox.__resolveOwnerForTest({user:{id:'signed-in-owner-id'}}),
    redirects,el,storage,queryCalls
  };
}
test('Lamine URL must never open Baptiste cockpit',async()=>{
  const sim=simulation('?slug=lamine-driver-saly',[
    {slug:'baptiste-driver-ambassador',display_name:'Baptiste'}
  ],'baptiste-driver-ambassador');
  await sim.run();
  assert.deepEqual(sim.redirects,[]);
  assert.match(sim.el('status').textContent,/n.est pas propriétaire/);
  assert.equal(sim.storage.get('digiy_driver_owner_slug'),'baptiste-driver-ambassador');
  assert.deepEqual(
    sim.queryCalls.filter(c=>c[0]==='eq').map(c=>c.slice(1)),
    [['owner_id','signed-in-owner-id'],['is_active',true]]
  );
});
test('Lamine URL opens only Lamine when owner list contains that slug',async()=>{
  const sim=simulation('?slug=lamine-driver-saly',[
    {slug:'baptiste-driver-ambassador'},
    {slug:'lamine-driver-saly',display_name:'Lamine'}
  ]);
  await sim.run();
  assert.equal(sim.redirects.length,1);
  assert.match(sim.redirects[0],/gestion\.html\?slug=lamine-driver-saly/);
  assert.equal(sim.storage.get('digiy_driver_owner_slug'),'lamine-driver-saly');
});
test('No slug and multiple profiles cannot silently select first one',async()=>{
  const sim=simulation('',[{slug:'lamine-driver-saly'},{slug:'baptiste-driver-ambassador'}]);
  await sim.run();
  assert.deepEqual(sim.redirects,[]);
  assert.match(sim.el('status').textContent,/Plusieurs chauffeurs/);
});
test('Legacy access without slug still works for a single profile',async()=>{
  const sim=simulation('',[{slug:'lamine-driver-saly'}]);
  await sim.run();
  assert.equal(sim.redirects.length,1);
  assert.match(sim.redirects[0],/slug=lamine-driver-saly/);
});
test('Invalid chauffeur slug is rejected without fallback',async()=>{
  const sim=simulation('?slug=%2E%2E%2Fother',[{slug:'lamine-driver-saly'}]);
  await sim.run();
  assert.deepEqual(sim.redirects,[]);
  assert.match(sim.el('status').textContent,/Lien chauffeur invalide/);
});
