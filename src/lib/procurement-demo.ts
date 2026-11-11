export const indexedFiles = [
  { name: "AMCOR_Paper_Supplier_Contract.pdf", kind: "PDF", size: "2.4 MB", detail: "Supplier contract" },
  { name: "Email_Log_PlasticsCorp.eml", kind: "EML", size: "846 KB", detail: "Email correspondence" },
  { name: "Q3_Vendor_Spend.xlsx", kind: "XLSX", size: "1.2 MB", detail: "Spend analysis" },
];

export const team = [
  { name: "Sarah", initials: "SJ", expertise: "Packaging expert", workload: "Low", capacity: 24, tone: "green" },
  { name: "Mike", initials: "MT", expertise: "Plastics expert", workload: "High", capacity: 86, tone: "amber" },
  { name: "David", initials: "DC", expertise: "Logistics expert", workload: "Medium", capacity: 52, tone: "blue" },
] as const;

export const allocations = [
  { task: "AMCOR renewal", buyer: "Sarah", initials: "SJ", rationale: "Matches packaging expertise; buyer has highest available capacity.", tone: "green" },
  { task: "Plastics rate", buyer: "Mike", initials: "MT", rationale: "Overrides high workload constraint due to critical plastics supplier relationship history.", tone: "amber" },
  { task: "Shipping delay", buyer: "David", initials: "DC", rationale: "Direct match for logistics expertise.", tone: "blue" },
] as const;

export function getAmcorTerms(question: string) {
  const normalized = question.toLowerCase();
  if (!normalized.includes("amcor") || !normalized.includes("discount")) return null;
  return { discountPercent: 15, unitThreshold: 10000, accountManager: "Sarah Jenkins", source: "AMCOR_Paper_Supplier_Contract.pdf" };
}

export function getDemoAnswer(question: string) {
  const terms = getAmcorTerms(question);
  return terms
    ? `Based on ${terms.source}, we have a ${terms.discountPercent}% volume discount applied to all orders over ${terms.unitThreshold.toLocaleString("en-US")} units. The primary account manager is ${terms.accountManager}.`
    : "This demo currently includes AMCOR volume discount terms. Ask ‘What is our volume discount with AMCOR?’ to retrieve the supported contract details.";
}