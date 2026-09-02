// M2 网格线、顶点标记、星位点渲染

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class BoardView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.group.add(this.group);
  }

  // 由 mesh 构建网格线 + 顶点标记 + 星位点
  build(mesh) {
    this.clear();
    this.mesh = mesh;

    // 1) 网格线
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

    // 2) 普通顶点小点
    const dotGeo = new THREE.SphereGeometry(CONFIG.VERTEX_MARKER_RADIUS, 8, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.COLOR_LINE) });
    this.dotMesh = new THREE.InstancedMesh(dotGeo, dotMat, mesh.positions.length / 3);
    const dummy = new THREE.Object3D();
    for (let v = 0; v < mesh.positions.length / 3; v++) {
      dummy.position.set(
        mesh.positions[v * 3],
        mesh.positions[v * 3 + 1],
        mesh.positions[v * 3 + 2]
      );
      dummy.updateMatrix();
      this.dotMesh.setMatrixAt(v, dummy.matrix);
    }
    this.group.add(this.dotMesh);

    // 3) 星位点金色圆环
    this.starMesh = this.buildStarRings(mesh);
    this.group.add(this.starMesh);
  }

  buildStarRings(mesh) {
    const ringGroup = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(CONFIG.STAR_RING_RADIUS, 0.006, 8, 20);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.COLOR_STAR) });
    for (const v of mesh.degree5Vertices) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const pos = new THREE.Vector3(
        mesh.positions[v * 3],
        mesh.positions[v * 3 + 1],
        mesh.positions[v * 3 + 2]
      );
      ring.position.copy(pos);
      // 圆环朝向球心法线
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      ringGroup.add(ring);
    }
    return ringGroup;
  }

  clear() {
    while (this.group.children.length) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  }

  render() {
    // 静态网格，无需每帧重绘，占位
  }
}

export default BoardView;
