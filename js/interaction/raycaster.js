// M3 拾取：屏幕射线 → 单位球面交点 → 最近可落子顶点、悬停预览
// 用解析球面求交而非 intersectObject：
//   1) 不依赖场景里有没有可命中的几何体（网格是线/点，空白处无实体可打）
//   2) 悬停预览能稳定跟随鼠标，不会因命中棋子/预览球而抖动

import * as THREE from 'three';

const DRAG_THRESHOLD_PX = 6; // 位移小于该值视为"点击"，否则是拖拽旋转

export class Raycaster {
  constructor(scene, board, stoneView) {
    this.scene = scene;
    this.board = board;
    this.stoneView = stoneView;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.hoveredVertex = null;
    this.pressPos = null; // { clientX, clientY, idx }：按下时记录，抬起判定点击

    // 顶点间距参考：取顶点 0 到首邻接的弦长，用于"格子归属"判定
    this.edgeLen = 0.25;
    const adj0 = board.mesh.adjacency[0] || [];
    if (adj0.length > 0) {
      const dx = board.mesh.positions[adj0[0] * 3] - board.mesh.positions[0];
      const dy = board.mesh.positions[adj0[0] * 3 + 1] - board.mesh.positions[1];
      const dz = board.mesh.positions[adj0[0] * 3 + 2] - board.mesh.positions[2];
      this.edgeLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const dom = scene.renderer.domElement;
    this.onMove = this.onPointerMove.bind(this);
    this.onDown = this.onPointerDown.bind(this);
    this.onUp = this.onPointerUp.bind(this);
    this.onLeave = this.onPointerLeave.bind(this);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointerleave', this.onLeave);
  }

  // 重建棋盘时移除旧监听，避免多个 Raycaster 同时响应
  dispose() {
    const dom = this.scene.renderer.domElement;
    dom.removeEventListener('pointermove', this.onMove);
    dom.removeEventListener('pointerdown', this.onDown);
    dom.removeEventListener('pointerup', this.onUp);
    dom.removeEventListener('pointerleave', this.onLeave);
  }

  // 屏幕坐标转 NDC
  updateNDC(clientX, clientY) {
    const rect = this.scene.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  // 射线与单位球面的近交点；射线未照到球面返回 null。
  // 手写解析求交：|origin + t·dir| = 1 的最近正根，
  // 不依赖 three 的 Ray.intersectSphere（其 target 参数在 r185 起必须显式传入）
  sphereHitPoint() {
    this.raycaster.setFromCamera(this.pointer, this.scene.camera);
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    // t² + 2(o·d)t + (|o|² − r²) = 0，r = 1
    const b = o.dot(d);
    const c = o.dot(o) - 1;
    const disc = b * b - c;
    if (disc < 0) return null;
    let t = -b - Math.sqrt(disc); // 近交点
    if (t <= 0) t = -b + Math.sqrt(disc); // 射线起点在球内时取远交点
    if (t <= 0) return null;
    return o.clone().addScaledVector(d, t);
  }

  // 找球面交点 p 附近的顶点：
  // 优先最近顶点；若最近顶点已被占据，则在"格子归属"范围内找最近空顶点，
  // 距离明显超出（点落在已占顶点的势力圈内）则返回 -1（无可落子点）。
  findPlaceableVertex(p) {
    const mesh = this.board.mesh;
    const V = mesh.positions.length / 3;
    let occDist = Infinity;   // 最近已占顶点距离
    let emptyIdx = -1;
    let emptyDist = Infinity; // 最近空顶点距离

    for (let v = 0; v < V; v++) {
      const dx = mesh.positions[v * 3] - p.x;
      const dy = mesh.positions[v * 3 + 1] - p.y;
      const dz = mesh.positions[v * 3 + 2] - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (this.board.occupied[v] !== null) {
        if (d < occDist) occDist = d;
      } else if (d < emptyDist) {
        emptyDist = d;
        emptyIdx = v;
      }
    }
    if (emptyIdx === -1) return -1;
    // 空顶点必须在"半格"范围内：比最近已占顶点近，或只远半个格距
    const slack = 0.5 * this.edgeLen;
    if (Math.sqrt(emptyDist) <= Math.sqrt(occDist) + slack) return emptyIdx;
    return -1;
  }

  onPointerMove(e) {
    // 对局结束不再预览
    if (this.board.won || this.board.isDraw) {
      if (this.hoveredVertex !== null) this.hideHover();
      return;
    }
    this.updateNDC(e.clientX, e.clientY);
    const p = this.sphereHitPoint();
    if (!p) { this.hideHover(); return; }

    const idx = this.findPlaceableVertex(p);
    if (idx !== -1 && idx !== this.hoveredVertex) {
      this.hoveredVertex = idx;
      this.stoneView.setHover(idx, this.board.currentPlayer, true);
      this.scene.renderer.domElement.style.cursor = 'pointer';
    } else if (idx === -1) {
      this.hideHover();
    }
  }

  onPointerDown(e) {
    if (e.button !== 0) return; // 仅左键
    this.updateNDC(e.clientX, e.clientY);
    const p = this.sphereHitPoint();
    const idx = p ? this.findPlaceableVertex(p) : -1;
    this.pressPos = { clientX: e.clientX, clientY: e.clientY, idx };
    // 按下即取消预览（无论最终是点击还是拖拽）
    this.stoneView.setHover(null, this.board.currentPlayer, false);
  }

  onPointerUp(e) {
    if (e.button !== 0 || !this.pressPos) return;
    const { clientX, clientY, idx } = this.pressPos;
    this.pressPos = null;
    // 位移超过阈值 → 判定为拖拽旋转，不落子
    const moved = Math.hypot(e.clientX - clientX, e.clientY - clientY);
    if (moved > DRAG_THRESHOLD_PX) return;
    if (idx === -1) return;
    // 交给 board.place，落子后由 main 重绘 + 清悬停
    this.onPlace = idx;
    this.hoveredVertex = null;
    this.stoneView.setHover(null, this.board.currentPlayer, false);
  }

  // 鼠标离开 canvas：清悬停与按下状态
  onPointerLeave() {
    this.hideHover();
    this.pressPos = null;
  }

  hideHover() {
    if (this.hoveredVertex !== null) {
      this.hoveredVertex = null;
      this.stoneView.setHover(null, this.board.currentPlayer, false);
      this.scene.renderer.domElement.style.cursor = 'default';
    }
  }

  // 主循环调用：落子后清悬停
  clearHover() {
    this.hideHover();
  }

  // 是否有点击待处理（由 main 消费）
  consumeClick() {
    const idx = this.onPlace;
    this.onPlace = null;
    return idx;
  }
}

export default Raycaster;
