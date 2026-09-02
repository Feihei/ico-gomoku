import { generateIcosphere } from '../js/mesh/icosphere.js';
import { validateMesh } from '../js/mesh/validate.js';
import { Board } from '../js/game/board.js';
import { checkWin, BLACK } from '../js/game/rules.js';

const mesh = generateIcosphere(5);
validateMesh(mesh);

// 直接测：沿 0-1-4 轴放 5 颗（0,1,4 是 180° 对轴），再往两侧各加
const board = new Board(mesh);
const P = mesh.positions;
function ang(v, a, b) {
  const norm = (v, a) => {
    const dx = P[a*3]-P[v*3], dy = P[a*3+1]-P[v*3+1], dz = P[a*3+2]-P[v*3+2];
    const l = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1; return [dx/l, dy/l, dz/l];
  };
  const va = norm(v, a), vb = norm(v, b);
  return Math.acos(Math.max(-1, Math.min(1, va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2])));
}
function neighbors(v) { return mesh.adjacency[v]; }
function maxNeighbor(cur, prev) {
  let best = null, bestAng = -1;
  for (const d of neighbors(cur)) {
    if (d === prev) continue;
    const a = ang(cur, prev, d);
    if (a > bestAng) { bestAng = a; best = d; }
  }
  return { d: best, a: bestAng };
}

// 放 5 颗最简单的：0,1,4 对轴，再加 1 的两个方向
// 先放 0, 1, 4（这是 180° 对轴，3 颗）
board.place(0); board.place(1); board.place(4);
// 从 0 往远离 1 的方向再走 2 步
let cur = 0, prev = 1;
for (let i = 0; i < 2; i++) {
  const r = maxNeighbor(cur, prev);
  board.place(r.d); prev = cur; cur = r.d;
}
// 从 4 往远离 1 的方向再走 2 步
cur = 4; prev = 1;
for (let i = 0; i < 2; i++) {
  const r = maxNeighbor(cur, prev);
  board.place(r.d); prev = cur; cur = r.d;
}
console.log('placed order:', board.history.map(h=>h.v));

// 现在检查最后放置点是否获胜
const last = board.history[board.history.length-1].v;
console.log('last placed =', last);
const r = checkWin(board, last, BLACK);
console.log('checkWin:', r.win, 'line=', r.line);

// 逐个点检查
for (const h of board.history) {
  const w = checkWin(board, h.v, BLACK);
  if (w.win) console.log('命中', h.v, '->', w.line);
}
