// M5 入口：初始化渲染循环、装配各模块、处理 UI 回调

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { generateIcosphere } from './mesh/icosphere.js';
import { validateMesh } from './mesh/validate.js';
import { Board } from './game/board.js';
import { BLACK, WHITE } from './game/rules.js';
import { chooseMove } from './game/ai.js';
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
    // 模式与执色：pvp=双人；ai=人机（玩家执 humanColor，AI 执另一色）
    // 默认人机对战；按钮文案为"命令式"：显示"点击后切换到的目标"而非当前状态
    // （人机 → "双人"，双人 → "人机"；玩家执黑 → "执白"，执白 → "执黑"）
    this.mode = 'ai';
    this.humanColor = BLACK; // 玩家默认执黑先行
    this.aiTimer = null;     // AI 落子定时器（思考延迟）

    this.statusTurn = document.getElementById('status-turn');
    this.statusPlayer = document.getElementById('status-player');
    this.statusPlayerRow = document.getElementById('status-player-row');
    this.statusMode = document.getElementById('status-mode');
    this.statusBoard = document.getElementById('status-board');
    this.statusMessage = document.getElementById('status-message');
    this.winOverlay = document.getElementById('win-overlay');
    this.winText = document.getElementById('win-text');
    this.btnMode = document.getElementById('btn-mode');
    this.btnColor = document.getElementById('btn-color');
    this.btnFreq = document.getElementById('btn-freq');

    this.rebuild(this.currentN);

    // UI 事件
    document.getElementById('btn-new').addEventListener('click', () => this.newGame());
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-export').addEventListener('click', () => this.exportGame());
    this.updateFreqButton(); // 命令式初始文案：默认细分五 → 按钮显示"细分六"

    // 模式切换（命令式文案）：人机 ↔ 双人，切换时清盘重开
    this.btnMode.addEventListener('click', () => {
      const ai = this.mode !== 'ai';
      this.mode = ai ? 'ai' : 'pvp';
      this.btnMode.textContent = ai ? '双人' : '人机'; // 显示点击后的目标模式
      this.btnColor.hidden = !ai;
      this.statusMessage.textContent = ai
        ? `人机模式：你执${this.humanColor === BLACK ? '黑' : '白'}（可点按钮换边）`
        : '';
      this.startNewRound();
    });

    // 人机模式换边（命令式文案）：玩家执黑 ↔ 执白（执白时 AI 执黑先行）
    this.btnColor.addEventListener('click', () => {
      this.humanColor = this.humanColor === BLACK ? WHITE : BLACK;
      this.btnColor.textContent = this.humanColor === BLACK ? '执白' : '执黑'; // 显示点击后的目标执色
      this.statusMessage.textContent = `你执${this.humanColor === BLACK ? '黑' : '白'}，本局${this.humanColor === BLACK ? '你先手' : 'AI 先手'}`;
      this.startNewRound();
    });

    // 细分频率切换（命令式文案：当前细分五显示"细分六"，反之亦然）：重建棋盘会清空对局，需二次确认
    this.btnFreq.addEventListener('click', () => {
      const target = this.currentN === 5 ? 6 : 5;
      if (!confirm(`细分频率改为 ${target} 将重建棋盘并清空当前对局，确定吗？`)) return;
      this.currentN = target;
      this.rebuild(target);
      this.updateFreqButton();
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // 重建棋盘（细分频率改变时调用，清空对局；同时清胜线/胜字——否则残留上一局高亮）
  rebuild(n) {
    this.clearAiSchedule();
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
    this.stoneView.hideAiMark();
    this.hideResult();

    // 重建交互
    if (this.raycaster) this.raycaster.dispose();
    this.raycaster = new Raycaster(this.scene, this.board, this.stoneView);

    this.updateUI();
    this.statusMessage.textContent = '';
  }

  // 处理一次点击落子（仅玩家回合可落；AI 回合点击被忽略——防连点）
  handleClickedVertex(idx) {
    if (idx === null || idx === undefined) return;
    // 人机模式：轮到 AI 时玩家点击无效
    if (this.mode === 'ai' && this.board.currentPlayer !== this.humanColor) return;

    const res = this.board.place(idx);
    if (!res) return;

    this.stoneView.rebuild(this.board);
    this.stoneView.hideAiMark();

    if (res.won || res.isDraw) {
      this.finishRound(res);
    } else {
      this.updateUI();
      this.maybeScheduleAi(); // 落子后轮到 AI 则安排思考
    }
    this.raycaster.clearHover();
  }

  // 人机模式：当前若轮到 AI，0.5s 后自动落子
  maybeScheduleAi() {
    if (this.mode !== 'ai') return;
    if (this.board.won || this.board.isDraw) return;
    if (this.board.currentPlayer === this.humanColor) return;
    this.clearAiSchedule();
    this.aiTimer = setTimeout(() => this.aiMove(), CONFIG.AI_THINK_MS);
  }

  clearAiSchedule() {
    if (this.aiTimer !== null) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  // AI 决策落子：评分+浅层搜索选点 → 落子 → 旋转视角把落点转至视口中央
  aiMove() {
    this.aiTimer = null;
    if (this.mode !== 'ai' || this.board.won || this.board.isDraw) return;
    if (this.board.currentPlayer === this.humanColor) return; // 竞态保护

    const v = chooseMove(this.board, this.board.currentPlayer);
    const res = this.board.place(v);
    if (!res) return;

    this.stoneView.rebuild(this.board);
    this.stoneView.showAiMark(v, res.player); // 标记锥色与 AI 棋子相反（黑子→白锥/白子→墨锥）
    this.centerViewOn(v);               // 视口旋转使 AI 落子朝前

    if (res.won || res.isDraw) {
      this.finishRound(res);
    } else {
      this.updateUI();
    }
    this.raycaster.clearHover();
  }

  // 清盘重开（模式切换 / 换边后调用）：重置对局并决定谁先手
  startNewRound() {
    this.clearAiSchedule();
    this.board.reset();
    this.stoneView.rebuild(this.board);
    this.stoneView.clearWin();
    this.stoneView.hideAiMark();
    this.hideResult();
    this.updateUI();
    // 人机模式且玩家执白：AI（黑）先手
    if (this.mode === 'ai' && this.humanColor === WHITE) {
      this.statusMessage.textContent = 'AI 先行…';
      this.maybeScheduleAi();
    }
  }

  // AI 落子后把视口转过去：保持球心在原点，相机沿落点法向看，使落子位于视口中央
  centerViewOn(v) {
    const pos = this.mesh.positions;
    const dir = new THREE.Vector3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]).normalize();
    const dist = this.scene.camera.position.length();
    const { controls, camera } = this.scene;
    controls.target.set(0, 0, 0);
    camera.position.copy(dir).multiplyScalar(dist);
    camera.lookAt(0, 0, 0);
    controls.update();
  }

  // 结算一局：胜负 / 和棋（更新状态行提示后落中央大字）
  finishRound(res) {
    if (res.won) {
      this.stoneView.highlightWin(res.line);
      this.statusMessage.textContent = '';
      if (this.mode === 'ai') {
        // 人机模式：以玩家视角出结果（命令式文案）
        this.showResult(res.player === this.humanColor ? '你赢了' : '你输了');
      } else {
        this.showResult(res.player === BLACK ? '黑胜' : '白胜');
      }
    } else if (res.isDraw) {
      this.statusMessage.textContent = '';
      this.showResult('和棋');
    }
  }

  undo() {
    this.clearAiSchedule();
    // 人机模式：轮到玩家（说明 AI 刚回应）时，悔棋应连撤两步——
    // AI 的回应 + 玩家上一手，回到玩家重新落子，而非撤完又被 AI 立刻重放
    if (this.mode === 'ai' && this.board.currentPlayer === this.humanColor) {
      this.board.undo();
    }
    const last = this.board.undo();
    if (!last) return;
    this.stoneView.rebuild(this.board);
    this.stoneView.clearWin();
    this.stoneView.hideAiMark();
    this.hideResult();
    this.updateUI();

    if (this.mode === 'ai' && !this.board.won && !this.board.isDraw) {
      if (this.board.currentPlayer === this.humanColor) {
        this.statusMessage.textContent = `悔棋（第 ${this.board.history.length} 手后），请重新落子`;
      } else {
        this.statusMessage.textContent = '悔棋（轮到 AI 应手）';
        this.maybeScheduleAi();
        this.raycaster.clearHover();
        return;
      }
    } else {
      this.statusMessage.textContent = `悔棋（第 ${this.board.history.length} 手后）`;
    }
    this.raycaster.clearHover();
  }

  newGame() {
    this.clearAiSchedule();
    this.board.reset();
    this.stoneView.rebuild(this.board);
    this.stoneView.clearWin();
    this.stoneView.hideAiMark();
    this.hideResult();
    this.updateUI();
    // 人机模式：玩家执白则 AI 黑先；执黑则等待玩家落子
    if (this.mode === 'ai' && this.humanColor === WHITE) {
      this.statusMessage.textContent = 'AI 先行…';
      this.maybeScheduleAi();
    } else {
      this.statusMessage.textContent = '';
    }
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

  // 细分按钮命令式文案：显示"点击后切换到的目标"——当前细分五显示"细分六"，反之亦然
  updateFreqButton() {
    this.btnFreq.textContent = this.currentN === 5 ? '细分六' : '细分五';
  }

  updateUI() {
    // 模式行：人机模式带玩家执色"人机（你执黑/白）"且括号前换行，双人模式仅"双人"
    // （换行由 CSS white-space:pre-line 呈现）
    this.statusMode.textContent = this.mode === 'ai'
      ? `人机\n（你执${this.humanColor === BLACK ? '黑' : '白'}）`
      : '双人';
    this.statusBoard.textContent = this.currentN === 5 ? '细分五' : '细分六';
    this.statusTurn.textContent = String(this.board.history.length);
    // 执子方行仅双人模式显示（人机模式已由模式行表达执色）
    this.statusPlayerRow.hidden = this.mode === 'ai';
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

  try {
    new Game();
  } catch (err) {
    // 初始化失败（如 WebGL 不可用）：显示加载失败而非停在"加载中"
    // 文案用字需在子集字体内（加/载/失/败/请/刷/新 均收录）
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.textContent = '加载失败，请刷新';
    console.error('游戏初始化失败', err);
    return;
  }

  // 初始化完成：隐藏首屏加载提示
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'none';

  // 左侧竖向 bar 收起/展开（✕ 置最左上，收起后 ☰ 恢复）
  const hud = document.getElementById('hud');
  const btnCollapse = document.getElementById('btn-collapse');
  const btnInfo = document.getElementById('btn-info');
  const infoSlot = document.getElementById('hud-info-slot');

  // i 按钮随折叠状态换位：展开时位于 bar 底部槽位，收起时回到 ✕ 下方（hud-head）
  const placeInfoButton = () => {
    const target = hud.classList.contains('collapsed') ? document.getElementById('hud-head') : infoSlot;
    if (btnInfo.parentElement !== target) target.appendChild(btnInfo);
  };

  btnCollapse.addEventListener('click', () => {
    const collapsed = hud.classList.toggle('collapsed');
    btnCollapse.textContent = collapsed ? '☰' : '✕';
    placeInfoButton();
  });
  placeInfoButton(); // 初始为展开态：i 按钮落到 bar 底部

  // 游戏说明：圆 i 打开全屏 info 弹层（内容取自 info.txt），点 X 退出
  const infoModal = document.getElementById('info-modal');
  const infoText = document.getElementById('info-text');
  document.getElementById('btn-info').addEventListener('click', async () => {
    try {
      const res = await fetch('info.txt');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      infoText.textContent = await res.text();
    } catch (err) {
      infoText.textContent = '说明文字加载失败（缺少 info.txt）';
      console.error('加载 info.txt 失败', err);
    }
    infoModal.hidden = false;
  });
  document.getElementById('btn-info-close').addEventListener('click', () => {
    infoModal.hidden = true;
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
