// 所有可调常量集中在此，禁止魔法数字散落各处

export const CONFIG = {
  // 二十面体细分频率 n，顶点数 V = 10n² + 2
  SUBDIVISION_FREQ: 5,

  // 获胜连珠数，球面棋盘建议测 5 和 6
  WIN_N: 5,

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

  // 材质复用
  LINE_THICKNESS: 0.005,
};
