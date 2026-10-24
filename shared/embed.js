// Lets an interactive run inside a reading page's <iframe>.
// Inside a frame (or with ?embed=1) the page gets the "embedded" class so it can
// hide its own header, and it reports its height so the host can size the frame.
(function(){
  const params=new URLSearchParams(location.search);
  const embedded=window.parent!==window||params.get('embed')==='1';
  if(!embedded)return;
  document.documentElement.classList.add('embedded');
  if(window.parent===window)return;
  let last=0;
  function report(){
    const h=Math.ceil(document.documentElement.getBoundingClientRect().height);
    if(h===last)return;
    last=h;
    window.parent.postMessage({type:'flatland-fog:height',height:h},'*');
  }
  if('ResizeObserver' in window)new ResizeObserver(report).observe(document.documentElement);
  window.addEventListener('load',report);
})();
