// M3 拾取：鼠标→最近可落子顶点、悬停预览

import * as THREE from 'three';
import { Board } from '../game/board.js';
import { BLACK } from '../game/rules.js';

export class Raycaster {
  constructor(scene, board, stoneView) {
    this.scene = scene;
    this.board = board;
    this.stoneView = stoneView;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.hoveredVertex = null;

    const dom = scene.renderer.domElement;
    dom.addEventListener('pointermove', this.onPointerMove.bind(this));
    dom.addEventListener('pointerdown', this.onPointerDown.bind(this));
  }

  // 屏幕坐标转 NDC
  updateNDC(clientX, clientY) {
    const rect = this.scene.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  // 找最近的可落子顶点（命中空顶点，或棋子但只读最近索引）
  findClosestVertex(intersect) {
    const mesh = this.board.mesh;
    let bestIdx = -1;
    let bestDist = Infinity;

    for (const hit of intersect) {
      // 命中点投影到球面附近，找最近顶点
      const p = hit.point;
      // 遍历所有顶点找最近（V=252，性能 OK）
      for (let v = 0; v < mesh.positions.length / 3; v++) {
        const vx = mesh.positions[v * 3];
        const vy = mesh.positions[v * 3 + 1];
        const vz = mesh.positions[v * 3 + 2];
        const dx = p.x - vx, dy = p.y - vy, dz = p.z - vz;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = v;
        }
      }
    }

    return bestIdx;
  }

  onPointerMove(e) {
    this.updateNDC(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.pointer, this.scene.camera);
    const intersects = this.raycaster.intersectObject(this.scene.group, true);

    if (intersects.length > 0) {
      const idx = this.findClosestVertex(intersects);
      if (idx !== -1 && idx !== this.hoveredVertex) {
        this.hoveredVertex = idx;
        this.stoneView.setHover(idx, this.board.currentPlayer, true);
        this.scene.renderer.domElement.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredVertex !== null) {
        this.hoveredVertex = null;
        this.stoneView.setHover(null, this.board.currentPlayer, false);
        this.scene.renderer.domElement.style.cursor = 'default';
      }
    }
  }

  onPointerDown(e) {
    if (e.button !== 0) return; // 仅左键
    this.updateNDC(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.pointer, this.scene.camera);
    const intersects = this.raycaster.intersectObject(this.scene.group, true);
    if (intersects.length === 0) return;

    const idx = this.findClosestVertex(intersects);
    if (idx === -1) return;

    // 交给 board.place，点击后由 main 负责重绘 + 悬停清除
    this.onPlace = idx;
    this.stoneView.setHover(null, this.board.currentPlayer, false);
  }

  // 主循环调用：落子后清悬停
  clearHover() {
    this.hoveredVertex = null;
    this.stoneView.setHover(null, this.board.currentPlayer, false);
  }

  // 是否有点击待处理（由 main 消费）
  consumeClick() {
    const idx = this.onPlace;
    this.onPlace = null;
    return idx;
  }
}

export default Raycaster;
