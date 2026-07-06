import sys
import json
import math
import io
import base64

# Try to import scientific libraries safely so we have a double-engine fallback
try:
    import numpy as np
    import networkx as nx
    import pandas as pd
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.cm as cm
    from matplotlib.patches import FancyArrowPatch
    from scipy.spatial import ConvexHull
    DEPENDENCIES_OK = True
except Exception as e:
    DEPENDENCIES_OK = False
    DEP_ERROR = str(e)


def edge_betweenness_centrality_pure(nodes, edges):
    """
    Pure Python implementation of Brandes' algorithm for directed graph edge betweenness centrality.
    Provides identical results to NetworkX edge_betweenness_centrality(G, normalized=True).
    """
    eb = { (u, v): 0.0 for u, v in edges }
    adj = { u: [] for u in nodes }
    for u, v in edges:
        if u in adj:
            adj[u].append(v)
            
    for s in nodes:
        S = []
        P = { w: [] for w in nodes }
        sigma = { w: 0.0 for w in nodes }
        sigma[s] = 1.0
        d = { w: -1 for w in nodes }
        d[s] = 0
        
        from collections import deque
        Q = deque([s])
        while Q:
            v = Q.popleft()
            S.append(v)
            for w in adj[v]:
                if d[w] < 0:
                    d[w] = d[v] + 1
                    Q.append(w)
                if d[w] == d[v] + 1:
                    sigma[w] += sigma[v]
                    P[w].append(v)
                    
        delta = { w: 0.0 for w in nodes }
        while S:
            w = S.pop()
            for v in P[w]:
                c = (sigma[v] / sigma[w]) * (1.0 + delta[w])
                if (v, w) in eb:
                    eb[(v, w)] += c
                delta[v] += c
                
    n = len(nodes)
    if n > 1:
        scale = 1.0 / (n * (n - 1))
        for k in eb:
            eb[k] *= scale
            
    return eb


def get_node_color(stability):
    """Interpolates RdYlGn colormap in pure Python."""
    # RdYlGn approximate colors:
    # 0.0 -> Red (215, 48, 39)
    # 0.5 -> Yellow (254, 224, 139)
    # 1.0 -> Green (26, 152, 80)
    if stability < 0.5:
        f = stability / 0.5
        r = int(215 + (254 - 215) * f)
        g = int(48 + (224 - 48) * f)
        b = int(39 + (139 - 39) * f)
    else:
        f = (stability - 0.5) / 0.5
        r = int(254 + (26 - 254) * f)
        g = int(224 + (152 - 224) * f)
        b = int(139 + (80 - 139) * f)
    return f"rgb({r},{g},{b})"


def generate_svg_plot(nodes_data, edges_data, dimensions_data, history, t, pos, centers, dimensions_list, nodes_dim):
    """Renders the network as a high-quality SVG and returns a base64 encoded URI."""
    dim_colors = {
        "1": "#4169E1", # Critical Infrastructure -> Royal Blue
        "2": "#2E8B57", # Economics -> Sea Green
        "3": "#228B22", # Environment -> Forest Green
        "4": "#FF69B4", # Health & Well-being -> Hot Pink
        "5": "#8A2BE2", # Institutional -> Blue Violet
        "6": "#FF8C00", # Leadership & Strategy -> Dark Orange
        "7": "#D2691E"  # Social & Demographic -> Chocolate
    }
    
    scale = 14.0
    svg_elements = []
    
    # SVG header
    svg_elements.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -200 420 440" width="100%" height="100%">')
    
    # Definitions for markers and gradients
    svg_elements.append('''  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
    </marker>
    <marker id="arrow-same" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
    </marker>
    <linearGradient id="colorbar-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgb(215,48,39)" />
      <stop offset="50%" stop-color="rgb(254,224,139)" />
      <stop offset="100%" stop-color="rgb(26,152,80)" />
    </linearGradient>
  </defs>''')
    
    # Transparent background
    svg_elements.append('  <rect x="-210" y="-200" width="420" height="440" fill="none" />')
    
    # Draw dimension clusters backgrounds
    for dim_id in dimensions_list:
        dim_nodes = [n.get("abbr") for n in nodes_data if str(n.get("dimension_id")) == dim_id]
        if not dim_nodes:
            continue
            
        color = dim_colors.get(dim_id, "#777777")
        cx, cy = centers[dim_id]
        
        scx, scy = cx * scale, cy * scale
        sradius = 3.6 * scale
        svg_elements.append(f'  <circle cx="{scx:.2f}" cy="{scy:.2f}" r="{sradius:.2f}" fill="{color}" opacity="0.07" stroke="{color}" stroke-dasharray="2 2" stroke-width="0.7" />')
        
        import html
        dim_obj = next((d for d in dimensions_data if str(d.get("id")) == dim_id), None)
        dim_name = dim_obj.get("name") if dim_obj else f"Dim {dim_id}"
        dim_name = html.escape(dim_name)
        
        # Label offset outside radially
        norm = math.sqrt(cx*cx + cy*cy)
        if norm > 0:
            label_x = cx + 3.8 * (cx / norm)
            label_y = cy + 3.8 * (cy / norm)
        else:
            label_x, label_y = cx, cy + 3.8
            
        slx, sly = label_x * scale, label_y * scale
        
        words = dim_name.split()
        if len(words) > 2:
            mid = len(words) // 2
            line1 = " ".join(words[:mid])
            line2 = " ".join(words[mid:])
            svg_elements.append(f'''  <g>
    <rect x="{slx - 45:.1f}" y="{sly - 12:.1f}" width="90" height="24" rx="4" fill="white" opacity="0.9" filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.05))" />
    <text x="{slx:.1f}" y="{sly - 2:.1f}" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">{line1}</text>
    <text x="{slx:.1f}" y="{sly + 7:.1f}" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">{line2}</text>
  </g>''')
        else:
            svg_elements.append(f'''  <g>
    <rect x="{slx - 45:.1f}" y="{sly - 7:.1f}" width="90" height="14" rx="4" fill="white" opacity="0.9" filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.05))" />
    <text x="{slx:.1f}" y="{sly + 3:.1f}" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">{dim_name}</text>
  </g>''')
  
    # Draw directed edges (bezier curves)
    for edge in edges_data:
        u = edge.get("source")
        v = edge.get("target")
        if u not in pos or v not in pos:
            continue
            
        ux, uy = pos[u]
        vx, vy = pos[v]
        
        s_ux, s_uy = ux * scale, uy * scale
        s_vx, s_vy = vx * scale, vy * scale
        
        dx = s_vx - s_ux
        dy = s_vy - s_uy
        d = math.sqrt(dx*dx + dy*dy)
        if d > 0.001:
            shrink_start = 7.5
            shrink_end = 9.0
            s_ux_shrunk = s_ux + (dx / d) * shrink_start
            s_uy_shrunk = s_uy + (dy / d) * shrink_start
            s_vx_shrunk = s_vx - (dx / d) * shrink_end
            s_vy_shrunk = s_vy - (dy / d) * shrink_end
        else:
            s_ux_shrunk, s_uy_shrunk, s_vx_shrunk, s_vy_shrunk = s_ux, s_uy, s_vx, s_vy
            
        same_dim = nodes_dim.get(u) == nodes_dim.get(v)
        stroke_color = '#94a3b8' if same_dim else '#64748b'
        opacity = 0.5 if same_dim else 0.22
        stroke_width = 1.0 if same_dim else 0.8
        marker = 'url(#arrow-same)' if same_dim else 'url(#arrow)'
        
        mx = (s_ux_shrunk + s_vx_shrunk) / 2
        my = (s_uy_shrunk + s_vy_shrunk) / 2
        if d > 0.001:
            px = -dy / d
            py = dx / d
        else:
            px, py = 0, 0
            
        shift = 10.0 if same_dim else 16.0
        ctrl_x = mx + px * shift
        ctrl_y = my + py * shift
        
        svg_elements.append(f'  <path d="M {s_ux_shrunk:.2f} {s_uy_shrunk:.2f} Q {ctrl_x:.2f} {ctrl_y:.2f} {s_vx_shrunk:.2f} {s_vy_shrunk:.2f}" fill="none" stroke="{stroke_color}" stroke-width="{stroke_width:.1f}" opacity="{opacity:.2f}" marker-end="{marker}" />')

    # Draw nodes
    import html
    for node in nodes_data:
        abbr = node.get("abbr")
        safe_abbr = html.escape(str(abbr))
        if abbr not in pos:
            continue
        x, y = pos[abbr]
        sx, sy = x * scale, y * scale
        
        stability = history[abbr][t]
        node_color = get_node_color(stability)
        
        radius = 0.52 * scale
        # Glowing shadow or outer ring (gray circle edge)
        svg_elements.append(f'  <circle cx="{sx:.2f}" cy="{sy:.2f}" r="{radius:.2f}" fill="{node_color}" stroke="none" />')
        
        font_size = 7 if len(abbr) <= 2 else 6
        svg_elements.append(f'  <text x="{sx:.2f}" y="{sy + 2.5:.2f}" font-size="{font_size}" font-family="sans-serif" font-weight="900" fill="#0f172a" text-anchor="middle">{safe_abbr}</text>')

    # Colorbar at the bottom
    svg_elements.append('''  <g>
    <rect x="-70" y="200" width="140" height="7" fill="url(#colorbar-grad)" rx="1.5" />
    <text x="-70" y="217" font-size="7.5" font-family="sans-serif" fill="#64748b" text-anchor="middle">0.0 (Worst)</text>
    <text x="0" y="217" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">Indicator Stability (Sv)</text>
    <text x="70" y="217" font-size="7.5" font-family="sans-serif" fill="#64748b" text-anchor="middle">1.0 (Best)</text>
  </g>''')
  
    svg_elements.append('</svg>')
    
    svg_str = "\n".join(svg_elements)
    encoded = base64.b64encode(svg_str.encode('utf-8')).decode('utf-8')
    return f"data:image/svg+xml;base64,{encoded}"


def run_fallback_simulation(nodes_data, edges_data, dimensions_data, params):
    """Zero-dependency simulation implementation matching NetworkX logic."""
    shocks_raw = params.get("shocks", {})
    T = int(params.get("T", 8))
    gamma = float(params.get("gamma", 1.5))
    epsilon = float(params.get("epsilon", 0.001))
    default_theta = float(params.get("default_theta", 0.2))
    default_recovery_rate = float(params.get("default_recovery_rate", 0.01))
    interventions_raw = params.get("interventions", [])

    nodes_list = [node.get("abbr") for node in nodes_data]
    edges_list = [(edge.get("source"), edge.get("target")) for edge in edges_data if edge.get("source") in nodes_list and edge.get("target") in nodes_list]

    thresholds = {}
    recovery_rates = {}
    nodes_dim = {}
    for node in nodes_data:
        abbr = node.get("abbr")
        thresholds[abbr] = float(node.get("theta") if node.get("theta") is not None else default_theta)
        recovery_rates[abbr] = float(node.get("recovery_rate") if node.get("recovery_rate") is not None else default_recovery_rate)
        nodes_dim[abbr] = str(node.get("dimension_id"))

    shocks = {}
    for abbr, delta in shocks_raw.items():
        if abbr in nodes_list:
            shocks[abbr] = float(delta)

    interventions = {}
    for item in interventions_raw:
        node_abbr = item.get("node")
        wave = int(item.get("wave"))
        strength = float(item.get("strength", 0.0))
        if node_abbr in nodes_list:
            interventions[(node_abbr, wave)] = strength

    # Adjacency list for predecessors
    predecessors = { v: [] for v in nodes_list }
    for u, v in edges_list:
        predecessors[v].append(u)

    # Initial states S
    S = {v: 1.0 for v in nodes_list}
    for v, delta in shocks.items():
        S[v] = max(0.0, S[v] - delta)

    # Initial history state
    history = {v: [S[v]] for v in nodes_list}
    cascade_depth = 0

    for t in range(T):
        # 1. Edge betweenness
        if len(edges_list) > 0:
            edge_betweenness = edge_betweenness_centrality_pure(nodes_list, edges_list)
            b_values = list(edge_betweenness.values())
            b_min, b_max = min(b_values), max(b_values)
        else:
            edge_betweenness = {}
            b_min, b_max = 0.0, 0.0

        # 2. Compute weights
        weights = {}
        for (u, v), b in edge_betweenness.items():
            denom = (b_max - b_min) if (b_max - b_min) > 0 else 1.0
            weights[(u, v)] = ((b - b_min) / denom) ** gamma

        # 3. Compute incoming degradation
        new_S = dict(S)
        for v in nodes_list:
            incoming = 0.0
            for u in predecessors[v]:
                w_uv = weights.get((u, v), 0.0)
                incoming += w_uv * (1 - S[u])

            theta_v = thresholds.get(v, default_theta)
            if incoming > theta_v:
                new_S[v] = max(0.0, S[v] - incoming)
            else:
                new_S[v] = S[v]

            # 4. Apply passive recovery + any scheduled intervention
            r_v = recovery_rates.get(v, default_recovery_rate)
            i_v = interventions.get((v, t), 0.0)
            new_S[v] = min(1.0, new_S[v] + r_v + i_v)

        # 5. Check convergence
        total_change = sum(abs(new_S[v] - S[v]) for v in nodes_list)
        S = new_S
        for v in nodes_list:
            history[v].append(S[v])
        
        cascade_depth = t + 1
        if total_change < epsilon:
            break

    # Calculate metrics for each wave
    num_waves = len(next(iter(history.values()))) if history else 0
    gsi = []
    vnc = []
    vulnerable_nodes = []
    domain_spillover = []

    dim_nodes_map = {}
    for d in dimensions_data:
        dim_id = str(d.get("id"))
        dim_nodes_map[dim_id] = [node.get("abbr") for node in nodes_data if str(node.get("dimension_id")) == dim_id]

    for t in range(num_waves):
        wave_stabilities = {v: history[v][t] for v in nodes_list}
        avg_s = sum(wave_stabilities.values()) / len(nodes_list) if len(nodes_list) > 0 else 1.0
        gsi.append(avg_s)

        vuln_list = [v for v, s in wave_stabilities.items() if s < 0.3]
        vnc.append(len(vuln_list))
        vulnerable_nodes.append(vuln_list)

        wave_spillover = {}
        for d in dimensions_data:
            dim_id = str(d.get("id"))
            nodes_in_dim = dim_nodes_map.get(dim_id, [])
            if len(nodes_in_dim) > 0:
                vuln_in_dim = sum(1 for v in nodes_in_dim if wave_stabilities.get(v, 1.0) < 0.3)
                wave_spillover[dim_id] = vuln_in_dim / len(nodes_in_dim)
            else:
                wave_spillover[dim_id] = 0.0
        domain_spillover.append(wave_spillover)

    # Compute Layout positions for SVG
    dimensions_list = sorted(list(set([str(node.get("dimension_id")) for node in nodes_data])))
    num_dims = len(dimensions_list)
    centers = {}
    for i, dim_id in enumerate(dimensions_list):
        angle = 2 * math.pi * i / num_dims if num_dims > 0 else 0
        centers[dim_id] = (10.0 * math.cos(angle), 10.0 * math.sin(angle))

    pos = {}
    for dim_id in dimensions_list:
        dim_nodes = [n.get("abbr") for n in nodes_data if str(n.get("dimension_id")) == dim_id]
        num_nodes_in_dim = len(dim_nodes)
        for j, node_abbr in enumerate(dim_nodes):
            node_angle = 2 * math.pi * j / num_nodes_in_dim if num_nodes_in_dim > 0 else 0
            r = 2.4
            cx, cy = centers[dim_id]
            pos[node_abbr] = (cx + r * math.cos(node_angle), cy + r * math.sin(node_angle))

    # Generate plots
    plots = []
    for t in range(num_waves):
        plots.append(generate_svg_plot(nodes_data, edges_data, dimensions_data, history, t, pos, centers, dimensions_list, nodes_dim))

    # Output structure
    output = {
        "history": history,
        "gsi": gsi,
        "vnc": vnc,
        "vulnerable_nodes": vulnerable_nodes,
        "cascade_depth": cascade_depth,
        "domain_spillover": domain_spillover,
        "plots": plots
    }
    print(json.dumps(output))


def run_simulation():
    # Read input from stdin
    input_data = sys.stdin.read()
    if not input_data.strip():
        print(json.dumps({"error": "Empty input"}))
        return

    try:
        data = json.loads(input_data)
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON: {str(e)}"}))
        return

    nodes_data = data.get("nodes", [])
    edges_data = data.get("edges", [])
    dimensions_data = data.get("dimensions", [])
    params = data.get("params", {})

    # Use pure Python fallback if scientific dependencies are not available
    if not DEPENDENCIES_OK:
        run_fallback_simulation(nodes_data, edges_data, dimensions_data, params)
        return

    # Standard Matplotlib + NetworkX Engine (Runs if packages exist)
    try:
        shocks_raw = params.get("shocks", {})
        T = int(params.get("T", 8))
        gamma = float(params.get("gamma", 1.5))
        epsilon = float(params.get("epsilon", 0.001))
        default_theta = float(params.get("default_theta", 0.2))
        default_recovery_rate = float(params.get("default_recovery_rate", 0.01))
        interventions_raw = params.get("interventions", [])

        G = nx.DiGraph()
        for node in nodes_data:
            abbr = node.get("abbr")
            G.add_node(abbr)

        for edge in edges_data:
            src = edge.get("source")
            tgt = edge.get("target")
            if src in G and tgt in G:
                G.add_edge(src, tgt)

        thresholds = {}
        recovery_rates = {}
        nodes_dim = {}
        for node in nodes_data:
            abbr = node.get("abbr")
            thresholds[abbr] = float(node.get("theta") if node.get("theta") is not None else default_theta)
            recovery_rates[abbr] = float(node.get("recovery_rate") if node.get("recovery_rate") is not None else default_recovery_rate)
            nodes_dim[abbr] = str(node.get("dimension_id"))

        shocks = {}
        for abbr, delta in shocks_raw.items():
            if abbr in G:
                shocks[abbr] = float(delta)

        interventions = {}
        for item in interventions_raw:
            node_abbr = item.get("node")
            wave = int(item.get("wave"))
            strength = float(item.get("strength", 0.0))
            if node_abbr in G:
                interventions[(node_abbr, wave)] = strength

        S = {v: 1.0 for v in G.nodes}
        for v, delta in shocks.items():
            S[v] = max(0.0, S[v] - delta)

        history = {v: [S[v]] for v in G.nodes}
        cascade_depth = 0

        for t in range(T):
            if len(G.edges) > 0:
                edge_betweenness = nx.edge_betweenness_centrality(G, normalized=True)
                b_values = list(edge_betweenness.values())
                b_min, b_max = min(b_values), max(b_values)
            else:
                edge_betweenness = {}
                b_min, b_max = 0.0, 0.0

            weights = {}
            for (u, v), b in edge_betweenness.items():
                denom = (b_max - b_min) if (b_max - b_min) > 0 else 1.0
                weights[(u, v)] = ((b - b_min) / denom) ** gamma

            new_S = dict(S)
            for v in G.nodes:
                incoming = 0.0
                for u in G.predecessors(v):
                    w_uv = weights.get((u, v), 0.0)
                    incoming += w_uv * (1 - S[u])

                theta_v = thresholds.get(v, default_theta)
                if incoming > theta_v:
                    new_S[v] = max(0.0, S[v] - incoming)
                else:
                    new_S[v] = S[v]

                r_v = recovery_rates.get(v, default_recovery_rate)
                i_v = interventions.get((v, t), 0.0)
                new_S[v] = min(1.0, new_S[v] + r_v + i_v)

            total_change = sum(abs(new_S[v] - S[v]) for v in G.nodes)
            S = new_S
            for v in G.nodes:
                history[v].append(S[v])
            
            cascade_depth = t + 1
            if total_change < epsilon:
                break

        num_waves = len(next(iter(history.values())))
        gsi = []
        vnc = []
        vulnerable_nodes = []
        domain_spillover = []

        dim_nodes_map = {}
        for d in dimensions_data:
            dim_id = str(d.get("id"))
            dim_nodes_map[dim_id] = [node.get("abbr") for node in nodes_data if str(node.get("dimension_id")) == dim_id]

        for t in range(num_waves):
            wave_stabilities = {v: history[v][t] for v in G.nodes}
            avg_s = sum(wave_stabilities.values()) / len(G.nodes) if len(G.nodes) > 0 else 1.0
            gsi.append(avg_s)

            vuln_list = [v for v, s in wave_stabilities.items() if s < 0.3]
            vnc.append(len(vuln_list))
            vulnerable_nodes.append(vuln_list)

            wave_spillover = {}
            for d in dimensions_data:
                dim_id = str(d.get("id"))
                nodes_in_dim = dim_nodes_map.get(dim_id, [])
                if len(nodes_in_dim) > 0:
                    vuln_in_dim = sum(1 for v in nodes_in_dim if wave_stabilities.get(v, 1.0) < 0.3)
                    wave_spillover[dim_id] = vuln_in_dim / len(nodes_in_dim)
                else:
                    wave_spillover[dim_id] = 0.0
            domain_spillover.append(wave_spillover)

        dimensions_list = sorted(list(set([str(node.get("dimension_id")) for node in nodes_data])))
        num_dims = len(dimensions_list)
        centers = {}
        for i, dim_id in enumerate(dimensions_list):
            angle = 2 * math.pi * i / num_dims if num_dims > 0 else 0
            centers[dim_id] = (10.0 * math.cos(angle), 10.0 * math.sin(angle))

        pos = {}
        for dim_id in dimensions_list:
            dim_nodes = [n.get("abbr") for n in nodes_data if str(n.get("dimension_id")) == dim_id]
            num_nodes_in_dim = len(dim_nodes)
            for j, node_abbr in enumerate(dim_nodes):
                node_angle = 2 * math.pi * j / num_nodes_in_dim if num_nodes_in_dim > 0 else 0
                r = 2.4
                cx, cy = centers[dim_id]
                pos[node_abbr] = np.array([cx + r * math.cos(node_angle), cy + r * math.sin(node_angle)])

        dim_colors = {
            "1": "#4169E1",
            "2": "#2E8B57",
            "3": "#228B22",
            "4": "#FF69B4",
            "5": "#8A2BE2",
            "6": "#FF8C00",
            "7": "#D2691E"
        }

        plots = []
        cmap = cm.get_cmap('RdYlGn')

        def wrap_text(text):
            words = text.split()
            if len(words) <= 2:
                return "\n".join(words)
            mid = len(words) // 2
            return "\n".join([" ".join(words[:mid]), " ".join(words[mid:])])

        for t in range(num_waves):
            fig, ax = plt.subplots(figsize=(9, 9), dpi=110)
            fig.patch.set_facecolor('none')
            ax.patch.set_facecolor('none')
            ax.set_aspect('equal')
            ax.axis('off')
            ax.set_xlim(-14, 14)
            ax.set_ylim(-14, 14)

            for dim_id in dimensions_list:
                dim_nodes = [n.get("abbr") for n in nodes_data if str(n.get("dimension_id")) == dim_id]
                if not dim_nodes:
                    continue

                dim_pts = np.array([pos[n] for n in dim_nodes])
                color = dim_colors.get(dim_id, "#777777")

                expanded_points = []
                for px, py in dim_pts:
                    for angle in np.linspace(0, 2*np.pi, 12):
                        expanded_points.append([px + 0.65 * np.cos(angle), py + 0.65 * np.sin(angle)])
                expanded_points = np.array(expanded_points)

                try:
                    hull = ConvexHull(expanded_points)
                    hull_pts = expanded_points[hull.vertices]
                    polygon = plt.Polygon(hull_pts, closed=True, facecolor=color, edgecolor=color, alpha=0.11, zorder=1)
                    ax.add_patch(polygon)
                except Exception:
                    pass

                dim_obj = next((d for d in dimensions_data if str(d.get("id")) == dim_id), None)
                dim_name = dim_obj.get("name") if dim_obj else f"Dim {dim_id}"
                wrapped_name = wrap_text(dim_name)

                cx, cy = centers[dim_id]
                norm = math.sqrt(cx*cx + cy*cy)
                if norm > 0:
                    label_x = cx + 3.8 * (cx / norm)
                    label_y = cy + 3.8 * (cy / norm)
                else:
                    label_x, label_y = cx, cy + 3.8

                ax.text(label_x, label_y, wrapped_name, fontsize=7.5, fontweight='bold',
                        color='#334155', ha='center', va='center', zorder=5,
                        bbox=dict(facecolor='white', alpha=0.9, edgecolor='none', boxstyle='round,pad=0.2'))

            for u, v in G.edges:
                pos_u = pos[u]
                pos_v = pos[v]
                same_dim = nodes_dim[u] == nodes_dim[v]
                edge_color = '#94a3b8' if same_dim else '#64748b'
                alpha = 0.5 if same_dim else 0.22
                linewidth = 1.0 if same_dim else 0.8
                arrow = FancyArrowPatch(
                    pos_u, pos_v,
                    connectionstyle="arc3,rad=0.08" if same_dim else "arc3,rad=0.15",
                    arrowstyle="-|>",
                    mutation_scale=8.5,
                    color=edge_color,
                    alpha=alpha,
                    linewidth=linewidth,
                    shrinkA=10,
                    shrinkB=10,
                    zorder=2 if same_dim else 1
                )
                ax.add_patch(arrow)

            for node in nodes_data:
                abbr = node.get("abbr")
                x, y = pos[abbr]
                stability = history[abbr][t]
                node_color = cmap(stability)

                circle = plt.Circle((x, y), radius=0.48, facecolor=node_color, edgecolor='none', zorder=3)
                ax.add_patch(circle)

                ax.text(x, y, abbr, color='#0f172a', fontsize=7.5, fontweight='black', ha='center', va='center', zorder=4)

            sm = plt.cm.ScalarMappable(cmap=cmap, norm=plt.Normalize(vmin=0, vmax=1))
            sm.set_array([])
            cbar = plt.colorbar(sm, ax=ax, orientation='horizontal', pad=0.04, shrink=0.35, aspect=25)
            cbar.set_label('Indicator Stability ($S_v$)', fontsize=8, fontweight='semibold', color='#334155')
            cbar.ax.tick_params(labelsize=7, colors='#64748b')

            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.1, dpi=110, transparent=True)
            buf.seek(0)
            img_str = base64.b64encode(buf.getvalue()).decode('utf-8')
            plots.append(f"data:image/png;base64,{img_str}")
            plt.close(fig)

        output = {
            "history": history,
            "gsi": gsi,
            "vnc": vnc,
            "vulnerable_nodes": vulnerable_nodes,
            "cascade_depth": cascade_depth,
            "domain_spillover": domain_spillover,
            "plots": plots
        }
        print(json.dumps(output))
    except Exception as e:
        # Fall back gracefully to pure Python implementation if matplotlib rendering fails runtime
        run_fallback_simulation(nodes_data, edges_data, dimensions_data, params)


if __name__ == "__main__":
    run_simulation()
