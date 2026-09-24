/* Stock tables (C/D), home-run origins by device kind, breakouts, measured multis and
   measured data home runs (I). Sept 23, 2026. Usage: node tests/verify-stock-origins.cjs <build.html>
   Requires Playwright on NODE_PATH (or RIGPOWER_PLAYWRIGHT) and installed Chrome. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');const {chromium}=require(process.env.RIGPOWER_PLAYWRIGHT||'playwright');
let checks=0;const failures=[];function check(n,f){try{f();checks++;console.log('PASS '+n)}catch(e){failures.push(n+': '+e.message);console.error('FAIL '+n+': '+e.message)}}
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.RIGPOWER_BROWSER||'chrome'});
try{const p=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
await p.goto(pathToFileURL(path.resolve(process.argv[2])).href);await p.waitForFunction(()=>typeof THREE!=='undefined');
await p.evaluate(()=>{
  window.FT=304.8; const pt=(x,y,z)=>({x:x*FT,y:y*FT,z:z*FT});
  window.mkRig=()=>{
    state={fixtures:[{name:'Spot',watts:500,count:8,footprint:10,mode:''}],positions:[{id:'p1',name:'LX1',tag:'',multis:[makeMulti('SOCA')]}],instances:[],devices:[],paths:[]};
    const m=state.positions[0].multis[0]; m.id='m1'; m.breakout=SOCA_BREAKOUTS[0]; m.homerun=100; m.dmx=100; m.eth=75;
    for(let i=0;i<8;i++){ const it={id:'f'+i,fid:i+1,name:'S'+i,type:'Spot',pos:'LX1',...pt(i*3.3,0,20),universe:1,address:1+i*10};
      state.instances.push(it); it.assigned={positionId:'p1',multiId:'m1',circuitIndex:i<4?0:1}; adjustCircuitCount(it,1); }
    state.devices=[{id:'dD',kind:'distro',name:'Distro',placed:true,outputs:6,voltage:208,...pt(0,-30,0)},
                   {id:'dN',kind:'node',name:'Node',placed:true,inputs:2,outputs:4,...pt(30,-30,0)}];
    _posAxisCache=null;
  };
  window.parts=o=>Object.keys(o);
  window.dsum=o=>Object.values(o).reduce((a,b)=>a+b,0);
});
// ---- C/D stock ----
let r=await p.evaluate(()=>{mkRig();return {def:{...stockLengths},rep:computeAutoCable()};});
check('defaults: DMX/Ethernet gain 15, Power = old JUMPER_STD',()=>{assert.deepEqual(r.def.DMX,[5,10,15,25,50,100]);assert.deepEqual(r.def.Ethernet,[5,10,15,25,50,100]);assert.deepEqual(r.def.Power,[5,10,15,25,50,100]);});
r=await p.evaluate(()=>{mkRig();stockLengths.Power=[10,50];stockLengths.DMX=[25];const a=computeAutoCable({jumperType:'PowerCon',dataType:'DMX'});stockLengths.Ethernet=[7];const b=computeAutoCable({dataType:'Cat5e'});stockLengths.Power=[5,10,15,25,50,100];stockLengths.DMX=[5,10,15,25,50,100];stockLengths.Ethernet=[5,10,15,25,50,100];return {jp:parts(a.jumperParts),dp:parts(a.dataParts),ep:parts(b.dataParts),sizesAfter:typeof _jumperSizes==='undefined'?'undef':_jumperSizes};});
check('power jumpers come only from the Power table (C)',()=>{assert.ok(r.jp.length);assert.ok(r.jp.every(k=>/^PowerCon\|(10|50)$/.test(k)),r.jp.join());});
check('DMX jumpers come from the DMX table (C/D)',()=>{assert.ok(r.dp.length);assert.ok(r.dp.every(k=>k==='DMX|25'),r.dp.join());});
check('Cat5e pulls the Ethernet table (D)',()=>{assert.ok(r.ep.length);assert.ok(r.ep.every(k=>k==='Cat5e|7'),r.ep.join());});
check('stock override is reset after the run',()=>assert.equal(r.sizesAfter,null));
// ---- origins by kind ----
r=await p.evaluate(()=>{mkRig();const rep=computeAutoCable();const hp=rep.segments.filter(s=>s.kind==='homerun-power'),hd=rep.segments.filter(s=>s.kind==='homerun-data');
  return {hpA:hp.map(s=>s.a.id),hdA:hd.map(s=>s.a.id),notes:rep.originNotes,jn:dsum(rep.jumperParts),multi:rep.segments.filter(s=>s.kind==='homerun-multi').length};});
check('data home runs start at the node, not the distro',()=>{assert.ok(r.hdA.length);assert.ok(r.hdA.every(i=>i==='dN'),r.hdA.join());});
check('no breakout: power runs fall back to the distro, flagged, tails uncounted',()=>{assert.ok(r.hpA.every(i=>i==='dD'));assert.ok(r.notes.some(t=>/LX1 · SOCAPex #1: no breakout placed/.test(t)),r.notes.join('|'));assert.equal(r.multi,0);});
const jnNoBo=r.jn;
r=await p.evaluate(()=>{mkRig();state.devices.push({id:'dB',kind:'breakout',name:'BO',multiId:'m1',placed:true,x:-3*FT,y:0,z:20*FT});
  const rep=computeAutoCable();const hp=rep.segments.filter(s=>s.kind==='homerun-power');const tail=hp.reduce((a,s)=>a+(s.pieces||[s.std]).length,0);
  const mr=rep.multiRuns.get('m1');return {hpA:hp.map(s=>s.a.id),jn:dsum(rep.jumperParts),tail,notes:rep.originNotes,mr:{ft:mr.ft,routed:mr.routed,target:mr.target,total:mr.build.total,distro:mr.distro.id},
    straight:dist3(state.devices[0],state.devices[2])/FT, slack:slackTarget(dist3(state.devices[0],state.devices[2])/FT),multiSeg:rep.segments.filter(s=>s.kind==='homerun-multi').length};});
check('breakout placed: power runs start at the breakout',()=>{assert.ok(r.hpA.length);assert.ok(r.hpA.every(i=>i==='dB'));assert.ok(!r.notes.some(t=>/no breakout/.test(t)));});
check('breakout tails are tallied as power jumpers (I)',()=>assert.equal(r.jn,jnNoBo+r.tail,`${jnNoBo}+${r.tail} vs ${r.jn}`));
check('multi measured distro→breakout, straight line without a path',()=>{assert.equal(r.mr.distro,'dD');assert.equal(r.mr.routed,false);assert.ok(Math.abs(r.mr.ft-r.straight)<1e-9);assert.equal(r.mr.target,Math.ceil(r.slack-1e-9));assert.ok(r.mr.total>=r.mr.target);assert.equal(r.multiSeg,1);});
r=await p.evaluate(()=>{mkRig();state.devices.push({id:'dB',kind:'breakout',name:'BO',multiId:'m1',placed:true,x:-3*FT,y:0,z:20*FT});
  state.paths=[{id:'pp',name:'feed',kind:'run',carries:'power',pos:'',pts:[{x:0,y:-30*FT,z:0},{x:0,y:-30*FT,z:20*FT},{x:-3*FT,y:0,z:20*FT}]}];
  const mr=computeAutoCable().multiRuns.get('m1');return {ft:mr.ft,routed:mr.routed,exp:(20+Math.hypot(3,30))};});
check('multi measured along a connecting power path',()=>{assert.equal(r.routed,true);assert.ok(Math.abs(r.ft-r.exp)<1e-6,`${r.ft} vs ${r.exp}`);});
// ---- Cables tab ----
await p.evaluate(()=>{mkRig();state.devices.push({id:'dB',kind:'breakout',name:'BO',multiId:'m1',placed:true,x:-3*FT,y:0,z:20*FT});});
await p.click('.tab[data-view="cables"]');await p.waitForTimeout(200);
let t=await p.evaluate(()=>({row:$('#cablesBody').innerText,parts:$('#partTotals').textContent,mr:measureMultiRuns().get('m1')}));
check('Cables tab shows measured multi and ignores typed 100′',()=>{assert.match(t.row,/measured/);assert.ok(!/100′/.test(t.row.split('\n')[0]||''));});
check('Cables parts: SOCA from measured target; typed DMX dropped, typed Ethernet kept (DMX selected)',()=>{assert.ok(!/DMX/.test(t.parts),t.parts);assert.match(t.parts,/Ethernet/);assert.match(t.row,/DMX measured:/);});
await p.click('.tab[data-view="autocable"]');await p.selectOption('#dataType','Cat5e');await p.click('.tab[data-view="cables"]');await p.waitForTimeout(200);
t=await p.evaluate(()=>({row:$('#cablesBody').innerText,parts:$('#partTotals').textContent}));
check('Cat5e selected: typed Ethernet dropped, typed DMX counted',()=>{assert.ok(!/Ethernet/.test(t.parts),t.parts);assert.match(t.parts,/DMX/);assert.match(t.row,/ENet measured:/);});
await p.click('.tab[data-view="autocable"]');await p.selectOption('#dataType','DMX');
// ---- CSV ----
const dl=p.waitForEvent('download');await p.click('#btnExport');const csv=fs.readFileSync(await (await dl).path(),'utf8');
check('CSV: measured multi, measured DMX column, Auto-Cable parts section',()=>{assert.match(csv,/\(measured\)/);assert.match(csv,/,measured,/);assert.match(csv,/AUTO-CABLE PARTS/);assert.match(csv,/True1\|?,?\d+|True1,\d+,\d+/);});
// ---- Devices tab UI ----
await p.click('.tab[data-view="devices"]');await p.click('[data-dev="breakout"]');await p.waitForTimeout(100);
const n=await p.evaluate(()=>state.devices.length);const panel=p.locator('#devicesList .panel').nth(n-1);
await panel.locator('.d-multi').selectOption('m1');await panel.locator('.d-x').fill('5');
t=await p.evaluate(()=>{const d=state.devices[state.devices.length-1];return {kind:d.kind,multiId:d.multiId,placed:d.placed,label:$$('#devicesList .panel')[state.devices.length-1].textContent};});
check('Devices tab: add Breakout, link multi, place',()=>{assert.equal(t.kind,'breakout');assert.equal(t.multiId,'m1');assert.equal(t.placed,true);assert.match(t.label,/Breakout/);assert.match(t.label,/Feeds multi/);});
await p.evaluate(()=>{state.devices.pop();});
// ---- 3D ----
await p.click('.tab[data-view="plot"]');await p.waitForTimeout(400);
await p.evaluate(()=>{PLOT.cable.homerun=true;syncCableButtons();buildCables();});
t=await p.evaluate(()=>({labels:[...new Set(PLOT.cableMeshes.map(m=>m.userData.label))],dev:PLOT.deviceMeshes.length}));
check('3D: multi drawn in home-run layer, breakout mesh present',()=>{assert.ok(t.labels.includes('Multi (distro to breakout)'),t.labels.join('|'));assert.equal(t.dev,3);});
// ---- Save / Load ----
await p.evaluate(()=>{stockLengths.Power=[10,25,50];});
const sv=p.waitForEvent('download');await p.click('#btnSaveProj');const J=JSON.parse(fs.readFileSync(await (await sv).path(),'utf8'));
check('save carries breakout + Power stock',()=>{assert.ok(J.devices.some(d=>d.kind==='breakout'&&d.multiId==='m1'));assert.deepEqual(J._stock.Power,[10,25,50]);});
const old=JSON.parse(JSON.stringify(J));delete old._stock.Power;old._stock.DMX=[5,10,25,50,100];
await p.evaluate(()=>{stockLengths.Power=[5,10,15,25,50,100];});
const ch=p.waitForEvent('filechooser');await p.click('#btnLoadProj');await (await ch).setFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await p.waitForTimeout(300);
t=await p.evaluate(()=>({st:{...stockLengths},rep:computeAutoCable()}));
check('older project: its own DMX stock kept, Power default filled',()=>{assert.deepEqual(t.st.DMX,[5,10,25,50,100]);assert.deepEqual(t.st.Power,[5,10,15,25,50,100]);assert.ok(t.rep.segments.length>5);});
check('no page errors',()=>assert.deepEqual(errors,[]));
console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
