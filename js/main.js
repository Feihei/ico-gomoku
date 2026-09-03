// M5 入口：初始化渲染循环、装配各模块、处理 UI 回调

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { generateIcosphere } from './mesh/icosphere.js';
import { validateMesh } from './mesh/validate.js';
import { Board } from './game/board.js';
import { Scene } from './render/scene.js';
import { BoardView } from './render/boardView.js';
import { StoneView } from './render/stoneView.js';
import { Raycaster } from './interaction/raycaster.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new Scene(this.container);
    this.scene.setBackground(CONFIG.COLOR_BG_TOP, CONFIG.COLOR_BG_BOTTOM);

    this.board = null;
    this.boardView = new BoardView(this.scene);
    this.stoneView = new StoneView(this.scene);
    this.raycaster = null;
    this.currentN = CONFIG.SUBDIVISION_FREQ;

    this.statusTurn = document.getElementById('status-turn');
    this.statusPlayer = document.getElementById('status-player');
    this.statusMessage = document.getElementById('status-message');
    this.selWinN = document.getElementById('sel-win-n');
    this.selFreq = document.getElementById('sel-freq');

    this.rebuild(this.currentN);

    // UI 事件
    document.getElementById('btn-new').addEventListener('click', () => this.newGame());
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    this.selWinN.addEventListener('change', () => {
      // WIN_N 只影响后续判胜；重放历史保证当前局面判胜状态一致
      CONFIG.WIN_N = parseInt(this.selWinN.value, 10);
      this.replayAll();
      this.stoneView.clearWin();
      if (this.board.won) {
        this.stoneView.highlightWin(this.board.winningLine);
        this.stoneView.dimOthers(this.board.winningLine);
        const name = this.board.winner === 1 ? '黑方' : '白方';
        this.statusMessage.textContent = `连珠数改为 ${CONFIG.WIN_N}，${name}获胜！`;
        return;
      }
      this.updateUI();
      this.statusMessage.textContent = `连珠数改为 ${CONFIG.WIN_N}`;
    });
    this.selFreq.addEventListener('change', () => {
      const n = parseInt(this.selFreq.value, 10);
      if (n === this.currentN) return;
      // 重建棋盘会清空对局，需二次确认
      if (!confirm(`细分频率改为 ${n} 将重建棋盘并清空当前对局，确定吗？`)) {
        this.selFreq.value = String(this.currentN);
        return;
      }
      this.currentN = n;
      this.rebuild(n);
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // 重放整段历史（切换 WIN_N 后恢复局面）
  replayAll() {
    const moves = [];
    while (this.board.history.length > 0) moves.push(this.board.undo());
    for (const m of moves.reverse()) this.board.place(m.v);
    if (this.board.won) {
      this.stoneView.highlightWin(this.board.winningLine);
    }
  }

  // 重建棋盘（细分频率改变时调用，清空对局）
  rebuild(n) {
    this.mesh = generateIcosphere(n);
    const stats = validateMesh(this.mesh, n); // 不通过会抛错
    console.log('网格生成校验通过', stats);

    // 重建 board
    this.board = new Board(this.mesh);
    this.stoneView.setMesh(this.mesh);

    // 重建渲染
    this.boardView.build(this.mesh);
    this.stoneView.rebuild(this.board);

    // 重建交互
    if (this.raycaster) this.raycaster.dispose();
    this.raycaster = new Raycaster(this.scene, this.board, this.stoneView);

    this.updateUI();
    this.statusMessage.textContent = '对局开始，黑先';
  }

  // 处理一次点击落子
  handleClickedVertex(idx) {
    if (idx === null || idx === undefined) return;
    const res = this.board.place(idx);
    if (!res) return;

    // 重绘棋子
    this.stoneView.rebuild(this.board);

    if (res.won) {
      this.stoneView.highlightWin(res.line);
      this.stoneView.dimOthers(res.line);
      const name = res.player === 1 ? '黑方' : '白方';
      this.statusMessage.textContent = `${name}获胜！`;
    } else if (res.isDraw) {
      this.statusMessage.textContent = '和棋！';
    } else {
      this.updateUI();
    }

    this.raycaster.clearHover();
  }

  undo() {
    const last = this.board.undo();
    if (!last) return;
    this.stoneView.rebuild(this.board);
    this.stoneView.clearWin();
    this.updateUI();
    this.statusMessage.textContent = `悔棋（第 ${this.board.history.length + 1} 手），轮到${last.player === 1 ? '黑方' : '白方'}`;
    this.raycaster.clearHover();
  }

  newGame() {
    this.board.reset();
    this.stoneView.rebuild(this.board);
    this.stoneView.clearWin();
    this.updateUI();
    this.statusMessage.textContent = '对局开始，黑先';
  }

  updateUI() {
    this.statusTurn.textContent = `第 ${this.board.history.length} 手`;
    this.statusPlayer.textContent = this.board.currentPlayer === 1 ? '黑方' : '白方';
  }

  loop() {
    requestAnimationFrame(this.loop);
    this.scene.render();

    // 消费点击（pointerdown 只记录索引，这里真正落子）
    const idx = this.raycaster.consumeClick();
    if (idx !== null) {
      this.handleClickedVertex(idx);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
