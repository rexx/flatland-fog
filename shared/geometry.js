// Plane geometry for Flatland figures seen by an observer standing at (0, -D)
// and looking toward +y. Every figure is inscribed in a circle of radius R
// centred at the origin; rotation angles are in degrees, counter-clockwise.
(function(global){
  const D=3.2,R=1,RAD=Math.PI/180;
  const CIRCLE_WIDTH=2*Math.asin(R/D);
  const FIELD_HALF=CIRCLE_WIDTH/2*1.12;

  function onCircle(degs,th){return degs.map(d=>{const a=(d+th)*RAD;return[R*Math.cos(a),R*Math.sin(a)];});}

  // spec: {kind, apex?, sca?, irr?, tpb?}. kind is '0' (circle), 'seg', 'iso', 'sca', 'irr',
  // 'tpb' (triangular front, polygonal back) or a side count. irr and tpb are [degrees, radius] lists.
  // Returns the vertex list, or null for the circle.
  function verts(spec,th){
    const kind=spec.kind;
    if(kind==='0')return null;
    if(kind==='seg')return onCircle([-90,90],th);
    if(kind==='iso')return onCircle([-90,90-spec.apex,90+spec.apex],th);
    if(kind==='sca')return onCircle(spec.sca,th);
    if(kind==='irr'||kind==='tpb'){const t=th*RAD;return spec[kind].map(([d,r])=>[r*Math.cos(d*RAD+t),r*Math.sin(d*RAD+t)]);}
    const n=parseInt(kind,10),a=[];for(let k=0;k<n;k++)a.push(-90+360*k/n);return onCircle(a,th);
  }

  function cross(a,b){return a[0]*b[1]-a[1]*b[0];}
  function edgeCount(v){return v.length===2?1:v.length;}

  // Distance along the ray from the observer to the first boundary hit, or null.
  function hit(kind,v,dir){
    const O=[0,-D];
    if(kind==='0'){const b=dir[0]*O[0]+dir[1]*O[1];const disc=b*b-(O[0]*O[0]+O[1]*O[1]-R*R);if(disc<0)return null;const t=-b-Math.sqrt(disc);return t>0?t:null;}
    let best=null;
    for(let i=0;i<edgeCount(v);i++){
      const P=v[i],Q=v[(i+1)%v.length];const e=[Q[0]-P[0],Q[1]-P[1]];const den=cross(dir,e);
      if(Math.abs(den)<1e-12)continue;
      const w=[P[0]-O[0],P[1]-O[1]];const t=cross(w,e)/den,u=cross(w,dir)/den;
      if(t>0&&u>=0&&u<=1&&(best===null||t<best))best=t;
    }
    return best;
  }

  // Closest boundary point to the observer: {d, p}.
  function nearest(kind,v){
    const O=[0,-D];
    if(kind==='0')return{d:D-R,p:[0,-R]};
    let best={d:1e9,p:null};
    for(let i=0;i<edgeCount(v);i++){
      const P=v[i],Q=v[(i+1)%v.length];const e=[Q[0]-P[0],Q[1]-P[1]];const L=e[0]*e[0]+e[1]*e[1];
      let u=((O[0]-P[0])*e[0]+(O[1]-P[1])*e[1])/L;u=Math.max(0,Math.min(1,u));
      const X=[P[0]+u*e[0],P[1]+u*e[1]];const d=Math.hypot(X[0]-O[0],X[1]-O[1]);
      if(d<best.d)best={d,p:X};
    }
    return best;
  }

  // Left and right edges of the figure as view angles in radians.
  function extent(kind,v){
    if(kind==='0')return[-CIRCLE_WIDTH/2,CIRCLE_WIDTH/2];
    let lo=1e9,hi=-1e9;v.forEach(p=>{const a=Math.atan2(p[0],p[1]+D);lo=Math.min(lo,a);hi=Math.max(hi,a);});
    return[lo,hi];
  }

  // Brightness falls off exponentially with distance; the closest possible point is 1.
  function bright(t,k){return Math.exp(-k*(t-(D-R)));}

  // Brightness for each column of the observer's field of view (null where nothing is seen).
  function profile(kind,v,k,cols){
    const out=[];
    for(let i=0;i<cols;i++){
      const a=-FIELD_HALF+2*FIELD_HALF*i/(cols-1);
      const t=hit(kind,v,[Math.sin(a),Math.cos(a)]);
      out.push(t===null?null:bright(t,k));
    }
    return out;
  }

  global.FlatlandGeometry={D,R,RAD,CIRCLE_WIDTH,FIELD_HALF,onCircle,verts,hit,nearest,extent,bright,profile};
})(window);
