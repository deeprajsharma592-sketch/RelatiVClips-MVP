type Point = [number, number, number];
type Face = { points: Point[]; tone: number; color: number[] };

const faces: Face[] = [];
const hullColor = [35, 55, 82];
const hull = (u: number, v: number): Point => {
  const x = -Math.cos(u);
  const radius = Math.sin(u) * (1 - .24 * x);
  return [1.65 * x, .47 * radius * Math.cos(v), .45 * radius * Math.sin(v)];
};

for (let i = 0; i < 18; i++) {
  for (let j = 0; j < 20; j++) {
    const u = Math.PI * i / 18, v = Math.PI * j / 10;
    const nextU = u + Math.PI / 18, nextV = v + Math.PI / 10;
    const light = .40 + .64 * Math.max(0, Math.cos(v - .36));
    faces.push({ points: [hull(u,v), hull(nextU,v), hull(nextU,nextV), hull(u,nextV)], tone: light, color: hullColor });
  }
}

const finColor = [36, 54, 80];
for (const side of [-1, 1]) {
  faces.push(
    { points: [[.87,0,0],[1.24,.70*side,0],[1.58,.70*side,0],[1.59,0,0]], tone: .83, color: finColor },
    { points: [[.94,0,0],[1.35,0,.59*side],[1.58,0,.59*side],[1.59,0,0]], tone: .67, color: finColor },
    { points: [[-.35,-.40,.15*side],[.40,-.40,.15*side],[.29,-.58,.13*side],[-.27,-.58,.13*side]], tone: .7, color: finColor },
  );
}
faces.push({ points: [[-.27,-.58,-.13],[.29,-.58,-.13],[.29,-.58,.13],[-.27,-.58,.13]], tone: .65, color: finColor });

const glyphs: Record<string, string[]> = {
  O:["01110","10001","10001","10001","01110"], W:["10001","10001","10101","10101","01010"],
  N:["10001","11001","10101","10011","10001"], Y:["10001","01010","00100","00100","00100"],
  U:["10001","10001","10001","10001","01110"], R:["11110","10001","11110","10100","10011"],
  T:["11111","00100","00100","00100","00100"], A:["01110","10001","11111","10001","10001"],
  S:["01111","10000","01110","00001","11110"], E:["11111","10000","11110","10000","11111"],
};

const lamps: Face[] = [];
for (const side of [-1, 1]) {
  for (const [i, letter] of Array.from("OWN YOUR TASTE").entries()) {
    for (const [row, bits] of (glyphs[letter] ?? []).entries()) {
      for (const [col, bit] of Array.from(bits).entries()) {
        if (bit !== "1") continue;
        const x = -1.05 + (i * 6 + col) * .025;
        const y = .145 - row * .053;
        const dot = (dx: number, dy: number): Point => {
          const a = (x + dx) * side;
          const b = y + dy;
          const u = Math.acos(-a / 1.65);
          const radius = Math.sin(u) * (1 - .24 * a / 1.65);
          return [a,b,side * (.009 + .45 * Math.sqrt(Math.max(0,radius*radius-(b/.47)**2)))];
        };
        lamps.push({ points: [dot(0,0),dot(.018,0),dot(.018,.038),dot(0,.038)], tone: side, color: [202, 239, 255] });
      }
    }
  }
}

const random = (low: number, high: number) => low + Math.random() * (high - low);
const ease = (t: number) => t * t * (3 - 2 * t);
type Pass = { y: number; from: number; to: number; direction: number; duration: number; retreat?: { at: number; x: number; scale: number } };
const protectedContent = [
  "header", "footer", "h1,h2,h3,h4,h5,h6,p,li", "a,button,input,textarea,select",
  "img,svg,video,canvas", "[data-taste-redesign]",
].join(",");

export function mountFloatingAirship(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pass: Pass | null = null;
  let start = performance.now() + random(1200,3200);
  let width = 0, height = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  let obstacles: DOMRect[] = [];
  let lastScan = -Infinity;
  const hero = document.querySelector('[aria-label="Hero message"]');
  const pause = (now: number, delay: number) => {
    pass = null;
    start = now + delay;
    timer = setTimeout(() => { frame = requestAnimationFrame(render); }, delay);
  };

  function render(now: number) {
    if (!ctx) return;
    if (now < start) {
      timer = setTimeout(() => { frame = requestAnimationFrame(render); }, start - now);
      return;
    }
    ctx.clearRect(0,0,width,height);
    const heroBox = hero?.getBoundingClientRect();
    if (heroBox && heroBox.bottom > 0 && heroBox.top < height) {
      pause(now,random(2200,4200));
      return;
    }

    const maxScale = Math.min(91,Math.max(39,width*.068));
    if (now-lastScan>90) {
      obstacles = Array.from(document.querySelectorAll(protectedContent))
        .filter(element => element !== canvas && !element.closest('[aria-hidden="true"]:not(canvas):not(svg):not(img):not(video)'))
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 2 && rect.height > 2 && rect.right > 0 && rect.left < width && rect.bottom > 0 && rect.top < height);
      lastScan = now;
    }
    const intersects = (x: number, y: number, halfWidth: number, halfHeight: number) =>
      obstacles.some(rect => rect.left < x+halfWidth && rect.right > x-halfWidth && rect.top < y+halfHeight && rect.bottom > y-halfHeight);
    if (!pass) {
      const lanes = Array.from({length:14},(_,i)=>height*(.13+i*.052));
      const clearance = maxScale*.77+12;
      const corridors = lanes.flatMap(y => {
        const intervals = obstacles.filter(rect=>rect.top<y+clearance && rect.bottom>y-clearance)
          .sort((a,b)=>a.left-b.left);
        const gaps: { y: number; left: number; right: number }[] = [];
        let cursor = 0;
        for (const rect of intervals) {
          if (rect.left-cursor>maxScale*6) gaps.push({y,left:cursor,right:rect.left});
          cursor = Math.max(cursor,rect.right);
        }
        if (width-cursor>maxScale*6) gaps.push({y,left:cursor,right:width});
        return gaps;
      });
      if (!corridors.length) {
        pause(now,random(3800,6700));
        return;
      }
      const {y,left,right} = corridors[Math.floor(random(0,corridors.length))];
      const fromLeft = Math.random()<.5;
      const first = left===0 ? -maxScale : left+maxScale*2.35+12;
      const last = right===width ? width+maxScale : right-maxScale*2.35-12;
      pass = {y,from:fromLeft?first:last,to:fromLeft?last:first,direction:fromLeft?1:-1,duration:random(13000,17000)};
      start = now;
    }
    const progress = (now-start)/pass.duration;
    if (progress >= 1 && !pass.retreat) {
      pause(now,random(18000,34000));
      return;
    }
    const y = pass.y;
    let x = pass.from + (pass.to-pass.from)*progress;
    const approach = Math.sin(Math.PI*Math.min(1,progress))**.75;
    let scale = maxScale*(.25+.75*approach);
    let opacity = ease(Math.min(1,approach*2.1))*.82;
    if (!pass.retreat && intersects(x,y,scale*2.35+12,scale*.77+10)) {
      pass.retreat = { at:now, x, scale };
    }
    if (pass.retreat) {
      const elapsed = (now-pass.retreat.at)/480;
      if (elapsed >= 1) {
        pause(now,random(18000,34000));
        return;
      }
      const retreat = ease(elapsed);
      x = pass.retreat.x - pass.direction * pass.retreat.scale * retreat;
      scale = pass.retreat.scale*(1-.78*retreat);
      opacity *= (1-retreat)**2;
      if (intersects(x,y,scale*2.35+4,scale*.77+4)) {
        frame = requestAnimationFrame(render);
        return;
      }
    }
    const yaw = (pass.direction>0?Math.PI:0) + .16*Math.sin(progress*Math.PI*2);
    const roll = .035*Math.sin(progress*Math.PI*2);
    const pitch = .13;
    const ca=Math.cos(yaw),sa=Math.sin(yaw),cr=Math.cos(roll),sr=Math.sin(roll),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const project = ([px,py,pz]: Point): Point => {
      const a=ca*px+sa*pz, b=ca*pz-sa*px;
      const c=cp*py-sp*b, z=sp*py+cp*b;
      const size=scale*5/(5-z);
      return [x+(cr*a-sr*c)*size, y-(sr*a+cr*c)*size, z];
    };
    ctx.globalAlpha = opacity;
    const visibleSide=ca>0?1:-1;
    const projected = [...faces,...lamps.filter(lamp=>lamp.tone===visibleSide)].map(face=>{
      const points=face.points.map(project);
      return { face,points,depth:points.reduce((sum,p)=>sum+p[2],0)/points.length };
    }).sort((a,b)=>a.depth-b.depth);
    for (const {face,points} of projected) {
      ctx.fillStyle = `rgb(${face.color.map(c=>Math.round(c*Math.abs(face.tone))).join(",")})`;
      ctx.beginPath();
      ctx.moveTo(points[0][0],points[0][1]);
      for (const p of points.slice(1)) ctx.lineTo(p[0],p[1]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle=ctx.fillStyle;
      ctx.lineWidth=.42;
      ctx.stroke();
    }
    const tail=project([1.58,0,0]), tip=project([2.24+.08*Math.sin(now/38),0,0]);
    const glow=ctx.createLinearGradient(tail[0],tail[1],tip[0],tip[1]);
    glow.addColorStop(0,"#c8f1ff");glow.addColorStop(.32,"#54bafa");glow.addColorStop(1,"#33a6ff00");
    ctx.strokeStyle=glow;
    ctx.lineWidth=Math.max(1,scale*.046);
    ctx.beginPath();ctx.moveTo(tail[0],tail[1]);ctx.lineTo(tip[0],tip[1]);ctx.stroke();
    ctx.globalAlpha=1;
    frame=requestAnimationFrame(render);
  }
  frame=requestAnimationFrame(render);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    observer.disconnect();
    ctx.clearRect(0,0,width,height);
  };
}
