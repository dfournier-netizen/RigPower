const fs=require('fs'),vm=require('vm'),assert=require('assert');
const file=process.argv[2]||'engine-output.tmp',html=fs.readFileSync(file,'utf8');
const source=html.slice(html.indexOf('function dist3('),html.indexOf('function renderAutoCable('));
const ctx=vm.createContext({state:{},SWAG_SAG:.08,buildJumper:ft=>({total:Math.ceil(ft),pieces:[Math.ceil(ft)]}),jumperStockFor:()=>null});vm.runInContext(source,ctx);
function check(expr){assert(vm.runInContext(expr,ctx),expr);}
function setup(paths,points=[[2000,0,1000],[4000,0,1000]],origin={x:0,y:0,z:1000}){
 ctx.state={paths,devices:[{...origin,kind:'distro',placed:true},{...origin,kind:'node',placed:true}],instances:points.map((p,i)=>({x:p[0],y:p[1],z:p[2],id:'f'+i,pos:'LX',universe:1,assigned:{positionId:'p',multiId:'m',circuitIndex:0}}))};
 vm.runInContext('var result=computeAutoCable()',ctx);
}
const p=(x,y=0,z=1000)=>({x,y,z});const run=(pts,other={})=>({id:'r',kind:'run',carries:'both',pos:'LX',pts,...other});
setup([]);check('result.routing.fallbackPositions.length===2');check('result.segments.length===4');check('Math.abs(result.segments[0].raw-2000/304.8)<1e-9');
setup([run([p(0),p(0,1000),p(4000,1000),p(4000)])],[[4000,500,1000],[4000,0,1000]]);check('result.routing.routedPositions.length===2');check('result.segments.find(s=>s.kind==="homerun-power").raw===5500/304.8');
setup([run([p(0),p(4000)]),{id:'b',kind:'brk',pts:[p(3000)],pos:'LX',carries:'both'}]);check('result.segments.filter(s=>s.kind==="power").length===2');check('result.segments.filter(s=>s.kind==="power").every(s=>s.ai===0&&s.bi===1&&s.aId==="f0"&&s.bId==="f1"&&s.breakCount===2)');
setup([run([p(0),p(2500)]),run([p(2500),p(4000)],{id:'r2'})]);check('result.routing.routedPositions.length===2');
setup([run([p(0),p(4000)],{carries:'power'})]);check('result.routing.routedPositions.length===1&&result.routing.fallbackPositions.length===1');
setup([run([p(0),p(2400)]),run([p(2600),p(4000)],{id:'r2'})]);check('result.routing.routedPositions.length===0');
setup([run([p(0),p(4000)]),run([p(2000),p(2000,2000)],{id:'r2'})],[[4000,0,1000],[2000,2000,1000]]);check('result.routing.routedPositions.length===0');check('result.routing.fallbackPositions.every(p=>p.reason.includes("return"))');
setup([run([p(0),p(4000)]),run([p(2000),p(2000,2000)],{id:'r2'})],[[2000,1000,1000],[2000,2000,1000]]);check('result.routing.routedPositions.length===2');
setup([run([p(0),p(4000)],{kind:'swag',sag:1})],[[4000,0,1000]],p(0));check('result.routing.routedPositions.length===2');check('result.segments.every(s=>s.hasSwag&&s.raw>4000/304.8)');check('result.segments.every(s=>s.routePoints.every(p=>p.z>=0))');
setup([run([p(0),p(4000)])],[[2000,400,1000],[4000,400,1000]]);check('result.routing.routedPositions.length===0');
setup([run([p(0),p(4000)],{pos:''})]);ctx.state.instances[1].pos='OTHER';vm.runInContext('result=computeAutoCable()',ctx);
check('result.routing.fallbackPositions.filter(p=>p.family==="power").length===2');check('result.segments.filter(s=>s.kind==="power").every(s=>!s.routed&&s.fallbackReason.includes("multiple"))');
setup([run([p(0),{x:NaN,y:0,z:1000},p(4000)])]);check('result.routing.routedPositions.length===0');
setup([run([p(0),p(4000)])]);ctx.state.paths[0].carries='data';vm.runInContext('result=computeAutoCable()',ctx);check('result.routing.fallbackPositions.length===1&&result.routing.fallbackPositions[0].family==="power"');
setup([run([p(0),p(4000)]),{id:'b',kind:'brk',pts:[p(1000)],pos:'LX',carries:'both'}]);check('result.segments.filter(s=>s.kind==="homerun-power").length===2');check('result.segments.filter(s=>s.kind==="homerun-power").every(s=>s.bi===0&&s.ai===-1&&s.breakCount===2)');
console.log('14 focused engine scenarios PASS');
