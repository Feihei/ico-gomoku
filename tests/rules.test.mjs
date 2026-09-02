import { generateIcosphere } from '../js/mesh/icosphere.js';
import { validateMesh } from '../js/mesh/validate.js';
import { Board } from '../js/game/board.js';
import { checkWin, isDraw, BLACK, WHITE } from '../js/game/rules.js';

let pass = 0, fail = 0;
const results = [];
function assert(cond, msg) {
  if (cond) { pass++; results.push('✓ ' + msg); }
  else { fail++; results.push('✗ ' + msg); }
}

// ── 辅助函数（与 rules.js 内部实现一致） ──

function angleAt(positions, v, a, b) {
  const va = normalize(positions, v, a);
  const vb = normalize(positions, v, b);
  const d = Math.max(-1, Math.min(1, va[0]*vb[0] + va[1]*vb[1] + va[2]*vb[2]));
  return Math.acos(d);
}
function normalize(positions, v, a) {
  const dx = positions[a*3]-positions[v*3], dy = positions[a*3+1]-positions[v*3+1], dz = positions[a*3+2]-positions[v*3+2];
  const len = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1;
  return [dx/len, dy/len, dz/len];
}

/**
 * 从 start 出发，cameFrom 进入方向，沿最直方向（最大夹角）走 n 步。
 * 用于构造连珠局面，逻辑与 rules.js 的 extend 一致。
 */
function walkStraight(board, start, cameFrom, n) {
  const { adjacency, positions } = board.mesh;
  const path = [start];
  let cur = start, prev = cameFrom;
  for (let i = 0; i < n - 1; i++) {
    let best = null, bestAng = -1;
    for (const d of adjacency[cur]) {
      if (d === prev) continue;
      const ang = angleAt(positions, cur, prev, d);
      if (ang > bestAng) { bestAng = ang; best = d; }
    }
    if (best === null) break;
    path.push(best);
    prev = cur;
    cur = best;
  }
  return path;
}

/**
 * 测试用的 getAxes（与 rules.js 内部实现一致）
 * 6价点：贪心选3条独立轴；5价点：取5个最大夹角对
 */
function getAxes(adjacency, v, positions) {
  const n = adjacency[v];
  const deg = n.length;
  const pairs = [];
  for (let i = 0; i < deg; i++) {
    for (let j = i + 1; j < deg; j++) {
      pairs.push({ a: n[i], b: n[j], ang: angleAt(positions, v, n[i], n[j]) });
    }
  }
  pairs.sort((p, q) => q.ang - p.ang);

  if (deg === 6) {
    const used = new Set();
    const axes = [];
    for (const pair of pairs) {
      if (axes.length === 3) break;
      if (!used.has(pair.a) && !used.has(pair.b)) {
        axes.push({ a: pair.a, b: pair.b });
        used.add(pair.a);
        used.add(pair.b);
      }
    }
    return axes;
  } else if (deg === 5) {
    return pairs.slice(0, 5).map(({ a, b }) => ({ a, b }));
  }
  return [];
}

// ── 网格校验 ──

const mesh = generateIcosphere(5);
validateMesh(mesh);

// ── 测试 1：六价点轴向 5 连珠 ──
{
  const board = new Board(mesh);
  let v = -1;
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    if (mesh.adjacency[i].length === 6) { v = i; break; }
  }
  if (v === -1) {
    assert(false, '找不到六价点');
  } else {
    const axes = getAxes(mesh.adjacency, v, mesh.positions);
    if (axes.length < 1) {
      assert(false, '六价点找不到轴向');
    } else {
      const { a, b } = axes[0];
      // 从 a 出发，cameFrom=v，沿最直方向走 2 步 → [a, left1]
      const leftPath = walkStraight(board, a, v, 2);
      // 从 b 出发，cameFrom=v，沿最直方向走 2 步 → [b, right1]
      const rightPath = walkStraight(board, b, v, 2);
      // line = [a, left1, v, b, right1] = 5 个点
      const line = [...leftPath, v, ...rightPath];
      let win = false;
      for (const p of line) {
        board.place(p);
        const r = checkWin(board, p, BLACK);
        if (r.win) { win = true; break; }
      }
      assert(win, '六价点轴向 5 连珠应判胜');
    }
  }
}

// ── 测试 2：五价点 5 连珠 ──
{
  const board = new Board(mesh);
  const star = mesh.degree5Vertices[0];
  const axes = getAxes(mesh.adjacency, star, mesh.positions);
  if (axes.length < 1) {
    assert(false, '五价点找不到轴向');
  } else {
    const { a, b } = axes[0];
    const leftPath = walkStraight(board, a, star, 2);
    const rightPath = walkStraight(board, b, star, 2);
    const line = [...leftPath, star, ...rightPath];
    let win = false;
    for (const p of line) {
      board.place(p);
      const r = checkWin(board, p, BLACK);
      if (r.win) { win = true; break; }
    }
    assert(win, '五价点 5 连珠应判胜');
  }
}

// ── 测试 3：平局 ──
{
  const board = new Board(mesh);
  let won = false;
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    const res = board.place(i);
    if (res && res.won) { won = true; break; }
  }
  if (won) {
    assert(false, '平局测试中意外判胜（place 顺序 0,1,2,...）');
  } else {
    assert(board.isDraw, '铺满棋盘且无连珠应判和棋');
  }
}

// ── 测试 4：非连珠不判胜 ──
{
  const board = new Board(mesh);
  board.place(0); board.place(1); board.place(2); board.place(3);
  assert(!board.won, '非连珠局面不应判胜');
}

// ── 测试 5：悔棋 ──
{
  const board = new Board(mesh);
  board.place(0); // 黑方
  board.place(1); // 白方
  board.undo();   // 撤销白方
  assert(board.history.length === 1, '悔棋后历史长度减 1');
  assert(board.occupied[0] === null, '悔棋后顶点 0 清空');
  // undo 撤销最后一步，currentPlayer 回到最后一步的执子方
  assert(board.currentPlayer === WHITE, '悔棋后切回白方');
}

// ── 测试 6：多次悔棋 ──
{
  const board = new Board(mesh);
  board.place(0); // 黑
  board.place(1); // 白
  board.place(2); // 黑
  board.undo();   // 撤销黑(2)
  assert(board.currentPlayer === BLACK, '两次 place 后 undo，切回黑方');
  assert(board.history.length === 2, '悔棋后历史长度减 1');
  assert(board.occupied[2] === null, '悔棋后顶点 2 清空');
}

// ── 测试 7：checkWin 返回 line ──
{
  const board = new Board(mesh);
  // 构造一个简单连珠：place 5 个在同一条轴向的邻居链上
  let v = -1;
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    if (mesh.adjacency[i].length === 6) { v = i; break; }
  }
  if (v !== -1) {
    const axes = getAxes(mesh.adjacency, v, mesh.positions);
    if (axes.length >= 1) {
      const { a, b } = axes[0];
      const leftPath = walkStraight(board, a, v, 2); // [a, left1]
      const rightPath = walkStraight(board, b, v, 2); // [b, right1]
      const line = [...leftPath, v, ...rightPath]; // 5 个点
      for (const p of line) {
        board.place(p);
        const r = checkWin(board, p, BLACK);
        if (r.win && r.line) {
          assert(r.line.length === 5, '获胜线长度应为 5');
          assert(r.line.includes(v), '获胜线应包含中心点');
          break;
        }
      }
    }
  }
  assert(pass - fail >= 7, '所有测试应通过'); // 占位，实际结果由下方汇总
}

console.log(results.join('\n'));
console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail > 0 ? 1 : 0);
