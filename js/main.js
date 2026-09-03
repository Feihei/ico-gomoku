// M5 入口：初始化渲染循环、装配各模块、处理 UI 回调

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { generateIcosphere } from './mesh/icosphere.js';
import { validateMesh } from './mesh/validate.js';
import { Board } from './game/board.js';
import { BLACK } from './game/rules.js';
import { Scene } from './render/scene.js';
import { BoardView } from './render/boardView.js';
import { StoneView } from './render/stoneView.js';
import { Raycaster } from './interaction/raycaster.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new Scene(this.container); // 纸面背景在 Scene 构造时已设置

    this.board = null;
    this.boardView = new BoardView(this.scene);
    this.stoneView = new StoneView(this.scene);
    this.raycaster = null;
    this.currentN = CONFIG.SUBDIVISION_FREQ;
    // v1 仅对战（AGENTS §10 不做 AI）；人机按钮为 UI 占位
    this.mode = 'pvp';

    this.statusTurn = document.getElementById('status-turn');
    this.statusPlayer = document.getElementById('status-player');
    this.statusMessage = document.getElementById('status-message');
    this.winOverlay = document.getElementById('win-overlay');
    this.winText = document.getElementById('win-text');
    this.btnMode = document.getElementById('btn-mode');
    this.freqBtns = Array.from(document.querySelectorAll('.freq-btn'));

    this.rebuild(this.currentN);

    // UI 事件
    document.getElementById('btn-new').addEventListener('click', () => this.newGame());
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-export').addEventListener('click', () => this.exportGame());

    // 模式切换（占位）：v1 无 AI，点击提示后仍按对战进行
    this.btnMode.addEventListener('click', () => {
      if (this.mode === 'pvp') {
        this.mode = 'ai';
        this.btnMode.textContent = '人机';
        this.statusMessage.textContent = '人机 AI 开发中，暂按对战进行';
        // 短暂提示后回退对战模式（占位期间不接受 AI 模式）
        setTimeout(() => {
          this.mode = 'pvp';
          this.btnMode.textContent = '对战';
        }, 1500);
      }
    });

    // 细分频率 5/6 切换（重建棋盘会清空对局，需二次确认）
    for (const btn of this.freqBtns) {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.freq, 10);
        if (n === this.currentN) return;
        if (!confirm(`细分频率改为 ${n} 将重建棋盘并清空当前对局，确定吗？`)) return;
        this.currentN = n;
        this.rebuild(n);
        for (const b of this.freqBtns) {
          b.classList.toggle('active', b === btn);
        }
      });
    }

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // 重建棋盘（细分频率改变时调用，清空对局；同时清胜线/胜字——否则残留上一局高亮）
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
    this.stoneView.clearWin(); // bug 修复：重开棋盘必须清掉旧胜线
    this.hideResult();

    // 重建交互
    if (this.raycaster) this.raycaster.dispose();
    this.raycaster = new Raycaster(this.scene, this.board, this.stoneView);

    this.updateUI();
    this.statusMessage.textContent = '';
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
      this.statusMessage.textContent = '';
      this.showResult(res.player === BLACK ? '黑胜' : '白胜');
    } else if (res.isDraw) {
      this.statusMessage.textContent = '';
      this.showResult('和棋');
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
    this.hideResult();
    this.updateUI();
    this.statusMessage.textContent = `悔棋（第 ${this.board.history.length + 1} 手），轮到${last.player === BLACK ? '黑方' : '白方'}`;
    this.raycaster.clearHover();
  }

  newGame() {
    this.board.reset();
    this.stoneView.rebuild(this.board);
    this.stoneView.clearWin();
    this.hideResult();
    this.updateUI();
    this.statusMessage.textContent = '';
  }

  // 中央大字胜负提示
  showResult(text) {
    this.winText.textContent = text;
    this.winOverlay.hidden = false;
  }

  hideResult() {
    this.winOverlay.hidden = true;
  }

  // 导出当前棋局为 JSON（细分频率、连珠数、全部手数、结果）
  exportGame() {
    const moves = this.board.history.map((m) => ({ v: m.v, player: m.player === BLACK ? '黑' : '白' }));
    const result = this.board.won
      ? (this.board.winner === BLACK ? '黑胜' : '白胜')
      : (this.board.isDraw ? '和棋' : '进行中');
    const data = {
      game: '球面五子棋',
      subdivisionFrequency: this.currentN,
      winN: CONFIG.WIN_N,
      mode: this.mode,
      moves,
      result,
    };
    const json = JSON.stringify(data, null, 2);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `球面五子棋-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  updateUI() {
    this.statusTurn.textContent = String(this.board.history.length);
    this.statusPlayer.textContent = this.board.currentPlayer === BLACK ? '黑方' : '白方';
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
  // 最上层纸纹噪波覆盖层：生成灰度细颗粒图块铺满视口（物体纯平涂色 + 颗粒层 = 纸面）
  paintNoiseOverlay();

  new Game();

  // 左侧竖向 bar 收起/展开（✕ 置最左上，收起后 ☰ 恢复）
  const hud = document.getElementById('hud');
  const btnCollapse = document.getElementById('btn-collapse');
  btnCollapse.addEventListener('click', () => {
    const collapsed = hud.classList.toggle('collapsed');
    btnCollapse.textContent = collapsed ? '☰' : '✕';
  });
});

// 生成噪波图块并作为 background-image 平铺整个视口
function paintNoiseOverlay() {
  const el = document.getElementById('paper-noise');
  if (!el) return;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  // 每像素：灰度随机 + 极低 alpha，模拟纸张纤维颗粒（点得越密越均匀，不宜过强）
  const maxAlpha = CONFIG.PAPER_NOISE_STRENGTH * 255;
  for (let i = 0; i < data.length; i += 4) {
    const g = Math.floor(Math.random() * 256);
    data[i] = g;
    data[i + 1] = g;
    data[i + 2] = g;
    data[i + 3] = Math.floor(Math.random() * maxAlpha);
  }
  ctx.putImageData(img, 0, 0);
  el.style.backgroundImage = `url(${canvas.toDataURL()})`;
}
