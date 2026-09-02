"""验证 rules.js 连珠判定：place 0-4 是否还误判"""
import math

PHI = (1 + 5**0.5) / 2

def normalize(v):
    l = (v[0]**2 + v[1]**2 + v[2]**2)**0.5
    return (v[0]/l, v[1]/l, v[2]/l)

BASE_V = [normalize((-1, PHI, 0)), normalize((1, PHI, 0)),
          normalize((-1, -PHI, 0)), normalize((1, -PHI, 0)),
          normalize((0, -1, PHI)), normalize((0, 1, PHI)),
          normalize((0, -1, -PHI)), normalize((0, 1, -PHI)),
          normalize((PHI, 0, -1)), normalize((PHI, 0, 1)),
          normalize((-PHI, 0, -1)), normalize((-PHI, 0, 1))]

BASE_F = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
          [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
          [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
          [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]]

def gen_icosphere(n):
    key_to_idx = {}
    def add_v(x,y,z):
        k = (f"{x:.12g}", f"{y:.12g}", f"{z:.12g}")
        if k in key_to_idx: return key_to_idx[k]
        idx = len(key_to_idx)
        key_to_idx[k] = idx
        return idx
    def pt(A,B,C,a,b):
        c = n-a-b
        x = a/n*A[0]+b/n*B[0]+c/n*C[0]
        y = a/n*A[1]+b/n*B[1]+c/n*C[1]
        z = a/n*A[2]+b/n*B[2]+c/n*C[2]
        return add_v(x,y,z)
    out_f = []
    for i,j,k in BASE_F:
        A,B,C = BASE_V[i],BASE_V[j],BASE_V[k]
        for a in range(n):
            for b in range(n-a):
                out_f.append((pt(A,B,C,a,b), pt(A,B,C,a,b+1), pt(A,B,C,a+1,b)))
                if a+b <= n-2:
                    out_f.append((pt(A,B,C,a,b+1), pt(A,B,C,a+1,b), pt(A,B,C,a+1,b+1)))
    V = len(key_to_idx)
    pos = [None]*V
    for k in key_to_idx:
        ix,iy,iz = float(k[0]),float(k[1]),float(k[2])
        pos[key_to_idx[k]] = (ix,iy,iz)
    adj = [set() for _ in range(V)]
    for a,b,c in out_f:
        adj[a].add(b); adj[b].add(a)
        adj[b].add(c); adj[c].add(b)
        adj[c].add(a); adj[a].add(c)
    adj = [sorted(s) for s in adj]
    deg5 = [v for v in range(V) if len(adj[v])==5]
    return V, pos, adj, deg5

def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]

def angle(pos, v, a, b):
    va = (pos[a][0]-pos[v][0], pos[a][1]-pos[v][1], pos[a][2]-pos[v][2])
    vb = (pos[b][0]-pos[v][0], pos[b][1]-pos[v][1], pos[b][2]-pos[v][2])
    la,lb = (dot(x,x)**0.5 or 1 for x in (va,vb))
    va = tuple(x/la for x in va)
    vb = tuple(x/lb for x in vb)
    return math.acos(max(-1,min(1,dot(va,vb))))

def get_axes(adj, v, pos):
    n = adj[v]
    deg = len(n)
    pairs = []
    for i in range(deg):
        for j in range(i+1, deg):
            pairs.append((n[i], n[j], angle(pos, v, n[i], n[j])))
    pairs.sort(key=lambda x: -x[2])
    
    if deg == 6:
        used = set()
        axes = []
        for a,b,ang in pairs:
            if len(axes) == 3: break
            if a not in used and b not in used:
                axes.append((a,b))
                used.update([a,b])
        return axes
    elif deg == 5:
        return [(a,b) for a,b,ang in pairs[:5]]
    return []

def extend(board_occ, adj, pos, start, came_from, player):
    line = []
    visited = set()
    cur = start
    prev = came_from
    while board_occ[cur] == player and cur not in visited:
        visited.add(cur)
        line.append(cur)
        best, best_ang = None, -1
        for d in adj[cur]:
            if d == prev or d in visited: continue
            if board_occ[d] != player: continue
            ang = angle(pos, cur, prev, d)
            if ang > best_ang: best_ang, best = ang, d
        if best is None: break
        prev, cur = cur, best
    return line

def check_win(board_occ, adj, pos, v, player):
    axes = get_axes(adj, v, pos)
    for a, b in axes:
        fwd = extend(board_occ, adj, pos, a, v, player)
        bwd = extend(board_occ, adj, pos, b, v, player)
        line = fwd + [v] + bwd
        if len(line) >= 5:
            return True, line
    return False, None

V, pos, adj, deg5 = gen_icosphere(5)
print(f"V={V}, deg5={len(deg5)}")

# Test 1: place 0,1,2,3,4 - should NOT be a win
print("\n=== Test 1: place 0,1,2,3,4 ===")
board_occ = [None]*V
for i in range(5):
    board_occ[i] = 1
    for v in range(i+1):
        if board_occ[v] != 1: continue
        win, line = check_win(board_occ, adj, pos, v, 1)
        if win:
            print(f"  WIN at v={v}: line={line}")
            print(f"  ERROR: place 0-4 should NOT be a win!")

# Test 2: construct 5-in-a-row along axis - SHOULD be a win
print("\n=== Test 2: construct 5-in-a-row ===")
board_occ2 = [None]*V
# Find a 6-vertex
for v in range(V):
    if len(adj[v]) == 6:
        axes = get_axes(adj, v, pos)
        if axes:
            a, b = axes[0]
            # Walk from a away from v
            path_a = [a]
            cur, prev = a, v
            for _ in range(3):
                best, best_ang = None, -1
                for d in adj[cur]:
                    if d == prev: continue
                    ang = angle(pos, cur, prev, d)
                    if ang > best_ang: best_ang, best = ang, d
                if best is None: break
                path_a.append(best)
                prev, cur = cur, best
            
            # Walk from b away from v
            path_b = [b]
            cur, prev = b, v
            for _ in range(3):
                best, best_ang = None, -1
                for d in adj[cur]:
                    if d == prev: continue
                    ang = angle(pos, cur, prev, d)
                    if ang > best_ang: best_ang, best = ang, d
                if best is None: break
                path_b.append(best)
                prev, cur = cur, best
            
            line = path_a + [v] + path_b
            print(f"  Line: {line} (len={len(line)})")
            for p in line:
                board_occ2[p] = 1
            # Check win
            for p in line:
                win, win_line = check_win(board_occ2, adj, pos, p, 1)
                if win:
                    print(f"  WIN at v={p}: {win_line}")
                    break
            break

# Test 3: place 0,1,2,3,4 where 0 is a 5-vertex
print("\n=== Test 3: place 0,1,2,3,4 with 0 as 5-vertex ===")
board_occ3 = [None]*V
for i in range(5):
    board_occ3[i] = 1
for v in range(5):
    win, line = check_win(board_occ3, adj, pos, v, 1)
    if win:
        print(f"  WIN at v={v}: {line}")
        print(f"  Neighbors of 0: {adj[0]}")
        axes0 = get_axes(adj, 0, pos)
        print(f"  Axes of 0: {axes0}")
        break
else:
    print(f"  No win (correct, since 0-1-2-3-4 are not connected in a line)")
