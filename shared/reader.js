// Sizes embedded interactives to the height they report through shared/embed.js.
(function(){
  window.addEventListener('message',e=>{
    const data=e.data;
    if(!data||data.type!=='flatland-fog:height'||typeof data.height!=='number')return;
    document.querySelectorAll('.interactive iframe').forEach(frame=>{
      if(frame.contentWindow!==e.source)return;
      const border=frame.offsetHeight-frame.clientHeight;
      frame.style.height=Math.max(200,data.height)+border+'px';
    });
  });
})();
