// M2 棋盘渲染：纸面实体（自遮挡）+ 网格线 + 顶点标记 + 星位点
// 纸面实体 = 复用同一细分 icosphere 的三角面片整体微缩 OCCLUDER_SCALE：
//   · 与网格线同拓扑，缩放后每根网格线都严格位于其外侧（无 z-fight、正面线不再被吃）
//   · 自身为不透明纸面，天然把背面网格/棋子遮挡掉，无需额外加一个更细的圆球

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { makePaperTexture } from './scene.js';

export class BoardView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.group.add(this.group);
  }

  // 由 mesh 构建：纸面实体 → 网格线 → 顶点标记 → 星位点
  build(mesh) {
    this.clear();
    this.mesh = mesh;

    // 0) 纸面实体（不透明，负责遮挡背面）
    this.faceMesh = this.buildPaperBall(mesh);
    this.group.add(this.faceMesh);

    // 1) 网格线（墨线）
    const lineGeo = new THREE.BufferGeometry();
    const linePoints = [];
    for (const [a, b, c] of mesh.faces) {
      const addEdge = (i, j) => {
        const p = (idx) => new THREE.Vector3(
          mesh.positions[idx * 3],
          mesh.positions[idx * 3 + 1],
          mesh.positions[idx * 3 + 2]
        );
        linePoints.push(p(i), p(j));
      };
      addEdge(a, b); addEdge(b, c); addEdge(c, a);
    }
    lineGeo.setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(CONFIG.COLOR_LINE) });
    this.lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    this.group.add(this.lineMesh);

    // 2) 星位点：普通交叉点小点样式，仅标记 12 个五价点（普通顶点不画点，网格线即交叉标记）
    this.starMesh = this.buildDotMesh(
      mesh,
      CONFIG.STAR_MARK_RADIUS,
      CONFIG.COLOR_STAR,
      () => mesh.degree5Vertices.length,
      (v) => mesh.degree5Vertices[v]
    );
    this.group.add(this.starMesh);
  }

  // 纸面实体：同细分 icosphere 三角面，整体乘 OCCLUDER_SCALE（约 0.99）微缩
  buildPaperBall(mesh) {
    const { positions, faces } = mesh;
    const s = CONFIG.OCCLUDER_SCALE;
    const pos = [];
    const uv = [];
    for (const [a, b, c] of faces) {
      for (const v of [a, b, c]) {
        const x = positions[v * 3] * s;
        const y = positions[v * 3 + 1] * s;
        const z = positions[v * 3 + 2] * s;
        pos.push(x, y, z);
        // 由单位方向生成等距柱状 UV，供纸纹噪波贴图使用
        const nx = x / s, ny = y / s, nz = z / s;
        uv.push(
          0.5 + Math.atan2(nz, nx) / (2 * Math.PI),
          0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI
        );
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mat = new THREE.MeshBasicMaterial({
      map: makePaperTexture(CONFIG.COLOR_PAPER, CONFIG.PAPER_NOISE_TILE),
    });
    return new THREE.Mesh(geo, mat);
  }

  // 通用实心点 InstancedMesh（普通顶点 / 星位点共用）
  buildDotMesh(mesh, radius, colorHex, countFn, indexFn) {
    const count = countFn();
    const geo = new THREE.SphereGeometry(radius, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for (let v = 0; v < count; v++) {
      const idx = indexFn(v);
      dummy.position.set(
        mesh.positions[idx * 3],
        mesh.positions[idx * 3 + 1],
        mesh.positions[idx * 3 + 2]
      );
      dummy.updateMatrix();
      inst.setMatrixAt(v, dummy.matrix);
    }
    return inst;
  }

  clear() {
    while (this.group.children.length) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        // InstancedMesh 的材质可能带贴图（纸纹），一并释放
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    }
  }
}

export default BoardView;
