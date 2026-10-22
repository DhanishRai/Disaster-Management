const LIFE_SAFETY_POINTS = 35;
const URGENT_NEED_POINTS = 20;
const AFFECTED_PEOPLE_POINTS = 20;
const TIME_SENSITIVE_POINTS = 15;
const CORROBORATION_POINTS = 10;

const urgentNeeds = new Set(["medical supplies", "medication", "clean water", "drinking water", "rescue", "evacuation support"]);
const isUrgentNeed = (need) => urgentNeeds.has(need.toLowerCase()) || /\b(boat|first aid|life vest|life jacket|rescue|evacuat)\b/i.test(need);
const lifeSafetyPatterns = [
  { pattern: /\b(trapped|stuck|stranded|can't get out|cannot get out)\b/i, value: "trapped" },
  { pattern: /\b(injur(?:ed|y)|bleeding|unconscious|not breathing|heart medication|urgent medication)\b/i, value: "medical" },
  { pattern: /\b(missing|separated from|lost child)\b/i, value: "missing persons" }
];
const needPatterns = [
  { pattern: /\b(boat|rescue|evacuat(?:e|ion)|life vest|life jacket)\b/i, value: "Rescue / evacuation" },
  { pattern: /\b(first aid|medical|medicine|medication|clinic|injur(?:ed|y))\b/i, value: "Medical support" },
  { pattern: /\b(clean water|drinking water|water supply|thirst)\b/i, value: "Clean water" },
  { pattern: /\b(food|meal|hungry|ration)\b/i, value: "Food" },
  { pattern: /\b(blanket|shelter|dry clothing|homeless)\b/i, value: "Shelter" },
  { pattern: /\b(generator|power|electricity|outage)\b/i, value: "Power" },
  { pattern: /\b(tree|road|blocked|access|clearance)\b/i, value: "Access / road clearance" }
];

export function scoreIncident(incident) {
  const lifeSafety = Array.isArray(incident.lifeSafety) ? incident.lifeSafety : [];
  const needs = Array.isArray(incident.needs) ? incident.needs : [];
  const conditions = Array.isArray(incident.conditions) ? incident.conditions : [];
  const people = Number.isFinite(Number(incident.people)) ? Math.max(0, Number(incident.people)) : 0;
  const corroborations = Number.isFinite(Number(incident.corroborations)) ? Math.max(0, Number(incident.corroborations)) : 0;

  const factors = [
    { label: "Immediate life-safety concern", detail: lifeSafety.length ? lifeSafety.join(", ") : "", points: lifeSafety.length ? LIFE_SAFETY_POINTS : 0 },
    { label: "Urgent essential needs reported", detail: needs.filter(isUrgentNeed).join(", "), points: needs.some(isUrgentNeed) ? URGENT_NEED_POINTS : 0 },
    { label: "People potentially affected", detail: people ? `${people} reported` : "Count not reported", points: people >= 25 ? AFFECTED_PEOPLE_POINTS : people >= 10 ? 12 : people > 0 ? 5 : 0 },
    { label: "Time-sensitive conditions", detail: conditions.join(", "), points: conditions.length ? TIME_SENSITIVE_POINTS : 0 },
    { label: "Independent corroboration", detail: corroborations ? `${corroborations} additional source${corroborations === 1 ? "" : "s"}` : "Not yet corroborated", points: Math.min(corroborations * 5, CORROBORATION_POINTS) }
  ];
  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));
  return {
    score,
    factors: factors.filter((factor) => factor.points > 0),
    tier: score >= 70 ? "Critical" : score >= 45 ? "High" : score >= 20 ? "Review" : "Monitor"
  };
}

export function confidenceFor(incident) {
  if (incident.confidence && ["High", "Medium", "Low"].includes(incident.confidence)) return incident.confidence;
  const rawLength = typeof incident.rawText === "string" ? incident.rawText.trim().length : 0;
  const corroborations = Number.isFinite(Number(incident.corroborations)) ? Number(incident.corroborations) : 0;
  if (rawLength >= 80 && corroborations >= 2) return "High";
  if (rawLength >= 35 || corroborations > 0) return "Medium";
  return "Low";
}

export function parseReport(rawText) {
  const text = rawText.trim();
  const lifeSafety = lifeSafetyPatterns.filter(({ pattern }) => pattern.test(text)).map(({ value }) => value);
  const needs = needPatterns.filter(({ pattern }) => pattern.test(text)).map(({ value }) => value);
  const conditions = [];
  if (/\b(rising|fast|rapidly|up to the windows|water is up)\b/i.test(text)) conditions.push("Rising water");
  if (/\b(dark|nightfall|before dark)\b/i.test(text)) conditions.push("Nightfall approaching");
  if (/\b(no power|power out|power outage|generator)\b/i.test(text)) conditions.push("Power outage");
  const corroborations = /\b(neighbor|confirmed|confirm(?:s|ed)?|multiple reports|staff report)\b/i.test(text) ? 1 : 0;
  const detailCount = [lifeSafety.length, needs.length, /\b\d+\b/.test(text), /\b(in|at|near|behind|by)\b/i.test(text)].filter(Boolean).length;
  const confidence = detailCount >= 3 && corroborations ? "High" : detailCount >= 2 ? "Medium" : "Low";
  const category = lifeSafety.length || needs.includes("Rescue / evacuation")
    ? "Rescue"
    : needs.includes("Medical support")
      ? "Medical"
      : needs.includes("Shelter")
        ? "Shelter"
        : needs.includes("Access / road clearance")
          ? "Access"
          : needs.includes("Power")
            ? "Utilities"
            : "Supplies";

  return { lifeSafety, needs, conditions, corroborations, confidence, category };
}

export function recommendationReason(incident) {
  const { factors } = scoreIncident(incident);
  if (!factors.length) return "No immediate risk signals identified. Verify the report and check for unreported needs.";
  const reasons = factors.slice(0, 2).map((factor) => factor.label.toLowerCase());
  return `Suggested because of ${reasons.join(" and ")}. Confirm details and local access before dispatch.`;
}
