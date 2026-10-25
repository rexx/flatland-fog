// Plays an interactive's timeline once, the first time its stage is fully on screen,
// then holds the last frame; the button pauses, resumes and replays.
// ?t=<ms> opens on a fixed moment without autoplay (for screenshots and links), and
// with reduced motion the opening frame waits for the reader to press Play.
// Inside a reading page the observer measures against the reader's viewport, not the frame's.
(function(global){
  const LABELS={ready:'Play',playing:'Pause',paused:'Resume',done:'Replay'};
  // Reading speed shared by the word-by-word fade and the time each caption stays up.
  const CHAR_MS=40,FADE_MS=300;

  // opts: {duration, draw(clock), stage, button, caption?, steps?}. Returns {redraw}.
  // When caption (an element) is given, draw returns the caption text for that moment and
  // its words fade in one by one at reading speed while the animation plays.
  // steps (from steps()) adds previous and next buttons around the play button that move
  // between captions: while playing they jump to a caption's start and play on; otherwise
  // they show the caption's finished frame and wait.
  // A timeline slider along the bottom of the button's .panel scrubs to any moment and pauses there.
  function create(opts){
    const{duration,draw,stage,button,caption,steps}=opts;
    let status='ready',clock=0,last=null;
    let text=null,words=[],shownAt=0;
    const panel=button.closest('.panel');
    let scrub=null;
    if(panel){
      scrub=document.createElement('input');
      scrub.type='range';scrub.className='player-scrub';
      scrub.min='0';scrub.max=String(duration);scrub.step='10';scrub.value='0';
      scrub.setAttribute('aria-label','Timeline');
      panel.append(scrub);
    }

    function render(){
      const t=Math.min(clock,duration),next=draw(t);
      if(scrub)scrub.value=String(t);
      if(!caption||typeof next!=='string')return;
      if(next!==text){
        text=next;shownAt=status==='playing'?t:-Infinity;
        caption.textContent='';
        let chars=0;
        words=next.split(' ').map((w,i)=>{
          const s=document.createElement('span');s.textContent=(i?' ':'')+w;caption.append(s);
          const at=chars*CHAR_MS;chars+=w.length+1;return{s,at};
        });
      }
      words.forEach(({s,at})=>{s.style.opacity=Math.max(0.08,Math.min(1,(t-shownAt-at)/FADE_MS));});
    }
    // Captions reached by a jump or a fixed ?t= moment are shown whole.
    function reveal(){shownAt=-Infinity;}
    function setStatus(s){
      status=s;last=null;
      if(s==='playing'&&clock===0)text=null;
      button.textContent=LABELS[s];
      button.setAttribute('aria-pressed',String(s==='playing'));
    }
    function press(){
      if(status==='playing'){setStatus('paused');reveal();render();}
      else if(status==='done'){clock=0;setStatus('playing');}
      else setStatus('playing');
    }
    function tick(now){
      if(status==='playing'){
        if(last!==null)clock+=Math.min(now-last,100);
        last=now;
        if(clock>=duration){clock=duration;setStatus('done');reveal();}
        render();
      }
      requestAnimationFrame(tick);
    }

    function current(){let i=0;while(i<steps.length-1&&clock>=steps[i+1].start)i++;return i;}
    function go(i){
      if(i>=steps.length){clock=duration;setStatus('done');render();return;}
      i=Math.max(0,i);
      if(status==='playing'){clock=steps[i].start;last=null;text=null;render();return;}
      clock=steps[i].settled;setStatus(clock>=duration?'done':'paused');
      render();reveal();render();
    }
    if(steps&&steps.length>1){
      const nav=document.createElement('span');nav.className='player-nav';
      button.parentNode.insertBefore(nav,button);
      const step=(label,text,delta)=>{
        const b=document.createElement('button');b.type='button';b.className='step';
        b.textContent=label;b.setAttribute('aria-label',text);b.title=text;
        b.addEventListener('click',()=>go(current()+delta));
        return b;
      };
      nav.append(step('‹','Previous sentence',-1),button,step('›','Next sentence',1));
    }

    if(scrub)scrub.addEventListener('input',()=>{
      clock=Math.max(0,Math.min(duration,parseFloat(scrub.value)));
      setStatus(clock>=duration?'done':'paused');
      render();reveal();render();
    });
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

  // Finds the phase containing time t. p is the progress through the phase's motion (0 to 1);
  // it stays at 1 through the hold that pace() adds at the end.
  function phaseAt(phases,t){
    let i=0;while(i<phases.length-1&&t>=phases[i].ms){t-=phases[i].ms;i++;}
    const ph=phases[i],move=ph.ms-(ph.hold||0);
    return{index:i,phase:ph,p:move>0?Math.min(1,t/move):1};
  }

  function total(phases){return phases.reduce((s,p)=>s+p.ms,0);}

  // Time for every word of a caption to fade in.
  function revealMs(text){return CHAR_MS*text.length+FADE_MS;}
  // Time to read a caption: about 25 characters a second, then a beat to take it in.
  function readMs(text){return 1000+CHAR_MS*text.length;}

  // Consecutive phases showing the same caption (phase[key]) form one run.
  function runs(phases,key){
    const out=[];let i=0;
    while(i<phases.length){
      let j=i;
      if(phases[i][key])while(j+1<phases.length&&phases[j+1][key]===phases[i][key])j++;
      out.push([i,j]);i=j+1;
    }
    return out;
  }

  // Keeps every caption up long enough to read. Any shortfall becomes a hold at the end of
  // the run, after its motion has finished, so nothing moves more slowly. The final caption only
  // needs time to finish fading in: it stays on screen once the animation ends.
  function pace(phases,key){
    const out=phases.map(p=>Object.assign({},p));
    runs(out,key).forEach(([i,j])=>{
      const time=j===out.length-1?revealMs:readMs;
      if(!out[i][key])return;
      const need=time(out[i][key]);let have=0;for(let k=i;k<=j;k++)have+=out[k].ms;
      if(have<need){out[j].hold=need-have;out[j].ms+=need-have;}
    });
    return out;
  }

  // One step per caption: when it starts, and the moment just before the next one,
  // where its motion has finished.
  function steps(phases,key){
    const starts=[];let t=0;phases.forEach(p=>{starts.push(t);t+=p.ms;});
    return runs(phases,key).map(([i,j])=>({start:starts[i],settled:j===phases.length-1?t:starts[j]+phases[j].ms-1}));
  }

  const ease=p=>p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;

  global.FlatlandPlayer={create,phaseAt,total,pace,steps,ease};
})(window);
