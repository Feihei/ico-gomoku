// M2 场景：Three.js 场景、相机、OrbitControls
// 纸面印刷风（非真实渲染）：全部物体用不受光的 MeshBasicMaterial/LineBasicMaterial，
// 场景不设灯光；所有物体（纸面实体/背景/白子）均为纯平涂纸色，
// 纸纹噪波由 DOM 最上层覆盖层统一叠加（见 main.js），保证全视口颗粒一致。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from '../config.js';

export class Scene {
  constructor(container) {
    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(new THREE.Color(CONFIG.COLOR_PAPER), 1);
    container.appendChild(this.renderer.domElement);

    // 场景
    this.scene = new THREE.Scene();

    // 相机
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA_FOV,
      container.clientWidth / container.clientHeight,
      CONFIG.CAMERA_NEAR,
      CONFIG.CAMERA_FAR
    );
    this.camera.position.set(...CONFIG.CAMERA_POSITION);

    // 控件
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.6;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 12;

    // 自适应
    this.onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.onResize);

    // 主对象容器（棋盘），便于整体旋转
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  // 渲染一帧
  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

export default Scene;
