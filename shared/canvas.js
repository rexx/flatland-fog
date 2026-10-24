// 2D canvas drawing for the fog screen, brightness plots and the top-down view.
// Colours come from the CSS tokens in theme.css so both themes stay in sync.
(function(global){
  const G=global.FlatlandGeometry;
  const MONO='11px "IBM Plex Mono", ui-monospace, monospace';

  function token(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||'#888';}

  // Resizes the backing store to the element's CSS size and returns [ctx, width, height].
  function setup(c){
    const dpr=window.devicePixelRatio||1;const w=c.clientWidth,h=c.clientHeight;
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    return[g,w,h];
  }

  // What a Flatlander sees: a single line, hatched where nothing is in view.
  function drawStrip(c,prof){
    const[g,w,h]=setup(c);
    g.fillStyle=token('--screen');g.fillRect(0,0,w,h);
    g.strokeStyle=token('--screen-line');g.lineWidth=1;g.beginPath();
    for(let x=-h;x<w;x+=8){g.moveTo(x,h);g.lineTo(x+h,0);}
    g.stroke();
    const cw=w/prof.length;
    prof.forEach((b,i)=>{if(b===null)return;const v=Math.round(255*b);g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(i*cw,0,cw+0.6,h);});
  }

  function drawProfile(c,prof,labels){
    const[g,w,h]=setup(c);const pad=8,ph=h-2*pad;
    g.strokeStyle=token('--line');g.lineWidth=1;g.beginPath();g.moveTo(0,h-pad);g.lineTo(w,h-pad);g.moveTo(0,pad);g.lineTo(w,pad);g.stroke();
    g.fillStyle=token('--muted');g.font=MONO;g.fillText(labels.bright,4,pad+12);g.fillText(labels.dim,4,h-pad-4);
    g.strokeStyle=token('--shape');g.lineWidth=2;g.beginPath();let on=false;
    prof.forEach((b,i)=>{const x=i*w/(prof.length-1);if(b===null){on=false;return;}const y=pad+(1-b)*ph;on?g.lineTo(x,y):g.moveTo(x,y);on=true;});
    g.stroke();
  }

  // Top-down view with the observer, field of view, and optional nearest point and extent ticks.
  function drawTop(c,kind,v,opts){
    const[g,w,h]=setup(c);
    const D=G.D,R=G.R,HALF=G.FIELD_HALF;
    const sc=h/(D+R+0.6),cx=w/2,cy=0.35*sc+R*sc;
    const toS=([x,y])=>[cx+x*sc,cy-y*sc];const O=toS([0,-D]);
    g.setLineDash([4,4]);g.strokeStyle=token('--line-strong');g.lineWidth=1;
    [-HALF,HALF].forEach(a=>{const e=toS([Math.sin(a)*(D+R),-D+Math.cos(a)*(D+R)]);g.beginPath();g.moveTo(O[0],O[1]);g.lineTo(e[0],e[1]);g.stroke();});
    g.setLineDash([]);
    g.fillStyle=token('--shape-fill');g.strokeStyle=token('--shape');g.lineWidth=kind==='seg'?3:2;g.beginPath();
    if(kind==='0'){const c0=toS([0,0]);g.arc(c0[0],c0[1],R*sc,0,2*Math.PI);}
    else{v.forEach((p,i)=>{const s=toS(p);i?g.lineTo(s[0],s[1]):g.moveTo(s[0],s[1]);});if(kind!=='seg')g.closePath();}
    if(kind!=='seg')g.fill();
    g.stroke();
    if(opts.extent){
      const ex=G.extent(kind,v);g.strokeStyle=token('--extent');g.lineWidth=2;
      ex.forEach(a=>{const p1=toS([Math.sin(a)*(D+R+0.25),-D+Math.cos(a)*(D+R+0.25)]),p2=toS([Math.sin(a)*(D+R+0.5),-D+Math.cos(a)*(D+R+0.5)]);g.beginPath();g.moveTo(p1[0],p1[1]);g.lineTo(p2[0],p2[1]);g.stroke();});
    }
    if(opts.nearest){
      const np=toS(G.nearest(kind,v).p);
      g.strokeStyle=token('--nearest');g.lineWidth=1;g.beginPath();g.moveTo(O[0],O[1]);g.lineTo(np[0],np[1]);g.stroke();
      g.fillStyle=token('--nearest');g.beginPath();g.arc(np[0],np[1],4,0,2*Math.PI);g.fill();
    }
    g.fillStyle=token('--observer');g.beginPath();g.arc(O[0],O[1],6,0,2*Math.PI);g.fill();
  }

  // A value sampled every 0.5 degrees over one full turn, with a marker at the current angle.
  function drawTrace(c,data,lo,hi,color,theta){
    const[g,w,h]=setup(c);const tp=10,th2=h-2*tp-6;
    g.strokeStyle=token('--line');g.lineWidth=1;g.beginPath();g.moveTo(0,tp+th2);g.lineTo(w,tp+th2);g.moveTo(0,tp);g.lineTo(w,tp);g.stroke();
    g.fillStyle=token('--muted');g.font=MONO;
    [0,90,180,270,360].forEach(d=>{const x=12+d/360*(w-24);g.fillText(d+'°',Math.min(Math.max(x-10,0),w-30),h-1);});
    g.strokeStyle=color;g.lineWidth=2;g.beginPath();
    data.forEach((b,i)=>{const x=12+(i*0.5)/360*(w-24);const y=tp+(1-(b-lo)/(hi-lo))*th2;i?g.lineTo(x,y):g.moveTo(x,y);});
    g.stroke();
    const mx=12+(theta%360)/360*(w-24);g.strokeStyle=token('--marker');g.lineWidth=1.5;g.beginPath();g.moveTo(mx,tp);g.lineTo(mx,tp+th2);g.stroke();
  }

  global.FlatlandCanvas={token,setup,drawStrip,drawProfile,drawTop,drawTrace};
})(window);
