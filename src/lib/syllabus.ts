import type { Course, Distributional } from "@/data/courses";
import { mockSyllabus } from "@/data/syllabi";

export type WorkloadPref = "light" | "moderate" | "heavy";

export type SyllabusPreferences = {
  workload: WorkloadPref;
  assessments: string[];
  interests: string;
  avoidGroupWork: boolean;
  gaps: Distributional[];
};

export type SyllabusAnalysis = {
  courseId: string;
  score: number;
  summary: string;
  highlights: string[];
  flags: string[];
  evidence: string[];
};

const ASSESSMENTS = ["papers", "exams", "problem sets", "projects"];

function sentences(text: string): string[] {
  return text.split(/(?<=\.)\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function has(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase);
}

export function analyzeSyllabus(course: Course, prefs: SyllabusPreferences): SyllabusAnalysis | null {
  const text = mockSyllabus(course.id);
  if (!text) return null;
  const lines = sentences(text);
  let score = 50;
  const highlights: string[] = [];
  const flags: string[] = [];
  const evidence: string[] = [];

  if (prefs.gaps.includes(course.distributional)) {
    score += 20;
    highlights.push(`Lists ${course.distributional}, which you still need.`);
  }
  const workloadLine = lines.find((line) => /workload|reading is|weekly/i.test(line));
  const stated = has(text, "heavy") ? "heavy" : has(text, "light") ? "light" : "moderate";
  if (stated === prefs.workload) {
    score += 15;
    highlights.push(`Workload reads as ${stated}, which matches your preference.`);
  } else if ((prefs.workload === "light" && stated === "heavy") || (prefs.workload === "heavy" && stated === "light")) {
    score -= 15;
    flags.push(`Workload reads as ${stated}, not ${prefs.workload}.`);
  }
  if (workloadLine) evidence.push(workloadLine);

  for (const assessment of ASSESSMENTS) {
    const hit = prefs.assessments.includes(assessment) && has(text, assessment.replace("papers", "paper").replace("exams", "exam").replace("problem sets", "problem set").replace("projects", "project"));
    if (hit) {
      score += 5;
      const quote = lines.find((line) => has(line, assessment.replace("papers", "paper").split(" ")[0]));
      if (quote && !evidence.includes(quote)) evidence.push(quote);
    }
  }

  const groupLine = lines.find((line) => /group|pair|team|partner/i.test(line));
  if (prefs.avoidGroupWork && groupLine && /group project|group presentation|team|partners submit|field teams/i.test(text)) {
    score -= 12;
    flags.push("The syllabus describes shared or group work.");
    evidence.push(groupLine);
  } else if (groupLine && /no group|independently|independent/i.test(text)) {
    score += 8;
    highlights.push("Work is mostly independent.");
    evidence.push(groupLine);
  }

  const interests = prefs.interests.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  for (const word of interests) {
    const quote = lines.find((line) => line.toLowerCase().includes(word));
    if (quote) {
      score += 8;
      highlights.push(`Mentions your interest “${word}”.`);
      if (!evidence.includes(quote)) evidence.push(quote);
    }
  }

  score = Math.max(0, Math.min(100, score));
  const summary = [
    prefs.gaps.includes(course.distributional) ? `Fits ${course.distributional}` : `${course.distributional} is not one of your open requirements`,
    `${stated} workload`,
    flags.includes("The syllabus describes shared or group work.") ? "some group work" : "little required group work",
  ].join(", ");
  return { courseId: course.id, score, summary, highlights, flags, evidence: evidence.slice(0, 3) };
}
