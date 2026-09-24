/* Real-browser regression suite. Run: node tests/verify-routing.cjs NEW_BUILD.html [BASELINE.html]
   Requires Playwright on NODE_PATH (or RIGPOWER_PLAYWRIGHT) and installed Chrome. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.RIGPOWER_PLAYWRIGHT||'playwright');
const fs=require('node:fs');
const baselineName='RIGPOWER_2026-09-21_204144.html';
const target=process.argv[2], baseline=process.argv[3]||(fs.existsSync(baselineName)?baselineName:path.join('_to_delete',baselineName));
if(!target)throw Error('Supply the new HTML build');
const failures=[];let checks=0;
function check(name,fn){try{fn();checks++;console.log('PASS '+name);}catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name+': '+e.message);}}
async function setup(page){return page.evaluate(()=>{
  window.pt=(x,y=0,z=10)=>({x:x*304.8,y:y*304.8,z:z*304.8});
  window.fx=(id,x,y=0,z=10,pos='LX1')=>({id,type:'Test',pos,...pt(x,y,z),universe:1,address:1,assigned:{positionId:'p1',multiId:'m1',circuitIndex:0}});
  window.resetRig=()=>{state={fixtures:[],positions:[],instances:[fx('a',10),fx('b',20),fx('c',30)],devices:[{id:'d1',kind:'distro',name:'Distro',placed:true,...pt(0)}],paths:[]};_posAxisCache=null;};
  window.route=(id,points,carries='both',kind='run',pos='LX1')=>({id,name:id,kind,carries,pts:points,pos,text:'',locked:false});
  resetRig();
});}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.RIGPOWER_BROWSER||'chrome'});
 try{
  const old=await browser.newPage(),page=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await old.goto(pathToFileURL(path.resolve(baseline)).href);await setup(old);
  const before=await old.evaluate(()=>computeAutoCable());await old.close();
  await page.goto(pathToFileURL(path.resolve(target)).href);await setup(page);
  const fresh=await page.evaluate(()=>({rep:computeAutoCable(),inited:PLOT.inited,three:THREE.REVISION}));
  check('fresh-page compute before plot initialized, real Three r128',()=>{assert.equal(fresh.inited,false);assert.equal(fresh.three,'128');assert.equal(fresh.rep.segments.length,6);});
  const core=r=>JSON.parse(JSON.stringify(r,(k,v)=>['routing','routed','fallbackReason','routePoints','routeLegs','hasSwag','breakIndex','breakCount','sourceFamily','routeFamily','pos'].includes(k)?undefined:v));
  check('no-path cable lengths, ordering and stock match 6A',()=>{
   const pick=r=>r.segments.map(s=>({kind:s.kind,aId:s.aId,bId:s.bId,raw:s.raw,std:s.std,pieces:s.pieces,ai:s.ai,bi:s.bi,chainLen:s.chainLen}));assert.deepEqual(pick(fresh.rep),pick(before));assert.deepEqual(fresh.rep.jumperParts,before.jumperParts);assert.deepEqual(fresh.rep.dataParts,before.dataParts);
  });
  let r=await page.evaluate(()=>{state.paths=[route('bend',[pt(0),pt(0,10),pt(10,10),pt(10),pt(20),pt(30)])];return computeAutoCable();});
  check('bend follows 30ft path, not 10ft chord',()=>{const h=r.segments.find(s=>s.kind==='homerun-power');assert.equal(h.routed,true);assert.ok(Math.abs(h.raw-30)<1e-7);assert.ok(h.routePoints.length>=4);assert.equal(h.bId,'a');});
  check('path legs retain fixture chain indexes',()=>{assert.equal(r.segments.length,6);for(const s of r.segments.filter(s=>s.kind==='power')){assert.equal(s.bi,s.ai+1);assert.equal(s.chainLen,3);}});
  r=await page.evaluate(()=>{state.paths=[route('reverse',[pt(0),pt(0,10),pt(30,10),pt(30),pt(20),pt(10)])];return computeAutoCable();});
  check('path feed overrides Euclidean feed and uses same homerun',()=>{const h=r.segments.find(s=>s.kind==='homerun-power');assert.equal(h.bId,'c');assert.ok(Math.abs(h.raw-50)<1e-7);assert.deepEqual(r.segments.filter(s=>s.kind==='power').map(s=>s.bId),['b','a']);});
  r=await page.evaluate(()=>{state.paths=[route('power-route',[pt(0),pt(10),pt(20),pt(30)],'power'),route('data-route',[pt(0),pt(0,10),pt(30,10),pt(30),pt(20),pt(10)],'data')];return computeAutoCable();});
  check('typed power/data paths independently choose feed',()=>{assert.equal(r.segments.find(s=>s.kind==='homerun-power').bId,'a');assert.equal(r.segments.find(s=>s.kind==='homerun-data').bId,'c');assert.ok(r.segments.every(s=>s.routed));});
  r=await page.evaluate(()=>{state.paths=[route('first',[pt(0),pt(10),pt(20)]),route('join',[pt(20),pt(30)]),route('break',[pt(15)],'both','brk')];return computeAutoCable();});
  check('junctions connect and breaks force physical terminations',()=>{const pieces=r.segments.filter(s=>s.kind==='power'&&s.ai===0);assert.equal(pieces.length,2);assert.ok(pieces.every(s=>s.bi===1&&s.chainLen===3&&s.breakCount===2));assert.ok(Math.abs(pieces.reduce((n,s)=>n+s.raw,0)-10)<1e-7);});
  r=await page.evaluate(()=>{state.paths=[route('first',[pt(0),pt(10)]),{...route('swag',[pt(10),pt(20)],'both','swag'),sag:.25},route('last',[pt(20),pt(30)])];return computeAutoCable();});
  check('swag arc contributes to cable order',()=>{const s=r.segments.find(s=>s.kind==='power'&&s.ai===0);assert.equal(s.hasSwag,true);assert.ok(s.raw>10);assert.ok(s.routePoints.length>3);assert.ok(s.routePoints.every(p=>p.z>=0));assert.ok(s.std>=s.raw);});
  await page.evaluate(()=>{document.querySelector('[data-view="plot"]').click();PLOT.cable.power=true;PLOT.cable.data=true;PLOT.cable.homerun=true;PLOT.cable.ends=true;buildCables();});
  const render=await page.evaluate(()=>({mesh:PLOT.cableMeshes.length,tubes:PLOT.cableMeshes.filter(m=>!m.userData.marker).map(m=>({fam:m.userData.fam,kind:m.userData.cable.kind,hasSwag:m.userData.cable.hasSwag,label:m.userData.label,geometry:m.geometry.type})),floor:Math.min(...PLOT.cableMeshes.filter(m=>!m.userData.marker).flatMap(m=>Array.from(m.geometry.attributes.position.array).filter((v,i)=>i%3===1)))}));
  check('real Three renders routed tubes and explicitly labels swag',()=>{assert.ok(render.mesh>6);assert.ok(render.tubes.some(m=>m.hasSwag&&/swag/i.test(m.label)));assert.ok(render.floor>=-0.02);assert.ok(render.tubes.every(m=>m.geometry==='TubeGeometry'));});
  const iso=await page.evaluate(()=>{PLOT.selectedSet=new Set(['a']);PLOT.isolate=true;applyIsolate();return PLOT.cableMeshes.map(m=>({visible:m.visible,expected:!!(PLOT.selectedSet.has(m.userData.cable.aId)||PLOT.selectedSet.has(m.userData.cable.bId))}));});
  check('isolate follows fixture endpoints including route legs and markers',()=>{assert.ok(iso.some(m=>!m.visible));assert.ok(iso.every(m=>m.visible===m.expected));});
  r=await page.evaluate(()=>{PLOT.isolate=false;resetRig();state.paths=[route('island',[pt(10),pt(20),pt(30)])];renderAutoCable();renderPlot();return {rep:computeAutoCable(),stats:document.querySelector('#autoCableStats').textContent,meshes:PLOT.meshes.map(m=>({id:m.userData.id,color:m.material.color.getHex(),emissive:m.material.emissive.getHex()}))};});
  check('disconnected paths visibly fall back with reason',()=>{assert.ok(r.rep.segments.every(s=>!s.routed&&s.fallbackReason));assert.ok(r.rep.routing.fallbackPositions.length);assert.match(r.stats,/fallback|unrouted/i);});
  check('fallback fixtures receive visible tint',()=>assert.ok(r.meshes.every(m=>m.emissive!==0)));
  const tint=await page.evaluate(()=>{PLOT.selectedSet=new Set();state.paths=[route('connected',[pt(0),pt(10),pt(20),pt(30)])];buildCables();return PLOT.meshes.map(m=>m.material.emissive.getHex());});
  check('restoring connected path clears fallback tint',()=>assert.ok(tint.every(c=>c===0)));
  r=await page.evaluate(()=>{resetRig();state.instances=[fx('a',20),fx('b',25),fx('c',30)];Object.assign(state.devices[0],pt(20,5));state.paths=[route('trunk',[pt(10),pt(30)]),route('spur',[pt(20),pt(20,5)])];return computeAutoCable();});
  check('vertex on middle of another leg forms T junction',()=>{assert.ok(r.segments.every(s=>s.routed));assert.ok(Math.abs(r.segments.find(s=>s.kind==='homerun-power').raw-5)<1e-7);});
  r=await page.evaluate(()=>{resetRig();state.paths=[route('bad',[pt(0),{x:NaN,y:0,z:3048},pt(30)])];return computeAutoCable();});
  check('malformed path never creates shortcut',()=>assert.ok(r.segments.every(s=>!s.routed)));
  r=await page.evaluate(()=>{resetRig();state.instances=[fx('a',10),fx('b',20,10),fx('c',20,-10)];state.paths=[route('trunk',[pt(0),pt(10),pt(20)]),route('branches',[pt(20,10),pt(20),pt(20,-10)])];return computeAutoCable();});
  check('branched fixture traversal falls back with explicit reason',()=>{assert.ok(r.segments.every(s=>!s.routed));assert.match(r.routing.fallbackPositions[0].reason,/branch|return/i);});
  const marker=await page.evaluate(()=>{resetRig();state.paths=[route('bend',[pt(0),pt(0,10),pt(10,10),pt(10),pt(20),pt(30)])];renderPlot();const cones=PLOT.cableMeshes.filter(m=>m.geometry.type==='ConeGeometry');return cones.map(m=>{const p=m.userData.cable.routePoints;const expected=plotVec(p[p.length-1]).sub(plotVec(p[p.length-2])).normalize();return new THREE.Vector3(0,1,0).applyQuaternion(m.quaternion).dot(expected);});});
  check('destination cones follow final leg tangent at bends',()=>{assert.ok(marker.length);assert.ok(marker.every(d=>d>.999));});
  const mutation=await page.evaluate(()=>{
   renderPaths();PLOT.activePath='bend';renderPathPoints();
   const before=computeAutoCable().segments.find(s=>s.kind==='homerun-power').raw;
   const inp=document.querySelectorAll('#pathPtsBody .qy')[1];inp.value='15';inp.dispatchEvent(new Event('input',{bubbles:true}));
   const after=PLOT.cableMeshes.find(m=>m.userData.cable.kind==='homerun-power').userData.cable.raw;
   const car=document.querySelector('#pathsBody .pcar');car.value='power';car.dispatchEvent(new Event('change',{bubbles:true}));
   const data=PLOT.cableMeshes.find(m=>m.userData.cable.kind==='data').userData.cable;
   const pos=document.querySelector('#pathsBody .ppos');pos.value='';pos.dispatchEvent(new Event('change',{bubbles:true}));
   PLOT._move={path:state.paths[0],index:1};endMoveDrag();
   return {before,after,dataFallback:!!data.fallbackReason,pos:state.paths[0].pos};
  });
  check('numeric point edit immediately refreshes rendered routing',()=>assert.ok(mutation.after>mutation.before));
  check('carries edit immediately updates data fallback',()=>assert.equal(mutation.dataFallback,true));
  check('cleared serves remains shared after point move',()=>assert.equal(mutation.pos,''));
  const homebreak=await page.evaluate(()=>{resetRig();state.paths=[route('all',[pt(0),pt(10),pt(20),pt(30)]),route('break',[pt(5)],'both','brk')];renderPaths();const breakRow=document.querySelector('[data-pid=break] .pk');if(breakRow.value!=='brk')throw Error('real Break UI kind is not brk');breakRow.dispatchEvent(new Event('change',{bubbles:true}));renderPlot();const rep=computeAutoCable();return {homes:rep.segments.filter(s=>s.kind.startsWith('homerun')),origins:PLOT.cableMeshes.filter(m=>m.geometry.type==='OctahedronGeometry').length};});
  check('home-run breaks split geometry without duplicate origin markers',()=>{assert.equal(homebreak.homes.length,4);assert.equal(homebreak.origins,2);assert.ok(homebreak.homes.every(s=>s.ai===-1&&s.bi===0));});
  const floor=await page.evaluate(()=>{resetRig();state.paths=[route('first',[pt(0),pt(10)]),{...route('deep',[pt(10),pt(20)],'both','swag'),sag:100},route('last',[pt(20),pt(30)])];renderPlot();return {floor:PLOT.xform.minZ,min:Math.min(...routePathPoints(state.paths[1]).map(p=>p.z)),length:pathLengthFt(state.paths[1]),mesh:PLOT.cableMeshes.filter(m=>!m.userData.marker&&m.userData.cable.hasSwag).length};});
  check('elevated-only rig uses physical deck for deep swag clamp',()=>{assert.equal(floor.floor,0);assert.ok(floor.min>=-1e-7);assert.ok(floor.length>10);assert.ok(floor.mesh>2);});
  const perf=await page.evaluate(()=>{resetRig();state.instances=[];state.paths=[];for(let row=0;row<3;row++){let pos='LX'+row;for(let i=0;i<30;i++)state.instances.push({...fx(row+'-'+i,10+i*4,row*30,10,pos),assigned:{positionId:pos,multiId:'m',circuitIndex:Math.floor(i/10)}});state.paths.push(route('lead'+row,[pt(0),pt(0,row*30),pt(10,row*30)],'both','run',pos));for(let i=0;i<29;i++)state.paths.push(route('link'+row+'-'+i,[pt(10+i*4,row*30),pt(14+i*4,row*30)],'both',i%10===4?'swag':'run',pos));}const start=performance.now();const rep=computeAutoCable();const computeMs=performance.now()-start;const rs=performance.now();renderPlot();return {computeMs,renderMs:performance.now()-rs,segments:rep.segments.length,routed:rep.routing.routedPositions.length,meshes:PLOT.cableMeshes.length};});
  console.log('PERFORMANCE '+JSON.stringify(perf));
  check('90-fixture nine-swag rig fully routes within interactive budget',()=>{assert.equal(perf.routed,6);assert.ok(perf.computeMs<3000);assert.ok(perf.renderMs<5000);});

  check('no page exceptions throughout browser integration',()=>assert.deepEqual(errors,[]));
  console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
