import { describe,it,expect } from 'vitest';
import { UnloadMachine } from './unloadMachine.js';
const containerInfo={innerLength:5898,innerWidth:2352,innerHeight:2393};
const box={cargoId:'a',sku:'A',x:700,y:0,z:30,l:600,w:500,h:550,weight:8,portSequence:1,handlingMethod:'manual',packagingType:'CARTON',stackable:true};

describe('physical unloading cycle',()=>{
  it('takes the supported upper box first and counts delivery only at the receiving position',()=>{
    const plan={containerInfo,loadedCargo:[box,{...box,cargoId:'b',y:550}]};
    const original=JSON.stringify(plan),m=new UnloadMachine(plan);
    expect(m.queue[0].cargoId).toBe('b');m.play();
    let carried=false,paused=false;
    for(let i=0;i<4000 && m.phase!=='COMPLETED';i++){
      const s=m.tick(.1);
      expect(s.phase,s.blockedReasons.map(r=>r.message).join(';')).not.toBe('BLOCKED');
      expect(s.placedCargo.length+Number(s.inProgress)).toBe(2);
      if(s.inProgress && !carried){carried=true;expect(s.completedCount).toBe(0);}
      if(s.inProgress && !paused){
        const before=m.pause();const pose=JSON.stringify([before.worker,before.forklift,before.jack,before.cargoPose]);
        const after=m.tick(10);expect(JSON.stringify([after.worker,after.forklift,after.jack,after.cargoPose])).toBe(pose);paused=true;m.play();
      }
    }
    expect(m.phase).toBe('COMPLETED');expect(m.remaining()).toHaveLength(0);expect(carried&&paused).toBe(true);
    for(const [i,c] of m.getSnapshot().placedCargo.entries())expect([c.x,c.y,c.z]).toEqual([m.stagingSlots.get(i).x,m.stagingSlots.get(i).y,m.stagingSlots.get(i).z]);
    expect(JSON.stringify(plan)).toBe(original);
  });
  it('runs ground equipment through extraction, jack handoff, forklift delivery and return',()=>{
    const cargo={...box,l:1200,w:1000,h:1500,weight:180,handlingMethod:'forklift',packagingType:'WOOD_CRATE',forkEntry:'FOUR_WAY',packagingProfile:{palletJackCompatible:true}};
    const m=new UnloadMachine({containerInfo,loadedCargo:[cargo]});m.play();const steps=new Set();
    for(let i=0;i<4000&&m.phase!=='COMPLETED';i++){const s=m.tick(.1);steps.add(s.phaseLabel);expect(s.phase).not.toBe('BLOCKED');}
    expect(m.getSnapshot().completedCount).toBe(1);
    expect([...steps]).toEqual(expect.arrayContaining(['地牛放下交接','地牛抽叉','叉车接近交接位','叉车提取货物','运往卸货暂存位']));
  });
  it('keeps unsupported high equipment in the container with a visible block',()=>{
    const m=new UnloadMachine({containerInfo,loadedCargo:[{...box,y:1500,handlingMethod:'forklift',packagingType:'PALLETIZED_CARTONS'}]});
    const s=m.play();expect(s.phase).toBe('BLOCKED');expect(s.completedCount).toBe(0);expect(m.remaining()).toHaveLength(1);
  });
});
