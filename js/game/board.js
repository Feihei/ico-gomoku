// M3 棋局状态：唯一状态持有者，落子、悔棋、查询
// 渲染层只读，状态变更通过显式调用触发，不用观察者框架

import { checkWin, isDraw } from './rules.js';
import { BLACK, WHITE } from './rules.js';

export class Board {
  constructor(mesh) {
    this.mesh = mesh;
    this.V = mesh.positions.length / 3;
    this.occupied = new Array(this.V).fill(null);
    this.currentPlayer = BLACK;
    this.history = []; // [{v, player}]
    this.winner = null;
    this.won = false;
    this.isDraw = false;
    this.winningLine = null;
  }

  isEmpty(v) {
    return v >= 0 && v < this.V && this.occupied[v] === null;
  }

  place(v) {
    if (this.won || this.isDraw) return null;
    if (!this.isEmpty(v)) return null;

    const player = this.currentPlayer;
    this.occupied[v] = player;
    this.history.push({ v, player });

    const { win, line } = checkWin(this, v, player);
    if (win) {
      this.winner = player;
      this.winningLine = line;
      this.won = true;
    } else if (this.occupied.every((c) => c !== null)) {
      this.isDraw = true;
    } else {
      this.currentPlayer = player === BLACK ? WHITE : BLACK;
    }

    return { v, player, won: this.won, isDraw: this.isDraw, line };
  }

  undo() {
    if (this.history.length === 0) return null;
    const last = this.history.pop();
    this.occupied[last.v] = null;
    this.winner = null;
    this.won = false;
    this.isDraw = false;
    this.winningLine = null;
    this.currentPlayer = last.player;
    return last;
  }

  undoSteps(n) {
    const r = [];
    for (let i = 0; i < n; i++) {
      const s = this.undo();
      if (s === null) break;
      r.push(s);
    }
    return r;
  }

  // 复盘：清空后重放到第 n 手
  replayTo(n) {
    this.reset();
    for (let i = 0; i < Math.min(n, this.history.length); i++) {
      this.place(this.history[i].v);
    }
  }

  reset() {
    this.occupied = new Array(this.V).fill(null);
    this.currentPlayer = BLACK;
    this.history = [];
    this.winner = null;
    this.won = false;
    this.isDraw = false;
    this.winningLine = null;
  }
}

export default Board;
