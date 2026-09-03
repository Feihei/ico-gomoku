// M1 网格校验：V/E/F 公式、12 个五价点、邻接对称性
// 网格初始化后必须全量校验，不通过直接抛错

export function validateMesh(mesh, n) {
  const { positions, adjacency, faces, degree5Vertices } = mesh;
  const errors = [];

  const V = positions.length / 3;
  let edgeCount = 0;
  for (const v of adjacency) edgeCount += v.length;

  // 1) V 公式：V = 10n² + 2（n 为实际细分频率，不能取全局默认值）
  const expectedV = 10 * n * n + 2;
  if (V !== expectedV) {
    errors.push(`顶点数 ${V} ≠ 公式值 ${expectedV} (n=${n})`);
  }

  // 2) E 公式：E = 30n²，邻接度和 = 2E
  const expectedE = 30 * n * n;
  if (edgeCount !== 2 * expectedE) {
    errors.push(`邻接度和 ${edgeCount} ≠ 2E=${2 * expectedE}`);
  }

  // 3) F 公式：F = 20n²，每个面 3 条边
  const expectedF = 20 * n * n;
  if (faces.length !== expectedF) {
    errors.push(`面数 ${faces.length} ≠ 公式值 ${expectedF}`);
  }

  // 4) 五价点恰好 12 个
  if (degree5Vertices.length !== 12) {
    errors.push(`五价点数 ${degree5Vertices.length} ≠ 12`);
  }

  // 5) 度数分布：12 个五价点，其余六价
  for (let v = 0; v < V; v++) {
    const d = adjacency[v].length;
    if (d !== 5 && d !== 6) {
      errors.push(`顶点 ${v} 度数 ${d} 既非 5 也非 6`);
    }
  }

  // 6) 邻接对称性：i 在 j 的邻接 ⟺ j 在 i 的邻接
  for (let i = 0; i < V; i++) {
    for (const j of adjacency[i]) {
      if (!adjacency[j].includes(i)) {
        errors.push(`邻接不对称：${i}→${j} 但 ${j}↛${i}`);
        break;
      }
    }
  }

  // 7) 面顶点不重复
  for (const [a, b, c] of faces) {
    if (a === b || b === c || a === c) {
      errors.push(`面 ${[a, b, c]} 有重复顶点`);
      break;
    }
  }

  // 8) 面绕序统一朝外（FrontSide 实体渲染依赖，倒立三角形会反过来）
  for (const [a, b, c] of faces) {
    const abx = positions[b * 3] - positions[a * 3];
    const aby = positions[b * 3 + 1] - positions[a * 3 + 1];
    const abz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const acx = positions[c * 3] - positions[a * 3];
    const acy = positions[c * 3 + 1] - positions[a * 3 + 1];
    const acz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const dot = nx * (positions[a * 3] + positions[b * 3] + positions[c * 3])
      + ny * (positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1])
      + nz * (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]);
    if (dot <= 0) {
      errors.push(`面 ${[a, b, c]} 绕序朝内`);
      break;
    }
  }

  if (errors.length > 0) {
    throw new Error(`网格校验失败：\n  - ${errors.join('\n  - ')}`);
  }

  return { V, E: expectedE, F: expectedF, degree5Count: degree5Vertices.length };
}

export default validateMesh;
