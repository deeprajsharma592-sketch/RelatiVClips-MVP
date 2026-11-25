import { mountTowerPosters } from "./studioTowerPosters";

export async function mountStudioTower(root, signal, options = {}) {
  if (signal.aborted) return;
  let animationFrame = 0;
  let observer;
  let resetTimer;
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(animationFrame);
    clearTimeout(resetTimer);
    observer?.disconnect();
  }, { once: true });
  const canvas = root.querySelector('canvas');
  const status = root.querySelector('[role=status]');
  try {
    const gl = canvas.getContext('webgl2', {alpha:true,antialias:true});
    if (!gl) throw new Error('WebGL 2 unavailable');
    const vertex = `#version 300 es
    in vec3 position; in vec3 normal; in vec2 uv;
    uniform vec4 camera; uniform float aspect; uniform vec2 motion; uniform float plume; uniform vec4 flightPose; uniform vec3 cameraOffset;
    out vec3 n; out vec2 t;
    vec3 orbit(vec3 p) {
      vec3 q=vec3(camera.y*p.x+camera.x*p.z,p.y,camera.y*p.z-camera.x*p.x);
      return vec3(q.x,camera.w*q.y-camera.z*q.z,camera.z*q.y+camera.w*q.z);
    }
    void main() {
      vec3 p=position;
      if(plume>0.) {
        float trail=1.-smoothstep(.0,1.82,p.y);
        p.xz*=1.+trail*.14*sin(motion.y*13.-p.y*12.);
        p.y+=trail*.045*sin(motion.y*18.-p.y*9.);
      }
      vec3 q=orbit(p+vec3(0.,motion.x-3.79,0.));
      q-=cameraOffset;
      float w=1.+(1.-flightPose.z)*.55-q.z/17.;
      float scale=.246*min(1.,aspect/.50);
      float c=cos(flightPose.w), s=sin(flightPose.w);
      mat2 bank=mat2(c,s,-s,c);
      vec2 projected=bank*q.xy*scale*flightPose.z;
      gl_Position=vec4(projected/vec2(aspect,1.)+flightPose.xy*w,-q.z*.06,w);
      n=orbit(normal);
      n.xy=bank*n.xy;
      t=uv;
    }`;
    const fragment = `#version 300 es
    precision highp float;
    in vec3 n; in vec2 t; out vec4 color;
    uniform bool textured; uniform sampler2D image; uniform vec3 metal; uniform float plume;
    void main() {
      vec3 N=normalize(n);
      float diffuse=max(dot(N,vec3(-.42,.69,.59)),0.);
      if(plume>0.) {
        float edge=pow(clamp(N.z,0.,1.),.65);
        float root=1.-smoothstep(.68,1.,t.y);
        vec3 tint=mix(vec3(.015,.27,1.),metal,root);
        float opacity=plume<.5 ? plume*edge*root : mix(.28,1.,root);
        color=vec4(tint,opacity);
      } else if (textured) {
        color=vec4(texture(image,t).rgb*(.86+.14*diffuse),1.);
      } else if (metal.r>.9 && metal.g<.34) {
        color=vec4(vec3(.98,.40,.13)*(.85+.15*diffuse),1.);
      } else {
        vec3 R=reflect(vec3(0.,0.,-1.),N);
        float cool=max(0.,dot(R,normalize(vec3(.80,.28,.43))));
        float key=pow(max(0.,dot(R,normalize(vec3(-.62,.22,.74)))),8.);
        float soft=pow(max(0.,dot(R,normalize(vec3(-.72,.45,.50)))),2.);
        float rim=pow(max(0.,dot(R,normalize(vec3(.92,.18,-.35)))),14.);
        float warm=pow(max(0.,dot(R,normalize(vec3(-.15,-.82,.53)))),2.);
        float under=step(.12,metal.r-metal.b);
        float band=pow(max(0.,dot(R,normalize(vec3(-.23,-.91,.40)))),6.);
        float base=.20+.12*diffuse;
        vec3 finish=vec3(base)+vec3(.09,.23,.40)*cool+vec3(.24,.29,.36)*soft
          +vec3(.43,.43,.42)*key+vec3(.31,.44,.65)*rim+vec3(.26,.20,.13)*warm;
        vec3 underside=vec3(.245,.218,.172)+vec3(.18,.14,.084)*warm+vec3(.55,.47,.34)*band+vec3(.16,.17,.20)*rim;
        color=vec4(mix(finish*(.52+metal*.84),underside,under),1.);
      }
    }`;
    const program = gl.createProgram();
    for (const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const uniforms=Object.fromEntries(['camera','aspect','textured','metal','motion','plume','flightPose','cameraOffset'].map(key=>[key,gl.getUniformLocation(program,key)]));
    const [mesh,images]=options.modelData ?? await fetch('/studio-tower/mesh.json', {signal}).then(response=>{
      if(!response.ok) throw new Error('Model data could not load');
      return response.json();
    });
    if(signal.aborted) return;
    const bytes = value => Uint8Array.from(atob(value),c=>c.charCodeAt(0));
    const textures=await Promise.all(images.map(async data=>{
      const dataUrl='data:image/jpeg;base64,'+data;
      const image=new Image();
      image.src=dataUrl;
      await image.decode();
      if(signal.aborted) return null;
      const id=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,id);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      return id;
    }));
    if(signal.aborted) return;
    const meshes=await Promise.all(mesh.map(async ([count,indexCount,color,texture,data])=>{
      const stream=new Blob([bytes(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
      const raw=await new Response(stream).arrayBuffer();
      if(signal.aborted) return null;
      const vao=gl.createVertexArray();
      gl.bindVertexArray(vao);
      const attributes=[
        ['position',3,new Int16Array(raw,0,count*3),4096],
        ['normal',3,new Int8Array(raw,count*6,count*3),127],
        ['uv',2,null,32767]
      ];
      const uvOffset=count*9;
      const packed=new DataView(raw);
      attributes[2][2]=Int16Array.from({length:count*2},(_,i)=>packed.getInt16(uvOffset+i*2,true));
      for (const [name,size,array,factor] of attributes) {
        const location=gl.getAttribLocation(program,name);
        gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER,Float32Array.from(array,x=>x/factor),gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);
      }
      const delta=new Int16Array(raw,Math.ceil(count*13/2)*2,indexCount);
      let previous=0;
      const indices=Uint32Array.from(delta,value=>(previous+=value));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
      const plume=color[2]>.9 && color[0]<.6 ? (color[0]>.5 ? 1 : color[0]>.02 ? .55 : .24) : 0;
      const posterGeometry=texture>=0 && texture<4
        ? {positions:attributes[0][2], normals:attributes[1][2]}
        : null;
      return {vao,indexCount,color,texture,plume,posterGeometry};
    }));
    if(signal.aborted) return;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0,0,0,0);
    const tau=Math.PI*2;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let clock=0;
    const homeAzimuth=-Math.PI/4;
    const homePitch=-.39;
    const returnDelay=1000;
    const returnDuration=700;
    const readingPause=2200;
    let azimuth=homeAzimuth, pitch=homePitch, drag=null, last=0;
    const flightDuration=7200;
    const flightThreshold=3300;
    const flightGestureDuration=2200;
    const gestureGap=300;
    const restPose=[0,0,1,0];
    let returnView=null;
    let flight=null;
    let flightPose=restPose;
    let gesture=null;
    let hiddenPoster=-1;
    const posterPanel=mountTowerPosters(root,canvas,signal,()=>{
      hiddenPoster=-1;
      queueReturn();
      draw();
    },options.interactiveLinks ?? true);

    function visiblePosters(){
      const rect=canvas.getBoundingClientRect();
      if(!rect.width || !rect.height) return [];
      const aspect=rect.width/rect.height;
      const scale=.246*Math.min(1,aspect/.5);
      const ca=Math.cos(azimuth), sa=Math.sin(azimuth);
      const cp=Math.cos(pitch), sp=Math.sin(pitch);
      const bob=.075*Math.sin(clock*tau/4.5)-3.79;
      const results=[];
      for(const {texture,posterGeometry} of meshes){
        if(!posterGeometry) continue;
        const {positions,normals}=posterGeometry;
        let left=Infinity, right=-Infinity, top=Infinity, bottom=-Infinity;
        let nearest=-Infinity, normalX=0, normalZ=0, count=0;
        for(let i=0;i<positions.length;i+=3){
          const nx=normals[i]/127, ny=normals[i+1]/127, nz=normals[i+2]/127;
          const facing=sp*ny+cp*(ca*nz-sa*nx);
          if(facing<.12) continue;
          normalX+=ca*nx+sa*nz;
          normalZ+=facing;
          count++;
          const x=positions[i]/4096, y=positions[i+1]/4096+bob, z=positions[i+2]/4096;
          const orbitZ=ca*z-sa*x;
          const depth=sp*y+cp*orbitZ;
          const w=1-depth/17;
          const px=rect.left+(1+(ca*x+sa*z)*scale/(aspect*w))*rect.width/2;
          const py=rect.top+(1-(cp*y-sp*orbitZ)*scale/w)*rect.height/2;
          left=Math.min(left,px);
          right=Math.max(right,px);
          top=Math.min(top,py);
          bottom=Math.max(bottom,py);
          nearest=Math.max(nearest,depth);
        }
        if(count && right-left>12 && bottom-top>8){
          const tilt=Math.atan2(normalX,normalZ)*180/Math.PI;
          results.push({texture,left,right,top,bottom,width:right-left,height:bottom-top,nearest,tilt});
        }
      }
      return results.sort((a,b)=>b.nearest-a.nearest);
    }

    function openPoster(poster){
      if(!poster || flight || posterPanel.active) return;
      hiddenPoster=poster.texture;
      returnView=null;
      clearTimeout(resetTimer);
      posterPanel.open(poster.texture,poster,images[poster.texture],reducedMotion);
      draw();
    }

    function draw(){
      const rect=canvas.getBoundingClientRect();
      const ratio=Math.min(window.devicePixelRatio||1,2);
      const width=Math.max(1,Math.round(rect.width*ratio));
      const height=Math.max(1,Math.round(rect.height*ratio));
      if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const slide=reducedMotion ? 0 : posterPanel.cameraProgress;
      const cameraAzimuth=azimuth+slide*.43;
      const cameraPitch=pitch+slide*.07;
      const aspect=width/height;
      gl.uniform4f(uniforms.camera,Math.sin(cameraAzimuth),Math.cos(cameraAzimuth),Math.sin(cameraPitch),Math.cos(cameraPitch));
      gl.uniform1f(uniforms.aspect,aspect);
      gl.uniform3f(uniforms.cameraOffset,slide*aspect*2.2,slide*.08,slide*1.2);
      gl.uniform4fv(uniforms.flightPose,flightPose);
      gl.uniform2f(uniforms.motion,.075*Math.sin(clock*tau/4.5),clock);
      for(const mesh of meshes){
        if(mesh.texture>=0 && mesh.texture===hiddenPoster) continue;
        if(mesh.plume){
          gl.enable(gl.BLEND);
          gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(false);
        }
        gl.uniform1f(uniforms.plume,mesh.plume);
        gl.bindVertexArray(mesh.vao);
        gl.uniform1i(uniforms.textured,mesh.texture>=0);
        gl.uniform3fv(uniforms.metal,mesh.color);
        gl.bindTexture(gl.TEXTURE_2D,textures[mesh.texture]||null);
        gl.drawElements(gl.TRIANGLES,mesh.indexCount,gl.UNSIGNED_INT,0);
        if(mesh.plume){
          gl.depthMask(true);
          gl.disable(gl.BLEND);
        }
      }
    }
    function animate(now){
      const elapsed=last ? Math.min(now-last,80) : 0;
      last=now;
      if(!posterPanel.active) clock+=elapsed/1000;
      if(posterPanel.active) {
        draw();
        animationFrame=requestAnimationFrame(animate);
        return;
      }
      if(flight){
        const progress=Math.max(0,Math.min(1,(now-flight.start)/flightDuration));
        const eased=progress*progress*(3-2*progress);
        const distance=Math.sin(Math.PI*eased);
        const orbitAngle=tau*eased;
        const cameraArc=Math.sin(orbitAngle);
        flightPose=[
          flight.direction*.56*Math.sin(orbitAngle)*distance,
          distance*(.12+.24*cameraArc),
          1-.32*distance,
          -flight.direction*.29*Math.cos(orbitAngle)*distance,
        ];
        azimuth=flight.azimuth+flight.turn*eased;
        pitch=flight.pitch+(homePitch-flight.pitch)*eased+distance*(.35+.70*cameraArc);
        if(progress===1){
          flight=null;
          flightPose=restPose;
          azimuth=homeAzimuth;
          pitch=homePitch;
          returnView={start:now-returnDuration,azimuth,pitch,turn:0};
        }
      } else if(returnView){
        const progress=Math.max(0,Math.min(1,(now-returnView.start)/returnDuration));
        const eased=progress*progress*(3-2*progress);
        azimuth=returnView.azimuth+returnView.turn*eased;
        pitch=returnView.pitch+(homePitch-returnView.pitch)*eased;
        if(now>=returnView.start+returnDuration+readingPause) returnView=null;
      } else if(!drag){
        azimuth=(azimuth-elapsed*tau/18000)%tau;
      }
      draw();
      animationFrame=requestAnimationFrame(animate);
    }
    canvas.addEventListener('pointerdown',event=>{
      if(drag||flight||posterPanel.active||event.button!==0) return;
      gesture=null;
      clearTimeout(resetTimer);
      returnView=null;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};
      canvas.setPointerCapture(event.pointerId);
    }, {signal});
    canvas.addEventListener('pointermove',event=>{
      if(drag?.id!==event.pointerId)return;
      if(!drag.moved && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<5) return;
      drag.moved=true;
      azimuth+=(event.clientX-drag.x)*.011;
      pitch=Math.max(-1.1,Math.min(1.1,pitch+(event.clientY-drag.y)*.009));
      drag.x=event.clientX;
      drag.y=event.clientY;
      draw();
    }, {signal});
    function queueReturn(delay=returnDelay){
      if(reducedMotion){
        clearTimeout(resetTimer);
        resetTimer=setTimeout(()=>{
          azimuth=homeAzimuth;
          pitch=homePitch;
          draw();
        },delay);
        return;
      }
      const delta=homeAzimuth-azimuth;
      returnView={
        start:performance.now()+delay,
        azimuth,
        pitch,
        turn:Math.atan2(Math.sin(delta),Math.cos(delta)),
      };
    }
    canvas.addEventListener('pointerup',event=>{
      if(drag?.id!==event.pointerId || drag.moved) return;
      const {clientX:x,clientY:y}=event;
      const poster=visiblePosters().find(p=>x>=p.left && x<=p.right && y>=p.top && y<=p.bottom);
      if(poster){
        drag=null;
        openPoster(poster);
      }
    }, {signal});
    canvas.addEventListener('keydown',event=>{
      if(flight || posterPanel.active) return;
      if(event.key==='Enter' || event.key===' '){
        event.preventDefault();
        openPoster(visiblePosters()[0]);
      } else if(event.key==='ArrowLeft' || event.key==='ArrowRight'){
        event.preventDefault();
        azimuth+=event.key==='ArrowLeft' ? -.5 : .5;
        queueReturn();
        draw();
      }
    }, {signal});
    canvas.addEventListener('lostpointercapture',event=>{
      if(drag?.id!==event.pointerId) return;
      drag=null;
      queueReturn(reducedMotion?0:returnDelay);
    }, {signal});
    canvas.addEventListener('wheel',event=>{
      if(drag||event.ctrlKey||posterPanel.active) return;
      const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY);
      const delta=horizontal?event.deltaX:event.shiftKey?event.deltaY:0;
      if(!delta) return;
      if(event.cancelable) event.preventDefault();
      if(flight) return;
      const unit=event.deltaMode===1?16:event.deltaMode===2?canvas.clientWidth:1;
      const pixels=Math.max(-120,Math.min(120,delta*unit));
      azimuth=(azimuth+pixels*.006)%tau;
      const now=performance.now();
      const direction=Math.sign(pixels);
      if(!gesture||gesture.direction!==direction||now-gesture.last>gestureGap){
        gesture={direction,start:now,last:now,distance:0};
      }
      gesture.last=now;
      gesture.distance+=Math.abs(pixels);
      if(!reducedMotion&&gesture.distance>=flightThreshold&&now-gesture.start>=flightGestureDuration){
        const delta=homeAzimuth-azimuth;
        flight={
          start:now,
          direction,
          azimuth,
          pitch,
          turn:Math.atan2(Math.sin(delta),Math.cos(delta))+direction*2*tau,
        };
        gesture=null;
        returnView=null;
      } else {
        queueReturn();
      }
      draw();
    }, {passive:false,signal});
    observer=new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    root.dataset.live='true';
    status.hidden=true;
    if(!reducedMotion) animationFrame=requestAnimationFrame(animate);
  } catch(error) {
    if(signal.aborted) return;
    status.textContent='Live 3D is unavailable in this panel. A still image of the tower is shown.';
    console.error(error);
  }
}
