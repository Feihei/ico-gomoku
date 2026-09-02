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

    this.statusTurn = document.getElementById('status-turn');
    this.statusPlayer = document.getElementById('status-player');
    this.statusMessage = document.getElementById('status-message');

    this.rebuild(CONFIG.SUBDIVISION_FREQ);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // 重建棋盘（细分频率改变时调用，清空对局）
  rebuild(n) {
    this.mesh = generateIcosphere(n);
    const stats = validateMesh(this.mesh); // 不通过会抛错
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
      const name = res.player === 1 ? '黑方' : '白方';
      this.statusMessage.textContent = `${name}获胜！`;
      this.dimOthers(res.line);
    } else if (res.isDraw) {
      this.statusMessage.textContent = '和棋！';
    } else {
      this.updateUI();
    }

    this.raycaster.clearHover();
  }

  dimOthers(winLine) {
    // 简单压暗：非胜线子调透明度，胜线子保持
    // 这里用双材质思路太复杂，暂用场景整体不处理，仅高亮胜线
  }

  undo() {
    this.board.undo();
    this.stoneView.rebuild(this.board);
    this.stoneView.clearWin();
    this.updateUI();
    this.statusMessage.textContent = '悔棋，轮到白方';
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
  window.game = new Game();
});
