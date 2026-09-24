import sys
from pathlib import Path
src,dst=map(Path,sys.argv[1:3])
s=src.read_text(encoding='utf-8')
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:90],s.count(a))
 s=s.replace(a,b)
rep("  if(C.numbers&&!isHome&&typeof sg.bi==='number'){", "  if(C.numbers&&!isHome&&typeof sg.bi==='number'&&(!sg.breakCount||sg.breakIndex===sg.breakCount-1)){")
rep("    if(sg.ai===0){", "    if(sg.ai===0&&(!sg.breakCount||sg.breakCount===1)){")
# A split first link needs its source fixture number on its first physical piece.
rep("  // the device / distro end that everything feeds back to\n  if(C.origins&&isHome){", "  if(C.numbers&&!isHome&&sg.ai===0&&sg.breakCount>1&&sg.breakIndex===0){\n    const s0=numberSprite(1); s0.position.copy(pa); s0.position.y+=PLOT.span*0.022;\n    s0.scale.setScalar(PLOT.span*0.028); pushMarker(s0,sg,fam,label,drawnFt);\n  }\n  // the device / distro end that everything feeds back to\n  if(C.origins&&isHome&&(!sg.breakCount||sg.breakIndex===0)){")
rep("    if(pa.distanceTo(pb)<1e-6)return;", "    if(pa.distanceTo(pb)<1e-6&&!(sg.routePoints&&sg.routePoints.length>2))return;")
rep("    const cc=cableCurve(pa,pb,sg.raw,drawnFt);\n    const curve=cc.curve, curved=cc.curved;", """    // The routing engine supplies the exact sampled geometry it measured, including
    // swag arcs. Supported paths stay on their supports in both display modes.
    const routePts=sg.routed&&sg.routePoints&&sg.routePoints.length>1
      ?sg.routePoints.map(p=>{const v=plotVec(p);if(off)v.add(off);v.y=Math.max(0,v.y);return v;}):null;
    if(routePts){pa=routePts[0];pb=routePts[routePts.length-1];}
    const cc=routePts?{clamped:false}:cableCurve(pa,pb,sg.raw,drawnFt);""")
rep("    legend[label]=color;\n\n    const geo=new THREE.TubeGeometry(curve, curved?16:1, radius, 5, false);\n    const mat=new THREE.MeshStandardMaterial({color,roughness:0.75,metalness:0.05,\n      emissive:0x000000, transparent:fam==='homerun', opacity:fam==='homerun'?0.75:1});\n    const m=new THREE.Mesh(geo,mat);\n    m.userData={cable:sg,fam,drawn:drawnFt,label,clamped:cc.clamped};\n    PLOT.cableGroup.add(m); PLOT.cableMeshes.push(m);", """    if(sg.hasSwag)label+=' / swag';
    if(sg.fallbackReason){color=0xeb7e55;label+=' / fallback';}
    legend[label]=color;
    const addTube=(curve,steps)=>{
      const geo=new THREE.TubeGeometry(curve,steps,radius,5,false);
      const mat=new THREE.MeshStandardMaterial({color,roughness:0.75,metalness:0.05,
        emissive:0x000000,transparent:fam==='homerun',opacity:fam==='homerun'?0.75:1});
      const m=new THREE.Mesh(geo,mat);
      m.userData={cable:sg,fam,drawn:drawnFt,label,clamped:cc.clamped};
      PLOT.cableGroup.add(m);PLOT.cableMeshes.push(m);
    };
    // Render each measured leg separately so TubeGeometry never cuts a routing corner.
    if(routePts){
      for(let i=1;i<routePts.length;i++)if(routePts[i-1].distanceTo(routePts[i])>1e-9)
        addTube(new THREE.LineCurve3(routePts[i-1],routePts[i]),1);
    }else addTube(cc.curve,cc.curved?16:1);""")
rep("  appendCableLegend();\n}\n\n// Idempotent", "  if(stat&&rep.routing){\n    const falls=rep.routing.fallbackPositions||[];\n    stat.textContent+=' | '+(rep.routing.routedPositions||[]).length+' path-routed, '+falls.length+' fallback position/families';\n    stat.title=falls.map(f=>f.pos+' / '+f.family+': '+f.reason).join('\\n');\n  }\n  appendCableLegend();\n}\n\n// Idempotent")
rep("    +'<br>gap '+sg.raw.toFixed(1)", "    +(sg.fallbackReason?'<br><span style=\"color:var(--warn)\">Fallback: '+esc(sg.fallbackReason)+'</span>':sg.routed?'<br>Along permitted paths'+(sg.hasSwag?' (includes swag arc)':''):'')\n    +(sg.breakCount>1?'<br>Physical cable '+(sg.breakIndex+1)+' of '+sg.breakCount+' (forced break)':'')\n    +'<br>route '+sg.raw.toFixed(1)")
rep("  // jumper parts table\n  const jb=", """  if(st&&rep.routing){
    const falls=rep.routing.fallbackPositions||[], routed=rep.routing.routedPositions||[];
    const box=document.createElement('div');box.className='stat';
    box.innerHTML='<div class="label">Path Routing</div><div class="val" style="font-size:15px">'+routed.length+' routed / '+falls.length+' fallback</div>'
      +'<div class="meta">position / cable family</div>'
      +(falls.length?'<div style="color:var(--warn);font-size:11px;margin-top:6px">'+falls.map(f=>esc(f.pos||'Unassigned')+' / '+esc(f.family)+': '+esc(f.reason)).join('<br>')+'</div>':'');
    st.appendChild(box);
  }
  // jumper parts table
  const jb=""")
# Recompute after all committed routing mutations. Draft/selection changes need no recalculation.
rep("  buildPaths(); updatePathStat();\n  if($('#view-paths')", "  buildPaths(); refreshPathRouting(); updatePathStat();\n  if($('#view-paths')")
rep("    t.path.pos=t.path.pos||inferPathPos(t.path.pts);", "    refreshPathRouting();")
rep("    PLOT.activePath=null; renderPaths(); buildPaths(); toast('Path deleted');", "    PLOT.activePath=null; renderPaths(); buildPaths(); refreshPathRouting(); toast('Path deleted');")
rep("tr.querySelector('.pk').onchange=e=>{pa.kind=e.target.value;renderPaths();buildPaths();};", "tr.querySelector('.pk').onchange=e=>{pa.kind=e.target.value;renderPaths();buildPaths();refreshPathRouting();};")
rep("tr.querySelector('.pcar').onchange=e=>{pa.carries=e.target.value;};", "tr.querySelector('.pcar').onchange=e=>{pa.carries=e.target.value;refreshPathRouting();};")
rep("tr.querySelector('.ppos').onchange=e=>{pa.pos=e.target.value||inferPathPos(pa.pts);renderPaths();};", "tr.querySelector('.ppos').onchange=e=>{pa.pos=e.target.value;renderPaths();refreshPathRouting();};")
rep("q[k]=v*304.8; buildPaths();", "q[k]=v*304.8; buildPaths(); refreshPathRouting();")
rep("      renderPaths(); buildPaths();\n    };\n    tb.appendChild(tr);\n  });\n  if(st)", "      renderPaths(); buildPaths(); refreshPathRouting();\n    };\n    tb.appendChild(tr);\n  });\n  if(st)")
rep("function pathById(id){", "function refreshPathRouting(){\n  if(PLOT.inited)buildCables();\n  if($('#view-autocable')?.classList.contains('active'))renderAutoCable();\n}\nfunction pathById(id){")

rep('minZ=Math.min(...zs)', 'minZ=Math.min(0,...zs)')
rep('<option value="">— auto —</option>', '<option value="">Shared / auto</option>')
rep("    pa.pts.push({x:last.x+1000,y:last.y,z:last.z});\n    renderPaths(); buildPaths();", "    pa.pts.push({x:last.x+1000,y:last.y,z:last.z});\n    renderPaths(); buildPaths(); refreshPathRouting();")
rep('function addCableMarkers(sg,fam,pa,pb,color,radiusBase,label,drawnFt){', 'function addCableMarkers(sg,fam,pa,pb,color,radiusBase,label,drawnFt,routePts){')
rep('  const dir=pb.clone().sub(pa); if(dir.lengthSq()<1e-12)return; dir.normalize();', '  const dir=routePts?pb.clone().sub(routePts[routePts.length-2]):pb.clone().sub(pa); if(dir.lengthSq()<1e-12)return; dir.normalize();\n  const sourceDir=routePts?routePts[1].clone().sub(pa).normalize():dir;')
rep('ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);','ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),sourceDir);')
rep('addCableMarkers(sg,fam,pa,pb,color,radiusBase,label,drawnFt);','addCableMarkers(sg,fam,pa,pb,color,radiusBase,label,drawnFt,routePts);')


a=s.index('function swagCurve(pa){');b=s.index('\n// True length of a path',a)
old=s[a:b]
assert old.count('function swagCurve(')==1
rep(old,"""function swagCurve(pa){
  const pts=routePathPoints(pa);if(pts.length<2)return null;
  const curve=new THREE.CurvePath();
  for(let i=1;i<pts.length;i++)curve.add(new THREE.LineCurve3(plotVec(pts[i-1]),plotVec(pts[i])));
  return curve;
}
""")

# Keep fallback positions visible without replacing their type/phase palette.
rep("m.material.emissive.setHex(isSel?0x665500:0x000000);", "m.material.emissive.setHex(isSel?0x665500:(PLOT.routingFallbackPositions?.has(it.pos||'-')?0x54200e:0x000000));")
rep("  // legend UI\n  const lg=$('#plotLegend');", "  if(PLOT.meshes.some(m=>PLOT.routingFallbackPositions?.has(m.userData.pos||'-')))\n    legend.routingFallback={color:0xeb7e55,label:'Orange tint: routing fallback'};\n  // legend UI\n  const lg=$('#plotLegend');")
rep("function buildCables(){", "function applyRoutingStatus(rep){\n  PLOT.routingFallbackPositions=new Set((rep.routing?.fallbackPositions||[]).map(p=>p.pos));\n  if(PLOT.inited)applyColorMode();\n}\nfunction buildCables(){")
rep("\n  const legOf=(typeof instanceLeg==='function')?instanceLeg():{};", "\n  applyRoutingStatus(rep);\n  const legOf=(typeof instanceLeg==='function')?instanceLeg():{};")
rep("  const rep=computeAutoCable({jumperType:jt,dataType:dt});", "  const rep=computeAutoCable({jumperType:jt,dataType:dt});\n  applyRoutingStatus(rep);")
rep("  return kind==='power'?'power':'data';", "  if(kind==='power'||kind==='data')return kind;\n  return null; // Unsupported kinds must not silently render as data.")
rep("    const fam=cableFamily(sg.kind);", "    const fam=cableFamily(sg.kind);\n    if(!fam)return;")

assert src.resolve()!=dst.resolve(),'Preserve source build'
dst.write_text(s,encoding='utf-8',newline='\n')
assert dst.read_text(encoding='utf-8')==s
print('Applied renderer patch:',dst)
