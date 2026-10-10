const clamp = value => Math.min(1, Math.max(0, value));

// One Landing-only loop. Geometry is cached outside the scrolling frame.
export function createLandingScrollDriver({ root, capture = false } = {}) {
  const items = new Map();
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let nextId=0, frame=0, idle=0, slow=0, lastTick=null, destroyed=false, degraded=false;
  const reduced = () => capture || media.matches;
  const ctx = () => ({scrollY:window.scrollY,viewportH:window.innerHeight,reduced:reduced()});
  const measure = item => {
    let node=item.rect==='parent' ? item.el.parentElement : item.el, top=0;
    item.height=node?.offsetHeight || 1;
    while(node){top+=node.offsetTop||0;node=node.offsetParent;}
    item.top=top;item.previous=NaN;
  };
  const stop = () => {if(frame)window.cancelAnimationFrame(frame);frame=0;lastTick=null;slow=0;};
  const terminal = item => {item.compute(1,{...ctx(),reduced:true});item.previous=1;};
  const tick = timestamp => {
    frame=0;if(destroyed || document.hidden || reduced())return;
    const now=Number.isFinite(timestamp)?timestamp:performance.now();
    const elapsed=lastTick===null?0:now-lastTick;lastTick=now;
    const context=ctx();let changed=false;
    for(const item of items.values()) {
      if(item.disabled)continue;
      const raw=(context.scrollY+context.viewportH-item.top)/(item.height+context.viewportH);
      const [start,end]=item.range || [0,1];
      const progress=clamp((raw-start)/(end-start || 1));
      if(Number.isFinite(item.previous)&&Math.abs(progress-item.previous)<.001)continue;
      item.compute(progress,context);item.previous=progress;changed=true;
    }
    slow=elapsed>24?slow+1:0;
    if(slow>=60&&!degraded){degraded=true;for(const item of items.values())if(item.priority==='parallax'){terminal(item);item.disabled=true;}}
    idle=changed?0:idle+1;
    if(idle<30)frame=window.requestAnimationFrame(tick);
  };
  const wake = () => {idle=0;if(!destroyed&&!frame&&!reduced()&&!document.hidden){lastTick=null;slow=0;frame=window.requestAnimationFrame(tick);}};
  const resize = () => {
    for(const item of items.values()) {
      measure(item);
      item.disabled=item.priority==='parallax'&&(window.innerWidth<=760||degraded);
      if(item.disabled||reduced())terminal(item);
    }
    wake();
  };
  const motion = () => {stop();if(reduced())items.forEach(terminal);else{items.forEach(measure);wake();}};
  const visibility = () => {if(document.hidden)stop();else resize();};
  window.addEventListener('scroll',wake,{passive:true});
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',visibility);
  media.addEventListener('change',motion);
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);
  if(root)observer?.observe(root);
  document.fonts?.ready.then(()=>{if(!destroyed)resize();});
  return {
    register(options) {
      if(destroyed || !options.el)return null;
      const id=++nextId,item={...options,previous:NaN};measure(item);
      item.disabled=item.priority==='parallax'&&(window.innerWidth<=760||degraded);
      items.set(id,item);if(reduced()||item.disabled)terminal(item);else wake();return id;
    },
    unregister(id){items.delete(id);if(!items.size)stop();},
    destroy(){destroyed=true;stop();items.clear();observer?.disconnect();window.removeEventListener('scroll',wake);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',motion);}
  };
}
