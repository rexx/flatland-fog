// Renders a Flatland figure as a thin slab seen from slightly above the plane.
// Every surface is shaded by the same fog as the 1D view: the farther a point is
// from the observer (measured in the plane), the more it fades into the background.
// Requires three.js (r128) loaded as a global before this script.
(function(global){
  const G=global.FlatlandGeometry;
  const THICKNESS=0.035;

  const VERTEX='varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}';
  const FRAGMENT='uniform vec3 col;uniform vec3 bg;uniform float k;uniform float D;uniform float R;varying vec3 vW;'+
    'void main(){float d=length(vec2(vW.x,vW.z-D));float b=clamp(exp(-k*(d-(D-R))),0.0,1.0);gl_FragColor=vec4(mix(bg,col,b),1.0);}';

  // Colour schemes. "ink" matches the book's black-on-white plates; "colour" is for the sections after the Colour Bill.
  const SCHEMES={
    colour:{top:'#AFA9EC',side:'#FFFFFF',edge:null,grid:['#3a4a6e','#23345c']},
    ink:{top:'paper-2',side:'ink',edge:'ink',grid:['paper-grid','paper-grid']}
  };

  function outline(kind,v){
    if(kind==='0'){const a=[];for(let i=0;i<128;i++)a.push(-90+360*i/128);return G.onCircle(a,0);}
    if(kind==='seg'){
      const[P,Q]=v;const dx=Q[0]-P[0],dy=Q[1]-P[1],L=Math.hypot(dx,dy),nx=-dy/L*0.015,ny=dx/L*0.015;
      return[[P[0]+nx,P[1]+ny],[Q[0]+nx,Q[1]+ny],[Q[0]-nx,Q[1]-ny],[P[0]-nx,P[1]-ny]];
    }
    return v;
  }

  // Scheme entries are either hex colours or CSS token names resolved at render time.
  function resolve(value){
    if(!value||value.startsWith('#'))return value;
    return getComputedStyle(document.documentElement).getPropertyValue('--'+value).trim()||'#888888';
  }

  // Returns a renderer bound to the canvas, or null when three.js is unavailable.
  function create(canvas,options){
    if(typeof THREE==='undefined')return null;
    const scheme=SCHEMES[(options&&options.scheme)||'colour'];
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(30,2,0.05,50);
    let grid=null,gridKey='';
    // Faces are pushed back slightly so the ink edges are not hidden by depth fighting.
    const material=offset=>new THREE.ShaderMaterial({uniforms:{col:{value:new THREE.Color()},bg:{value:new THREE.Color()},k:{value:0},D:{value:G.D},R:{value:G.R}},vertexShader:VERTEX,fragmentShader:FRAGMENT,polygonOffset:offset,polygonOffsetFactor:1,polygonOffsetUnits:1});
    const mats=[material(true),material(true)];
    const edgeMat=material(false);
    const mesh=new THREE.Mesh(new THREE.BufferGeometry(),mats);scene.add(mesh);
    const edges=new THREE.LineSegments(new THREE.BufferGeometry(),edgeMat);scene.add(edges);

    function syncGrid(){
      const a=resolve(scheme.grid[0]),b=resolve(scheme.grid[1]),key=a+b;
      if(key===gridKey)return;
      if(grid){scene.remove(grid);grid.geometry.dispose();}
      grid=new THREE.GridHelper(8,20,new THREE.Color(a),new THREE.Color(b));grid.position.y=-0.002;scene.add(grid);
      gridKey=key;
    }

    // opts.fitDepth widens the vertical field so the whole figure stays in frame when seen from above.
    // opts.fogColor is what fully fogged points fade into; it defaults to the background,
    // and a slightly different value keeps faded tips distinguishable from it.
    function render(kind,v,k,elevDeg,clearColor,opts){
      opts=opts||{};
      const w=canvas.clientWidth,h=canvas.clientHeight;
      renderer.setPixelRatio(window.devicePixelRatio||1);renderer.setSize(w,h,false);
      renderer.setClearColor(new THREE.Color(clearColor),1);
      const bg=new THREE.Color(opts.fogColor||clearColor);
      syncGrid();

      const shape=new THREE.Shape(outline(kind,v).map(p=>new THREE.Vector2(p[0],p[1])));
      const geo=new THREE.ExtrudeGeometry(shape,{depth:THICKNESS,bevelEnabled:false,curveSegments:1});
      geo.rotateX(-Math.PI/2);
      mesh.geometry.dispose();mesh.geometry=geo;
      edges.geometry.dispose();
      edges.geometry=scheme.edge?new THREE.EdgesGeometry(geo,20):new THREE.BufferGeometry();

      mats[0].uniforms.col.value.set(resolve(scheme.top));
      mats[1].uniforms.col.value.set(resolve(scheme.side));
      if(scheme.edge)edgeMat.uniforms.col.value.set(resolve(scheme.edge));
      [mats[0],mats[1],edgeMat].forEach(m=>{m.uniforms.k.value=k;m.uniforms.bg.value.copy(bg);});

      const phi=elevDeg*G.RAD,dist=G.D+0.25;
      camera.aspect=w/h;
      let half=Math.atan(Math.tan(G.FIELD_HALF)/camera.aspect);
      if(opts.fitDepth)half=Math.max(half,G.FIELD_HALF);
      camera.fov=2*half/G.RAD;
      camera.position.set(0,THICKNESS/2+dist*Math.sin(phi),dist*Math.cos(phi));
      camera.lookAt(0,THICKNESS/2,0);camera.updateProjectionMatrix();
      renderer.render(scene,camera);
    }
    return{render};
  }

  global.FlatlandSlab3D={create};
})(window);
