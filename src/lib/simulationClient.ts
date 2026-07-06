export interface SimulationResult {
  history: Record<string, number[]>;
  gsi: number[];
  vnc: number[];
  vulnerable_nodes: string[][];
  cascade_depth: number;
  domain_spillover: Record<string, number>[];
  plots: string[];
}

export interface NodeData {
  abbr: string;
  dimension_id: string | number;
  theta?: number;
  recovery_rate?: number;
  [key: string]: any;
}

export interface EdgeData {
  source: string;
  target: string;
  weight: number;
  [key: string]: any;
}

export interface DimensionData {
  id: string | number;
  name: string;
  [key: string]: any;
}

export interface SimulationParams {
  shocks?: Record<string, number>;
  T?: number;
  gamma?: number;
  epsilon?: number;
  default_theta?: number;
  default_recovery_rate?: number;
  interventions?: any[];
}

export interface SimulationPayload {
  nodes: NodeData[];
  edges: EdgeData[];
  dimensions: DimensionData[];
  params: SimulationParams;
}

function edgeBetweennessCentrality(nodes: string[], edges: [string, string][]) {
  const eb: Record<string, number> = {};
  for (const [u, v] of edges) {
    eb[`${u}->${v}`] = 0.0;
  }
  
  const adj: Record<string, string[]> = {};
  for (const n of nodes) {
    adj[n] = [];
  }
  for (const [u, v] of edges) {
    if (adj[u]) adj[u].push(v);
  }

  for (const s of nodes) {
    const S: string[] = [];
    const P: Record<string, string[]> = {};
    const sigma: Record<string, number> = {};
    const d: Record<string, number> = {};
    for (const w of nodes) {
      P[w] = [];
      sigma[w] = 0.0;
      d[w] = -1;
    }
    sigma[s] = 1.0;
    d[s] = 0;

    const Q: string[] = [s];
    while (Q.length > 0) {
      const v = Q.shift()!;
      S.push(v);
      for (const w of adj[v]) {
        if (d[w] < 0) {
          d[w] = d[v] + 1;
          Q.push(w);
        }
        if (d[w] === d[v] + 1) {
          sigma[w] += sigma[v];
          P[w].push(v);
        }
      }
    }

    const delta: Record<string, number> = {};
    for (const w of nodes) {
      delta[w] = 0.0;
    }
    
    while (S.length > 0) {
      const w = S.pop()!;
      for (const v of P[w]) {
        const c = (sigma[v] / sigma[w]) * (1.0 + delta[w]);
        if (eb[`${v}->${w}`] !== undefined) {
          eb[`${v}->${w}`] += c;
        }
        delta[v] += c;
      }
    }
  }

  const n = nodes.length;
  if (n > 1) {
    const scale = 1.0 / (n * (n - 1));
    for (const k of Object.keys(eb)) {
      eb[k] *= scale;
    }
  }
  return eb;
}

function getNodeColor(stability: number) {
  let r, g, b;
  if (stability < 0.5) {
    const f = stability / 0.5;
    r = Math.floor(215 + (254 - 215) * f);
    g = Math.floor(48 + (224 - 48) * f);
    b = Math.floor(39 + (139 - 39) * f);
  } else {
    const f = (stability - 0.5) / 0.5;
    r = Math.floor(254 + (26 - 254) * f);
    g = Math.floor(224 + (152 - 224) * f);
    b = Math.floor(139 + (80 - 139) * f);
  }
  return `rgb(${r},${g},${b})`;
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateSvgPlot(
  nodes_data: NodeData[],
  edges_data: EdgeData[],
  dimensions_data: DimensionData[],
  history: Record<string, number[]>,
  t: number,
  pos: Record<string, [number, number]>,
  centers: Record<string, [number, number]>,
  dimensions_list: string[],
  nodes_dim: Record<string, string>
) {
  const dimColors: Record<string, string> = {
    "1": "#4169E1",
    "2": "#2E8B57",
    "3": "#228B22",
    "4": "#FF69B4",
    "5": "#8A2BE2",
    "6": "#FF8C00",
    "7": "#D2691E"
  };

  const scale = 14.0;
  const svg_elements: string[] = [];

  svg_elements.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -200 420 440" width="100%" height="100%">');
  
  svg_elements.push(`  <defs>
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
  </defs>`);

  svg_elements.push('  <rect x="-210" y="-200" width="420" height="440" fill="none" />');

  for (const dim_id of dimensions_list) {
    const dim_nodes = nodes_data.filter(n => String(n.dimension_id) === dim_id).map(n => n.abbr);
    if (dim_nodes.length === 0) continue;

    const color = dimColors[dim_id] || "#777777";
    const [cx, cy] = centers[dim_id];

    const scx = cx * scale;
    const scy = cy * scale;
    const sradius = 3.6 * scale;
    svg_elements.push(`  <circle cx="${scx.toFixed(2)}" cy="${scy.toFixed(2)}" r="${sradius.toFixed(2)}" fill="${color}" opacity="0.07" stroke="${color}" stroke-dasharray="2 2" stroke-width="0.7" />`);

    const dim_obj = dimensions_data.find(d => String(d.id) === dim_id);
    let dim_name = dim_obj ? dim_obj.name : `Dim ${dim_id}`;
    dim_name = escapeHtml(dim_name);

    const norm = Math.sqrt(cx*cx + cy*cy);
    let label_x, label_y;
    if (norm > 0) {
      label_x = cx + 3.8 * (cx / norm);
      label_y = cy + 3.8 * (cy / norm);
    } else {
      label_x = cx;
      label_y = cy + 3.8;
    }

    const slx = label_x * scale;
    const sly = label_y * scale;

    const words = dim_name.split(" ");
    if (words.length > 2) {
      const mid = Math.floor(words.length / 2);
      const line1 = words.slice(0, mid).join(" ");
      const line2 = words.slice(mid).join(" ");
      svg_elements.push(`  <g>
    <rect x="${(slx - 45).toFixed(1)}" y="${(sly - 12).toFixed(1)}" width="90" height="24" rx="4" fill="white" opacity="0.9" filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.05))" />
    <text x="${slx.toFixed(1)}" y="${(sly - 2).toFixed(1)}" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">${line1}</text>
    <text x="${slx.toFixed(1)}" y="${(sly + 7).toFixed(1)}" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">${line2}</text>
  </g>`);
    } else {
      svg_elements.push(`  <g>
    <rect x="${(slx - 45).toFixed(1)}" y="${(sly - 7).toFixed(1)}" width="90" height="14" rx="4" fill="white" opacity="0.9" filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.05))" />
    <text x="${slx.toFixed(1)}" y="${(sly + 3).toFixed(1)}" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">${dim_name}</text>
  </g>`);
    }
  }

  for (const edge of edges_data) {
    const u = edge.source;
    const v = edge.target;
    if (!pos[u] || !pos[v]) continue;

    const [ux, uy] = pos[u];
    const [vx, vy] = pos[v];

    const s_ux = ux * scale;
    const s_uy = uy * scale;
    const s_vx = vx * scale;
    const s_vy = vy * scale;

    const dx = s_vx - s_ux;
    const dy = s_vy - s_uy;
    const d = Math.sqrt(dx*dx + dy*dy);
    
    let s_ux_shrunk, s_uy_shrunk, s_vx_shrunk, s_vy_shrunk;
    if (d > 0.001) {
      const shrink_start = 7.5;
      const shrink_end = 9.0;
      s_ux_shrunk = s_ux + (dx / d) * shrink_start;
      s_uy_shrunk = s_uy + (dy / d) * shrink_start;
      s_vx_shrunk = s_vx - (dx / d) * shrink_end;
      s_vy_shrunk = s_vy - (dy / d) * shrink_end;
    } else {
      s_ux_shrunk = s_ux; s_uy_shrunk = s_uy; s_vx_shrunk = s_vx; s_vy_shrunk = s_vy;
    }

    const same_dim = nodes_dim[u] === nodes_dim[v];
    const stroke_color = same_dim ? '#94a3b8' : '#64748b';
    const opacity = same_dim ? 0.5 : 0.22;
    const stroke_width = same_dim ? 1.0 : 0.8;
    const marker = same_dim ? 'url(#arrow-same)' : 'url(#arrow)';

    const mx = (s_ux_shrunk + s_vx_shrunk) / 2;
    const my = (s_uy_shrunk + s_vy_shrunk) / 2;
    let px, py;
    if (d > 0.001) {
      px = -dy / d;
      py = dx / d;
    } else {
      px = 0; py = 0;
    }

    const shift = same_dim ? 10.0 : 16.0;
    const ctrl_x = mx + px * shift;
    const ctrl_y = my + py * shift;

    svg_elements.push(`  <path d="M ${s_ux_shrunk.toFixed(2)} ${s_uy_shrunk.toFixed(2)} Q ${ctrl_x.toFixed(2)} ${ctrl_y.toFixed(2)} ${s_vx_shrunk.toFixed(2)} ${s_vy_shrunk.toFixed(2)}" fill="none" stroke="${stroke_color}" stroke-width="${stroke_width.toFixed(1)}" opacity="${opacity.toFixed(2)}" marker-end="${marker}" />`);
  }

  for (const node of nodes_data) {
    const abbr = node.abbr;
    if (!pos[abbr]) continue;
    const safe_abbr = escapeHtml(abbr);
    const [x, y] = pos[abbr];
    const sx = x * scale;
    const sy = y * scale;

    const stability = history[abbr][t];
    const node_color = getNodeColor(stability);
    const radius = 0.52 * scale;

    svg_elements.push(`  <circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="${radius.toFixed(2)}" fill="${node_color}" stroke="none" />`);
    const font_size = abbr.length <= 2 ? 7 : 6;
    svg_elements.push(`  <text x="${sx.toFixed(2)}" y="${(sy + 2.5).toFixed(2)}" font-size="${font_size}" font-family="sans-serif" font-weight="900" fill="#0f172a" text-anchor="middle">${safe_abbr}</text>`);
  }

  svg_elements.push(`  <g>
    <rect x="-70" y="200" width="140" height="7" fill="url(#colorbar-grad)" rx="1.5" />
    <text x="-70" y="217" font-size="7.5" font-family="sans-serif" fill="#64748b" text-anchor="middle">0.0 (Worst)</text>
    <text x="0" y="217" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">Indicator Stability (Sv)</text>
    <text x="70" y="217" font-size="7.5" font-family="sans-serif" fill="#64748b" text-anchor="middle">1.0 (Best)</text>
  </g>`);

  svg_elements.push('</svg>');
  const svg_str = svg_elements.join("\n");
  const encoded = btoa(unescape(encodeURIComponent(svg_str)));
  return `data:image/svg+xml;base64,${encoded}`;
}

export function runSimulationClient(payload: SimulationPayload): SimulationResult {
  const { nodes, edges, dimensions, params } = payload;
  
  const shocks_raw = params.shocks || {};
  const T = params.T || 8;
  const gamma = params.gamma || 1.5;
  const epsilon = params.epsilon || 0.001;
  const default_theta = params.default_theta || 0.2;
  const default_recovery_rate = params.default_recovery_rate || 0.01;
  const interventions_raw = params.interventions || [];

  const nodes_list = nodes.map(n => n.abbr);
  const edges_list: [string, string][] = edges
    .filter(e => nodes_list.includes(e.source) && nodes_list.includes(e.target))
    .map(e => [e.source, e.target]);

  const thresholds: Record<string, number> = {};
  const recovery_rates: Record<string, number> = {};
  const nodes_dim: Record<string, string> = {};

  nodes.forEach(node => {
    thresholds[node.abbr] = typeof node.theta === "number" ? node.theta : default_theta;
    recovery_rates[node.abbr] = typeof node.recovery_rate === "number" ? node.recovery_rate : default_recovery_rate;
    nodes_dim[node.abbr] = String(node.dimension_id);
  });

  const shocks: Record<string, number> = {};
  for (const [abbr, delta] of Object.entries(shocks_raw)) {
    if (nodes_list.includes(abbr)) {
      shocks[abbr] = Number(delta);
    }
  }

  const interventions: Record<string, number> = {};
  for (const item of interventions_raw) {
    if (nodes_list.includes(item.node)) {
      interventions[`${item.node}-${item.wave}`] = Number(item.strength || 0.0);
    }
  }

  const predecessors: Record<string, string[]> = {};
  for (const v of nodes_list) {
    predecessors[v] = [];
  }
  for (const [u, v] of edges_list) {
    predecessors[v].push(u);
  }

  let S: Record<string, number> = {};
  for (const v of nodes_list) {
    S[v] = 1.0;
  }
  for (const [v, delta] of Object.entries(shocks)) {
    S[v] = Math.max(0.0, S[v] - delta);
  }

  const history: Record<string, number[]> = {};
  for (const v of nodes_list) {
    history[v] = [S[v]];
  }
  
  let cascade_depth = 0;

  for (let t = 0; t < T; t++) {
    let edge_betweenness: Record<string, number> = {};
    let b_min = 0.0;
    let b_max = 0.0;

    if (edges_list.length > 0) {
      edge_betweenness = edgeBetweennessCentrality(nodes_list, edges_list);
      const b_values = Object.values(edge_betweenness);
      if (b_values.length > 0) {
        b_min = Math.min(...b_values);
        b_max = Math.max(...b_values);
      }
    }

    const weights: Record<string, number> = {};
    for (const [uv, b] of Object.entries(edge_betweenness)) {
      const denom = (b_max - b_min) > 0 ? (b_max - b_min) : 1.0;
      weights[uv] = Math.pow((b - b_min) / denom, gamma);
    }

    const new_S: Record<string, number> = { ...S };
    for (const v of nodes_list) {
      let incoming = 0.0;
      for (const u of predecessors[v]) {
        const w_uv = weights[`${u}->${v}`] || 0.0;
        incoming += w_uv * (1 - S[u]);
      }

      const theta_v = thresholds[v];
      if (incoming > theta_v) {
        new_S[v] = Math.max(0.0, S[v] - incoming);
      }

      const r_v = recovery_rates[v];
      const i_v = interventions[`${v}-${t}`] || 0.0;
      new_S[v] = Math.min(1.0, new_S[v] + r_v + i_v);
    }

    let total_change = 0.0;
    for (const v of nodes_list) {
      total_change += Math.abs(new_S[v] - S[v]);
    }
    S = new_S;
    for (const v of nodes_list) {
      history[v].push(S[v]);
    }

    cascade_depth = t + 1;
    if (total_change < epsilon) {
      break;
    }
  }

  const num_waves = history[nodes_list[0]]?.length || 0;
  const gsi: number[] = [];
  const vnc: number[] = [];
  const vulnerable_nodes: string[][] = [];
  const domain_spillover: Record<string, number>[] = [];

  const dim_nodes_map: Record<string, string[]> = {};
  for (const d of dimensions) {
    const dim_id = String(d.id);
    dim_nodes_map[dim_id] = nodes.filter(n => String(n.dimension_id) === dim_id).map(n => n.abbr);
  }

  for (let t = 0; t < num_waves; t++) {
    const wave_stabilities: Record<string, number> = {};
    for (const v of nodes_list) {
      wave_stabilities[v] = history[v][t];
    }
    
    let avg_s = 1.0;
    if (nodes_list.length > 0) {
      const sum_s = Object.values(wave_stabilities).reduce((a, b) => a + b, 0);
      avg_s = sum_s / nodes_list.length;
    }
    gsi.push(avg_s);

    const vuln_list = Object.entries(wave_stabilities).filter(([_, s]) => s < 0.3).map(([v, _]) => v);
    vnc.push(vuln_list.length);
    vulnerable_nodes.push(vuln_list);

    const wave_spillover: Record<string, number> = {};
    for (const d of dimensions) {
      const dim_id = String(d.id);
      const nodes_in_dim = dim_nodes_map[dim_id] || [];
      if (nodes_in_dim.length > 0) {
        let vuln_in_dim = 0;
        for (const v of nodes_in_dim) {
          if ((wave_stabilities[v] ?? 1.0) < 0.3) {
            vuln_in_dim++;
          }
        }
        wave_spillover[dim_id] = vuln_in_dim / nodes_in_dim.length;
      } else {
        wave_spillover[dim_id] = 0.0;
      }
    }
    domain_spillover.push(wave_spillover);
  }

  const dimensions_list = Array.from(new Set(nodes.map(n => String(n.dimension_id)))).sort();
  const num_dims = dimensions_list.length;
  const centers: Record<string, [number, number]> = {};
  
  dimensions_list.forEach((dim_id, i) => {
    const angle = num_dims > 0 ? 2 * Math.PI * i / num_dims : 0;
    centers[dim_id] = [10.0 * Math.cos(angle), 10.0 * Math.sin(angle)];
  });

  const pos: Record<string, [number, number]> = {};
  dimensions_list.forEach(dim_id => {
    const dim_nodes = nodes.filter(n => String(n.dimension_id) === dim_id).map(n => n.abbr);
    const num_nodes_in_dim = dim_nodes.length;
    dim_nodes.forEach((node_abbr, j) => {
      const node_angle = num_nodes_in_dim > 0 ? 2 * Math.PI * j / num_nodes_in_dim : 0;
      const r = 2.4;
      const [cx, cy] = centers[dim_id];
      pos[node_abbr] = [cx + r * Math.cos(node_angle), cy + r * Math.sin(node_angle)];
    });
  });

  const plots: string[] = [];
  for (let t = 0; t < num_waves; t++) {
    plots.push(generateSvgPlot(nodes, edges, dimensions, history, t, pos, centers, dimensions_list, nodes_dim));
  }

  return {
    history,
    gsi,
    vnc,
    vulnerable_nodes,
    cascade_depth,
    domain_spillover,
    plots
  };
}
