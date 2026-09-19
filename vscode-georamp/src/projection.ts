import proj4 from 'proj4';
const catalog: Record<string, {name:string;proj4:string;kind:string;accuracy:number|null;unit:string}> = require('epsg-index/all.json');
type Point = [number,number];
type Camera = {zoom:number;panX:number;panY:number};
const converters = new Map<string, proj4.Converter>();
const descriptions = new Map<string,{id:string;name:string;accuracy:number|null;unit:string}>();
export function describe(code: string|number) {
  const key=String(code).trim().replace(/^EPSG:/i,'').trim();
  if(descriptions.has(key))return descriptions.get(key)!;
  const item=catalog[key];
  if (!/^\d+$/.test(key) || !item?.proj4 || /\+proj=(geocent|vert)/.test(item.proj4)) throw new Error('CRS horizontal no disponible: EPSG:'+key);
  if (/\+nadgrids=(?!@?null(?:\s|$))/.test(item.proj4)) throw new Error('Este CRS necesita una rejilla de datum no instalada.');
  const id='EPSG:'+key;
  if (!proj4.defs(id)) proj4.defs(id,item.proj4);
  // Validate that this projection is implemented before accepting it.
  proj4(id,id);
  const description={id,name:item.name,accuracy:item.accuracy,unit:item.unit};
  descriptions.set(key,description);return description;
}
export function search(query:string) {
  const text=query.trim().toLowerCase().replace(/^epsg:/,'');
  return Object.entries(catalog).filter(([code,item])=>item.proj4 && (code===text || (code+' '+item.name).toLowerCase().includes(text)))
    .slice(0,40).map(([code,item])=>({id:'EPSG:'+code,name:item.name}));
}
export function convert(from:string|number,to:string|number,point:Point): Point {
  const a=describe(from).id,b=describe(to).id;
  if (!point.every(Number.isFinite)) throw new Error('Coordenadas no validas');
  if (a===b) return [...point];
  const key=a+'>'+b;
  if (!converters.has(key)) converters.set(key,proj4(a,b));
  const output=converters.get(key)!.forward(point) as Point;
  if (!output.every(Number.isFinite)) throw new Error('Fuera del dominio del CRS');
  return output;
}
export function mapper(info:any,project:string) {
  const code=info.geo?.assignedCrs || info.geo?.epsg;
  if (!code || !info.geo?.transform) throw new Error('Asigna un CRS de origen a esta capa');
  const from=describe(code).id,to=describe(project).id;
  const key=from+'>'+to;
  if (!converters.has(key)) converters.set(key,proj4(from,to));
  const converter=converters.get(key)!;
  const [a,b,c,d,e,f]=info.geo.transform, det=a*e-b*d;
  if (!Number.isFinite(det) || det===0) throw new Error('Georreferenciacion no invertible');
  const offset=info.geo.pixelIsArea===false ? -0.5 : 0;
  const valid=(p:Point):Point=>{if(!p.every(Number.isFinite))throw new Error('Fuera del dominio del CRS');return p;};
  return {
    same:from===to,
    forward(x:number,y:number):Point {
      x+=offset;y+=offset;
      const world:Point=[a*x+b*y+c,d*x+e*y+f];
      return valid(from===to ? world : converter.forward(world) as Point);
    },
    inverse(x:number,y:number):Point {
      const p=valid(from===to ? [x,y] : converter.inverse([x,y]) as Point);
      return valid([(e*(p[0]-c)-b*(p[1]-f))/det-offset,(a*(p[1]-f)-d*(p[0]-c))/det-offset]);
    }
  };
}
export function bounds(info:any,project:string,window=[0,0,info.width,info.height]):number[] {
  const map=mapper(info,project),points:Point[]=[];
  for(let i=0;i<=32;i++) {
    const t=i/32,x=window[0]+(window[2]-window[0])*t,y=window[1]+(window[3]-window[1])*t;
    for(const p of [[x,window[1]],[x,window[3]],[window[0],y],[window[2],y]]) {
      try {points.push(map.forward(p[0],p[1]));}catch { /* Outside projection domain. */ }
    }
  }
  if(!points.length)throw new Error('Capa fuera del dominio del CRS de proyecto');
  return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
export function screenToPixel(info:any,project:string,camera:Camera,x:number,y:number):Point {
  return mapper(info,project).inverse((x-camera.panX)/camera.zoom,-(y-camera.panY)/camera.zoom);
}
export function sourceWindow(info:any,project:string,camera:Camera,width:number,height:number):number[]|null {
  const map=mapper(info,project),points:Point[]=[];
  for(let row=0;row<=8;row++)for(let col=0;col<=8;col++) {
    try {points.push(map.inverse((col*width/8-camera.panX)/camera.zoom,-(row*height/8-camera.panY)/camera.zoom));}catch {}
  }
  if(!points.length)return null;
  const result=[Math.max(0,Math.floor(Math.min(...points.map(p=>p[0])))-2),Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))-2),
    Math.min(info.width,Math.ceil(Math.max(...points.map(p=>p[0])))+2),Math.min(info.height,Math.ceil(Math.max(...points.map(p=>p[1])))+2)];
  return result[2]>result[0] && result[3]>result[1] ? result : null;
}
export function traceWindow(ctx:any,info:any,project:string,camera:Camera,window:number[]) {
  const map=mapper(info,project),corners=[[window[0],window[1]],[window[2],window[1]],[window[2],window[3]],[window[0],window[3]]];
  for(let edge=0;edge<4;edge++)for(let i=0;i<32;i++) {
    const a=corners[edge],b=corners[(edge+1)%4],t=i/32,p=map.forward(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
    const x=p[0]*camera.zoom+camera.panX,y=-p[1]*camera.zoom+camera.panY;
    if(edge===0 && i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();
}
/** Adaptive triangular warp; source pixels are never modified. */
export function draw(ctx:any,canvas:any,info:any,project:string,camera:Camera,window=[0,0,info.width,info.height]) {
  const map=mapper(info,project),w=canvas.width,h=canvas.height;
  const point=(u:number,v:number):Point=>{
    const p=map.forward(window[0]+u/w*(window[2]-window[0]),window[1]+v/h*(window[3]-window[1]));
    return [p[0]*camera.zoom+camera.panX,-p[1]*camera.zoom+camera.panY];
  };
  if(map.same) {
    const p=point(0,0),x=point(w,0),y=point(0,h);
    ctx.save();ctx.transform((x[0]-p[0])/w,(x[1]-p[1])/w,(y[0]-p[0])/h,(y[1]-p[1])/h,p[0],p[1]);ctx.drawImage(canvas,0,0);ctx.restore();return;
  }
  let triangles=0;
  const triangle=(uv:Point[],p:Point[])=>{
    const [u,v,z]=uv,den=(v[0]-u[0])*(z[1]-u[1])-(z[0]-u[0])*(v[1]-u[1]);
    if(!den)return;
    const ax=((p[1][0]-p[0][0])*(z[1]-u[1])-(p[2][0]-p[0][0])*(v[1]-u[1]))/den;
    const bx=((p[2][0]-p[0][0])*(v[0]-u[0])-(p[1][0]-p[0][0])*(z[0]-u[0]))/den;
    const ay=((p[1][1]-p[0][1])*(z[1]-u[1])-(p[2][1]-p[0][1])*(v[1]-u[1]))/den;
    const by=((p[2][1]-p[0][1])*(v[0]-u[0])-(p[1][1]-p[0][1])*(z[0]-u[0]))/den;
    ctx.save();ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.lineTo(...p[2]);ctx.closePath();ctx.clip();
    ctx.transform(ax,ay,bx,by,p[0][0]-ax*u[0]-bx*u[1],p[0][1]-ay*u[0]-by*u[1]);ctx.drawImage(canvas,0,0);ctx.restore();triangles++;
  };
  const tile=(x:number,y:number,width:number,height:number,depth:number)=>{
    try {
      const a=point(x,y),b=point(x+width,y),c=point(x+width,y+height),d=point(x,y+height),m=point(x+width/2,y+height/2);
      const midpoints=[point(x+width/2,y),point(x+width,y+height/2),point(x+width/2,y+height),point(x,y+height/2)];
      const corners=[a,b,c,d];
      const error=Math.max(Math.hypot(m[0]-(a[0]+c[0])/2,m[1]-(a[1]+c[1])/2),
        ...midpoints.map((p,i)=>Math.hypot(p[0]-(corners[i][0]+corners[(i+1)%4][0])/2,p[1]-(corners[i][1]+corners[(i+1)%4][1])/2)));
      if((depth<3 || error>0.5) && depth<8 && triangles<8192) {
        for(const dx of [0,width/2])for(const dy of [0,height/2])tile(x+dx,y+dy,width/2,height/2,depth+1);
      } else {triangle([[x,y],[x+width,y],[x+width,y+height]],[a,b,c]);triangle([[x,y],[x+width,y+height],[x,y+height]],[a,c,d]);}
    } catch {if(depth<6)for(const dx of [0,width/2])for(const dy of [0,height/2])tile(x+dx,y+dy,width/2,height/2,depth+1);}
  };
  tile(0,0,w,h,0);
}
