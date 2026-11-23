export async function mountStudioTower(root, signal) {
  if (signal.aborted) return;
  let animationFrame = 0;
  let observer;
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(animationFrame);
    observer?.disconnect();
  }, { once: true });
  const canvas = root.querySelector('canvas');
  const status = root.querySelector('[role=status]');
  try {
    const gl = canvas.getContext('webgl2', {alpha:true,antialias:true});
    if (!gl) throw new Error('WebGL 2 unavailable');
    const vertex = `#version 300 es
    in vec3 position; in vec3 normal; in vec2 uv;
    uniform vec4 camera; uniform float aspect; uniform vec2 motion; uniform float plume;
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
      float w=1.-q.z/17.;
      float scale=.246*min(1.,aspect/.50);
      gl_Position=vec4(q.x*scale/aspect,q.y*scale,-q.z*.06,w);
      n=orbit(normal); t=uv;
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
    const uniforms=Object.fromEntries(['camera','aspect','textured','metal','motion','plume'].map(key=>[key,gl.getUniformLocation(program,key)]));
    const response=await fetch('/studio-tower/mesh.json', {signal});
    if(!response.ok) throw new Error('Model data could not load');
    const [mesh,images]=await response.json();
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
      return {vao,indexCount,color,texture,plume};
    }));
    if(signal.aborted) return;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0,0,0,0);
    const tau=Math.PI*2;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let clock=0;
    let azimuth=-Math.PI/4, pitch=-.39, drag=null, last=0;
    function draw(){
      const rect=canvas.getBoundingClientRect();
      const ratio=Math.min(window.devicePixelRatio||1,2);
      const width=Math.max(1,Math.round(rect.width*ratio));
      const height=Math.max(1,Math.round(rect.height*ratio));
      if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform4f(uniforms.camera,Math.sin(azimuth),Math.cos(azimuth),Math.sin(pitch),Math.cos(pitch));
      gl.uniform1f(uniforms.aspect,width/height);
      gl.uniform2f(uniforms.motion,.075*Math.sin(clock*tau/4.5),clock);
      for(const mesh of meshes){
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
      clock+=elapsed/1000;
      if(!drag) azimuth=(azimuth-elapsed*tau/18000)%tau;
      draw();
      animationFrame=requestAnimationFrame(animate);
    }
    canvas.addEventListener('pointerdown',event=>{
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};
      canvas.setPointerCapture(event.pointerId);
    }, {signal});
    canvas.addEventListener('pointermove',event=>{
      if(drag?.id!==event.pointerId)return;
      azimuth+=(event.clientX-drag.x)*.011;
      pitch=Math.max(-1.1,Math.min(1.1,pitch+(event.clientY-drag.y)*.009));
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};
      draw();
    }, {signal});
    canvas.addEventListener('lostpointercapture',()=>{drag=null;}, {signal});
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
