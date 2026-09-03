// M2 棋盘渲染：纸面实体（自遮挡）+ 网格线 + 顶点标记 + 星位点
// 纸面实体 = 复用同一细分 icosphere 的三角面片整体微缩 OCCLUDER_SCALE：
//   · 与网格线同拓扑，缩放后每根网格线都严格位于其外侧（无 z-fight、正面线不再被吃）
//   · 自身为不透明纸面，天然把背面网格/棋子遮挡掉，无需额外加一个更细的圆球

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const UP = new THREE.Vector3(0, 0, 1); // 压扁轴（几何 +Z），将对齐顶点法向

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

  // 纸面实体：同细分 icosphere 三角面，整体乘 OCCLUDER_SCALE（约 0.99）微缩。
  // 纯平涂纸色（无贴图噪波）；纸纹由最上层全视口噪波覆盖层统一提供
  buildPaperBall(mesh) {
    const { positions, faces } = mesh;
    const s = CONFIG.OCCLUDER_SCALE;
    const pos = [];
    for (const [a, b, c] of faces) {
      for (const v of [a, b, c]) {
        pos.push(
          positions[v * 3] * s,
          positions[v * 3 + 1] * s,
          positions[v * 3 + 2] * s
        );
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.COLOR_PAPER) });
    return new THREE.Mesh(geo, mat);
  }

  // 星位实心小点 InstancedMesh：几何沿 +Z 压扁 STONE_SQUASH（与棋子同扁），
  // 逐实例用四元数把压扁轴对齐到顶点法向，贴服球面
  buildDotMesh(mesh, radius, colorHex, countFn, indexFn) {
    const count = countFn();
    const geo = new THREE.SphereGeometry(radius, 10, 8);
    geo.scale(1, 1, CONFIG.STONE_SQUASH);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const quat = new THREE.Quaternion();
    for (let v = 0; v < count; v++) {
      const idx = indexFn(v);
      const normal = new THREE.Vector3(
        mesh.positions[idx * 3],
        mesh.positions[idx * 3 + 1],
        mesh.positions[idx * 3 + 2]
      ).normalize();
      dummy.position.copy(normal);
      quat.setFromUnitVectors(UP, normal);
      dummy.quaternion.copy(quat);
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
