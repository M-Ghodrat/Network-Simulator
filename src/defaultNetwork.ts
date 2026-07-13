import { Domain, NodeIndicator, Edge } from "./types";

export const DEFAULT_DOMAINS: Domain[] = [
  { id: "1", name: "Critical Infrastructure" },
  { id: "2", name: "Economics" },
  { id: "3", name: "Environment" },
  { id: "4", name: "Health & Well-being" },
  { id: "5", name: "Institutional" },
  { id: "6", name: "Leadership & Strategy" },
  { id: "7", name: "Social & Demographic" }
];

export const FULL_NAME_TO_ABBR: Record<string, string> = {
  "Built Infrastructure": "BI",
  "Digital Infrastructure": "DI",
  "Effective Provision of Critical Services": "CR",
  "Energy": "EN",
  "Transportation": "TN",
  "Water": "WR",
  "Budget and Subsidy": "BS",
  "Business Environment": "BE",
  "Diverse Livelihood and Employment": "DL",
  "Economic Robustness": "ER",
  "Finance and Savings": "FS",
  "Households Assets": "HA",
  "Human Capital": "HC",
  "Income": "IN",
  "Innovation and Entrepreneurship": "IE",
  "Public Finance": "PF",
  "Air Quality": "AQ",
  "Decarbonization": "DC",
  "Environment and Ecology": "EE",
  "Flooding": "FL",
  "Green Infrastructure": "GI",
  "Heat Stress": "HS",
  "Land Use": "LU",
  "Waste Management": "WM",
  "Waste management": "WM",
  "Access to Quality Healthcare": "QH",
  "Emergency Medical Care": "EM",
  "Minimal Human Vulnerability": "HV",
  "Public Health": "PH",
  "Education": "ED",
  "Inclusivity and Involvement": "II",
  "Institutional Collaboration": "IC",
  "Knowledge Dissemination and Management": "KD",
  "Rule of Law": "RL",
  "Disaster Management": "DM",
  "Good Governance": "GG",
  "Integrated Development Planning": "ID",
  "Community Engagement and Preparedness": "CE",
  "Community Engagement & Preparedness": "CE",
  "Comprehensive Social Security": "CS",
  "Population": "PN",
  "Social Cohesion": "SC"
};

export const DEFAULT_NODES: NodeIndicator[] = [
  { id: "BI", abbr: "BI", full_name: "Built Infrastructure", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },
  { id: "DI", abbr: "DI", full_name: "Digital Infrastructure", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },
  { id: "CR", abbr: "CR", full_name: "Effective Provision of Critical Services", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },
  { id: "EN", abbr: "EN", full_name: "Energy", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },
  { id: "TN", abbr: "TN", full_name: "Transportation", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },
  { id: "WR", abbr: "WR", full_name: "Water", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },
  { id: "BS", abbr: "BS", full_name: "Budget and Subsidy", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "BE", abbr: "BE", full_name: "Business Environment", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "DL", abbr: "DL", full_name: "Diverse Livelihood and Employment", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "ER", abbr: "ER", full_name: "Economic Robustness", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "FS", abbr: "FS", full_name: "Finance and Savings", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "HA", abbr: "HA", full_name: "Households Assets", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "HC", abbr: "HC", full_name: "Human Capital", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "IN", abbr: "IN", full_name: "Income", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "IE", abbr: "IE", full_name: "Innovation and Entrepreneurship", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "PF", abbr: "PF", full_name: "Public Finance", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "AQ", abbr: "AQ", full_name: "Air Quality", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "DC", abbr: "DC", full_name: "Decarbonization", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "LU", abbr: "LU", full_name: "Land Use", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "GI", abbr: "GI", full_name: "Green Infrastructure", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "WM", abbr: "WM", full_name: "Waste Management", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "EE", abbr: "EE", full_name: "Environment and Ecology", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "FL", abbr: "FL", full_name: "Flooding", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "HS", abbr: "HS", full_name: "Heat Stress", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "QH", abbr: "QH", full_name: "Access to Quality Healthcare", domain_id: "4", theta: 0.2, recovery_rate: 0.05 },
  { id: "EM", abbr: "EM", full_name: "Emergency Medical Care", domain_id: "4", theta: 0.2, recovery_rate: 0.05 },
  { id: "HV", abbr: "HV", full_name: "Minimal Human Vulnerability", domain_id: "4", theta: 0.2, recovery_rate: 0.05 },
  { id: "PH", abbr: "PH", full_name: "Public Health", domain_id: "4", theta: 0.2, recovery_rate: 0.05 },
  { id: "ED", abbr: "ED", full_name: "Education", domain_id: "5", theta: 0.2, recovery_rate: 0.05 },
  { id: "II", abbr: "II", full_name: "Inclusivity and Involvement", domain_id: "5", theta: 0.2, recovery_rate: 0.05 },
  { id: "IC", abbr: "IC", full_name: "Institutional Collaboration", domain_id: "5", theta: 0.2, recovery_rate: 0.05 },
  { id: "KD", abbr: "KD", full_name: "Knowledge Dissemination and Management", domain_id: "5", theta: 0.2, recovery_rate: 0.05 },
  { id: "RL", abbr: "RL", full_name: "Rule of Law", domain_id: "5", theta: 0.2, recovery_rate: 0.05 },
  { id: "DM", abbr: "DM", full_name: "Disaster Management", domain_id: "6", theta: 0.2, recovery_rate: 0.05 },
  { id: "GG", abbr: "GG", full_name: "Good Governance", domain_id: "6", theta: 0.2, recovery_rate: 0.05 },
  { id: "ID", abbr: "ID", full_name: "Integrated Development Planning", domain_id: "6", theta: 0.2, recovery_rate: 0.05 },
  { id: "CE", abbr: "CE", full_name: "Community Engagement & Preparedness", domain_id: "7", theta: 0.2, recovery_rate: 0.05 },
  { id: "CS", abbr: "CS", full_name: "Comprehensive Social Security", domain_id: "7", theta: 0.2, recovery_rate: 0.05 },
  { id: "PN", abbr: "PN", full_name: "Population", domain_id: "7", theta: 0.2, recovery_rate: 0.05 },
  { id: "SC", abbr: "SC", full_name: "Social Cohesion", domain_id: "7", theta: 0.2, recovery_rate: 0.05 }
];

export const DEFAULT_CSV_DATA = `,1-Built Infrastructure,1-Digital Infrastructure,1-Effective Provision of Critical Services,1-Energy,1-Transportation,1-Water,2-Budget and Subsidy,2-Business Environment,2-Diverse Livelihood and Employment,2-Economic Robustness,2-Finance and Savings,2-Households Assets,2-Human Capital,2-Income,2-Innovation and Entrepreneurship,2-Public Finance,3-Air Quality,3-Decarbonization,3-Land Use,3-Green Infrastructure,3-Waste management,3-Environment and Ecology,3-Flooding,3-Heat Stress,4-Access to Quality Healthcare,4-Emergency Medical Care,4-Minimal Human Vulnerability,4-Public Health,5-Education,5-Inclusivity and Involvement,5-Institutional Collaboration,5-Knowledge Dissemination and Management,5-Rule of Law,6-Disaster Management,6-Good Governance,6-Integrated Development Planning,7-Community Engagement & Preparedness,7-Comprehensive Social Security,7-Population,7-Social Cohesion
1-Built Infrastructure,0,1,1,1,1,1,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,1,0,0,0,0,0,1
1-Digital Infrastructure,1,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
1-Effective Provision of Critical Services,1,0,0,1,1,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1,1,0,1,1,0,0,1,0,1,0,0,0,0,0,0
1-Energy,1,1,1,0,1,1,0,1,1,1,0,0,0,1,1,1,1,1,1,1,1,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,1,0,1
1-Transportation,1,1,1,1,0,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0
1-Water,0,0,1,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0
2-Budget and Subsidy,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0
2-Business Environment,0,0,0,0,0,0,0,0,1,1,1,1,0,1,0,1,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0
2-Diverse Livelihood and Employment,0,0,0,0,0,0,1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0
2-Economic Robustness,0,0,0,0,0,0,1,1,1,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1
2-Finance and Savings,0,0,0,0,0,0,1,1,1,1,0,1,1,1,0,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0
2-Households Assets,0,0,0,0,0,0,1,0,0,1,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0
2-Human Capital,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0
2-Income,0,0,0,0,0,0,1,1,0,1,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0
2-Innovation and Entrepreneurship,0,0,0,0,0,0,1,0,1,1,0,1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0
2-Public Finance,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,1
3-Air Quality,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1
3-Decarbonization,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
3-Land Use,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1
3-Green Infrastructure,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,1,1,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0
3-Waste management,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
3-Environment and Ecology,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
3-Flooding,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0
3-Heat Stress,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
4-Access to Quality Healthcare,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0
4-Emergency Medical Care,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0
4-Minimal Human Vulnerability,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0
4-Public Health,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0
5-Education,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,1,1,1,1,0,0,0,0,0,0,0
5-Inclusivity and Involvement,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,1,0,0,0,0,0,0,0
5-Institutional Collaboration,0,0,0,1,0,0,0,1,1,0,1,1,0,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,0,1,1,1,0,0,0,0,1,1
5-Knowledge Dissemination and Management,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,1,0,1,0,0,1,0,1,1,0,0,1,1,1,0,1,1,0,0,1,0,0,0
5-Rule of Law,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,0,0
6-Disaster Management,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,1,0,1,0,1
6-Good Governance,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,1,1,0,1,0,0,0,1
6-Integrated Development Planning,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0
7-Community Engagement & Preparedness,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0
7-Comprehensive Social Security,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1
7-Population,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1
7-Social Cohesion,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0`;

export function parseDefaultEdges(): Edge[] {
  const lines = DEFAULT_CSV_DATA.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").slice(1).map(h => h.trim());
  const edges: Edge[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const rowHeaderRaw = cells[0].trim();
    
    // Parse row abbreviation
    const rowFull = rowHeaderRaw.split("-").slice(1).join("-").trim();
    const sourceAbbr = FULL_NAME_TO_ABBR[rowFull];

    if (!sourceAbbr) continue;

    for (let j = 1; j < cells.length; j++) {
      const colHeaderRaw = headers[j - 1];
      const colFull = colHeaderRaw.split("-").slice(1).join("-").trim();
      const targetAbbr = FULL_NAME_TO_ABBR[colFull];

      if (!targetAbbr) continue;

      const value = parseInt(cells[j].trim());
      if (value === 1) {
        edges.push({
          id: `${sourceAbbr}_to_${targetAbbr}`,
          source: sourceAbbr,
          target: targetAbbr
        });
      }
    }
  }

  return edges;
}



export const SIMPLE_DOMAINS: Domain[] = [
  { id: "1", name: "Domain 1" },
  { id: "2", name: "Domain 2" },
  { id: "3", name: "Domain 3" },
  { id: "4", name: "Domain 4" }
];

export const SIMPLE_NODES: NodeIndicator[] = [
  { id: "n1", abbr: "N1", full_name: "Indicator 1", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },
  { id: "n2", abbr: "N2", full_name: "Indicator 2", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },
  { id: "n3", abbr: "N3", full_name: "Indicator 3", domain_id: "1", theta: 0.2, recovery_rate: 0.05 },

  { id: "n4", abbr: "N4", full_name: "Indicator 4", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "n5", abbr: "N5", full_name: "Indicator 5", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "n6", abbr: "N6", full_name: "Indicator 6", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },
  { id: "n7", abbr: "N7", full_name: "Indicator 7", domain_id: "2", theta: 0.2, recovery_rate: 0.05 },

  { id: "n8", abbr: "N8", full_name: "Indicator 8", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "n9", abbr: "N9", full_name: "Indicator 9", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "n10", abbr: "N10", full_name: "Indicator 10", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },
  { id: "n11", abbr: "N11", full_name: "Indicator 11", domain_id: "3", theta: 0.2, recovery_rate: 0.05 },

  { id: "n12", abbr: "N12", full_name: "Indicator 12", domain_id: "4", theta: 0.2, recovery_rate: 0.05 },
  { id: "n13", abbr: "N13", full_name: "Indicator 13", domain_id: "4", theta: 0.2, recovery_rate: 0.05 },
  { id: "n14", abbr: "N14", full_name: "Indicator 14", domain_id: "4", theta: 0.2, recovery_rate: 0.05 },
  { id: "n15", abbr: "N15", full_name: "Indicator 15", domain_id: "4", theta: 0.2, recovery_rate: 0.05 },
  { id: "n16", abbr: "N16", full_name: "Indicator 16", domain_id: "4", theta: 0.2, recovery_rate: 0.05 }
];

export function parseSimpleEdges(): Edge[] {
  return [
    { id: "e1", source: "N1", target: "N2", weight: 1.0 },
    { id: "e2", source: "N2", target: "N3", weight: 1.0 },
    { id: "e3", source: "N3", target: "N4", weight: 1.0 },
    { id: "e4", source: "N4", target: "N5", weight: 1.0 },
    { id: "e5", source: "N5", target: "N6", weight: 1.0 },
    { id: "e6", source: "N6", target: "N7", weight: 1.0 },
    { id: "e7", source: "N7", target: "N8", weight: 1.0 },
    { id: "e8", source: "N8", target: "N9", weight: 1.0 },
    { id: "e9", source: "N9", target: "N10", weight: 1.0 },
    { id: "e10", source: "N10", target: "N11", weight: 1.0 },
    { id: "e11", source: "N11", target: "N12", weight: 1.0 },
    { id: "e12", source: "N12", target: "N13", weight: 1.0 },
    { id: "e13", source: "N13", target: "N14", weight: 1.0 },
    { id: "e14", source: "N14", target: "N15", weight: 1.0 },
    { id: "e15", source: "N15", target: "N16", weight: 1.0 },
    { id: "e16", source: "N16", target: "N1", weight: 1.0 }
  ];
}
