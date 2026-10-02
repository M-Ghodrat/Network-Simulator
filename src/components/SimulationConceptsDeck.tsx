import React, { useState, useEffect, useCallback } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  LayoutGrid, 
  Play, 
  ArrowRight
} from "lucide-react";

export interface SlideCallout {
  cls: "low" | "high" | string;
  label: string;
  text: string;
}

export interface SimulationSlideItem {
  id: string;
  kind?: "title";
  tab?: string;
  eyebrow?: string;
  h2?: string;
  lede?: string;
  callout?: SlideCallout[];
  analogy?: string;
  html?: string;
  diagram: () => string;
}

// -------------------------------------------------------------
// EXACT SVG DIAGRAM GENERATORS & DATA FROM simulation-concepts.html
// -------------------------------------------------------------

/* =====================================================================
   SHARED HELPERS
===================================================================== */
const COL: Record<string, string> = { stable:"#4ED9A0", stress:"#F2643C", fail:"#B23A22", hub:"#F5C24C", policy:"#6C8CFF", dim:"#42454E", text:"#A6A7AB" };

function lerp(a: number, b: number, t: number): number { return a+(b-a)*t; }
function lerpColor(c1: string, c2: string, t: number): string {
  const p=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
  const [r1,g1,b1]=p(c1), [r2,g2,b2]=p(c2);
  return `rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`;
}
function colorForValue(v: number): string {
  v = Math.max(0,Math.min(1,v));
  return v<0.5 ? lerpColor(COL.stress, COL.hub, v/0.5) : lerpColor(COL.hub, COL.stable, (v-0.5)/0.5);
}
function normTimes(times: number[]): number[] {
  const out=[times[0]];
  for(let i=1;i<times.length;i++) out.push(Math.max(times[i], out[i-1]+0.001));
  if(out[out.length-1] > 1) out[out.length-1] = 1;
  return out;
}

const DEFS = `
<defs>
  <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="4" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>`;

const NET: { nodes: Record<string, { x: number; y: number; label: string }>; edges: [string, string][] } = {
  nodes:{
    PF:{x:120,y:150,label:"PF"}, BE:{x:250,y:95,label:"BE"},
    N1:{x:35,y:75,label:"DI"},   N2:{x:35,y:225,label:"CR"},
    N3:{x:130,y:245,label:"EN"}, N6:{x:220,y:255,label:"TN"},
    N4:{x:335,y:55,label:"IE"},  N5:{x:340,y:150,label:"HC"}
  },
  edges:[["PF","N1"],["PF","N2"],["PF","N3"],["PF","BE"],["BE","N4"],["BE","N5"],["N3","N6"]]
};
const HOP: Record<string, number> = { PF:0, BE:0, N1:1, N2:1, N3:1, N4:1, N5:1, N6:2 };

function edgeSVG(a: string, b: string, attrs: string = ""): string {
  const A=NET.nodes[a], B=NET.nodes[b];
  return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" ${attrs}/>`;
}
function allEdgesSVG(attrs: string = `stroke="${COL.dim}" stroke-width="1.4"`): string {
  return NET.edges.map(([a,b])=>edgeSVG(a,b,attrs)).join("");
}
function nodeSVG(id: string, {fill=COL.stable, r=15, showId=true, glow=false, extra=""}: {fill?: string; r?: number; showId?: boolean; glow?: boolean; extra?: string} = {}): string {
  const n = NET.nodes[id];
  return `<g>
    <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" ${glow?'filter="url(#glow)"':""}/>
    ${showId?`<text x="${n.x}" y="${n.y+3.5}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" font-weight="600" fill="#0F1319">${n.label}</text>`:""}
    ${extra}
  </g>`;
}
function svgWrap(inner: string, viewBox: string = "0 0 400 300"): string {
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${DEFS}${inner}</svg>`;
}
function insetPanel(x: number, y: number, w: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#1E1F23" stroke="${COL.dim}" stroke-width="1"/>`;
}
function cornerReadout(text: string, color: string, dur: string, triangleUp: boolean): string {
  const tri = triangleUp ? `<path d="M0,8 L8,8 L4,0 Z" fill="${color}"/>` : `<path d="M0,0 L8,0 L4,8 Z" fill="${color}"/>`;
  return `<g transform="translate(14,14)">
    ${tri}
    <text x="14" y="8" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="${color}">${text}
      <animate attributeName="opacity" values="0.35;1;0.35" dur="${dur}" repeatCount="indefinite"/>
    </text>
  </g>`;
}

/* 1. TITLE */
function diagramTitle(){
  const n = 32, pts = [];
  for(let i=0;i<n;i++){
    const angle = (i/n)*Math.PI*2 + (Math.random()-0.5)*0.18;
    const radius = 58 + Math.random()*112;
    pts.push({
      x:200 + Math.cos(angle)*radius + (Math.random()-0.5)*24,
      y:150 + Math.sin(angle)*radius*0.72 + (Math.random()-0.5)*18
    });
  }
  let edges = "";
  const order = [...Array(n).keys()].sort((a,b)=>{
    const da=Math.hypot(pts[a].x-200, pts[a].y-150);
    const db=Math.hypot(pts[b].x-200, pts[b].y-150);
    return da-db;
  });
  for(let i=1;i<order.length;i++){
    const a=pts[order[i-1]], b=pts[order[i]];
    edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#42454E" stroke-width="1"/>`;
  }
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
    const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<78 && Math.random()>0.30){
      edges += `<line x1="${pts[i].x}" y1="${pts[i].y}" x2="${pts[j].x}" y2="${pts[j].y}" stroke="#383A42" stroke-width="1"/>`;
    }
  }
  const circles = pts.map((p,i)=>{
    const c = i%7===0?COL.stress:(i%4===0?COL.hub:COL.stable);
    const r = 2.8 + Math.random()*2.4;
    return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${c}" opacity="0.85">
      <animate attributeName="opacity" values="0.35;1;0.35" dur="${3+i%4}s" begin="${(i*0.18).toFixed(2)}s" repeatCount="indefinite"/>
    </circle>`;
  }).join("");
  return svgWrap(edges+circles);
}

/* 2. NODE STABILITY */
function diagramStability(){
  const vals = { PF:0.42, BE:0.58, N1:0.91, N2:0.77, N3:0.34, N6:0.19, N4:0.88, N5:0.65 };
  const nodes = Object.keys(NET.nodes).map(id=>{
    const v = vals[id];
    return nodeSVG(id, {fill:colorForValue(v), r:20, showId:false, glow:v<0.35,
      extra:`<text x="${NET.nodes[id].x}" y="${NET.nodes[id].y+4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="#0F1319">${v.toFixed(2)}</text>`});
  }).join("");
  const legend = `
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${COL.stress}"/><stop offset="50%" stop-color="${COL.hub}"/><stop offset="100%" stop-color="${COL.stable}"/>
    </linearGradient></defs>
    <rect x="80" y="286" width="240" height="8" rx="4" fill="url(#lg)"/>
    <text x="80" y="280" font-family="IBM Plex Mono" font-size="9" fill="${COL.stress}">0.0 low</text>
    <text x="320" y="280" text-anchor="end" font-family="IBM Plex Mono" font-size="9" fill="${COL.stable}">1.0 high</text>`;
  return svgWrap(allEdgesSVG()+nodes+legend, "0 0 400 300");
}

/* 3. SHOCK */
function diagramShock(){
  const netG = `<g transform="translate(14,10) scale(0.78)">
    ${allEdgesSVG()}
    ${Object.keys(NET.nodes).filter(id=>id!=="PF").map(id=>nodeSVG(id,{fill:COL.stable,r:12})).join("")}
    <circle cx="${NET.nodes.PF.x}" cy="${NET.nodes.PF.y}" r="16" fill="${COL.stress}" filter="url(#glow)">
      <animate attributeName="r" values="14;19;14" dur="1.3s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${NET.nodes.PF.x}" cy="${NET.nodes.PF.y}" r="16" fill="none" stroke="${COL.stress}" stroke-width="2" opacity="0.6">
      <animate attributeName="r" values="16;42;16" dur="1.7s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;0;0.6" dur="1.7s" repeatCount="indefinite"/>
    </circle>
    <text x="${NET.nodes.PF.x}" y="${NET.nodes.PF.y+3.5}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" font-weight="700" fill="#0F1319">PF</text>
  </g>`;
  const readout = cornerReadout("&#916;S = &minus;0.40", COL.stress, "1.6s", false);
  const chart = `<g transform="translate(272,196)">
    ${insetPanel(0,0,118,96)}
    <line x1="16" y1="10" x2="16" y2="76" stroke="${COL.dim}"/>
    <line x1="16" y1="76" x2="104" y2="76" stroke="${COL.dim}"/>
    <text x="12" y="14" text-anchor="end" font-family="IBM Plex Mono" font-size="7" fill="${COL.text}">1</text>
    <text x="12" y="78" text-anchor="end" font-family="IBM Plex Mono" font-size="7" fill="${COL.text}">0</text>
    <path d="M16,16 L30,20 L46,58 L104,68" fill="none" stroke="${COL.stress}" stroke-width="2" stroke-linecap="round" stroke-dasharray="130" stroke-dashoffset="130">
      <animate attributeName="stroke-dashoffset" values="130;0;0;130" keyTimes="0;0.5;0.85;1" dur="3.4s" repeatCount="indefinite"/>
    </path>
    <text x="60" y="90" text-anchor="middle" font-family="IBM Plex Mono" font-size="7" fill="${COL.text}">S(t)</text>
  </g>`;
  return svgWrap(netG+readout+chart, "0 0 400 300");
}

/* 4. WAVES (T) */
function diagramWaves(){
  const netG = `<g transform="translate(8,2) scale(0.70)">
    ${allEdgesSVG()}
    ${Object.keys(NET.nodes).filter(id=>id!=="N3").map(id=>nodeSVG(id,{fill:COL.stable,r:14})).join("")}
    <circle cx="${NET.nodes.N3.x}" cy="${NET.nodes.N3.y}" r="17" fill="${COL.hub}" filter="url(#glow)">
      <animate attributeName="opacity" values="1;0.55;1" dur="2s" repeatCount="indefinite"/>
    </circle>
    <text x="${NET.nodes.N3.x}" y="${NET.nodes.N3.y+4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="700" fill="#0F1319">EN</text>
  </g>`;
  const chart = `<g transform="translate(74,188)">
    ${insetPanel(0,0,252,92)}
    <line x1="18" y1="10" x2="18" y2="70" stroke="${COL.dim}"/>
    <line x1="18" y1="70" x2="234" y2="70" stroke="${COL.dim}"/>
    <text x="14" y="14" text-anchor="end" font-family="IBM Plex Mono" font-size="8" fill="${COL.text}">1.0</text>
    <text x="14" y="72" text-anchor="end" font-family="IBM Plex Mono" font-size="8" fill="${COL.text}">0</text>
    <path id="wpath" d="M18,16 L48,20 L78,38 L108,58 L138,64 L168,60 L198,48 L234,36" fill="none" stroke="${COL.hub}" stroke-width="2.3" stroke-linecap="round" stroke-dasharray="320" stroke-dashoffset="320">
      <animate attributeName="stroke-dashoffset" values="320;0;0;320" keyTimes="0;0.6;0.9;1" dur="4.5s" repeatCount="indefinite"/>
    </path>
    <circle r="4" fill="${COL.hub}">
      <animateMotion dur="4.5s" repeatCount="indefinite" keyPoints="0;1;1;0" keyTimes="0;0.6;0.9;1" calcMode="linear">
        <mpath href="#wpath"/>
      </animateMotion>
    </circle>
    <text x="126" y="86" text-anchor="middle" font-family="IBM Plex Mono" font-size="8.5" fill="${COL.text}">waves t = 0 → 9 · EN stability</text>
  </g>`;
  return svgWrap(netG+chart, "0 0 400 300");
}

/* 5. SHOCK INTENSITY */
function diagramIntensity(){
  function mini(cx: number, cy: number, value: string, sev: string): string {
    return `<g transform="translate(${cx},${cy})">
      <circle r="34" fill="none" stroke="${COL.dim}" stroke-width="1"/>
      <circle r="22" fill="${sev==='low'?colorForValue(0.8):COL.stress}" ${sev==='high'?'filter="url(#glow)"':""}>
        ${sev==='high'?`<animate attributeName="opacity" values="1;0.65;1" dur="1s" repeatCount="indefinite"/>`:""}
      </circle>
      <text y="4" text-anchor="middle" font-family="IBM Plex Mono" font-size="12" font-weight="700" fill="#0F1319">BE</text>
      <text y="-46" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" font-weight="600" fill="${COL.stress}">${value}</text>
    </g>`;
  }
  return svgWrap(`
    ${mini(110,150,"-0.20","low")}
    ${mini(290,150,"-0.80","high")}
    <text x="110" y="235" text-anchor="middle" font-family="Inter" font-size="12" fill="#D0D3D7">δ = 20% (small)</text>
    <text x="290" y="235" text-anchor="middle" font-family="Inter" font-size="12" fill="#D0D3D7">δ = 80% (large)</text>
    <line x1="200" y1="60" x2="200" y2="240" stroke="${COL.dim}" stroke-width="1" stroke-dasharray="3 4"/>
  `, "0 0 400 260");
}

/* 6. FAILURE THRESHOLD */
function diagramThreshold(){
  const netG = `<g transform="translate(110,-10) scale(0.45)">
    ${allEdgesSVG()}
    ${Object.keys(NET.nodes).filter(id=>id!=="N6").map(id=>nodeSVG(id,{fill:COL.stable,r:13})).join("")}
    <circle cx="${NET.nodes.N6.x}" cy="${NET.nodes.N6.y}" r="16" fill="${COL.hub}">
       <animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite"/>
    </circle>
    <text x="${NET.nodes.N6.x}" y="${NET.nodes.N6.y+4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="700" fill="#0F1319">TN</text>
  </g>`;

  const tnX = 110 + NET.nodes.N6.x * 0.45;
  const tnY = -10 + NET.nodes.N6.y * 0.45;
  const connections = `
     <path d="M${tnX},${tnY+10} L${tnX},120 L100,120 L100,125" fill="none" stroke="${COL.dim}" stroke-width="1" stroke-dasharray="2 2"/>
     <path d="M${tnX},${tnY+10} L${tnX},120 L300,120 L300,125" fill="none" stroke="${COL.dim}" stroke-width="1" stroke-dasharray="2 2"/>
  `;

  function scenario(cx: number, cy: number, title: string, thetaSize: number, shockSize: number, isFail: boolean): string {
      const DUR = "5s";
      const finalStabilityH = isFail ? 15 : 50;
      const finalStabilityY = isFail ? 35 : 0;
      const finalColor = isFail ? COL.stress : COL.stable;
      
      const crossTime = (thetaSize / shockSize) * 0.15;
      const t1 = Math.min(crossTime, 0.14).toFixed(3);
      const t2 = (Math.min(crossTime, 0.14) + 0.01).toFixed(3);

      return `
      <g transform="translate(${cx}, ${cy})">
          <text y="-18" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" font-weight="700" fill="${COL.text}">${title}</text>
          <rect x="-65" y="-5" width="130" height="52" rx="6" fill="#1E1F23" stroke="${COL.dim}" stroke-width="1"/>
          <text x="-55" y="8" font-family="IBM Plex Mono" font-size="7" fill="${COL.text}">Capacity (&#952;)</text>
          <rect x="-55" y="12" width="${thetaSize}" height="7" rx="3.5" fill="${COL.policy}" opacity="0.4"/>
          <line x1="${-55 + thetaSize}" y1="8" x2="${-55 + thetaSize}" y2="41" stroke="${COL.policy}" stroke-dasharray="2 2" stroke-width="1.5"/>
          <text x="-55" y="31" font-family="IBM Plex Mono" font-size="7" fill="${COL.hub}">Shock (&#916;S)</text>
          <rect x="-55" y="35" width="0" height="7" rx="3.5" fill="${COL.hub}">
              <animate attributeName="width" values="0; ${shockSize}; ${shockSize}; 0" keyTimes="0; 0.15; 0.85; 1" dur="${DUR}" repeatCount="indefinite"/>
              ${isFail ? `<animate attributeName="fill" values="${COL.hub}; ${COL.hub}; ${COL.stress}; ${COL.stress}; ${COL.hub}" keyTimes="0; ${t1}; ${t2}; 0.85; 1" dur="${DUR}" repeatCount="indefinite"/>` : ''}
          </rect>
          <text x="0" y="65" text-anchor="middle" font-family="IBM Plex Mono" font-size="7.5" fill="${COL.text}">Node Stability</text>
          <g transform="translate(-15, 72)">
              <rect x="0" y="0" width="30" height="50" rx="4" fill="${COL.dim}" opacity="0.3"/>
              <rect x="0" y="0" width="30" height="50" rx="4" fill="${COL.stable}">
                  <animate attributeName="height" values="50; 50; ${finalStabilityH}; ${finalStabilityH}; 50" keyTimes="0; 0.2; 0.25; 0.85; 1" dur="${DUR}" repeatCount="indefinite"/>
                  <animate attributeName="y" values="0; 0; ${finalStabilityY}; ${finalStabilityY}; 0" keyTimes="0; 0.2; 0.25; 0.85; 1" dur="${DUR}" repeatCount="indefinite"/>
                  <animate attributeName="fill" values="${COL.stable}; ${COL.stable}; ${finalColor}; ${finalColor}; ${COL.stable}" keyTimes="0; 0.2; 0.25; 0.85; 1" dur="${DUR}" repeatCount="indefinite"/>
              </rect>
              <text x="15" y="28" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" font-weight="700" fill="#0F1319">
                  ${isFail ? `<animate attributeName="opacity" values="1; 1; 0; 0; 1" keyTimes="0; 0.2; 0.25; 0.85; 1" dur="${DUR}" repeatCount="indefinite"/>` : ''}
                  0.9
              </text>
              ${isFail ? `
              <text x="15" y="46" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" font-weight="700" fill="#0F1319" opacity="0">
                  <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.2; 0.25; 0.85; 1" dur="${DUR}" repeatCount="indefinite"/>
                  0.4
              </text>
              ` : ''}
          </g>
          <text x="0" y="138" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="${isFail ? COL.stress : COL.stable}" font-weight="600">
              <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.25; 0.3; 0.85; 1" dur="${DUR}" repeatCount="indefinite"/>
              ${isFail ? 'SHOCK &gt; &#952; &#8594; FAIL' : 'SHOCK = 0 &#8594; ABSORBED'}
          </text>
      </g>
      `;
  }

  const scenarios = `
    ${scenario(100, 145, "HIGH THRESHOLD", 100, 65, false)}
    ${scenario(300, 145, "LOW THRESHOLD", 40, 65, true)}
  `;

  return svgWrap(netG + connections + scenarios, "0 0 400 300");
}

/* 7. CENTRALITY DAMPENING (γ) */
function diagramCentrality(){
  const be = NET.nodes.BE;
  const beNeighbors = [
    { x: be.x + 90, y: be.y },
    { x: be.x - 45, y: be.y + 85 },
    { x: be.x + 35, y: be.y + 85 }
  ];
  const beNeighborEdges = beNeighbors.map(n => 
    `<line x1="${be.x}" y1="${be.y}" x2="${n.x}" y2="${n.y}" stroke="${COL.dim}" stroke-width="1.2" opacity="0.6"/>`
  ).join("");
  const beNeighborNodes = beNeighbors.map(n => 
    `<circle cx="${n.x}" cy="${n.y}" r="10" fill="${COL.dim}"/>`
  ).join("");
  const extraNeighbor = {x: 35, y: 285, label: ""};
  const crNode = NET.nodes.N2;
  const extraEdge = `<line x1="${extraNeighbor.x}" y1="${extraNeighbor.y}" x2="${crNode.x}" y2="${crNode.y}" stroke="${COL.dim}" stroke-width="1" opacity="0.35"/>`;
  const extraNode = `<circle cx="${extraNeighbor.x}" cy="${extraNeighbor.y}" r="9" fill="${COL.dim}"/>`;

  function feed(from: string, width: number, sizeLabel: string, txtColor: string): string {
    const A=NET.nodes[from], B=NET.nodes.PF;
    return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${txtColor}" stroke-width="${width}" stroke-linecap="round" opacity="0.85"/>
      <circle r="${width*0.9}" fill="${txtColor}">
        <animateMotion dur="1.6s" repeatCount="indefinite" path="M${A.x},${A.y} L${B.x},${B.y}"/>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="1.6s" repeatCount="indefinite"/>
      </circle>
      <text x="${(A.x+B.x)/2}" y="${(A.y+B.y)/2 - 10}" text-anchor="middle" font-family="IBM Plex Mono" font-size="8.5" fill="${txtColor}">${sizeLabel}</text>`;
  }

  const feeds = feed("N1", 2, "low betweenness", COL.stable) +
                feed("N2", 4.5, "medium", COL.hub) +
                feed("BE", 8, "high betweenness", COL.stress);

  const target = `<circle cx="${NET.nodes.PF.x}" cy="${NET.nodes.PF.y}" r="18" fill="${COL.hub}" filter="url(#glow)">
      <animate attributeName="r" values="17;19;17" dur="1.6s" repeatCount="indefinite"/>
    </circle>
    <text x="${NET.nodes.PF.x}" y="${NET.nodes.PF.y+4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" font-weight="700" fill="#0F1319">PF</text>`;

  const others = ["N1","N2","BE"].map(id=>nodeSVG(id,{fill:COL.stable,r:12})).join("");

  return svgWrap(`${extraEdge}${extraNode}${beNeighborEdges}${beNeighborNodes}${feeds}${others}${target}`, "0 0 400 300");
}

/* 8. PASSIVE RECOVERY */
function diagramRecovery(){
  const netG = `<g transform="translate(14,10) scale(0.78)">
    ${allEdgesSVG()}
    ${Object.keys(NET.nodes).filter(id=>id!=="PF").map(id=>nodeSVG(id,{fill:COL.stable,r:12})).join("")}
    <circle cx="${NET.nodes.PF.x}" cy="${NET.nodes.PF.y}" r="16" fill="${COL.hub}">
      <animate attributeName="fill" values="${COL.hub};${COL.stable};${COL.hub}" dur="2.6s" repeatCount="indefinite"/>
      <animate attributeName="r" values="15;17;15" dur="2.6s" repeatCount="indefinite"/>
    </circle>
    <text x="${NET.nodes.PF.x}" y="${NET.nodes.PF.y+3.5}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" font-weight="700" fill="#0F1319">PF</text>
  </g>`;
  const readout = cornerReadout("+r_v per wave", COL.stable, "2.6s", true);
  const chart = `<g transform="translate(272,196)">
    ${insetPanel(0,0,118,96)}
    <line x1="16" y1="10" x2="16" y2="76" stroke="${COL.dim}"/>
    <line x1="16" y1="76" x2="104" y2="76" stroke="${COL.dim}"/>
    <text x="12" y="14" text-anchor="end" font-family="IBM Plex Mono" font-size="7" fill="${COL.text}">1</text>
    <text x="12" y="78" text-anchor="end" font-family="IBM Plex Mono" font-size="7" fill="${COL.text}">0</text>
    <path d="M16,60 L30,61 L38,54 L52,55 L60,48 L74,49 L82,42 L104,32" fill="none" stroke="${COL.stable}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="130" stroke-dashoffset="130">
      <animate attributeName="stroke-dashoffset" values="130;0;0;130" keyTimes="0;0.6;0.9;1" dur="3.6s" repeatCount="indefinite"/>
    </path>
    <text x="60" y="90" text-anchor="middle" font-family="IBM Plex Mono" font-size="7" fill="${COL.text}">S(t)</text>
  </g>`;
  return svgWrap(netG+readout+chart, "0 0 400 300");
}

/* 9. TOLERANCE (ε) */
function diagramTolerance(){
  return svgWrap(`
  <path d="M20,150 C60,60 90,240 130,110 C160,20 190,220 220,140 C250,90 270,160 300,150 C320,148 340,150 360,150"
    fill="none" stroke="${COL.policy}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="300" y1="150" x2="360" y2="150" stroke="${COL.stable}" stroke-width="3"/>
  <circle cx="360" cy="150" r="6" fill="${COL.stable}" filter="url(#glow)"/>
  <text x="330" y="130" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="${COL.stable}">stop (ε reached)</text>
  <text x="90" y="40" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="${COL.text}">changes still large</text>
  `, "0 0 400 260");
}

/* 10. INTERVENTION + BOOST */
function diagramIntervention(){
  const netG = `<g transform="translate(10,58) scale(0.66)">
    ${allEdgesSVG()}
    ${Object.keys(NET.nodes).filter(id=>id!=="PF").map(id=>nodeSVG(id,{fill:COL.stable,r:12})).join("")}
    <circle cx="${NET.nodes.PF.x}" cy="${NET.nodes.PF.y}" r="17" fill="${COL.stress}">
      <animate attributeName="fill" values="${COL.stress};${COL.stress};${COL.policy};${COL.stable};${COL.stable}" keyTimes="0;0.35;0.55;0.75;1" dur="3.8s" repeatCount="indefinite"/>
    </circle>
    <text x="${NET.nodes.PF.x}" y="${NET.nodes.PF.y+4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" font-weight="700" fill="#0F1319">PF</text>
  </g>`;

  const PFscaled = { x: 10 + NET.nodes.PF.x*0.66, y: 58 + NET.nodes.PF.y*0.66 };
  const aid = `
    <g transform="translate(${PFscaled.x},${PFscaled.y-46})">
      <rect x="-13" y="-9" width="26" height="18" rx="4" fill="${COL.policy}" opacity="0.18" stroke="${COL.policy}" stroke-width="2"/>
      <rect x="-5" y="-12" width="10" height="5" rx="2" fill="none" stroke="${COL.policy}" stroke-width="2"/>
      <path d="M-6,0 H6 M0,-6 V6" stroke="${COL.policy}" stroke-width="2.5" stroke-linecap="round"/>
      <animate attributeName="transform" values="translate(${PFscaled.x},${PFscaled.y-50});translate(${PFscaled.x},${PFscaled.y-42});translate(${PFscaled.x},${PFscaled.y-50})" dur="1.6s" repeatCount="indefinite"/>
    </g>
    <text x="${PFscaled.x}" y="${PFscaled.y-62}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" font-weight="600" fill="${COL.policy}">external aid</text>`;

  const chart = `<g transform="translate(238,188)">
    ${insetPanel(-10,-10,150,104)}
    <line x1="6" y1="2" x2="6" y2="72" stroke="${COL.dim}"/>
    <line x1="6" y1="72" x2="126" y2="72" stroke="${COL.dim}"/>
    <path d="M6,12 L30,42 L54,62 L78,70 L102,74 L126,76" fill="none" stroke="${COL.stress}" stroke-width="2" stroke-linecap="round"/>
    <path d="M6,12 L30,38 L54,40 L78,30 L102,22 L126,18" fill="none" stroke="${COL.stable}" stroke-width="2" stroke-linecap="round"/>
    <text x="104" y="58" text-anchor="middle" font-family="IBM Plex Mono" font-size="7.2" font-weight="600" fill="${COL.stress}">weak: iᵥ=0.015</text>
    <text x="124" y="12" text-anchor="end" font-family="IBM Plex Mono" font-size="7.2" fill="${COL.stable}">strong: iᵥ=0.018</text>
    <text x="60" y="88" text-anchor="middle" font-family="IBM Plex Mono" font-size="7.2" fill="${COL.text}">weak vs. strong boost</text>
  </g>`;

  return svgWrap(netG+aid+chart, "0 0 400 300");
}

/* SLIDE DATA */
export const SIMULATION_SLIDES_DATA: SimulationSlideItem[] = [
{
  id:"title", kind:"title",
  html:`
    <div class="title-badge">A plain-language walkthrough</div>
    <h1>How the URSA Simulation<br>Thinks About <span>Risk & Recovery</span></h1>
    <p class="sub">Network concepts, explained without the math — for anyone who needs to read the model's output and trust its logic.</p>
    <button class="startbtn" onclick="go(1)">Start walkthrough
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg>
    </button>
  `,
  diagram: diagramTitle
},
{
  id:"stability", tab:"Stability",
  eyebrow:"Concept",
  h2:"Node Stability — the health score",
  lede:"Every part of the city system — Public Finance, Energy, Healthcare, and so on — carries a running <b>stability score from 0 to 1</b>, shown here directly on each node and color-graded from red (fragile) to green (healthy).",
  callout:[
    {cls:"low", label:"Near 0.0", text:"Red. The function is failing or has broken down."},
    {cls:"high", label:"Near 1.0", text:"Green. Operating exactly as expected, no stress present."}
  ],
  analogy:"<b>Think of it like a credit score</b> for each part of the city — it drifts toward red under pressure and back toward green with support.",
  diagram: diagramStability
},
{
  id:"shock", tab:"Shock",
  eyebrow:"Concept",
  h2:"Shock — the initial hit",
  lede:"A shock is a sudden disruption injected into one or more starting nodes — here, a tariff striking <span class=\"mono\">Public Finance (PF)</span>. Its stability score drops immediately — shown as a readout in the corner and as the first fall in its trend line.",
  analogy:"<b>Business analogy:</b> a sudden supply-chain disruption landing on one department. The real question the simulation answers is whether it stays contained — or spreads to everything connected to it.",
  diagram: diagramShock
},
{
  id:"waves", tab:"Waves (T)",
  eyebrow:"Concept",
  h2:"Simulation Waves — the clock, in steps (T)",
  lede:"The model doesn't run in real minutes or days — it runs in discrete rounds called <b>waves</b>. Pulling one node's score out of the network and tracking it over time is exactly what a wave-by-wave chart shows: its stability trajectory, checkpoint by checkpoint.",
  callout:[
    {cls:"low", label:"Low T", text:"Only the short-term reaction is visible — a quick snapshot."},
    {cls:"high", label:"High T", text:"Enough time to see whether the system stabilizes, recovers, or fully collapses."}
  ],
  analogy:"<b>Business analogy:</b> like reviewing quarterly checkpoints after a crisis, rather than watching every single hour.",
  diagram: diagramWaves
},
{
  id:"intensity", tab:"Shock Intensity",
  eyebrow:"Parameter",
  h2:"Shock Intensity (δ_v)",
  lede:"How hard a specific node is hit at the start, expressed as a percentage drop in its stability — the size of the initial blow, before any spreading happens.",
  callout:[
    {cls:"low", label:"Low δ_v", text:"A minor disruption — usually absorbed without major consequences."},
    {cls:"high", label:"High δ_v", text:"A severe disruption — far more likely to trigger cascading failures elsewhere."}
  ],
  analogy:"<b>Business analogy:</b> the size of the initial financial hit — a 20% revenue dip versus an 80% revenue collapse.",
  diagram: diagramIntensity
},
{
  id:"threshold", tab:"Threshold (θ)",
  eyebrow:"Parameter",
  h2:"Failure Threshold (θ) — a stability-first view",
  lede:"Start from a node's own stability. A shock only <b>reduces</b> it if the incoming stress exceeds the node's threshold θ. A small hit below θ is absorbed and stability holds steady; a large hit above θ pushes stability sharply down.",
  callout:[
    {cls:"low", label:"Below θ", text:"Absorbed. The node's stability score doesn't move."},
    {cls:"high", label:"Above θ", text:"Failure. Stability drops immediately once θ is exceeded."}
  ],
  analogy:"<b>Business analogy:</b> a department's buffer capacity — cash reserves, backup staff, spare inventory — that lets it absorb shocks up to a point before showing visible strain.",
  diagram: diagramThreshold
},
{
  id:"centrality", tab:"Dampening (γ)",
  eyebrow:"Parameter",
  h2:"Centrality Dampening (γ)",
  lede:"Every neighbor sends the same kind of signal — its own (1 − stability). But the <b>edge</b> it travels through decides how much of that signal actually lands. A high-betweenness edge (a bridge many paths rely on) delivers a much bigger dose than a peripheral one.",
  callout:[
    {cls:"low", label:"Low γ", text:"Edge importance barely matters — every connection delivers a similar effect."},
    {cls:"high", label:"High γ", text:"Bridge edges dominate — the same stress hits far harder through a hub connection."}
  ],
  analogy:"<b>Business analogy:</b> the same bad news lands very differently depending on whether it comes from a peripheral contact or your most connected executive.",
  diagram: diagramCentrality
},
{
  id:"recovery", tab:"Recovery (r_v)",
  eyebrow:"Parameter",
  h2:"Passive Recovery (r_v)",
  lede:"A small, automatic healing rate — every node quietly regains a bit of stability each wave, even with no outside help, seen here as a steady step-wise climb.",
  callout:[
    {cls:"low", label:"Low r_v", text:"Slow natural recovery — the system stays wounded for longer."},
    {cls:"high", label:"High r_v", text:"Faster natural healing — the system bounces back on its own more quickly."}
  ],
  analogy:"<b>Business analogy:</b> natural organizational resilience — a team's built-in ability to self-correct over time without management stepping in.",
  diagram: diagramRecovery
},
{
  id:"tolerance", tab:"Tolerance (ε)",
  eyebrow:"Parameter",
  h2:"Tolerance (ε) — when to stop",
  lede:"A stopping rule for the simulation. Once stability scores stop changing meaningfully from one wave to the next, the model considers the system settled and halts.",
  analogy:"<b>Not a policy lever</b> — just a technical setting. It's like deciding a crisis is \"over\" once weekly changes become negligible, so there's no need to keep monitoring hour by hour.",
  diagram: diagramTolerance
},
{
  id:"intervention", tab:"Intervention & Boost",
  eyebrow:"Concept + Parameter",
  h2:"Interventions & the Boost (+i_v)",
  lede:"An intervention is external help arriving from outside the network and landing directly on a stressed node. Its <b>boost size (i_v)</b> decides whether that help fully contains the crisis or only delays it.",
  callout:[
    {cls:"low", label:"i_v = 0.015", text:"A smaller boost — only delays the failure. The system still collapses, just later."},
    {cls:"high", label:"i_v = 0.018", text:"A slightly larger boost — nearly halts the cascade and preserves stability."}
  ],
  analogy:"<b>Business analogy:</b> the size of a bailout — too small only postpones the crisis; the right size can prevent it outright. This is why precision matters near tipping points.",
  diagram: diagramIntervention
}
];

// -------------------------------------------------------------
// REACT SIMULATION CONCEPTS DECK COMPONENT
// -------------------------------------------------------------

export interface SimulationConceptsDeckProps {
  initialSlideIndex?: number;
  onSlideChange?: (index: number) => void;
}

export default function SimulationConceptsDeck({
  initialSlideIndex = 0,
  onSlideChange,
}: SimulationConceptsDeckProps) {
  const [current, setCurrent] = useState<number>(initialSlideIndex);
  const [viewMode, setViewMode] = useState<"walkthrough" | "all">("walkthrough");

  const total = SIMULATION_SLIDES_DATA.length;
  const currentSlide = SIMULATION_SLIDES_DATA[current] || SIMULATION_SLIDES_DATA[0];

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < total) {
        setCurrent(index);
        onSlideChange?.(index);
      }
    },
    [total, onSlideChange]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== "walkthrough") return;
      if (e.key === "ArrowRight") {
        goTo(Math.min(total - 1, current + 1));
      } else if (e.key === "ArrowLeft") {
        goTo(Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, total, goTo, viewMode]);

  const progressPercent = (current / (total - 1)) * 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-300" id="simulation-concepts-deck-root">
      {/* Top Controller Bar */}
      <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F2643C] shadow-[0_0_8px_#F2643C] animate-pulse" />
          <span className="font-bold text-sm text-[#F1F3F5] tracking-tight">
            URSA Simulation Concepts
          </span>
          <span className="text-xs text-[#A6A7AB] font-mono hidden md:inline">
            • Plain-language walkthrough & mathematical formulations
          </span>
        </div>

        {/* View Mode Controls & Standalone Link */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1E1F23] p-1 rounded-xl border border-[#42454E]">
            <button
              onClick={() => setViewMode("walkthrough")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "walkthrough"
                  ? "bg-[#383A42] text-[#F1F3F5] shadow-xs"
                  : "text-[#A6A7AB] hover:text-[#F1F3F5]"
              }`}
            >
              <Play size={13} className={viewMode === "walkthrough" ? "text-[#4ED9A0]" : ""} />
              <span>Interactive Walkthrough</span>
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "all"
                  ? "bg-[#383A42] text-[#F1F3F5] shadow-xs"
                  : "text-[#A6A7AB] hover:text-[#F1F3F5]"
              }`}
            >
              <LayoutGrid size={13} className={viewMode === "all" ? "text-[#6C8CFF]" : ""} />
              <span>All Concepts</span>
            </button>
          </div>

          <a
            href="/simulation-concepts.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-[#1E1F23] hover:bg-[#383A42] text-[#A6A7AB] hover:text-[#F1F3F5] rounded-xl border border-[#42454E] text-xs font-medium flex items-center gap-1.5 transition-all"
            title="Open original standalone presentation in new tab"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Fullscreen</span>
          </a>
        </div>
      </div>

      {viewMode === "walkthrough" ? (
        /* ==================== WALKTHROUGH MODE ==================== */
        <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] overflow-hidden shadow-md flex flex-col">
          {/* Horizontal Tabs Bar */}
          <div className="px-4 py-3 bg-[#2E3036] border-b border-[#42454E] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {SIMULATION_SLIDES_DATA.map((s, idx) => {
              const isActive = idx === current;
              return (
                <button
                  key={s.id}
                  onClick={() => goTo(idx)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-[#EDEBE6] text-[#25262B] font-bold shadow-xs"
                      : "text-[#A6A7AB] hover:text-[#EDEBE6] hover:bg-white/5"
                  }`}
                >
                  <span className={`font-mono text-[10px] ${isActive ? "text-[#25262B]" : "opacity-70"}`}>
                    {String(idx).padStart(2, "0")}
                  </span>
                  <span>{s.tab || "Intro"}</span>
                </button>
              );
            })}
          </div>

          {/* Progress bar line */}
          <div className="h-[2px] bg-[#42454E] w-full">
            <div
              className="h-full bg-gradient-to-r from-[#4ED9A0] via-[#F5C24C] to-[#F2643C] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Active Slide Body */}
          <div className="p-6 sm:p-10 min-h-[460px] flex items-center justify-center">
            {currentSlide.kind === "title" ? (
              /* Title / Intro Slide */
              <div className="max-w-2xl mx-auto text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-full max-w-[500px] h-[260px] sm:h-[300px] mx-auto bg-[#25262B] rounded-2xl border border-[#42454E] p-2 flex items-center justify-center overflow-hidden shadow-inner">
                  <div
                    className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: currentSlide.diagram() }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="inline-block font-mono text-xs text-[#A6A7AB] uppercase tracking-widest">
                    A plain-language walkthrough
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-bold text-[#F1F3F5] tracking-tight leading-tight">
                    How the URSA Simulation<br />
                    Thinks About <span className="text-[#F2643C]">Risk & Recovery</span>
                  </h1>
                  <p className="text-sm text-[#A6A7AB] max-w-lg mx-auto leading-relaxed">
                    Network concepts, explained without the math — for anyone who needs to read the model's output and trust its logic.
                  </p>
                </div>

                <div>
                  <button
                    onClick={() => goTo(1)}
                    className="inline-flex items-center gap-2 bg-[#EDEBE6] hover:bg-white text-[#25262B] px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer"
                  >
                    <span>Start walkthrough</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* Concept / Parameter Slide (Two Columns) */
              <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
                {/* Visual Frame */}
                <div className="lg:col-span-6 w-full">
                  <div className="w-full h-[280px] sm:h-[360px] bg-[#25262B] border border-[#42454E] rounded-2xl p-2 flex items-center justify-center relative overflow-hidden shadow-inner">
                    <div
                      className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: currentSlide.diagram() }}
                    />
                  </div>
                </div>

                {/* Text Content Column */}
                <div className="lg:col-span-6 space-y-5 text-left">
                  {/* Eyebrow */}
                  <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#A6A7AB]">
                    <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-2 py-0.5 rounded-md text-[11px]">
                      {String(current).padStart(2, "0")}
                    </span>
                    <span>{currentSlide.eyebrow}</span>
                  </div>

                  {/* Heading */}
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#F1F3F5] tracking-tight leading-snug">
                    {currentSlide.h2}
                  </h2>

                  {/* Lede Explanation */}
                  <p
                    className="text-sm sm:text-[15px] text-[#D0D3D7] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: currentSlide.lede || "" }}
                  />

                  {/* Callout Chips (if present) */}
                  {currentSlide.callout && currentSlide.callout.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {currentSlide.callout.map((c, cIdx) => (
                        <div
                          key={cIdx}
                          className="bg-[#25262B] border border-[#42454E] rounded-xl p-3.5 space-y-1"
                        >
                          <div
                            className={`font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                              c.cls === "low" ? "text-[#4ED9A0]" : "text-[#F2643C]"
                            }`}
                          >
                            <span>{c.cls === "low" ? "▼" : "▲"}</span>
                            <span>{c.label}</span>
                          </div>
                          <p className="text-xs text-[#D0D3D7] leading-relaxed m-0">
                            {c.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Analogy Box (if present) */}
                  {currentSlide.analogy && (
                    <div
                      className="border-l-2 border-[#6C8CFF] bg-[#6C8CFF]/10 rounded-r-xl p-3.5 text-xs sm:text-sm text-[#D6DAE2] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: currentSlide.analogy }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Navigation Bar */}
          <div className="px-6 py-4 bg-[#25262B] border-t border-[#42454E] flex items-center justify-between gap-4">
            <button
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="w-10 h-10 rounded-full border border-[#42454E] bg-[#2E3036] hover:bg-[#383A42] text-[#EDEBE6] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2 font-mono text-xs text-[#A6A7AB]">
              <span className="font-bold text-[#F1F3F5] text-sm">
                {String(current).padStart(2, "0")}
              </span>
              <span>/</span>
              <span>{String(total - 1).padStart(2, "0")}</span>
            </div>

            <button
              onClick={() => goTo(current + 1)}
              disabled={current === total - 1}
              className="w-10 h-10 rounded-full border border-[#42454E] bg-[#2E3036] hover:bg-[#383A42] text-[#EDEBE6] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : (
        /* ==================== ALL 10 CONCEPTS GRID VIEW ==================== */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {SIMULATION_SLIDES_DATA.map((s, idx) => (
              <div
                key={s.id}
                className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 shadow-xs hover:border-[#565A66] transition-all grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
              >
                {/* Visual */}
                <div className="lg:col-span-5 h-[240px] bg-[#25262B] border border-[#42454E] rounded-xl p-2 flex items-center justify-center overflow-hidden">
                  <div
                    className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: s.diagram() }}
                  />
                </div>

                {/* Content */}
                <div className="lg:col-span-7 space-y-3.5 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#A6A7AB]">
                      <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-2 py-0.5 rounded-md text-[11px]">
                        {String(idx).padStart(2, "0")}
                      </span>
                      <span>{s.eyebrow || "Overview"}</span>
                    </div>

                    <button
                      onClick={() => {
                        goTo(idx);
                        setViewMode("walkthrough");
                      }}
                      className="text-xs font-mono text-[#6C8CFF] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Jump to Slide</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  <h3 className="text-xl font-bold text-[#F1F3F5]">
                    {s.kind === "title" ? "How the URSA Simulation Thinks About Risk & Recovery" : s.h2}
                  </h3>

                  <p
                    className="text-xs text-[#D0D3D7] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: s.lede || "Network concepts, explained without the math — for anyone who needs to read the model's output and trust its logic." }}
                  />

                  {s.callout && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {s.callout.map((c, cIdx) => (
                        <div key={cIdx} className="bg-[#25262B] border border-[#42454E] rounded-lg p-2.5 space-y-0.5">
                          <div className={`font-mono text-[9px] font-bold uppercase ${c.cls === "low" ? "text-[#4ED9A0]" : "text-[#F2643C]"}`}>
                            {c.label}
                          </div>
                          <p className="text-[11px] text-[#D0D3D7] m-0">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.analogy && (
                    <div
                      className="border-l-2 border-[#6C8CFF] bg-[#6C8CFF]/10 rounded-r-lg p-2.5 text-xs text-[#D6DAE2]"
                      dangerouslySetInnerHTML={{ __html: s.analogy }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
