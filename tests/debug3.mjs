import { generateIcosphere } from '../js/mesh/icosphere.js';
import { validateMesh } from '../js/mesh/validate.js';
import { Board } from '../js/game/board.js';
import { checkWin, BLACK } from '../js/game/rules.js';

const mesh = generateIcosphere(5);
validateMesh(mesh);

// 沿一条直轴放 5 颗黑子，手动验证 checkWin
function ang(positions, v, a, b) {
  const norm = (v, a) => {
    const dx = positions[a*3]-positions[v*3], dy = positions[a*3+1]-positions[v*3+1], dz = positions[a*3+2]-positions[v*3+2];
    const l = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1;
    return [dx/l, dy/l, dz/l];
  };
  const va = norm(v, a), vb = norm(v, b);
  const d = Math.max(-1, Math.min(1, va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2]));
  return Math.acos(d);
}

// 找到顶点 1 的一条轴
function findAxis(v) {
  const n = mesh.adjacency[v];
  let best = null, bestAng = -1;
  for (let i = 0; i < n.length; i++)
    for (let j = i+1; j < n.length; j++) {
      const a = ang(mesh.positions, v, n[i], n[j]);
      if (a > bestAng) { bestAng = a; best = { a: n[i], b: n[j] }; }
    }
  return best;
}

// 从 start 出发沿 cameFrom 的反向延伸，找同色链
function extend(board, start, cameFrom, player) {
  const { adjacency, positions } = board.mesh;
  const occupied = board.occupied;
  const line = [];
  let cur = start, prev = cameFrom;
  while (occupied[cur] === player) {
    line.push(cur);
    let best = null, bestAng = -1;
    for (const d of adjacency[cur]) {
      if (d === prev) continue;
      if (occupied[d] !== player) continue;
      const a = ang(positions, cur, prev, d);
      if (a > bestAng) { bestAng = a; best = d; }
    }
    if (best === null) break;
    prev = cur; cur = best;
  }
  return line;
}

// 测试：沿轴放 5 颗
const board = new Board(mesh);
const axis = findAxis(1);
console.log('轴:', axis.a, axis.b, '夹角', (ang(mesh.positions, 1, axis.a, axis.b)*180/Math.PI).toFixed(1));

// 从 axis.a 出发，经过 1，到 axis.b，取轴上 5 个点
// a 方向取 a, 1, 然后从 a 再往左 2 步；b 方向同理
function walkLeft(start, cameFrom, steps) {
  const { adjacency } = board.mesh;
  let cur = start, prev = cameFrom;
  const path = [cur];
  for (let i = 0; i < steps; i++) {
    let best = null, bestAng = -1;
    for (const d of adjacency[cur]) {
      if (d === prev) continue;
      const a = ang(board.mesh.positions, cur, prev, d);
      if (a > bestAng) { bestAng = a; best = d; }
    }
    if (best === null) break;
    path.push(best); prev = cur; cur = best;
  }
  return path;
}

// 构造 5 连珠：从 a 往左 2 步 + 1 + b 往左 2 步
const left = walkLeft(axis.a, 1, 2); // [a, x, y]
const right = walkLeft(axis.b, 1, 2); // [b, x, y]
const line = [...left, 1, ...right];
console.log('连珠线:', line);

let won = false;
for (const p of line) {
  const r = board.place(p);
  const win = checkWin(board, p, BLACK);
  if (win.win) { won = true; console.log('在', p, '命中，line=', win.line); }
}
console.log('六价点 5 连珠判胜:', won);
