import { CROWD_LABEL, DINING_HALLS } from "../src/data/dining";
import { recommendDining, typicalCrowd, type YaleClock } from "../src/lib/dining";

const noon: YaleClock = { weekday: "Tue", hour: 12, minute: 10 };
const mid: YaleClock = { weekday: "Tue", hour: 15, minute: 0 };
const first = typicalCrowd("commons", noon);
const second = typicalCrowd("commons", noon);
if (first !== second || first !== "Very busy") {
  console.error("crowd is not a stable lunch pattern", first, second);
  process.exit(1);
}
if (typicalCrowd("commons", mid) === "Very busy") {
  console.error("midafternoon should not match the lunch rush");
  process.exit(1);
}
if (DINING_HALLS.length !== 16) {
  console.error("expected 14 colleges plus Commons and Slifka");
  process.exit(1);
}
const options = recommendDining({ chosen: [], clock: noon, collegeId: "silliman", diets: ["vegan"], lowCrowd: false, closest: false });
if (!options.length || options[0].crowdLabel !== CROWD_LABEL) {
  console.error("missing typical label");
  process.exit(1);
}
if (options.some((option) => option.crowdLabel !== "Typical for this time.")) {
  console.error("unlabeled crowd figure");
  process.exit(1);
}
console.log(`dining ok ${options[0].hall.short} ${options[0].minutes} min ${options[0].crowd}`);
