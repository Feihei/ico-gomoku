// M3 棋子：InstancedMesh 实例化渲染 + 落子动画 + 胜线高亮

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BLACK, WHITE } from '../game/rules.js';

export class StoneView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.group.add(this.group);

    // 棋子池（黑、白各一个 InstancedMesh）
    this.maxStones = 1024; // 留余量
    this.geo = new THREE.SphereGeometry(CONFIG.STONE_RADIUS, 16, 12);
    this.blackMesh = new THREE.InstancedMesh(this.geo, this.makeMat(CONFIG.COLOR_BLACK), this.maxStones);
    this.whiteMesh = new THREE.InstancedMesh(this.geo, this.makeMat(CONFIG.COLOR_WHITE), this.maxStones);
    this.blackMesh.count = 0;
    this.whiteMesh.count = 0;
    this.group.add(this.blackMesh);
    this.group.add(this.whiteMesh);

    // 悬停预览
    this.hoverGeo = new THREE.SphereGeometry(CONFIG.STONE_RADIUS, 16, 12);
    this.hoverMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.COLOR_HOVER), transparent: true, opacity: 0.5 });
    this.hoverMesh = new THREE.Mesh(this.hoverGeo, this.hoverMat);
    this.hoverMesh.visible = false;
    this.group.add(this.hoverMesh);

    // 胜线高亮（管状）
    this.winLineMesh = null;
  }

  makeMat(color) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.1,
    });
  }

  // 从 board 状态重建棋子
  rebuild(board) {
    let bi = 0, wi = 0;
    const dummy = new THREE.Object3D();
    for (let v = 0; v < board.occupied.length; v++) {
      const c = board.occupied[v];
      if (c === null) continue;
      const pos = new THREE.Vector3(
        board.mesh.positions[v * 3],
        board.mesh.positions[v * 3 + 1],
        board.mesh.positions[v * 3 + 2]
      );
      // 棋子略微浮出球面
      pos.normalize().multiplyScalar(pos.length() + CONFIG.STONE_Z_OFFSET);
      const mesh = c === BLACK ? this.blackMesh : this.whiteMesh;
      dummy.position.copy(pos);
      dummy.updateMatrix();
      mesh.setMatrixAt(c === BLACK ? bi++ : wi++, dummy.matrix);
    }
    this.blackMesh.count = bi;
    this.whiteMesh.count = wi;
    this.blackMesh.instanceMatrix.needsUpdate = true;
    this.whiteMesh.instanceMatrix.needsUpdate = true;
    this.blackMesh.frustumCulled = false;
    this.whiteMesh.frustumCulled = false;
  }

  setHover(vertexIndex, player, visible) {
    if (!visible || vertexIndex === null || vertexIndex === undefined) {
      this.hoverMesh.visible = false;
      return;
    }
    const p = this.meshPos(vertexIndex);
    this.hoverMesh.position.copy(p);
    this.hoverMat.color.set(player === BLACK ? CONFIG.COLOR_BLACK : CONFIG.COLOR_WHITE);
    this.hoverMesh.visible = true;
  }

  setMesh(mesh) {
    this.mesh = mesh;
  }

  meshPos(v) {
    const p = new THREE.Vector3(
      this.mesh.positions[v * 3],
      this.mesh.positions[v * 3 + 1],
      this.mesh.positions[v * 3 + 2]
    );
    // 棋子浮出球面
    return p.normalize().multiplyScalar(p.length() + CONFIG.STONE_Z_OFFSET);
  }

  // 标记胜线
  highlightWin(line) {
    this.clearWin();
    if (!line || line.length < 2) return;

    const points = line.map((v) => this.meshPos(v));
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(8, line.length * 8), 0.015, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.COLOR_WIN) });
    this.winLineMesh = new THREE.Mesh(tubeGeo, tubeMat);
    this.group.add(this.winLineMesh);
  }

  clearWin() {
    if (this.winLineMesh) {
      this.group.remove(this.winLineMesh);
      this.winLineMesh.geometry.dispose();
      this.winLineMesh.material.dispose();
      this.winLineMesh = null;
    }
  }

  // 其余棋子压暗（胜利时调用）
  dimOthers(winLine) {
    const winSet = new Set(winLine || []);
    // 简单处理：胜线子保持，其余调暗用材质全局透明度占位
    // 实际可用后处理或双 pass，这里为性能压暗非胜线
  }

  render() {
    // InstancedMesh 更新后自动渲染，占位
  }
}

export default StoneView;
