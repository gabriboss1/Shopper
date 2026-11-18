import { COURSES } from "../src/data/courses";
import { mockSyllabus } from "../src/data/syllabi";
import { analyzeSyllabus } from "../src/lib/syllabus";

const prefs = {
  workload: "moderate" as const,
  assessments: ["papers"],
  interests: "research",
  avoidGroupWork: true,
  gaps: ["WR" as const],
};

for (const course of COURSES) {
  const text = mockSyllabus(course.id);
  if (!text) {
    console.error("missing mock syllabus", course.id);
    process.exit(1);
  }
  const analysis = analyzeSyllabus(course, prefs);
  if (!analysis) {
    console.error("analysis failed", course.id);
    process.exit(1);
  }
  for (const quote of analysis.evidence) {
    if (!text.includes(quote.replace(/\.$/, ""))) {
      console.error("evidence is not from the syllabus", course.id, quote);
      process.exit(1);
    }
  }
}

const writing = analyzeSyllabus(COURSES.find((course) => course.id === "engl-114")!, prefs)!;
const math = analyzeSyllabus(COURSES.find((course) => course.id === "math-120")!, prefs)!;
if (writing.score <= math.score) {
  console.error("WR course should outrank a heavy exam course for this preference", writing.score, math.score);
  process.exit(1);
}
console.log(`syllabus ok ${writing.score} vs ${math.score}`);
