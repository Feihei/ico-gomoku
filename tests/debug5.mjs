import { generateIcosphere } from '../js/mesh/icosphere.js';
import { validateMesh } from '../js/mesh/validate.js';
import { Board } from '../js/game/board.js';
import { checkWin, BLACK } from '../js/game/rules.js';

const mesh = generateIcosphere(5);
validateMesh(mesh);
const P = mesh.positions;
function ang(v, a, b) {
  const norm = (v, a) => {
    const dx = P[a*3]-P[v*3], dy = P[a*3+1]-P[v*3+1], dz = P[a*3+2]-P[v*3+2];
    const l = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1; return [dx/l, dy/l, dz/l];
  };
  const va = norm(v, a), vb = norm(v, b);
  return Math.acos(Math.max(-1, Math.min(1, va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2])));
}

// 直接放一条手动验证的链：找顶点1的轴 0-1-4，然后两侧各延伸
const board = new Board(mesh);

// 从 0 出发（来自 1）找最直延伸
function straightStep(cur, prev) {
  const r = [];
  for (const d of mesh.adjacency[cur]) {
    if (d === prev) continue;
    r.push({ d, a: ang(cur, prev, d) });
  }
  r.sort((x, y) => y.a - x.a);
  return r;
}

// 0 的邻居按角度
console.log('从0(来自1)的邻居排序:');
for (const {d, a} of straightStep(0, 1)) console.log('  ->', d, (a*180/Math.PI).toFixed(1));

console.log('从4(来自1)的邻居排序:');
for (const {d, a} of straightStep(4, 1)) console.log('  ->', d, (a*180/Math.PI).toFixed(1));

// 把链放好：从0往左2步，1, 4往右2步
let chain = [0, 1, 4];
let cur = 0, prev = 1;
for (let i = 0; i < 2; i++) {
  const r = straightStep(cur, prev);
  const next = r[0].d;
  chain.push(next); prev = cur; cur = next;
}
cur = 4; prev = 1;
for (let i = 0; i < 2; i++) {
  const r = straightStep(cur, prev);
  const next = r[0].d;
  chain.push(next); prev = cur; cur = next;
}
console.log('链:', chain);

// 逐个放，记录哪一步获胜
for (const v of chain) {
  const res = board.place(v);
  const w = checkWin(board, v, BLACK);
  console.log(`放 ${v}: checkWin=${w.win} line=${w.line}`);
}
