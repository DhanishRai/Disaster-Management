import test from "node:test";
import assert from "node:assert/strict";
import { confidenceFor, parseReport, recommendationReason, scoreIncident } from "../src/logic.js";

test("life-safety and urgent needs are surfaced in the score explanation", () => {
  const result = scoreIncident({
    lifeSafety: ["trapped"],
    needs: ["Boat", "Clean water"],
    conditions: ["Rising water"],
    people: 18,
    corroborations: 1
  });
  assert.equal(result.score, 87);
  assert.equal(result.tier, "Critical");
  assert.match(result.factors[0].label, /life-safety/);
});

test("missing or low-connectivity information never subtracts priority points", () => {
  const sparse = scoreIncident({ lifeSafety: [], needs: [], conditions: [], people: 0, corroborations: 0, signalGap: true });
  const fuller = scoreIncident({ lifeSafety: ["medical"], needs: ["Medication"], conditions: [], people: 1, corroborations: 0 });
  assert.equal(sparse.score, 0);
  assert.ok(fuller.score > sparse.score);
  assert.equal(sparse.factors.length, 0);
});

test("priority is capped at 100 and affected population cannot lower it", () => {
  const result = scoreIncident({ lifeSafety: ["trapped"], needs: ["Clean water"], conditions: ["Rising water"], people: 1000, corroborations: 20 });
  const small = scoreIncident({ lifeSafety: ["trapped"], needs: ["Clean water"], conditions: ["Rising water"], people: 1, corroborations: 20 });
  assert.equal(result.score, 100);
  assert.ok(result.score >= small.score);
});

test("messy free text yields reviewable suggestions", () => {
  const parsed = parseReport("URGENT — water is rising fast behind Riverside clinic. At least 18 people including children stuck on the second floor. Neighbor on phone, line keeps cutting. Need boat and medicine.");
  assert.deepEqual(parsed.lifeSafety, ["trapped"]);
  assert.deepEqual(parsed.needs, ["Rescue / evacuation", "Medical support"]);
  assert.ok(parsed.conditions.includes("Rising water"));
  assert.equal(parsed.confidence, "High");
  assert.equal(parsed.category, "Rescue");
});

test("confidence is independent of priority score and can use report evidence", () => {
  const incident = { rawText: "A detailed field report with specific location and several needs have been described.", corroborations: 0 };
  assert.equal(confidenceFor(incident), "Medium");
  assert.match(recommendationReason({ lifeSafety: ["trapped"], needs: [], conditions: [], people: 2, corroborations: 0 }), /life-safety/);
});
