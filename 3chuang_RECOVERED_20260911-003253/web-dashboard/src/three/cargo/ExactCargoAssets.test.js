import {describe,it,expect} from 'vitest';
import {findExactSpec} from './ExactCargoAssets.js';
describe('exact physical asset selection',()=>{
  const row={key:'carton_strapped:1.140000:0.475000:0.640000:#aa8760',id:'correct-spec'};
  const manifest={assets:[row]};
  it('keeps the same geometry when the legacy presentation layer changes only color',()=>{
    expect(findExactSpec(manifest,'carton_strapped:1.140000:0.475000:0.640000:#b29673')).toBe(row);
  });
  it('rejects another dimension or packaging structure instead of stretching a fallback model',()=>{
    expect(()=>findExactSpec(manifest,'carton_strapped:1.150000:0.475000:0.640000:#aa8760')).toThrow();
    expect(()=>findExactSpec(manifest,'crate_reinforced:1.140000:0.475000:0.640000:#aa8760')).toThrow();
  });
});
