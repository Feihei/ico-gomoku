import { generateIcosphere } from '../js/mesh/icosphere.js';
import { validateMesh } from '../js/mesh/validate.js';

const n = 5;
const mesh = generateIcosphere(n);
const V = mesh.positions.length / 3;
const result = validateMesh(mesh);

console.log('n =', n);
console.log('V =', V, '(期望', 10 * n * n + 2, ')');
console.log('E =', result.E);
console.log('F =', result.F);
console.log('五价点数 =', result.degree5Count);
console.log('校验结果 =', JSON.stringify(result));

// 抽查几个顶点的度数
let deg5 = 0, deg6 = 0, other = 0;
for (let v = 0; v < V; v++) {
  const d = mesh.adjacency[v].length;
  if (d === 5) deg5++;
  else if (d === 6) deg6++;
  else other++;
}
console.log('度数分布: 5价=' + deg5 + ', 6价=' + deg6 + ', 其他=' + other);

// 抽查一个 6 价点的邻居
const sample = mesh.adjacency[0];
console.log('顶点0 度数=' + sample.length + ' 邻居=' + JSON.stringify(sample));
