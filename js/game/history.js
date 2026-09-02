// M5 手数记录：支持悔棋与复盘的历史封装
// 由 board 持有，这里做复盘/手数查询的辅助接口

import { BLACK, WHITE } from './rules.js';

export class MoveHistory {
  constructor() {
    this.moves = []; // [{v, player, turn}]
  }

  // 记录一手（由 board.place 内部调用）
  record(v, player) {
    this.moves.push({ v, player, turn: this.moves.length + 1 });
    return this.moves[this.moves.length - 1];
  }

  clear() {
    this.moves = [];
  }

  get length() {
    return this.moves.length;
  }

  get currentTurn() {
    return this.moves.length;
  }

  // 复盘到第 n 手（不含），返回该时刻的快照 [{v, player}]
  snapshotTo(n) {
    return this.moves.slice(0, n).map((m) => ({ v: m.v, player: m.player }));
  }

  // 所有手数
  all() {
    return this.moves.map((m) => ({ v: m.v, player: m.player, turn: m.turn }));
  }

  // 第 n 手信息
  get(n) {
    return this.moves[n] || null;
  }
}

export default MoveHistory;
