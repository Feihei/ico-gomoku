// M1 网格生成：重心坐标格点法，在正二十面体每个大三角形内按频率 n 撒 n² 个格点
// 返回结构：positions / adjacency / faces / degree5Vertices
// 落子逻辑只依赖 adjacency，不依赖 positions

const PHI = (1 + Math.sqrt(5)) / 2;

function normalize3(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// 正二十面体初始 12 顶点 + 20 三角面（标准朝向）
const BASE_VERTICES = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(normalize3);

const BASE_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/**
 * 频率 n 细分：每个大三角形分为 n² 个小三角形，新顶点投影回单位球面。
 * 用重心坐标 (a,b,c)，a+b+c=n，直接按坐标撒点，比下标布局法可靠。
 */
export function generateIcosphere(n) {
  const keyToIndex = new Map();
  function addVertex(x, y, z) {
    const key = x.toPrecision(12) + ',' + y.toPrecision(12) + ',' + z.toPrecision(12);
    const existing = keyToIndex.get(key);
    if (existing !== undefined) return existing;
    const idx = keyToIndex.size;
    keyToIndex.set(key, idx);
    return idx;
  }

  function point(A, B, C, a, b) {
    const c = n - a - b;
    const u = a / n, v = b / n, w = c / n;
    // 重心组合得到的点在三角形平面内（球内），必须投影回单位球面，
    // 否则细分网格仍是平面三角面而非球面（欧氏距离判定也会失真）
    let x = u * A[0] + v * B[0] + w * C[0];
    let y = u * A[1] + v * B[1] + w * C[1];
    let z = u * A[2] + v * B[2] + w * C[2];
    const len = Math.sqrt(x * x + y * y + z * z);
    x /= len; y /= len; z /= len;
    return addVertex(x, y, z);
  }

  const outFaces = [];
  for (const [i, j, k] of BASE_FACES) {
    const A = BASE_VERTICES[i], B = BASE_VERTICES[j], C = BASE_VERTICES[k];
    // 每个大三角形切成 n² 个小三角形：
    // 正立 (a,b),(a,b+1),(a+1,b)  +  倒立 (a,b+1),(a+1,b),(a+1,b+1)
    for (let a = 0; a <= n - 1; a++) {
      for (let b = 0; b <= n - 1 - a; b++) {
        outFaces.push([point(A, B, C, a, b), point(A, B, C, a, b + 1), point(A, B, C, a + 1, b)]);
        if (a + b <= n - 2) {
          outFaces.push([point(A, B, C, a, b + 1), point(A, B, C, a + 1, b), point(A, B, C, a + 1, b + 1)]);
        }
      }
    }
  }

  // positions
  const V = keyToIndex.size;
  const positions = new Float32Array(V * 3);
  let i = 0;
  for (const key of keyToIndex.keys()) {
    const parts = key.split(',');
    positions[i * 3] = parseFloat(parts[0]);
    positions[i * 3 + 1] = parseFloat(parts[1]);
    positions[i * 3 + 2] = parseFloat(parts[2]);
    i++;
  }

  // 邻接表（升序）
  const adjacency = Array.from({ length: V }, () => new Set());
  for (const [a, b, c] of outFaces) {
    adjacency[a].add(b); adjacency[b].add(a);
    adjacency[b].add(c); adjacency[c].add(b);
    adjacency[c].add(a); adjacency[a].add(c);
  }
  const adjacencyArr = adjacency.map((s) => Array.from(s).sort((x, y) => x - y));

  // 五价点（应恰好 12 个）
  const degree5Vertices = [];
  for (let v = 0; v < V; v++) {
    if (adjacencyArr[v].length === 5) degree5Vertices.push(v);
  }

  return { positions, adjacency: adjacencyArr, faces: outFaces, degree5Vertices };
}

export default generateIcosphere;
