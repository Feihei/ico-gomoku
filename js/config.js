// 所有可调常量集中在此，禁止魔法数字散落各处

export const CONFIG = {
  // 二十面体细分频率 n，顶点数 V = 10n² + 2
  SUBDIVISION_FREQ: 5,

  // 获胜连珠数，球面棋盘建议测 5 和 6
  WIN_N: 5,

  // 连珠"近直线"延续夹角阈值（弧度）。
  // 实测（细分 n=2..6，顶点已在单位球面上）：
  //   六价点：直行轴夹角 ≥144°（n=2）~164°，拐弯最大 ≤132.8°（n=6）
  //   五价点：穿行（跨过星位点）最小 132.4°（n=2）~142.9°，相邻拐弯仅 ~72°
  // 故六价与五价必须分别设限，单阈值会两头不讨好
  ANGLE_STRAIGHT_DEG6: 2.35, // ≈134.7°，介于六价直行(144°+)与拐弯(≤133°)之间
  ANGLE_STRAIGHT_DEG5: 2.0,  // ≈114.6°，介于五价穿行(132°+)与相邻拐弯(72°)之间

  // 颜色
  COLOR_BLACK: '#1a1a1a',      // 黑子
  COLOR_WHITE: '#f0e8d0',      // 象牙白
  COLOR_LINE: '#3a4a6a',       // 网格线
  COLOR_STAR: '#ffd700',       // 星位点金色
  COLOR_HOVER: '#88aaff',      // 悬停预览
  COLOR_WIN: '#ff4444',        // 胜线高亮
  COLOR_BG_TOP: '#0a0e1a',     // 背景渐变上
  COLOR_BG_BOTTOM: '#1a2040',  // 背景渐变下

  // 相机参数
  CAMERA_FOV: 45,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 100,
  CAMERA_POSITION: [0, 0, 6],  // 球心在原点，相机沿 +Z

  // 几何体尺寸
  VERTEX_MARKER_RADIUS: 0.02,  // 普通顶点小点
  STAR_RING_RADIUS: 0.06,      // 星位点圆环半径（明显更大）
  STONE_RADIUS: 0.05,          // 棋子半径
  STONE_Z_OFFSET: 0.03,        // 棋子略微浮出球面
};
