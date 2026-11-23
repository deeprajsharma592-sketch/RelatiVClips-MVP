import { fiberData } from "./audienceFiberData.js";

export function mountAudienceWeb(canvas, reducedMotion) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const raw = atob(fiberData);
  const bytes = Uint8Array.from(raw,c=>c.charCodeAt(0));
  const data = new DataView(bytes.buffer);
  const palette = ['#ece6df','#fffaf2','#cdc0b8','#e5d5cc','#bfaea8'];
  const strands = [];
  for(let offset=0;offset<bytes.length;) {
    const color = data.getUint8(offset++);
    const count = data.getUint16(offset,true);
    offset += 2;
    const points = [];
    for(let i=0;i<count;i++,offset+=8) {
      if (i%3===0 || i===count-1) points.push([(data.getInt16(offset,true)/1000+5)/10.85,
        data.getInt16(offset+2,true)/1000,data.getInt16(offset+4,true)/1000,data.getUint16(offset+6,true)/10000]);
    }
    strands.push({color:palette[color],points});
  }

  const cards = [
    {label:'Agencies',icon:'layers',x:480,y:113,w:178},
    {label:'Developers',icon:'code',x:760,y:174,w:210},
    {label:'Brands',icon:'tag',x:805,y:281,w:155},
    {label:'E-commerce',icon:'cart',x:763,y:411,w:213},
    {label:'SaaS',icon:'cloud',x:480,y:465,w:145},
    {label:'Entrepreneurs',icon:'rocket',x:193,y:411,w:221},
    {label:'Creators',icon:'play',x:154,y:281,w:161},
    {label:'Teams',icon:'teams',x:198,y:174,w:154}
  ];
  const icons = {
    layers:'M2 8 12 3 22 8 12 13ZM2 12l10 5 10-5M2 16l10 5 10-5',
    code:'M8 6 2 12l6 6m8-12 6 6-6 6m-2-14-4 16',
    tag:'M3 11 11 3h8l2 2v8l-8 8a2 2 0 0 1-3 0l-7-7a2 2 0 0 1 0-3Zm13-4h.01',
    cart:'M1 3h3l4 13h11l3-9H6m4 13h.01m8 0h.01',
    cloud:'M7 19a5 5 0 0 1-1-10 6 6 0 0 1 11 0 5 5 0 1 1 1 10Z',
    rocket:'M9 16 7 13c2-6 7-10 14-10 0 7-4 12-10 14L9 16Zm2-8-5 1-3 4h4m9 0-1 5-4 3v-4M6 17l-3 4 4-2m8-11a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0',
    play:'M2 5h20v14H2Zm8 4 5 3-5 3Z',
    teams:'M8 18v-2a4 4 0 0 1 8 0v2M2 18v-1a3 3 0 0 1 4-3m16 4v-1a3 3 0 0 0-4-3M12 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM5 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z'
  };
  for (const name in icons) icons[name] = new Path2D(icons[name]);
  const cx=480,cy=280.8, halfH=23;
  const clamp=t=>Math.max(0,Math.min(1,t));
  const ease=t=>1-Math.pow(1-clamp(t),3);
  for(const card of cards) {
    const dx=card.x-cx,dy=card.y-cy,length=Math.hypot(dx,dy);
    card.ux=dx/length;
    card.uy=dy/length;
    card.target=length;
    card.inset=Math.min(card.w*.5/Math.max(.0001,Math.abs(card.ux)),halfH/Math.max(.0001,Math.abs(card.uy)));
    card.off=Math.min((480+card.w*.55+46)/Math.max(.0001,Math.abs(card.ux)),
                      (270+halfH+42)/Math.max(.0001,Math.abs(card.uy)));
  }

  function tile(card,dist,driftX,driftY) {
    const x=cx+dist*card.ux+driftX,y=cy+dist*card.uy+driftY;
    ctx.fillStyle='#111217';
    ctx.strokeStyle='#e6e1df';
    ctx.lineWidth=1.35;
    ctx.beginPath();
    ctx.roundRect(x-card.w/2,y-halfH,card.w,halfH*2,8);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(x-card.w/2+12,y-12);
    ctx.lineWidth=1.65;
    ctx.lineJoin='round';
    ctx.lineCap='round';
    ctx.stroke(icons[card.icon]);
    ctx.restore();
    ctx.fillStyle='#fff';
    ctx.font='650 18px system-ui,sans-serif';
    ctx.textAlign='left';
    ctx.textBaseline='middle';
    ctx.fillText(card.label,x-card.w/2+46,y+.5);
  }

  function web(card,end,spread,energy,t,grip,driftX,driftY,floatTime) {
    if(end < 2) return;
    const scale=Math.min(30,4+end*.054)*spread;
    const driftBend=Math.hypot(driftX,driftY)*.42;
    const roll=.34+Math.sin(floatTime+card.ux*2)*.16;
    const onSide=card.w*.5*Math.abs(card.uy)<halfH*Math.abs(card.ux);
    const tangentX=onSide?0:1, tangentY=onSide?1:0;
    const inwardX=onSide?Math.sign(card.ux):0, inwardY=onSide?0:Math.sign(card.uy);
    const widths=[.24,.39,.57,.81,1.12,1.48,1.95,2.55,3.25];
    const layers=new Map();

    for(let index=0;index<strands.length;index++) {
      const {color,points}=strands[index];
      const anchored=index<17;
      const tip=points[points.length-1];
      const offset=((index*7)%17-8)*1.05;
      let paths=layers.get(color);
      if(!paths) {
        paths=widths.map(()=>new Path2D());
        layers.set(color,paths);
      }
      let previousX, previousY, previousRadius, previousBand=-1;
      for(const [along,y,z,r] of points) {
        const axis=along*end+z*(4+energy*5);
        const curve=Math.sin(along*Math.PI)*(energy*8*Math.sin(t*14+card.uy*4+along*5)
          + driftBend*Math.sin(floatTime+along*4));
        const cross=(y+z*roll)*scale+curve;
        let x=cx+axis*card.ux-cross*card.uy+driftX*along;
        let py=cy+axis*card.uy+cross*card.ux+driftY*along;
        let radius=r;
        if(anchored && grip>0) {
          const progress=clamp((along/tip[0]-.58)/.42);
          const blend=grip*progress*progress*(3-2*progress);
          const tail=(1-along/tip[0])*end*.93;
          const contact=end-2-tail;
          x+=(cx+contact*card.ux+offset*tangentX+inwardX*2+driftX-x)*blend;
          py+=(cy+contact*card.uy+offset*tangentY+inwardY*2+driftY-py)*blend;
          radius+=(Math.max(r,.008+(index%4)*.001)-r)*blend;
        }
        if(previousRadius!==undefined) {
          const width=(previousRadius+radius)*(27+spread*19);
          let band=0;
          while(band<widths.length-1 && width>widths[band]) band++;
          const path=paths[band];
          if(band!==previousBand) path.moveTo(previousX,previousY);
          path.lineTo(x,py);
          previousBand=band;
        }
        previousX=x;
        previousY=py;
        previousRadius=radius;
      }
    }

    for(let band=widths.length-1;band>=0;band--) {
      const width=widths[band];
      ctx.globalAlpha=Math.min(.8,.16+width*.36);
      ctx.lineWidth=width;
      for(const [color,paths] of layers) {
        ctx.strokeStyle=color;
        ctx.stroke(paths[band]);
      }
    }
    ctx.globalAlpha=1;
  }

  function draw(seconds, floating = true) {
    ctx.setTransform(1.5,0,0,1.5,0,0);
    ctx.clearRect(0,0,960,540);
    ctx.lineCap='round';

    for(let index=0;index<cards.length;index++) {
      const card=cards[index], t=seconds-index*.026;
      if(t<=0) continue;
      const shot=ease(t/.67);
      const pull=ease((t-.71)/1.35);
      const settled=clamp((t-.71)/1.65);
      const dist=card.off+(card.target-card.off)*pull;
      const reach=(card.off-card.inset)*shot;
      const end=t<.71?reach:dist-card.inset+3;
      const floatTime=Math.max(0,t-1.75);
      const drift=floating ? ease(floatTime/1.5) : 0;
      const driftX=drift*5.5*Math.sin(floatTime*.86+index*1.71);
      const driftY=drift*6.5*Math.sin(floatTime*1.08+index*2.13);
      const spread=.67+.35*(1-settled);
      web(card,end,spread,1-settled,t,ease((t-.71)/.42),driftX,driftY,floating?floatTime:0);
      if(t>=.71) tile(card,dist,driftX,driftY);
    }
  }

  let frame = 0;
  let lastDraw = null;
  let seconds = 0;
  let playing = false;
  let visible = false;

  function animate(now) {
    if (reducedMotion.matches) {
      frame = 0;
      draw(2.65, false);
      return;
    }
    const elapsed = lastDraw === null ? 1000 / 30 : now - lastDraw;
    if (elapsed >= 31) {
      seconds += elapsed / 1000;
      lastDraw = now;
      draw(seconds);
    }
    frame = requestAnimationFrame(animate);
  }

  function setVisible(nextVisible) {
    visible = nextVisible;
    if (!visible) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastDraw = null;
    } else if (playing && !frame && !reducedMotion.matches) {
      frame = requestAnimationFrame(animate);
    }
  }

  function play() {
    playing = true;
    seconds = 0;
    lastDraw = null;
    if (reducedMotion.matches) {
      draw(2.65, false);
      return;
    }
    draw(0);
    setVisible(visible);
  }

  const onMotionChange = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (reducedMotion.matches) draw(2.65, false);
    else if (playing) play();
    else draw(0);
  };
  reducedMotion.addEventListener("change", onMotionChange);
  draw(reducedMotion.matches ? 2.65 : 0, false);

  return {
    play,
    setVisible,
    dispose() {
      setVisible(false);
      reducedMotion.removeEventListener("change", onMotionChange);
    },
  };
}
