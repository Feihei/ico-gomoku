import { generateIcosphere } from '../js/mesh/icosphere.js';
const mesh = generateIcosphere(5);
const P = mesh.positions;
function norm(v, a) {
  const dx = P[a*3]-P[v*3], dy = P[a*3+1]-P[v*3+1], dz = P[a*3+2]-P[v*3+2];
  const l = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1;
  return [dx/l, dy/l, dz/l];
}
function ang(v, a, b) {
  const va = norm(v, a), vb = norm(v, b);
  const d = Math.max(-1, Math.min(1, va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2]));
  return Math.acos(d);
}
const v = 1;
const n = mesh.adjacency[v];
console.log("顶点", v, "度数", n.length);
const pairs = [];
for (let i = 0; i < n.length; i++)
  for (let j = i+1; j < n.length; j++)
    pairs.push({ i: n[i], j: n[j], a: ang(v, n[i], n[j]) });
pairs.sort((p, q) => p.a - q.a);
console.log("最小5对 (deg):");
for (const p of pairs.slice(0, 5)) console.log("  ", p.i, p.j, (p.a*180/Math.PI).toFixed(1));
console.log("最大3对 (deg):");
for (const p of pairs.slice(-3)) console.log("  ", p.i, p.j, (p.a*180/Math.PI).toFixed(1));
