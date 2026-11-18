"use client";

import { useState } from "react";
import { COURSES, type Course, type Distributional } from "@/data/courses";
import { mockSyllabus } from "@/data/syllabi";
import { analyzeSyllabus, type SyllabusAnalysis, type SyllabusPreferences, type WorkloadPref } from "@/lib/syllabus";

const GAPS: Distributional[] = ["WR", "SO", "L", "QR", "SC", "HU"];
const ASSESSMENTS = ["papers", "exams", "problem sets", "projects"];

export function SyllabusPanel({
  paired,
  list,
  onAnalyses,
}: {
  paired: boolean;
  list: Course[];
  onAnalyses: (analyses: SyllabusAnalysis[]) => void;
}) {
  const [prefs, setPrefs] = useState<SyllabusPreferences>({
    workload: "moderate",
    assessments: ["papers"],
    interests: "",
    avoidGroupWork: false,
    gaps: ["WR", "QR"],
  });
  const [connected, setConnected] = useState(false);
  const [analyses, setAnalyses] = useState<SyllabusAnalysis[]>([]);

  function publish(next: SyllabusAnalysis[]) {
    setAnalyses(next);
    onAnalyses(next);
  }

  function analyze(courses: Course[]) {
    const next = courses.map((course) => analyzeSyllabus(course, prefs)).filter((item): item is SyllabusAnalysis => Boolean(item));
    publish(next.sort((a, b) => b.score - a.score));
  }

  const gap = prefs.gaps[0];
  const suggestions = gap
    ? COURSES.filter((course) => course.distributional === gap)
        .map((course) => analyzeSyllabus(course, prefs))
        .filter((item): item is SyllabusAnalysis => Boolean(item))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : [];

  return (
    <section className="rounded-xl border border-[#e4dccb] bg-white p-3">
      <h2 className="font-semibold">Syllabus fit</h2>
      <p className="mt-1 text-xs text-[#5c564c]">
        Scores are read from bundled mock syllabi. Shopper does not ask for or store another NetID password.
        {paired ? " CAS is already paired for course data." : " Pair CAS above if you want that saved login. It is not required to read these mock syllabi."}
      </p>
      <button type="button" className="mt-2 text-sm text-[#00356b] underline" onClick={() => setConnected((value) => !value)}>
        {connected ? "Disconnect mock CourseTable" : "Connect mock CourseTable"}
      </button>
      <div className="mt-2 grid gap-2 text-sm">
        <label>
          Workload
          <select
            aria-label="Preferred workload"
            className="ml-2 rounded border px-2 py-1"
            value={prefs.workload}
            onChange={(event) => setPrefs({ ...prefs, workload: event.target.value as WorkloadPref })}
          >
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2 text-xs">
          {ASSESSMENTS.map((item) => (
            <label key={item} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={prefs.assessments.includes(item)}
                onChange={() => setPrefs({
                  ...prefs,
                  assessments: prefs.assessments.includes(item) ? prefs.assessments.filter((value) => value !== item) : [...prefs.assessments, item],
                })}
              />
              {item}
            </label>
          ))}
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={prefs.avoidGroupWork} onChange={() => setPrefs({ ...prefs, avoidGroupWork: !prefs.avoidGroupWork })} />
            Avoid group work
          </label>
        </div>
        <input
          aria-label="Interest keywords"
          value={prefs.interests}
          placeholder="Interest keywords"
          onChange={(event) => setPrefs({ ...prefs, interests: event.target.value })}
          className="rounded border px-2 py-1"
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {GAPS.map((item) => (
            <label key={item} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={prefs.gaps.includes(item)}
                onChange={() => setPrefs({
                  ...prefs,
                  gaps: prefs.gaps.includes(item) ? prefs.gaps.filter((value) => value !== item) : [...prefs.gaps, item],
                })}
              />
              {item}
            </label>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="mt-2 rounded-md bg-[#00356b] px-3 py-2 text-sm text-white"
        onClick={() => analyze(list)}
        disabled={!connected || list.length === 0}
      >
        Analyze all courses on my list
      </button>
      {!connected ? <p className="mt-2 text-xs">Connect the mock catalog before analyzing. No password is collected.</p> : null}
      {gap && connected ? (
        <div className="mt-3 text-sm">
          <p className="font-medium">Best {gap} options in the mock catalog</p>
          <ul className="mt-1 space-y-1 text-xs">
            {suggestions.map((item) => {
              const course = COURSES.find((entry) => entry.id === item.courseId);
              return <li key={item.courseId}>{course?.code}: {item.score} — {item.summary}</li>;
            })}
          </ul>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {analyses.map((item) => {
          const course = COURSES.find((entry) => entry.id === item.courseId);
          const text = course ? mockSyllabus(course.id) : null;
          return (
            <li key={item.courseId} className="rounded-lg border border-[#eee6d8] p-2 text-sm">
              <p className="font-medium">{course?.code} · fit {item.score}</p>
              <p>{item.summary}</p>
              {item.evidence.map((quote) => (
                <p key={quote} className="mt-1 text-xs text-[#5c564c]">“{quote.replace(/\.$/, "")}.”</p>
              ))}
              {text ? null : <p className="text-xs">No mock syllabus for this course.</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
