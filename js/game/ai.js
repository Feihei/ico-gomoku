// M7 AI：人机对战决策（启发式评分 + 浅层搜索）
// 只读 board 的 occupied/mesh；通过临时占位模拟落子、事后还原，不污染棋局状态。
// 候选评估遵循与 rules.js 相同的"轴向 + 近直线夹角阈值"语义（此处独立实现，
// 便于 AI 单独演进而无需动规则引擎）。

import { CONFIG } from '../config.js';
import { BLACK, WHITE } from './rules.js';

// ── 几何辅助（与 rules.js 语义一致） ──

function angleAt(positions, v, a, b) {
  const va = normalize(positions, v, a);
  const vb = normalize(positions, v, b);
  const d = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  return Math.acos(d);
}

function normalize(positions, v, a) {
  const dx = positions[a * 3] - positions[v * 3];
  const dy = positions[a * 3 + 1] - positions[v * 3 + 1];
  const dz = positions[a * 3 + 2] - positions[v * 3 + 2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return [dx / len, dy / len, dz / len];
}

/**
 * v 处的轴向（同 rules.getAxes）：
 * 6价点 → 3 条互不相交邻居对（夹角最大优先）；5价点 → 5 条不相邻邻居对。
 */
function getAxes(mesh, v) {
  const n = mesh.adjacency[v];
  const deg = n.length;
  const pairs = [];
  for (let i = 0; i < deg; i++) {
    for (let j = i + 1; j < deg; j++) {
      pairs.push({ a: n[i], b: n[j], ang: angleAt(mesh.positions, v, n[i], n[j]) });
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

// 近直线延续阈值：按当前顶点的价数取
function straightMin(degree) {
  return degree === 5 ? CONFIG.ANGLE_STRAIGHT_DEG5 : CONFIG.ANGLE_STRAIGHT_DEG6;
}

/**
 * 从 start 出发、由 cameFrom 进入，沿最直方向延伸的连续同色顶点序列。
 * 与 rules.extend 一致：低于阈值（拐弯）即断，visited 防绕圈。
 */
function extendLine(mesh, occupied, start, cameFrom, player) {
  const line = [];
  const visited = new Set([cameFrom]);
  let cur = start;
  let prev = cameFrom;

  while (occupied[cur] === player && !visited.has(cur)) {
    visited.add(cur);
    line.push(cur);
    let best = null, bestAng = -1;
    for (const d of mesh.adjacency[cur]) {
      if (d === prev || visited.has(d)) continue;
      if (occupied[d] !== player) continue;
      const ang = angleAt(mesh.positions, cur, prev, d);
      if (ang > bestAng) { bestAng = ang; best = d; }
    }
    if (best === null) break;
    if (bestAng < straightMin(mesh.adjacency[cur].length)) break;
    prev = cur;
    cur = best;
  }
  return line;
}

/**
 * 开放端探测：lineTail 是 extendLine 末端（同色链尽头），cameFrom 是其前驱。
 * 若沿最直方向有"空位"且夹角达标，则该端开放（可继续续子）。
 */
function isOpenEnd(mesh, occupied, lineTail, cameFrom, player) {
  if (lineTail === undefined || lineTail === null) return false;
  const n = mesh.adjacency[lineTail];
  const cand = [];
  for (const d of n) {
    if (d === cameFrom) continue;
    if (occupied[d] !== null) continue; // 只看空位（同色已被 extendLine 走完）
    cand.push(d);
  }
  if (cand.length === 0) return false;
  // 取夹角最大（最直）的空邻居，达标才算开放
  let bestAng = -1;
  for (const d of cand) {
    const ang = angleAt(mesh.positions, lineTail, cameFrom, d);
    if (ang > bestAng) bestAng = ang;
  }
  return bestAng >= straightMin(n.length);
}

/**
 * 评估"player 若落在 v"的威胁分值：
 * 沿每条轴向向两侧延伸同色链，链长 + 开放端数 → 模式分。
 * 通过临时占位模拟，函数内还原，不改动 board 状态。
 */
export function evaluatePlacement(board, v, player) {
  const { mesh, occupied } = board;
  if (occupied[v] !== null) return 0;

  occupied[v] = player; // 模拟落子
  let best = 0;
  for (const { a, b } of getAxes(mesh, v)) {
    const fwd = extendLine(mesh, occupied, a, v, player);
    const bwd = extendLine(mesh, occupied, b, v, player);
    const len = fwd.length + 1 + bwd.length;
    // 开放端（各自链条末端再延伸一位的空位）
    let opens = 0;
    if (isOpenEnd(mesh, occupied, fwd[fwd.length - 1], fwd.length >= 2 ? fwd[fwd.length - 2] : v, player)) opens++;
    if (isOpenEnd(mesh, occupied, bwd[bwd.length - 1], bwd.length >= 2 ? bwd[bwd.length - 2] : v, player)) opens++;
    const val = patternValue(len, opens);
    if (val > best) best = val;
  }
  occupied[v] = null; // 还原
  return best;
}

// 链长 + 开放端数 → 模式分（启发式打分表，非精确必胜判定）
function patternValue(len, opens) {
  if (len >= CONFIG.WIN_N) return 1000000;            // 落子即成五
  if (len === CONFIG.WIN_N - 1) {                      // 成四
    if (opens >= 2) return 500000;                     // 活四：双端开放，必胜
    if (opens === 1) return 100000;                    // 冲四
    return 1000;
  }
  if (len === CONFIG.WIN_N - 2) {                      // 成三
    if (opens >= 2) return 30000;                      // 活三
    if (opens === 1) return 3000;                      // 眠三
    return 100;
  }
  if (len === CONFIG.WIN_N - 3) {                      // 成二
    if (opens >= 2) return 800;
    if (opens === 1) return 100;
    return 10;
  }
  return 10;
}

/**
 * 收集候选落子点：所有已占顶点的邻域空点（就近作战）。
 * 空盘时返回 null，由调用方处理首手。
 */
function collectCandidates(board) {
  const { mesh, occupied } = board;
  const seen = new Set();
  for (let v = 0; v < occupied.length; v++) {
    if (occupied[v] === null) continue;
    for (const nb of mesh.adjacency[v]) {
      if (occupied[nb] === null) seen.add(nb);
    }
  }
  return seen.size ? [...seen] : null;
}

/**
 * AI 决策主入口：返回要落子的顶点索引。
 * 策略：① 己方即成五点（必胜）② 堵对手即成五点 ③ 评分排序 + 浅层回应搜索。
 * @param {Board} board 棋局（只读方式使用，不改动状态）
 * @param {number} aiPlayer BLACK / WHITE
 */
export function chooseMove(board, aiPlayer) {
  const human = aiPlayer === BLACK ? WHITE : BLACK;
  let cands = collectCandidates(board);

  // 空盘首手：落任意合法点（固定用第一个空顶点，稳定可测）
  if (cands === null) {
    return 0;
  }

  // 按"攻 + 防"综合粗排，只保留前 AI_SEARCH_TOP 名进入深评
  const scored = cands.map((v) => ({
    v,
    atk: evaluatePlacement(board, v, aiPlayer),
    def: evaluatePlacement(board, v, human),
  }));
  scored.sort((p, q) => scoreOf(q) - scoreOf(p));
  const top = scored.slice(0, CONFIG.AI_SEARCH_TOP);

  // ① 己方必杀
  for (const s of top) {
    if (s.atk >= 1000000) return s.v;
  }
  // ② 堵对手必杀
  for (const s of top) {
    if (s.def >= 1000000) return s.v;
  }

  // ③ 浅层搜索：对每个 top 候选，模拟己方落子后估算对手最佳回应的净收益
  let best = null;
  for (const s of top) {
    const net = simulateReply(board, s.v, aiPlayer, human, scored);
    if (best === null || net > best.net) best = { v: s.v, net };
  }
  return best ? best.v : top[0].v;
}

// 综合分：进攻 + 防守权重
function scoreOf(s) {
  return s.atk + CONFIG.AI_DEFENSE_BIAS * s.def;
}

/**
 * 模拟：aiPlayer 落 v 后，轮到 human 时 human 的最佳净收益（负值对 AI 越有利）。
 * 返回 AI 视角的净值 = 己方落子后的进攻分 - 对手最强回应的威胁分。
 */
function simulateReply(board, v, aiPlayer, human, scored) {
  const { occupied } = board;
  occupied[v] = aiPlayer;

  // 己方落子后仍能继续形成的最大威胁（简单看新盘面同色链最强者，此处近似取该点自身价值）
  const afterAtk = evaluatePlacement(board, v, aiPlayer) || 0;

  // 对手最佳回应：从原候选（剔除 v）里取其对我方最大的威胁
  let oppBest = 0;
  for (const s of scored) {
    if (s.v === v) continue;
    if (occupied[s.v] !== null) continue;
    const t = evaluatePlacement(board, s.v, human);
    if (t > oppBest) oppBest = t;
  }

  occupied[v] = null; // 还原
  return afterAtk - CONFIG.AI_DEFENSE_BIAS * oppBest;
}

export default { chooseMove, evaluatePlacement };
