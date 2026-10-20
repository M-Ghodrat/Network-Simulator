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
  domain_id: string | number;
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

export interface DomainData {
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
  parameter_mode?: "network" | "node";
  interventions?: any[];
}

export interface SimulationPayload {
  nodes: NodeData[];
  edges: EdgeData[];
  domains: DomainData[];
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

function interpolateRgb(c1: [number, number, number], c2: [number, number, number], f: number): string {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * f);
  return `rgb(${r},${g},${b})`;
}

// Option 1: Executive Dual-Tone (Soft Light Face + Saturated Solid Border + Deep Pigment Text)
// Critical (0.0): Face #FFF1F2 (255,241,242), Border #E11D48 (225,29,72), Text #881337 (136,19,55)
// Degraded (0.5): Face #FFFBEB (255,251,235), Border #D97706 (217,119,6), Text #78350F (120,53,15)
// Stable (1.0):   Face #ECFDF5 (236,253,245), Border #059669 (5,150,105),  Text #064E3B (6,78,59)
export function getNodeStyle(stability: number): { face: string; border: string; text: string } {
  const clamped = Math.max(0.0, Math.min(1.0, stability));
  if (clamped < 0.5) {
    const f = clamped / 0.5;
    return {
      face: interpolateRgb([255, 241, 242], [255, 251, 235], f),
      border: interpolateRgb([225, 29, 72], [217, 119, 6], f),
      text: interpolateRgb([136, 19, 55], [120, 53, 15], f)
    };
  } else {
    const f = (clamped - 0.5) / 0.5;
    return {
      face: interpolateRgb([255, 251, 235], [236, 253, 245], f),
      border: interpolateRgb([217, 119, 6], [5, 150, 105], f),
      text: interpolateRgb([120, 53, 15], [6, 78, 59], f)
    };
  }
}

function getNodeColor(stability: number) {
  return getNodeStyle(stability).face;
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
  domains_data: DomainData[],
  history: Record<string, number[]>,
  t: number,
  pos: Record<string, [number, number]>,
  centers: Record<string, [number, number]>,
  domains_list: string[],
  nodes_domain: Record<string, string>
) {
  const colorPalette = [
    "#3b82f6", // 1. Indigo Blue
    "#10b981", // 2. Emerald Green
    "#f43f5e", // 3. Rose/Pink
    "#eab308", // 4. Gold/Yellow
    "#8b5cf6", // 5. Purple
    "#f97316", // 6. Orange
    "#06b6d4", // 7. Cyan
    "#ef4444", // 8. Crimson Red
    "#14b8a6", // 9. Teal
    "#d946ef", // 10. Magenta
    "#84cc16", // 11. Lime Green
    "#6366f1", // 12. Indigo
    "#ec4899", // 13. Pink
    "#f59e0b", // 14. Amber
    "#a855f7", // 15. Violet
    "#0284c7", // 16. Sky Blue
    "#b91c1c", // 17. Dark Red
    "#0f766e", // 18. Dark Teal
    "#15803d", // 19. Forest Green
    "#7c2d12"  // 20. Chocolate Brown
  ];

  const getDomainColor = (domainId: string, idx: number) => {
    const parsed = parseInt(domainId, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= colorPalette.length) {
      return colorPalette[parsed - 1];
    }
    return colorPalette[idx % colorPalette.length];
  };

  const scale = 14.0;
  const svg_elements: string[] = [];

  // Compact, well-proportioned viewBox for pixel-perfect aspect ratio
  svg_elements.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -200 420 570" width="420" height="570">');
  
  svg_elements.push(`  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
    </marker>
    <marker id="arrow-same" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
    </marker>
    <linearGradient id="colorbar-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e11d48" />
      <stop offset="50%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
  </defs>`);

  svg_elements.push('  <rect x="-210" y="-200" width="420" height="570" fill="none" />');

  domains_list.forEach((domain_id, idx) => {
    const domain_nodes = nodes_data.filter(n => String(n.domain_id) === domain_id).map(n => n.abbr);
    if (domain_nodes.length === 0) return;

    const color = getDomainColor(domain_id, idx);
    const [cx, cy] = centers[domain_id];

    const scx = cx * scale;
    const scy = cy * scale;
    const sradius = 3.6 * scale;
    // Elegant dashed stroke matching the domain color, enclosing its respective indicator nodes with high transparency
    svg_elements.push(`  <circle cx="${scx.toFixed(2)}" cy="${scy.toFixed(2)}" r="${sradius.toFixed(2)}" fill="${color}" fill-opacity="0.125" stroke="${color}" stroke-opacity="0.25" stroke-dasharray="4 4" stroke-width="1.5" />`);
  });

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
    
    // Dynamically calculate node radius based on abbreviation length and multi-line rendering
    const getNodeRadius = (nodeAbbr: string) => {
      if (nodeAbbr.length > 4) return 0.68 * scale; // ~9.52px for 2-line abbreviations (up to 8 chars)
      if (nodeAbbr.length > 2) return 0.58 * scale; // ~8.12px for 3-4 chars
      return 0.54 * scale; // ~7.56px for 1-2 chars
    };

    let s_ux_shrunk, s_uy_shrunk, s_vx_shrunk, s_vy_shrunk;
    if (d > 0.001) {
      const uRadius = getNodeRadius(u);
      const vRadius = getNodeRadius(v);
      const shrink_start = uRadius + 0.8;
      const shrink_end = vRadius + 2.2;
      s_ux_shrunk = s_ux + (dx / d) * shrink_start;
      s_uy_shrunk = s_uy + (dy / d) * shrink_start;
      s_vx_shrunk = s_vx - (dx / d) * shrink_end;
      s_vy_shrunk = s_vy - (dy / d) * shrink_end;
    } else {
      s_ux_shrunk = s_ux; s_uy_shrunk = s_uy; s_vx_shrunk = s_vx; s_vy_shrunk = s_vy;
    }

    const same_domain = nodes_domain[u] === nodes_domain[v];
    const stroke_color = same_domain ? '#94a3b8' : '#64748b';
    const opacity = same_domain ? 0.5 : 0.22;
    const stroke_width = same_domain ? 1.0 : 0.8;
    const marker = same_domain ? 'url(#arrow-same)' : 'url(#arrow)';

    const mx = (s_ux_shrunk + s_vx_shrunk) / 2;
    const my = (s_uy_shrunk + s_vy_shrunk) / 2;
    let px, py;
    if (d > 0.001) {
      px = -dy / d;
      py = dx / d;
    } else {
      px = 0; py = 0;
    }

    const shift = same_domain ? 10.0 : 16.0;
    const ctrl_x = mx + px * shift;
    const ctrl_y = my + py * shift;

    svg_elements.push(`  <path d="M ${s_ux_shrunk.toFixed(2)} ${s_uy_shrunk.toFixed(2)} Q ${ctrl_x.toFixed(2)} ${ctrl_y.toFixed(2)} ${s_vx_shrunk.toFixed(2)} ${s_vy_shrunk.toFixed(2)}" fill="none" stroke="${stroke_color}" stroke-width="${stroke_width.toFixed(1)}" opacity="${opacity.toFixed(2)}" marker-end="${marker}" />`);
  }

  for (const node of nodes_data) {
    const abbr = node.abbr;
    if (!pos[abbr]) continue;
    const [x, y] = pos[abbr];
    const sx = x * scale;
    const sy = y * scale;

    const stability = history[abbr]?.[t] ?? 1.0;
    const style = getNodeStyle(stability);

    const isTwoLines = abbr.length > 4;
    const radius = isTwoLines ? 0.68 * scale : (abbr.length > 2 ? 0.58 * scale : 0.54 * scale);

    // Option 1: Executive Dual-Tone node face with solid colored status border
    svg_elements.push(`  <circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="${radius.toFixed(2)}" fill="${style.face}" stroke="${style.border}" stroke-width="1.3" />`);

    if (isTwoLines) {
      // Split into 2 lines so font can be significantly larger and comfortably readable
      // Line 1: first 4 characters (or split at hyphen/underscore if present near the middle)
      // Line 2: remaining characters
      let line1Text = "";
      let line2Text = "";

      const hyphenIdx = abbr.indexOf("-");
      const underIdx = abbr.indexOf("_");
      const sepIdx = hyphenIdx >= 2 && hyphenIdx <= 4 ? hyphenIdx : (underIdx >= 2 && underIdx <= 4 ? underIdx : -1);

      if (sepIdx !== -1 && (abbr.length - (sepIdx + 1)) <= 4) {
        line1Text = abbr.slice(0, sepIdx + 1);
        line2Text = abbr.slice(sepIdx + 1);
      } else {
        const splitPos = abbr.length <= 6 ? Math.ceil(abbr.length / 2) : 4;
        line1Text = abbr.slice(0, splitPos);
        line2Text = abbr.slice(splitPos);
      }

      const font_size = 5.2;
      const line_offset = 2.9;

      svg_elements.push(`  <text x="${sx.toFixed(2)}" y="${(sy - line_offset).toFixed(2)}" font-size="${font_size}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="normal" fill="${style.text}" text-anchor="middle" dominant-baseline="central" style="font-weight: normal;">${escapeHtml(line1Text)}</text>`);
      svg_elements.push(`  <text x="${sx.toFixed(2)}" y="${(sy + line_offset).toFixed(2)}" font-size="${font_size}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="normal" fill="${style.text}" text-anchor="middle" dominant-baseline="central" style="font-weight: normal;">${escapeHtml(line2Text)}</text>`);
    } else {
      // Single line for short abbreviations (1-4 characters) with generously large, clear font
      const font_size = abbr.length <= 2 ? 6.8 : 5.8;
      svg_elements.push(`  <text x="${sx.toFixed(2)}" y="${sy.toFixed(2)}" font-size="${font_size}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="normal" fill="${style.text}" text-anchor="middle" dominant-baseline="central" style="font-weight: normal;">${escapeHtml(abbr)}</text>`);
    }
  }

  // Draw the Colorbar first, positioned cleanly below the network (translated down by 50px)
  svg_elements.push(`  <g id="colorbar-container" transform="translate(0, 50)">
    <rect x="-70" y="200" width="140" height="7" fill="url(#colorbar-grad)" rx="1.5" />
    <text x="-70" y="217" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#e11d48" text-anchor="middle">0.0 (Worst)</text>
    <text x="0" y="217" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="middle">Indicator Stability (Sv)</text>
    <text x="70" y="217" font-size="7.5" font-family="sans-serif" font-weight="bold" fill="#059669" text-anchor="middle">1.0 (Best)</text>
  </g>`);

  // Draw Inline Domains & Indicators Legend Box inside the bottom of the image (no background color, below the color palette)
  svg_elements.push(`  <g id="image-legend-container">
    <text x="-190" y="295" font-size="8" font-family="sans-serif" font-weight="bold" fill="#64748b" text-anchor="start">NETWORK DOMAINS</text>
  </g>`);

  domains_list.forEach((domain_id, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const colWidth = 98;
    const startX = -190;
    const startY = 312;
    const x = startX + col * colWidth;
    const y = startY + row * 15;

    const color = getDomainColor(domain_id, idx);
    const domain_obj = domains_data.find(d => String(d.id) === domain_id);
    const domain_name = domain_obj ? domain_obj.name : `Domain ${domain_id}`;
    
    // Truncate domain name if it is long
    const displayName = domain_name.length > 22 ? domain_name.substring(0, 20) + ".." : domain_name;
    const labelText = `D${domain_id}: ${displayName}`;

    svg_elements.push(`  <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">
    <circle cx="4" cy="2" r="3.5" fill="${color}" stroke="none" />
    <text x="12" y="5" font-size="7" font-family="sans-serif" font-weight="bold" fill="#334155" text-anchor="start">${escapeHtml(labelText)}</text>
  </g>`);
  });

  svg_elements.push('</svg>');
  const svg_str = svg_elements.join("\n");
  const encoded = btoa(unescape(encodeURIComponent(svg_str)));
  return `data:image/svg+xml;base64,${encoded}`;
}

export function runSimulationClient(payload: SimulationPayload): SimulationResult {
  const { nodes, edges, domains, params } = payload;
  
  const shocks_raw = params.shocks || {};
  const T = params.T || 8;
  const gamma = params.gamma || 1.5;
  const epsilon = params.epsilon || 0.001;
  const default_theta = params.default_theta || 0.2;
  const default_recovery_rate = params.default_recovery_rate || 0.05;
  const interventions_raw = params.interventions || [];

  const nodes_list = nodes.map(n => n.abbr);
  const edges_list: [string, string][] = edges
    .filter(e => nodes_list.includes(e.source) && nodes_list.includes(e.target))
    .map(e => [e.source, e.target]);

  const parameter_mode = params.parameter_mode || "network";
  const thresholds: Record<string, number> = {};
  const recovery_rates: Record<string, number> = {};
  const nodes_domain: Record<string, string> = {};

  if (parameter_mode === "node") {
    const missingNodes: string[] = [];
    nodes.forEach(node => {
      const hasTheta = typeof node.theta === "number" && !isNaN(node.theta);
      const hasRecovery = typeof node.recovery_rate === "number" && !isNaN(node.recovery_rate);
      if (!hasTheta || !hasRecovery) {
        missingNodes.push(node.abbr);
      } else {
        thresholds[node.abbr] = node.theta;
        recovery_rates[node.abbr] = node.recovery_rate;
      }
      nodes_domain[node.abbr] = String(node.domain_id);
    });

    if (missingNodes.length > 0) {
      throw new Error(
        `Node-level parameters are missing for indicator(s): ${missingNodes.slice(0, 5).join(", ")}${missingNodes.length > 5 ? ` and ${missingNodes.length - 5} more` : ""}. Please configure Failure Threshold (θ) and Passive Recovery (rv) in the Network Configuration tab for all nodes, or choose Network-Level (Global) parameters.`
      );
    }
  } else {
    // Network-level: all nodes use the global defaults
    nodes.forEach(node => {
      thresholds[node.abbr] = default_theta;
      recovery_rates[node.abbr] = default_recovery_rate;
      nodes_domain[node.abbr] = String(node.domain_id);
    });
  }

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

  const domain_nodes_map: Record<string, string[]> = {};
  for (const d of domains) {
    const domain_id = String(d.id);
    domain_nodes_map[domain_id] = nodes.filter(n => String(n.domain_id) === domain_id).map(n => n.abbr);
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
    for (const d of domains) {
      const domain_id = String(d.id);
      const nodes_in_dim = domain_nodes_map[domain_id] || [];
      if (nodes_in_dim.length > 0) {
        let vuln_in_dim = 0;
        for (const v of nodes_in_dim) {
          if ((wave_stabilities[v] ?? 1.0) < 0.3) {
            vuln_in_dim++;
          }
        }
        wave_spillover[domain_id] = vuln_in_dim / nodes_in_dim.length;
      } else {
        wave_spillover[domain_id] = 0.0;
      }
    }
    domain_spillover.push(wave_spillover);
  }

  const domains_list = Array.from(new Set(nodes.map(n => String(n.domain_id)))).sort();
  const num_domains = domains_list.length;
  const centers: Record<string, [number, number]> = {};
  
  domains_list.forEach((domain_id, i) => {
    const angle = num_domains > 0 ? 2 * Math.PI * i / num_domains : 0;
    centers[domain_id] = [10.0 * Math.cos(angle), 10.0 * Math.sin(angle)];
  });

  const pos: Record<string, [number, number]> = {};
  domains_list.forEach(domain_id => {
    const domain_nodes = nodes.filter(n => String(n.domain_id) === domain_id).map(n => n.abbr);
    const num_nodes_in_dim = domain_nodes.length;
    domain_nodes.forEach((node_abbr, j) => {
      const node_angle = num_nodes_in_dim > 0 ? 2 * Math.PI * j / num_nodes_in_dim : 0;
      const r = 2.4;
      const [cx, cy] = centers[domain_id];
      pos[node_abbr] = [cx + r * Math.cos(node_angle), cy + r * Math.sin(node_angle)];
    });
  });

  const plots: string[] = [];
  for (let t = 0; t < num_waves; t++) {
    plots.push(generateSvgPlot(nodes, edges, domains, history, t, pos, centers, domains_list, nodes_domain));
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

export function generateStaticNetworkSvg(
  nodes: NodeData[],
  edges: EdgeData[],
  domains: DomainData[]
): string {
  const domains_list = Array.from(new Set(nodes.map(n => String(n.domain_id)))).sort();
  const num_domains = domains_list.length;
  const centers: Record<string, [number, number]> = {};
  
  domains_list.forEach((domain_id, i) => {
    const angle = num_domains > 0 ? 2 * Math.PI * i / num_domains : 0;
    centers[domain_id] = [10.0 * Math.cos(angle), 10.0 * Math.sin(angle)];
  });

  const pos: Record<string, [number, number]> = {};
  domains_list.forEach(domain_id => {
    const domain_nodes = nodes.filter(n => String(n.domain_id) === domain_id).map(n => n.abbr);
    const num_nodes_in_dim = domain_nodes.length;
    domain_nodes.forEach((node_abbr, j) => {
      const node_angle = num_nodes_in_dim > 0 ? 2 * Math.PI * j / num_nodes_in_dim : 0;
      const r = 2.4;
      const [cx, cy] = centers[domain_id];
      pos[node_abbr] = [cx + r * Math.cos(node_angle), cy + r * Math.sin(node_angle)];
    });
  });

  const nodes_domain: Record<string, string> = {};
  const history: Record<string, number[]> = {};
  nodes.forEach(node => {
    nodes_domain[node.abbr] = String(node.domain_id);
    history[node.abbr] = [1.0];
  });

  return generateSvgPlot(nodes, edges, domains, history, 0, pos, centers, domains_list, nodes_domain);
}
