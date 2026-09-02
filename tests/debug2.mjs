import { generateIcosphere } from '../js/mesh/icosphere.js';
import { validateMesh } from '../js/mesh/validate.js';
import { Board } from '../js/game/board.js';
import { checkWin, BLACK, WHITE } from '../js/game/rules.js';

const mesh = generateIcosphere(5);
validateMesh(mesh);

// 1) 简单落子测试
const board = new Board(mesh);
console.log('place(0):', JSON.stringify(board.place(0)));
console.log('occupied[0] =', board.occupied[0]);
console.log('currentPlayer =', board.currentPlayer, '(期望WHITE)');
console.log('place(1):', JSON.stringify(board.place(1)));
console.log('occupied[1] =', board.occupied[1]);
console.log('history.length =', board.history.length);

// 2) 轴测试
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
const v = 1;
const n = mesh.adjacency[v];
const pairs = [];
for (let i = 0; i < n.length; i++)
  for (let j = i+1; j < n.length; j++)
    pairs.push({ i: n[i], j: n[j], a: ang(mesh.positions, v, n[i], n[j]) });
pairs.sort((p, q) => q.a - p.a);
console.log('\n最大3对轴 (deg):');
for (const p of pairs.slice(0, 3)) console.log('  ', p.i, p.j, (p.a*180/Math.PI).toFixed(1));
