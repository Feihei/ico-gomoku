// M4 规则引擎：连珠判定、胜负/平局判定
// checkWin / extend 为纯函数，不持有状态

import { CONFIG } from '../config.js';

export const BLACK = 1;
export const WHITE = 2;

// v 处 a-v-b 的夹角（弧度），越大越接近 180°（越直）
function angleAt(positions, v, a, b) {
  const va = normalize(positions, v, a);
  const vb = normalize(positions, v, b);
  const d = clampDot(dot(va, vb));
  return Math.acos(d);
}

function normalize(positions, v, a) {
  const dx = positions[a * 3] - positions[v * 3];
  const dy = positions[a * 3 + 1] - positions[v * 3 + 1];
  const dz = positions[a * 3 + 2] - positions[v * 3 + 2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return [dx / len, dy / len, dz / len];
}

function dot(u, v) {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

function clampDot(x) {
  return Math.max(-1, Math.min(1, x));
}

/**
 * 枚举 v 处的所有轴向（无序邻居对 {a, b}）。
 * 6价点：贪心选3条独立轴，互不相交的邻居对，夹角最大优先。
 * 5价点：选5条轴，即5对不相邻邻居（夹角约144°）。
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
    // 六价点：选3条独立轴（互不相交的邻居对）
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
    // 五价点：选5条轴（每对不相邻的邻居，夹角约144°）
    return pairs.slice(0, 5).map(({ a, b }) => ({ a, b }));
  }

  return [];
}

/**
 * 从 start 出发、由 cameFrom 进入方向，沿最直方向（最大夹角）同色延伸。
 * 只有"近直线"延续才算连珠：某步的转角低于价数对应阈值即视为断线，
 * 否则 zigzag 的拐弯也会被贪心延伸串成假连珠。
 * 用 visited 集防止在球面上来回绕圈。
 */
function extend(board, start, cameFrom, player) {
  const { adjacency, positions } = board.mesh;
  const occupied = board.occupied;
  const line = [];
  const visited = new Set([cameFrom]); // 防止绕回 cameFrom
  let cur = start;
  let prev = cameFrom;

  while (occupied[cur] === player && !visited.has(cur)) {
    visited.add(cur);
    line.push(cur);
    let best = null, bestAng = -1;
    for (const d of adjacency[cur]) {
      if (d === prev || visited.has(d)) continue;
      if (occupied[d] !== player) continue;
      const ang = angleAt(positions, cur, prev, d);
      if (ang > bestAng) { bestAng = ang; best = d; }
    }
    if (best === null) break;
    // 六价点穿行 144°+、五价点穿行 132°+ 才算"近直线"，低于阈值是拐弯
    const straightMin = adjacency[cur].length === 5
      ? CONFIG.ANGLE_STRAIGHT_DEG5
      : CONFIG.ANGLE_STRAIGHT_DEG6;
    if (bestAng < straightMin) break;
    prev = cur;
    cur = best;
  }

  return line;
}

/**
 * 连珠判定：对刚落在 vertexIndex 的 player，枚举每个轴向双向延伸。
 * 返回 { win, line }，line 为获胜连珠顶点序列。
 */
export function checkWin(board, vertexIndex, player) {
  const axes = getAxes(board.mesh.adjacency, vertexIndex, board.mesh.positions);

  for (const { a, b } of axes) {
    // extend 返回从邻居向远端排列的序列（fwd[0] 是 a 本身），
    // 拼回时必须反转，使 line 从 a 端经 vertexIndex 到 b 端连续相邻
    const fwd = extend(board, a, vertexIndex, player);
    const bwd = extend(board, b, vertexIndex, player);
    const line = [...fwd.reverse(), vertexIndex, ...bwd];
    if (line.length >= CONFIG.WIN_N) {
      return { win: true, line };
    }
  }

  return { win: false, line: null };
}

/**
 * 平局：所有顶点被占据。
 */
export function isDraw(board) {
  return board.occupied.every((c) => c !== null);
}

export default { checkWin, isDraw, BLACK, WHITE };
