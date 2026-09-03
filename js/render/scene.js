// M2 场景：Three.js 场景、相机、OrbitControls
// 纸面印刷风（非真实渲染）：全部物体用不受光的 MeshBasicMaterial/LineBasicMaterial，
// 场景不设灯光；背景为平涂纸色 + 噪波纹理模拟纸面。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from '../config.js';

/**
 * 生成"纸面"画布纹理：平涂 baseColor + 随机颗粒噪波（模拟纸纤维质感）。
 * repeat>1 时纹理以瓦片方式平铺，颗粒更细密。
 */
export function makePaperTexture(baseColor, repeat = 1) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // 细颗粒噪波：在底色上叠加随机亮度扰动
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const amp = CONFIG.PAPER_NOISE_STRENGTH * 255;
  for (let i = 0; i < data.length; i += 4) {
    const delta = (Math.random() - 0.5) * 2 * amp;
    data[i] = Math.max(0, Math.min(255, data[i] + delta));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + delta));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + delta));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  return tex;
}

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

    // 纸面背景（平涂纸色 + 噪波），底色与棋盘纸面一致
    this.setBackground();
  }

  // 渲染一帧
  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // 页面背景：平涂纸色 + 噪波（底色与棋盘一致；背面遮挡由棋盘自身三角面承担）
  setBackground() {
    this.scene.background = makePaperTexture(CONFIG.COLOR_PAPER);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

export default Scene;
