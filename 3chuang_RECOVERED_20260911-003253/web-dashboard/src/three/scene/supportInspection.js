// Contact patches derived from plan geometry only; not a load-bearing certificate.
export function supportContactPatches(cargo, placements = []) {
  const x=Number(cargo.x),z=Number(cargo.z),y=Number(cargo.y),l=Number(cargo.l),w=Number(cargo.w);
  if (![x,z,y,l,w].every(Number.isFinite) || l<=0 || w<=0) return [];
  if (Math.abs(y)<1) return [{x,z,y:0,l,w,source:'CONTAINER_FLOOR'}];
  return placements.filter(item=>item.cargoId!==cargo.cargoId && Math.abs(Number(item.y)+Number(item.h)-y)<1).flatMap(item=>{
    const minX=Math.max(x,Number(item.x)),maxX=Math.min(x+l,Number(item.x)+Number(item.l));
    const minZ=Math.max(z,Number(item.z)),maxZ=Math.min(z+w,Number(item.z)+Number(item.w));
    return maxX>minX&&maxZ>minZ?[{x:minX,z:minZ,y,l:maxX-minX,w:maxZ-minZ,source:item.cargoId}]:[];
  });
}
