import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLandingScrollDriver } from './scrollDriver.js';

afterEach(()=>vi.unstubAllGlobals());
function environment(reduce=false) {
 const listeners={},queue=new Map();let id=0;
 const media={matches:reduce,addEventListener:vi.fn(),removeEventListener:vi.fn()};
 const window={scrollY:0,innerHeight:1000,innerWidth:1600,matchMedia:()=>media,requestAnimationFrame:fn=>{queue.set(++id,fn);return id;},cancelAnimationFrame:n=>queue.delete(n),addEventListener:(name,fn)=>{listeners[name]=fn;},removeEventListener:vi.fn()};
 vi.stubGlobal('window',window);vi.stubGlobal('document',{hidden:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});vi.stubGlobal('ResizeObserver',undefined);
 const el={offsetTop:0,offsetHeight:1000,offsetParent:null,getBoundingClientRect:()=>{throw Error('layout read in frame');}};
 const flush=timestamp=>{const tasks=[...queue.values()];queue.clear();tasks.forEach(fn=>fn(timestamp));};
 return {window,el,queue,flush,listeners,media};
}
describe('Landing scroll lifecycle',()=>{
 it('drops parallax after sixty actual slow frame intervals while keeping progress',()=>{const e=environment(),parallax=vi.fn(),progress=vi.fn(),driver=createLandingScrollDriver();driver.register({el:e.el,priority:'parallax',compute:parallax});driver.register({el:e.el,compute:progress});for(let i=0;i<62;i++){e.window.scrollY=i%2?20:40;e.flush(i*30);}expect(parallax.mock.lastCall).toEqual([1,expect.objectContaining({reduced:true})]);const count=parallax.mock.calls.length;e.window.scrollY=300;e.flush(1900);expect(parallax.mock.calls.length).toBe(count);expect(progress.mock.lastCall[0]).toBe(.65);driver.destroy();});
 it('resumes after reduced-motion is switched off, and stops when switched back',()=>{const e=environment(true),compute=vi.fn(),driver=createLandingScrollDriver();driver.register({el:e.el,compute});const change=e.media.addEventListener.mock.calls[0][1];e.media.matches=false;change();e.flush();expect(compute.mock.lastCall[0]).toBe(.5);e.media.matches=true;change();expect(e.queue.size).toBe(0);expect(compute.mock.lastCall[0]).toBe(1);driver.destroy();});
 it('turns parallax off at mobile width and restores it after resizing back',()=>{const e=environment(),compute=vi.fn(),driver=createLandingScrollDriver();driver.register({el:e.el,priority:'parallax',compute});e.flush();e.window.innerWidth=375;e.listeners.resize();expect(compute.mock.lastCall).toEqual([1,expect.objectContaining({reduced:true})]);e.window.scrollY=500;e.listeners.scroll();e.flush();expect(compute.mock.lastCall[0]).toBe(1);e.window.innerWidth=1600;e.listeners.resize();e.flush();expect(compute.mock.lastCall[0]).toBe(.75);driver.destroy();});
 it('computes from cached geometry, sleeps and wakes without layout reads',()=>{const e=environment(),compute=vi.fn(),driver=createLandingScrollDriver();driver.register({el:e.el,compute});for(let i=0;i<35;i++)e.flush();expect(e.queue.size).toBe(0);expect(compute.mock.calls[0][0]).toBe(.5);e.window.scrollY=500;e.listeners.scroll();e.flush();expect(compute.mock.lastCall[0]).toBe(.75);driver.destroy();expect(e.queue.size).toBe(0);});
 it.each([{capture:true,reduce:false},{capture:false,reduce:true}])('emits terminal content with no rAF: %j',({capture,reduce})=>{const e=environment(reduce),compute=vi.fn(),driver=createLandingScrollDriver({capture});driver.register({el:e.el,compute});expect(compute).toHaveBeenCalledWith(1,expect.objectContaining({reduced:true}));expect(e.queue.size).toBe(0);driver.destroy();});
 it('unregister and destroy leave no live callbacks',()=>{const e=environment(),compute=vi.fn(),driver=createLandingScrollDriver();const id=driver.register({el:e.el,compute});driver.unregister(id);expect(e.queue.size).toBe(0);driver.destroy();e.listeners.scroll();e.flush();expect(compute).not.toHaveBeenCalled();expect(driver.register({el:e.el,compute})).toBeNull();});
});
