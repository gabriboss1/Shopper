import { BUILDINGS, COURSES, DEFAULT_LIST, getCourse } from "../src/data/courses";
import { optimize, sectionsOverlap, walkingMinutes } from "../src/lib/schedule";

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const list = DEFAULT_LIST.map((id) => getCourse(id)!);
assert(list.every(Boolean), "default list courses exist");

const cpsc = getCourse("cpsc-223")!;
const econ = getCourse("econ-115")!;
const psyc = getCourse("psyc-110")!;
const hist = getCourse("hist-202")!;

assert(sectionsOverlap(cpsc.sections[0], econ.sections[0]), "CPSC 223-01 overlaps ECON 115-01");
assert(sectionsOverlap(cpsc.sections[0], psyc.sections[0]), "CPSC 223-01 overlaps PSYC 110");
assert(sectionsOverlap(cpsc.sections[1], hist.sections[0]), "CPSC 223-02 overlaps HIST 202");
assert(!sectionsOverlap(cpsc.sections[1], psyc.sections[0]), "CPSC 223-02 does not overlap PSYC 110");

const result = optimize(list);
const chosenIds = result.chosen.map((item) => item.course.id);
assert(!chosenIds.includes("hist-202"), "optimizer leaves out HIST 202");
assert(chosenIds.includes("cpsc-223") && chosenIds.includes("psyc-110"), "optimizer keeps higher-priority courses");

for (let i = 0; i < result.chosen.length; i += 1) {
  for (let j = i + 1; j < result.chosen.length; j += 1) {
    assert(!sectionsOverlap(result.chosen[i].section, result.chosen[j].section), "optimized week has no time overlap");
  }
}

assert(walkingMinutes("wlh", "wlh") === 0, "same building is zero minutes");
assert(walkingMinutes("akw", "kbt") > 0, "different buildings take time");
assert(walkingMinutes("wlh", "lc") < walkingMinutes("kbt", "lc"), "nearby halls are a shorter walk than Science Hill to LC");
assert(BUILDINGS.akw.lat > 41 && BUILDINGS.akw.lat < 42, "coordinates are on campus");

const empty = optimize([]);
assert(empty.chosen.length === 0 && empty.weeklyWalkingMinutes === 0, "empty list");

console.log(`ok ${COURSES.length} courses, optimized ${result.chosen.length}, walking ${result.weeklyWalkingMinutes} min, dropped ${result.dropped.map((c) => c.code).join(", ")}`);
