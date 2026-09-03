// M3 棋子：InstancedMesh 实例化渲染 + 悬停预览 + 胜线高亮
// 纸面印刷风（非真实渲染，无光照）：
//   棋子 = 沿球面法向压扁的扁球（STONE_SQUASH=0.5），底部贴临纸面实体，
//           每个实例按所在顶点法向定向（局部 +Z 对齐外法线）。
//   黑子 = 墨色扁球；白子 = 纸色扁球。
//   描边 = 所有棋子外覆一层略大的"墨壳"（BackSide 渲染，倒置外壳法）：
//           黑/白子同外轮廓（STONE_RADIUS+STONE_OUTLINE），视觉大小一致。
// 全部材质用 MeshBasicMaterial，场景无灯光。

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BLACK } from '../game/rules.js';

const UP = new THREE.Vector3(0, 0, 1); // 扁球压扁轴（局部 +Z），将对齐球面法向

export class StoneView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.group.add(this.group);

    this.maxStones = 1024; // 留余量

    // 黑子：墨色芯 + 墨色壳（同色壳只决定外轮廓，与白子等大）
    const shellRadius = CONFIG.STONE_RADIUS + CONFIG.STONE_OUTLINE;
    this.blackShellGeo = this.makeFlatGeo(shellRadius);
    this.blackShellMat = this.makeInkMat();
    this.blackShellMat.side = THREE.BackSide;
    this.blackShell = new THREE.InstancedMesh(this.blackShellGeo, this.blackShellMat, this.maxStones);
    this.blackShell.count = 0;
    this.group.add(this.blackShell);

    this.blackCoreGeo = this.makeFlatGeo(CONFIG.STONE_RADIUS);
    this.blackCoreMat = this.makeInkMat();
    this.blackCore = new THREE.InstancedMesh(this.blackCoreGeo, this.blackCoreMat, this.maxStones);
    this.blackCore.count = 0;
    this.group.add(this.blackCore);

    // 白子：墨色壳（描边）+ 纸色芯
    this.whiteShellGeo = this.makeFlatGeo(shellRadius);
    this.whiteShellMat = this.makeInkMat();
    this.whiteShellMat.side = THREE.BackSide;
    this.whiteShell = new THREE.InstancedMesh(this.whiteShellGeo, this.whiteShellMat, this.maxStones);
    this.whiteShell.count = 0;
    this.group.add(this.whiteShell);

    this.whiteCoreGeo = this.makeFlatGeo(CONFIG.STONE_RADIUS);
    this.whiteCoreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(CONFIG.COLOR_PAPER), // 填充与背景纸色一致
    });
    this.whiteCore = new THREE.InstancedMesh(this.whiteCoreGeo, this.whiteCoreMat, this.maxStones);
    this.whiteCore.count = 0;
    this.group.add(this.whiteCore);

    // 悬停预览：黑执子 = 半透明墨扁球；白执子 = 半透明墨圈（提示落点轮廓）
    this.hoverBlackGeo = this.makeFlatGeo(CONFIG.STONE_RADIUS * 0.9);
    this.hoverBlackMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(CONFIG.COLOR_HOVER), transparent: true, opacity: 0.45,
    });
    this.hoverBlack = new THREE.Mesh(this.hoverBlackGeo, this.hoverBlackMat);
    this.hoverBlack.visible = false;
    this.group.add(this.hoverBlack);

    this.hoverWhiteGeo = new THREE.TorusGeometry(
      CONFIG.STONE_RADIUS + CONFIG.STONE_OUTLINE, CONFIG.STONE_OUTLINE, 10, 28
    );
    this.hoverWhiteMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(CONFIG.COLOR_HOVER), transparent: true, opacity: 0.55,
    });
    this.hoverWhite = new THREE.Mesh(this.hoverWhiteGeo, this.hoverWhiteMat);
    this.hoverWhite.visible = false;
    this.group.add(this.hoverWhite);

    // 胜线高亮（细墨管，压在棋子底下）
    this.winLineMesh = null;
    // 当前每颗子的顶点归属（rebuild 时记录）
    this.blackVerts = [];
    this.whiteVerts = [];

    // AI 落子提示标记：四棱锥（锥尖朝棋子、底朝外，色与 AI 棋子相反——
    // AI 执黑落墨子则显纸白锥，AI 执白落纸子则显墨黑锥，避免与棋子同色叠没）
    this.aiMarkGeo = new THREE.ConeGeometry(CONFIG.AI_MARK_RADIUS, CONFIG.AI_MARK_HEIGHT, 4);
    this.aiMarkInkMat = this.makeInkMat();
    this.aiMarkPaperMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(CONFIG.COLOR_PAPER),
    });
    this.aiMark = new THREE.Mesh(this.aiMarkGeo, this.aiMarkInkMat);
    this.aiMark.visible = false;
    this.group.add(this.aiMark);
  }

  // 扁球几何：球体沿 +Z 压扁 STONE_SQUASH（高度为半径方向的一半）
  makeFlatGeo(radius) {
    const geo = new THREE.SphereGeometry(radius, 24, 16);
    geo.scale(1, 1, CONFIG.STONE_SQUASH);
    return geo;
  }

  makeInkMat() {
    return new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.COLOR_INK) });
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

  // 写入各 InstancedMesh：扁球需按顶点法向逐实例定向（尊重胜利压暗：非胜线子缩小）
  applyMatrices() {
    const dummy = new THREE.Object3D();
    const quat = new THREE.Quaternion();
    const normal = new THREE.Vector3();
    const put = (mesh, verts) => {
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        normal.set(
          this.mesh.positions[v * 3],
          this.mesh.positions[v * 3 + 1],
          this.mesh.positions[v * 3 + 2]
        ).normalize();
        // 中心浮于纸面实体之上，底部贴临球面
        dummy.position.copy(normal).multiplyScalar(1 + CONFIG.STONE_Z_OFFSET);
        // 压扁轴 +Z 对齐球面法向
        quat.setFromUnitVectors(UP, normal);
        dummy.quaternion.copy(quat);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = verts.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
    };
    put(this.blackShell, this.blackVerts);
    put(this.blackCore, this.blackVerts);
    put(this.whiteShell, this.whiteVerts);
    put(this.whiteCore, this.whiteVerts);
  }

  // 悬停预览：按执子方显示对应形状，浮在目标顶点上
  setHover(vertexIndex, player, visible) {
    const show = visible && vertexIndex !== null && vertexIndex !== undefined;
    this.hoverBlack.visible = false;
    this.hoverWhite.visible = false;
    if (!show) return;

    const p = this.meshPos(vertexIndex);
    const normal = p.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, normal);
    if (player === BLACK) {
      this.hoverBlack.position.copy(p);
      this.hoverBlack.quaternion.copy(quat);
      this.hoverBlack.visible = true;
    } else {
      this.hoverWhite.position.copy(p);
      this.hoverWhite.quaternion.copy(quat);
      this.hoverWhite.visible = true;
    }
  }

  setMesh(mesh) {
    this.mesh = mesh;
  }

  // 棋子中心位置（底面贴临纸面实体）
  meshPos(v) {
    const p = new THREE.Vector3(
      this.mesh.positions[v * 3],
      this.mesh.positions[v * 3 + 1],
      this.mesh.positions[v * 3 + 2]
    );
    return p.normalize().multiplyScalar(1 + CONFIG.STONE_Z_OFFSET);
  }

  // 胜线所在半径：贴近纸面（略高于网格线层 1.0），压在棋子底下——线穿过棋子的下半部，
  // 视觉上"从棋子之间钻过"，不再悬在棋子顶面上方
  winLinePos(v) {
    const p = new THREE.Vector3(
      this.mesh.positions[v * 3],
      this.mesh.positions[v * 3 + 1],
      this.mesh.positions[v * 3 + 2]
    );
    return p.normalize().multiplyScalar(1.0 + 0.002);
  }

  // AI 落子提示：在 vertexIndex 棋子上方显示四棱锥（锥尖朝棋子、底朝外，
  // 色与 AI 棋子相反：aiPlayer=黑 → 纸白锥，aiPlayer=白 → 墨黑锥）
  showAiMark(vertexIndex, aiPlayer) {
    if (vertexIndex === null || vertexIndex === undefined) return;
    const p = this.meshPos(vertexIndex);
    const normal = p.clone().normalize();
    // ConeGeometry 尖端默认沿 +Y：倒置 —— 让 +Y（尖端）指向球心（-normal），
    // 平底朝外贴棋子外侧，形成"伏在棋子上"的矮锥；中心沿法向抬半高，
    // 使平底刚浮于棋子顶面之上（尖部没入棋子上半，渲染被遮挡无碍）
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), normal.clone().negate()
    );
    this.aiMark.position.copy(p).addScaledVector(normal, CONFIG.AI_MARK_HEIGHT * 0.5);
    this.aiMark.quaternion.copy(quat);
    this.aiMark.material = aiPlayer === BLACK ? this.aiMarkPaperMat : this.aiMarkInkMat;
    this.aiMark.visible = true;
  }

  hideAiMark() {
    this.aiMark.visible = false;
  }

  // 标记胜线（细墨管，压在棋子底下，与印刷风一致）
  highlightWin(line) {
    this.clearWin();
    if (!line || line.length < 2) return;

    const points = line.map((v) => this.winLinePos(v));
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(8, line.length * 8), 0.008, 10, false);
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
}

export default StoneView;
