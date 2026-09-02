"""诊断 rules.js 连珠判定 bug"""
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

V, pos, adj, deg5 = gen_icosphere(5)
print(f"V={V}, deg5={len(deg5)}")
print(f"deg5 vertices: {deg5}")

# Check axis angles for a 6-vertex
print("\n=== 6-vertex axis angles ===")
for v in range(min(20,V)):
    if len(adj[v]) == 6:
        print(f"\nVertex {v} (6-valent):")
        neighbors = adj[v]
        pairs = []
        for i in range(6):
            for j in range(i+1,6):
                ang = angle(pos, v, neighbors[i], neighbors[j])
                pairs.append((neighbors[i], neighbors[j], math.degrees(ang)))
        pairs.sort(key=lambda x: -x[2])
        print("All pairs (sorted by angle):")
        for a,b,ang in pairs[:9]:
            print(f"  ({a},{b}) = {ang:.1f}°")
        # Show top 3 independent axes
        used = set()
        axes = []
        for a,b,ang in pairs:
            if len(axes) == 3: break
            if a not in used and b not in used:
                axes.append((a,b,ang))
                used.update([a,b])
        print(f"Top 3 independent axes: {[(a,b,f'{ang:.1f}') for a,b,ang in axes]}")
        break

# Check vertex 0's neighbors
print(f"\n=== Vertex 0 ===")
print(f"Neighbors: {adj[0]}")
print(f"Degree: {len(adj[0])}")
for i in range(len(adj[0])):
    for j in range(i+1,len(adj[0])):
        a,b = adj[0][i], adj[0][j]
        print(f"  ({a},{b}) = {math.degrees(angle(pos,0,a,b)):.1f}°")

# Test: construct a 5-in-a-row along an axis
print("\n=== Construct 5-in-a-row along axis ===")
# Find a 6-vertex with a good axis
for v in range(V):
    if len(adj[v]) == 6:
        neighbors = adj[v]
        pairs = []
        for i in range(6):
            for j in range(i+1,6):
                pairs.append((neighbors[i], neighbors[j], angle(pos,v,neighbors[i],neighbors[j])))
        pairs.sort(key=lambda x: -x[2])
        used = set()
        axes = []
        for a,b,ang in pairs:
            if len(axes)==3: break
            if a not in used and b not in used:
                axes.append((a,b,ang))
                used.update([a,b])
        print(f"Vertex {v}: top axis ({axes[0][0]},{axes[0][1]}) = {math.degrees(axes[0][2]):.1f}°")
        # Walk from a away from v, straightest direction
        path_a = []
        cur,prev = axes[0][0],v
        for _ in range(10):
            best,best_ang = None,-1
            for d in adj[cur]:
                if d==prev: continue
                ang = angle(pos,cur,prev,d)
                if ang>best_ang: best_ang,best = ang,d
            if best is None: break
            path_a.append(best)
            prev,cur = cur,best
        print(f"  From a={axes[0][0]} away from v: {path_a[:5]}")
        
        # Walk from b away from v
        path_b = []
        cur,prev = axes[0][1],v
        for _ in range(10):
            best,best_ang = None,-1
            for d in adj[cur]:
                if d==prev: continue
                ang = angle(pos,cur,prev,d)
                if ang>best_ang: best_ang,best = ang,d
            if best is None: break
            path_b.append(best)
            prev,cur = cur,best
        print(f"  From b={axes[0][1]} away from v: {path_b[:5]}")
        
        line = path_a + [v] + path_b
        print(f"  Full line: {line} (len={len(line)})")
        break

# Test: place 0,1,2,3,4 and check if it's a win
print("\n=== Testing place 0,1,2,3,4 ===")
board_occ = [None]*V
for i in range(5):
    board_occ[i] = 1
    print(f"After placing {i}: checking if any win...")
    for v in range(i+1):
        if board_occ[v] != 1: continue
        # Check win at v
        if len(adj[v]) == 6:
            neighbors = adj[v]
            pairs = []
            for ii in range(6):
                for jj in range(ii+1,6):
                    pairs.append((neighbors[ii], neighbors[jj], angle(pos,v,neighbors[ii],neighbors[jj])))
            pairs.sort(key=lambda x: -x[2])
            used = set()
            axes = []
            for a,b,ang in pairs:
                if len(axes)==3: break
                if a not in used and b not in used:
                    axes.append((a,b))
                    used.update([a,b])
            for a,b in axes:
                fwd = [a]
                cur,prev = a,v
                for _ in range(10):
                    best,best_ang = None,-1
                    for d in adj[cur]:
                        if d==prev: continue
                        if board_occ[d]!=1: continue
                        ang = angle(pos,cur,prev,d)
                        if ang>best_ang: best_ang,best = ang,d
                    if best is None: break
                    fwd.append(best)
                    prev,cur = cur,best
                bwd = [b]
                cur,prev = b,v
                for _ in range(10):
                    best,best_ang = None,-1
                    for d in adj[cur]:
                        if d==prev: continue
                        if board_occ[d]!=1: continue
                        ang = angle(pos,cur,prev,d)
                        if ang>best_ang: best_ang,best = ang,d
                    if best is None: break
                    bwd.append(best)
                    prev,cur = cur,best
                line = fwd + [v] + bwd
                if len(line)>=5:
                    print(f"  WIN at v={v} via axis ({a},{b}): line={line}")
