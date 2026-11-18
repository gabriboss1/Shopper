import { COURSES, getCourse, MAJORS } from "../src/data/courses";
import { optimize, sectionsOverlap, walkingMinutes, type ManualEvent } from "../src/lib/schedule";

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

for (const course of COURSES) {
  assert(course.major === MAJORS[course.department], `${course.code} major name`);
  assert(["WR", "SO", "L", "QR", "SC", "HU"].includes(course.distributional), `${course.code} distributional`);
}
assert(getCourse("fren-130")?.distributional === "L", "language maps to L");
assert(getCourse("span-140")?.distributional === "L", "spanish maps to L");

const cpsc = getCourse("cpsc-223")!;
const econ = getCourse("econ-115")!;
const psyc = getCourse("psyc-110")!;
assert(sectionsOverlap(cpsc.sections[0], econ.sections[0]), "time overlap still detected");
assert(walkingMinutes("wlh", "wlh") === 0, "same building is zero");

const kept = optimize([cpsc, psyc], [], () => 5);
assert(kept.chosen.length === 2 && kept.dropped.length === 0, "short walk keeps both, including a time overlap");
assert(kept.legs.some((leg) => leg.minutes === 5), "an overlapping pair still shows its own walk");

const leftOut = optimize([cpsc, psyc], [], () => 20);
assert(leftOut.chosen.length === 1 && leftOut.dropped.length === 1, "walk over 15 minutes leaves one out");
assert(leftOut.dropped[0].reason.includes("15-minute"), "conflict explains the buffer");

const event: ManualEvent = { id: "e", title: "Practice", day: "Tue", start: "11:35", end: "12:50" };
const shifted = optimize([cpsc], [event], () => 5);
assert(shifted.chosen[0]?.section.id === "cpsc-223-02", "a commitment moves the week to the other section");
const unshifted = optimize([cpsc], [], () => 5);
assert(unshifted.chosen[0]?.section.id === "cpsc-223-01", "removing the commitment restores the earlier section");

console.log(`ok ${COURSES.length} courses`);
