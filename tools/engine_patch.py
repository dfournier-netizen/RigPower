from pathlib import Path
import sys
ENGINE = r'''// Chunk 6B: graph coordinates and lengths are rig millimetres, independent of Plot.
const ROUTE_JOIN_MM=1, ROUTE_ATTACH_MM=304.8;
function routePoint(p){return {x:+p.x,y:+p.y,z:+p.z};}
function routeValid(p){return p&&['x','y','z'].every(k=>Number.isFinite(p[k]));}
function routePathPoints(pa){
  if(!(pa.pts||[]).every(routeValid))return []; // malformed paths must never gain a shortcut
  const pts=(pa.pts||[]).map(routePoint);
  if(pa.kind!=='swag'||pts.length<2)return pts;
  const a=pts[0],b=pts[1],s=Number.isFinite(pa.sag)?Math.max(0,pa.sag)*304.8:dist3(a,b)*SWAG_SAG;
  const h=Math.min(2*s,Math.pow(Math.sqrt(Math.max(0,a.z))+Math.sqrt(Math.max(0,b.z)),2)/2);
  if(h<=1e-9)return [a,b];
  // Quadratic, matching the existing path preview; never a surplus-slack curve.
  return Array.from({length:129},(_,i)=>{const t=i/128;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t-2*h*t*(1-t)};});
}
function routeProjection(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,den=dx*dx+dy*dy+dz*dz;
  const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/den)):0;
  const q={x:a.x+t*dx,y:a.y+t*dy,z:a.z+t*dz};return {t,q,d:dist3(p,q)};
}
function routeGraph(pos,family,fixtures,origins){
  const accepts=p=>(!p.pos||p.pos===pos)&&(!p.carries||p.carries==='both'||p.carries===family);
  const paths=(state.paths||[]).filter(p=>accepts(p)&&['run','hopover','swag'].includes(p.kind));
  const legs=[],vertices=[];
  paths.forEach(p=>{const pts=routePathPoints(p);(p.pts||[]).filter(routeValid).forEach(q=>vertices.push(q));for(let i=1;i<pts.length;i++)if(dist3(pts[i-1],pts[i])>1e-7)legs.push({a:pts[i-1],b:pts[i],kind:p.kind,pathId:p.id,cuts:[0,1]});});
  const nearest=p=>{let best=null;legs.forEach((l,i)=>{const q=routeProjection(p,l.a,l.b);if(!best||q.d<best.d-1e-8)best={...q,leg:i};});return best;};
  // Only deliberate vertices join another leg. A crossing without a vertex is not a junction.
  vertices.forEach(p=>legs.forEach(l=>{const q=routeProjection(p,l.a,l.b);if(q.d<=ROUTE_JOIN_MM)l.cuts.push(q.t);}));
  const attachments=new Map();
  [...fixtures,...origins].forEach(p=>{if(!routeValid(p))return;const q=nearest(p);if(q&&q.d<=ROUTE_ATTACH_MM){legs[q.leg].cuts.push(q.t);attachments.set(p,q);}});
  const breaks=[];
  (state.paths||[]).filter(p=>accepts(p)&&['brk','break'].includes(p.kind)).forEach(p=>{const at=(p.pts||[])[0];if(!routeValid(at))return;const q=nearest(at);if(q&&q.d<=ROUTE_JOIN_MM){legs[q.leg].cuts.push(q.t);breaks.push(q);}});
  const nodes=[],edges=[];
  const node=p=>{let i=nodes.findIndex(n=>dist3(n.p,p)<=ROUTE_JOIN_MM);if(i<0){i=nodes.length;nodes.push({p:routePoint(p),links:[],isBreak:false});}return i;};
  legs.forEach(l=>{const cuts=[...new Set(l.cuts)].sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){const a=routeProjection({x:l.a.x+(l.b.x-l.a.x)*cuts[i-1],y:l.a.y+(l.b.y-l.a.y)*cuts[i-1],z:l.a.z+(l.b.z-l.a.z)*cuts[i-1]},l.a,l.b).q;
    const b={x:l.a.x+(l.b.x-l.a.x)*cuts[i],y:l.a.y+(l.b.y-l.a.y)*cuts[i],z:l.a.z+(l.b.z-l.a.z)*cuts[i]};
    const u=node(a),v=node(b);if(u===v)continue;const e={u,v,kind:l.kind,pathId:l.pathId,length:dist3(nodes[u].p,nodes[v].p)};edges.push(e);nodes[u].links.push(e);nodes[v].links.push(e);
  }});
  attachments.forEach(q=>q.node=node(q.q));breaks.forEach(q=>nodes[node(q.q)].isBreak=true);
  return {nodes,edges,attachments};
}
function routeShortest(g,start,end){
  const d=g.nodes.map(()=>Infinity),prev=[],seen=new Set();d[start]=0;
  while(seen.size<g.nodes.length){let u=-1;for(let i=0;i<d.length;i++)if(!seen.has(i)&&(u<0||d[i]<d[u]))u=i;if(u<0||!Number.isFinite(d[u]))break;if(u===end)break;seen.add(u);
    g.nodes[u].links.forEach(e=>{const v=e.u===u?e.v:e.u,nd=d[u]+e.length;if(nd<d[v]-1e-8){d[v]=nd;prev[v]={u,e};}});
  }
  if(end===undefined)return {distances:d};
  if(!Number.isFinite(d[end]))return null;
  const legs=[];for(let v=end;v!==start;){const p=prev[v];if(!p)return null;legs.push({kind:p.e.kind,pathId:p.e.pathId,points:[g.nodes[p.u].p,g.nodes[v].p],endBreak:g.nodes[v].isBreak});v=p.u;}
  return {distance:d[end],legs:legs.reverse()};
}
let _routePlans=null;
function routePlan(pos,family){
  const key=family+'|'+pos;if(_routePlans&&_routePlans.has(key))return _routePlans.get(key);
  const fx=(state.instances||[]).filter(f=>(f.pos||'-')===pos&&routeValid(f));
  const placed=(state.devices||[]).filter(d=>d.placed&&routeValid(d));
  const origins=placed.length?placed:[homerunOrigin(fx)];
  const g=routeGraph(pos,family,fx,origins);
  let reason='No compatible cable path reaches this position',best=null;
  if(fx.length&&fx.every(f=>g.attachments.has(f))){
    reason='No feeding device connects to the position path';
    origins.forEach(origin=>{const at=g.attachments.get(origin);if(!at)return;const ds=routeShortest(g,at.node).distances;
      if(!fx.every(f=>Number.isFinite(ds[g.attachments.get(f).node])))return;
      const order=fx.slice().sort((a,b)=>ds[g.attachments.get(a).node]-ds[g.attachments.get(b).node]||String(a.id).localeCompare(String(b.id)));
      // A branch would force a return along the trunk. Preserve the strict sweep rule.
      for(let i=1;i<order.length;i++){const a=g.attachments.get(order[i-1]).node,b=g.attachments.get(order[i]).node,r=routeShortest(g,a,b);
        if(!r||r.distance>ds[b]-ds[a]+ROUTE_JOIN_MM){reason='Path branches require a return leg; using the existing sweep';return;}}
      const score=ds[g.attachments.get(order[0]).node]+at.d;
      if(!best||score<best.score)best={routed:true,pos,family,origin,graph:g,order,score,rank:new Map(order.map((f,i)=>[f,i]))};
    });
  }else if(g.edges.length)reason='Fixture farther than 1 ft from a compatible path';
  const result=best||{routed:false,pos,family,reason};if(_routePlans)_routePlans.set(key,result);return result;
}
function routeLink(plan,a,b,ai,bi){
  const g=plan.graph,aa=g.attachments.get(a),bb=g.attachments.get(b),r=routeShortest(g,aa.node,bb.node),legs=[];
  if(dist3(a,g.nodes[aa.node].p)>1e-7)legs.push({kind:'connector',points:[routePoint(a),g.nodes[aa.node].p],endBreak:g.nodes[aa.node].isBreak});
  legs.push(...r.legs);
  if(dist3(b,g.nodes[bb.node].p)>1e-7)legs.push({kind:'connector',points:[g.nodes[bb.node].p,routePoint(b)]});
  if(!legs.length)legs.push({kind:'connector',points:[routePoint(a),routePoint(b)]});
  const spans=[];let chunk=[];
  legs.forEach((leg,i)=>{chunk.push(leg);if(leg.endBreak&&i<legs.length-1){spans.push(chunk);chunk=[];}});if(chunk.length)spans.push(chunk);
  return spans.map((routeLegs,breakIndex)=>{const routePoints=[routeLegs[0].points[0],...routeLegs.map(l=>l.points[1])],ft=mmToFt(routeLegs.reduce((s,l)=>s+dist3(l.points[0],l.points[1]),0)),bd=buildJumper(ft);
    return {a:routePoints[0],b:routePoints[routePoints.length-1],aId:ai<0?undefined:a.id,bId:b.id,ai,bi,ft,std:bd.total,pieces:bd.pieces,routePoints,routeLegs,routed:true,hasSwag:routeLegs.some(l=>l.kind==='swag'),breakIndex,breakCount:spans.length};});
}
'''
p=Path(sys.argv[1]);out=Path(sys.argv[2]);assert p.resolve()!=out.resolve(),'Preserve existing HTML builds'
s=p.read_text(encoding='utf-8')
def rep(a,b,count=1):
 global s
 assert s.count(a)==count,(a[:90],s.count(a),count)
 s=s.replace(a,b)
rep('// Compute jumpers for one group (fixtures sharing a circuit or universe)',ENGINE+'\n// Compute jumpers for one group (fixtures sharing a circuit or universe)')
rep('function groupCables(fixtures, origin){','function groupCables(fixtures, origin, family=\'power\'){')
rep('  const chain=sweepOrder(withPos, origin);',r'''  const pos=withPos[0].pos||'-',plan=routePlan(pos,family);
  if(plan.routed&&withPos.every(f=>plan.rank.has(f))){
    const chain=withPos.slice().sort((a,b)=>plan.rank.get(a)-plan.rank.get(b)),jumps=[];
    for(let i=1;i<chain.length;i++)jumps.push(...routeLink(plan,chain[i-1],chain[i],i-1,i));
    const homeruns=routeLink(plan,plan.origin,chain[0],-1,0);
    return {homerun:homeruns[0],homeruns,jumps,chain,origin:plan.origin,routed:true,pos,family};
  }
  const chain=sweepOrder(withPos, origin);''')
rep('           jumps, chain, origin };','           jumps, chain, origin, routed:false, fallbackReason:plan.reason||"Circuit spans multiple hanging positions or has invalid coordinates", pos, family };')
rep('  _posAxisCache=null;     // feed axes are recomputed per run (devices may have moved)','  _posAxisCache=null;     // feed axes are recomputed per run (devices may have moved)\n  _routePlans=new Map(); // one graph, origin and feed ordering per position / family')
rep('    const r=groupCables(fx,origin);','    const r=groupCables(fx,origin,\'power\');',2)
# Second family occurrence only.
a="    const r=groupCables(fx,origin,'power');";at=s.rfind(a);s=s[:at]+s[at:].replace(a,"    const r=groupCables(fx,origin,'data');",1)
rep('                     raw:j.ft,std:j.std,pieces:j.pieces,ai:j.ai,bi:j.bi,chainLen:r.chain.length});','                     ...j, aId:j.aId||j.a&&j.a.id,bId:j.bId||j.b&&j.b.id,raw:j.ft,chainLen:r.chain.length,\n                     routed:!!r.routed,fallbackReason:r.fallbackReason,pos:r.pos});',2)
for family in ['power','data']:
 extra="group:k" if family=='power' else "universe:u,pos:gpos"
 a=f'''    if(r.homerun&&r.chain&&r.chain.length)
      segments.push({{kind:'homerun-{family}',{extra},a:r.origin,b:r.chain[0],bId:r.chain[0].id,
                     raw:r.homerun.ft,std:r.homerun.std,pieces:r.homerun.pieces,ai:-1,bi:0,chainLen:r.chain.length}});'''
 b=f'''    if(r.homerun&&r.chain&&r.chain.length)
      (r.homeruns||[r.homerun]).forEach(h=>segments.push({{kind:'homerun-{family}',{extra},...h,bId:r.chain[0].id,
                     raw:h.ft,ai:-1,bi:0,chainLen:r.chain.length,routed:!!r.routed,fallbackReason:r.fallbackReason,pos:r.pos}}));'''
 rep(a,b)
rep('  return {jumperType,dataType,jumperParts,dataParts,powerDetail,dataDetail,segments,',r'''  const status=new Map();
  segments.forEach(s=>{const family=s.kind.includes('power')?'power':'data';
    const positions=[s.pos,...[s.aId,s.bId].map(id=>byId[id]&&(byId[id].pos||'-'))].filter(Boolean);
    positions.forEach(pos=>{const key=family+'|'+pos,old=status.get(key);if(!old||!s.routed)status.set(key,{pos,family,routed:s.routed,reason:s.fallbackReason});});
  });
  const plans=[...status.values()];
  const routing={routedPositions:plans.filter(p=>p.routed).map(p=>({pos:p.pos,family:p.family})),
    fallbackPositions:plans.filter(p=>!p.routed).map(p=>({pos:p.pos,family:p.family,reason:p.reason}))};
  return {jumperType,dataType,jumperParts,dataParts,powerDetail,dataDetail,segments,routing,''')
# Numeric path lengths remain meaningful before plot initialisation.
assert s.count('function pathLengthFt(pa){')==1 and s.count('\nfunction clearPaths()')==1
a=s.index('function pathLengthFt(pa){');b=s.index('\nfunction clearPaths()',a)
s=s[:a]+'''function pathLengthFt(pa){
  const pts=routePathPoints(pa);let mm=0;for(let i=1;i<pts.length;i++)mm+=dist3(pts[i-1],pts[i]);return mmToFt(mm);
}
'''+s[b:]
out.write_text(s,encoding='utf-8',newline='\n')
assert out.read_bytes()==s.encode('utf-8')
print('engine patch written',sys.argv[2])
