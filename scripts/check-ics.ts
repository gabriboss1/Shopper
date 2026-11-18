import { getCourse } from "../src/data/courses";
import { scheduleToIcs } from "../src/lib/ics";
import { optimize, parseMinutes, type ManualEvent } from "../src/lib/schedule";

const cpsc = getCourse("cpsc-223")!;
const psyc = getCourse("psyc-110")!;
const event: ManualEvent = { id: "orch", title: "Orchestra", day: "Tue", start: "11:35", end: "12:50" };
const plan = optimize([cpsc, psyc], [], () => 20);
const ics = scheduleToIcs(
  plan.chosen,
  plan.legs,
  [event],
  plan.dropped.map((item) => ({ course: item.course, section: item.section })),
  new Date("2026-11-17T15:00:00"),
);
if (!ics.includes("SUMMARY:Shopper – Orchestra")) {
  console.error("missing commitment");
  process.exit(1);
}
if (!ics.includes(`SUMMARY:Shopper – ${plan.chosen[0].course.code}`) || !ics.includes(`SUMMARY:Shopper – ${plan.dropped[0].course.code}`)) {
  console.error("missing a conflicting course");
  process.exit(1);
}
const sample = plan.chosen[0];
const meeting = sample.section.meetings[0];
const start = parseMinutes(meeting.start);
const hh = String(Math.floor(start / 60)).padStart(2, "0");
const mm = String(start % 60).padStart(2, "0");
const classBlock = ics.split("BEGIN:VEVENT").find((block) => block.includes(`UID:class-${sample.section.id}-${meeting.days[0]}`));
if (!classBlock || !classBlock.includes(`T${hh}${mm}00`)) {
  console.error("class export did not keep the real start time");
  process.exit(1);
}
console.log("ics ok");
