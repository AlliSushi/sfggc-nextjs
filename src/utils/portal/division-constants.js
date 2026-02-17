const DIVISION_LABELS = {
  A: "Division A",
  B: "Division B",
  C: "Division C",
  D: "Division D",
  E: "Division E",
};
const DIVISION_ORDER = Object.keys(DIVISION_LABELS);

const DIVISION_THRESHOLDS = [
  { division: "A", minAverage: 208 },
  { division: "B", minAverage: 190 },
  { division: "C", minAverage: 170 },
  { division: "D", minAverage: 150 },
  { division: "E", minAverage: 0 },
];

const getDivisionFromAverage = (average) => {
  if (average === null || average === undefined || average === "") return null;
  const parsed = Number(average);
  if (!Number.isFinite(parsed)) return null;

  const match = DIVISION_THRESHOLDS.find(({ minAverage }) => parsed >= minAverage);
  return match?.division || null;
};

export { DIVISION_LABELS, DIVISION_ORDER, DIVISION_THRESHOLDS, getDivisionFromAverage };
