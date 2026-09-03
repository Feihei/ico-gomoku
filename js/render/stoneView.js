// M3 棋子：InstancedMesh 实例化渲染 + 落子动画 + 胜线高亮

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BLACK } from '../game/rules.js';

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
    // 胜利压暗：胜线顶点集合，null 表示未压暗
    this.winSet = null;
    // 当前每颗子的顶点归属（rebuild 时记录）
    this.blackVerts = [];
    this.whiteVerts = [];
  }

  makeMat(color) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.1,
    });
  }

  // 从 board 状态重建棋子（记录每颗子的顶点归属，供胜利压暗使用）
  rebuild(board) {
    this.board = board;
    this.blackVerts = [];
    this.whiteVerts = [];
    for (let v = 0; v < board.occupied.length; v++) {
      const c = board.occupied[v];
      if (c === null) continue;
      if (c === BLACK) this.blackVerts.push(v);
      else this.whiteVerts.push(v);
    }
    this.applyMatrices();
  }

  // 把当前棋子布局写入两个 InstancedMesh（尊重胜利压暗状态）
  applyMatrices() {
    const dummy = new THREE.Object3D();
    const put = (mesh, verts) => {
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        dummy.position.set(
          this.mesh.positions[v * 3],
          this.mesh.positions[v * 3 + 1],
          this.mesh.positions[v * 3 + 2]
        );
        // 棋子略微浮出球面
        dummy.position.normalize().multiplyScalar(1 + CONFIG.STONE_Z_OFFSET);
        // 压暗状态下非胜线子缩小，视觉上弱于胜线子
        const dimmed = this.winSet && !this.winSet.has(v);
        dummy.scale.setScalar(dimmed ? 0.7 : 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = verts.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
    };
    put(this.blackMesh, this.blackVerts);
    put(this.whiteMesh, this.whiteVerts);
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
    return p.normalize().multiplyScalar(1 + CONFIG.STONE_Z_OFFSET);
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

  // 其余棋子压暗（胜利时调用）：非胜线子缩小
  dimOthers(winLine) {
    this.winSet = new Set(winLine || []);
    this.applyMatrices();
  }

  clearWin() {
    if (this.winLineMesh) {
      this.group.remove(this.winLineMesh);
      this.winLineMesh.geometry.dispose();
      this.winLineMesh.material.dispose();
      this.winLineMesh = null;
    }
    if (this.winSet !== null) {
      this.winSet = null;
      this.applyMatrices();
    }
  }
}

export default StoneView;
