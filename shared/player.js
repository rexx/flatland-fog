// Plays an interactive's timeline once, the first time its stage is fully on screen,
// then holds the last frame; the button pauses, resumes and replays.
// ?t=<ms> opens on a fixed moment without autoplay (for screenshots and links), and
// with reduced motion the opening frame waits for the reader to press Play.
// Inside a reading page the observer measures against the reader's viewport, not the frame's.
(function(global){
  const LABELS={ready:'Play',playing:'Pause',paused:'Resume',done:'Replay'};

  // opts: {duration, draw(clock), stage, button}. Returns {redraw}.
  function create(opts){
    const{duration,draw,stage,button}=opts;
    let status='ready',clock=0,last=null;

    function render(){draw(Math.min(clock,duration));}
    function setStatus(s){
      status=s;last=null;
      button.textContent=LABELS[s];
      button.setAttribute('aria-pressed',String(s==='playing'));
    }
    function press(){
      if(status==='playing')setStatus('paused');
      else if(status==='done'){clock=0;setStatus('playing');}
      else setStatus('playing');
    }
    function tick(now){
      if(status==='playing'){
        if(last!==null)clock+=Math.min(now-last,100);
        last=now;
        if(clock>=duration){clock=duration;setStatus('done');}
        render();
      }
      requestAnimationFrame(tick);
    }

    button.addEventListener('click',press);
    stage.addEventListener('click',press);
    window.addEventListener('resize',render);
    if('ResizeObserver' in window)new ResizeObserver(render).observe(stage);
    try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',render);}catch(e){}
    new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

    const reduceMotion=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}})();
    const startAt=parseFloat(new URLSearchParams(location.search).get('t'));
    setStatus('ready');
    if(!isNaN(startAt)){
      clock=Math.max(0,Math.min(duration,startAt));
      setStatus(clock>=duration?'done':'paused');
    }else if(!reduceMotion){
      if('IntersectionObserver' in window){
        const io=new IntersectionObserver(entries=>{
          if(status!=='ready'||!entries.some(e=>e.intersectionRatio>=0.95))return;
          io.disconnect();
          setStatus('playing');
        },{threshold:[0.95]});
        io.observe(stage);
      }else{
        setStatus('playing');
      }
    }
    render();
    requestAnimationFrame(tick);
    return{redraw:render};
  }

  // Finds the phase containing time t; p is the eased-free progress through it (0 to 1).
  function phaseAt(phases,t){
    let i=0;while(i<phases.length-1&&t>=phases[i].ms){t-=phases[i].ms;i++;}
    return{index:i,phase:phases[i],p:Math.min(1,t/phases[i].ms)};
  }

  function total(phases){return phases.reduce((s,p)=>s+p.ms,0);}

  const ease=p=>p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;

  global.FlatlandPlayer={create,phaseAt,total,ease};
})(window);
