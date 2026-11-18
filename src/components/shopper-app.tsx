"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DAYS, COURSES, DEFAULT_LIST, getCourse, type Course, type Day } from "@/data/courses";
import { formatMeeting, formatMinutes, optimize, parseMinutes, type Optimized } from "@/lib/schedule";
import { colorFor, type MapPin } from "@/components/campus-map";

const CampusMap = dynamic(() => import("@/components/campus-map").then((mod) => mod.CampusMap), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-[#e7e1d4]" />,
});

const START = 8 * 60;
const END = 21 * 60;
const HOUR = 46;

export function ShopperApp() {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [ids, setIds] = useState<string[]>(DEFAULT_LIST);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("shopper-list");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) setIds(parsed.filter((id) => getCourse(id)));
      } catch {
        /* keep the seeded list */
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("shopper-list", JSON.stringify(ids));
  }, [ids, ready]);

  const departments = useMemo(() => ["All", ...Array.from(new Set(COURSES.map((course) => course.department)))], []);
  const list = useMemo(
    () => ids.map((id) => getCourse(id)).filter((course): course is Course => Boolean(course)),
    [ids],
  );
  const plan = useMemo(() => optimize(list), [list]);
  const dropped = new Set(plan.dropped.map((course) => course.id));

  const results = COURSES.filter((course) => {
    const haystack = `${course.code} ${course.title} ${course.department} ${course.sections.map((section) => section.instructor).join(" ")}`.toLowerCase();
    const matchesText = haystack.includes(query.trim().toLowerCase());
    const matchesDept = department === "All" || course.department === department;
    return matchesText && matchesDept;
  });

  function add(id: string) {
    setIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function remove(id: string) {
    setIds((current) => current.filter((item) => item !== id));
  }

  function move(id: string, direction: -1 | 1) {
    setIds((current) => {
      const index = current.indexOf(id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = current.slice();
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  const pins: MapPin[] = plan.chosen.map((item) => ({
    id: item.section.id,
    buildingId: item.section.meetings[0].buildingId,
    label: item.course.code,
    detail: formatMeeting(item.section),
  }));

  return (
    <div className="min-h-screen">
      <header className="bg-[#00356b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">Yale shopping period</p>
            <h1 className="text-2xl font-semibold">Shopper</h1>
          </div>
          <p className="max-w-sm text-right text-sm text-white/80">
            {plan.chosen.length} in the week · {plan.weeklyWalkingMinutes} min walking
            {plan.dropped.length > 0 ? ` · ${plan.dropped.length} left out` : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[340px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-[#e4dccb] bg-white p-3">
            <label className="block text-sm font-medium" htmlFor="search">
              Search courses
            </label>
            <input
              id="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code, title, or instructor"
              className="mt-2 w-full rounded-lg border border-[#d9d0c1] px-3 py-2 outline-none focus:border-[#00356b]"
            />
            <select
              aria-label="Department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#d9d0c1] px-3 py-2"
            >
              {departments.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <ul className="mt-3 max-h-72 space-y-2 overflow-auto">
              {results.map((course) => {
                const added = ids.includes(course.id);
                return (
                  <li key={course.id} className="rounded-lg border border-[#eee6d8] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {course.code} <span className="font-normal text-[#5c564c]">{course.title}</span>
                        </p>
                        <p className="text-xs text-[#5c564c]">{course.sections.length} section{course.sections.length === 1 ? "" : "s"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => (added ? remove(course.id) : add(course.id))}
                        className={`shrink-0 rounded-md px-2 py-1 text-sm ${added ? "bg-[#efe8dc] text-[#00356b]" : "bg-[#00356b] text-white"}`}
                      >
                        {added ? "Remove" : "Add"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-[#e4dccb] bg-white p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Shopping list</h2>
              <button type="button" className="text-sm text-[#00356b] underline" onClick={() => setIds(DEFAULT_LIST)}>
                Reset sample
              </button>
            </div>
            <p className="mt-1 text-xs text-[#5c564c]">Higher in the list is kept first when a time conflict is unavoidable.</p>
            {list.length === 0 ? <p className="mt-3 text-sm">Add a course to build a week.</p> : null}
            <ol className="mt-3 space-y-2">
              {list.map((course, index) => {
                const chosen = plan.chosen.find((item) => item.course.id === course.id);
                const conflict = dropped.has(course.id);
                return (
                  <li key={course.id} className={`rounded-lg border p-2 ${conflict ? "border-[#9b2335] bg-[#fdf2f3]" : "border-[#eee6d8]"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {index + 1}. {course.code}
                        </p>
                        <p className="text-sm text-[#3d3832]">{course.title}</p>
                        {chosen ? <p className="text-xs text-[#1f7a4d]">Section {chosen.section.label}: {formatMeeting(chosen.section)}</p> : null}
                        {conflict ? <p className="text-xs font-medium text-[#9b2335]">Conflict — left out of the optimized week</p> : null}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button type="button" aria-label={`Move ${course.code} up`} className="rounded border px-2 text-xs" onClick={() => move(course.id, -1)}>
                          Up
                        </button>
                        <button type="button" aria-label={`Move ${course.code} down`} className="rounded border px-2 text-xs" onClick={() => move(course.id, 1)}>
                          Down
                        </button>
                        <button type="button" className="rounded border px-2 text-xs" onClick={() => remove(course.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <Week plan={plan} />
          <div className="rounded-xl border border-[#e4dccb] bg-white p-3">
            <h2 className="font-semibold">Campus map</h2>
            <p className="mt-1 text-xs text-[#5c564c]">
              Walking times are estimated from building coordinates at a campus pace. They are not turn-by-turn directions.
            </p>
            <div className="mt-3">
              <CampusMap pins={pins} legs={plan.legs} />
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {plan.legs.length === 0 ? <li>Add two classes on the same day to see a walk.</li> : null}
              {plan.legs.map((leg) => (
                <li key={`${leg.day}-${leg.from.section.id}-${leg.to.section.id}`}>
                  {leg.day}: {leg.from.course.code} to {leg.to.course.code} · {leg.minutes} min
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

function Week({ plan }: { plan: Optimized }) {
  const hours = [];
  for (let minute = START; minute < END; minute += 60) hours.push(minute);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e4dccb] bg-white p-3">
      <h2 className="font-semibold">Optimized week</h2>
      <p className="text-sm text-[#5c564c]">{plan.weeklyWalkingMinutes} minutes of walking between classes.</p>
      <div className="mt-3 min-w-[720px]">
        <div className="grid grid-cols-[52px_repeat(5,1fr)] text-xs font-medium text-[#5c564c]">
          <div />
          {DAYS.map((day) => (
            <div key={day} className="px-1 pb-1">
              {day}
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[52px_repeat(5,1fr)]" style={{ height: ((END - START) / 60) * HOUR }}>
          <div className="relative">
            {hours.map((minute) => (
              <div key={minute} className="absolute left-0 text-[10px] text-[#8a8174]" style={{ top: ((minute - START) / 60) * HOUR - 6 }}>
                {formatMinutes(minute)}
              </div>
            ))}
          </div>
          {DAYS.map((day) => (
            <DayColumn key={day} day={day} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, plan }: { day: Day; plan: Optimized }) {
  return (
    <div className="relative border-l border-[#eee6d8]">
      {plan.chosen.flatMap((item, index) =>
        item.section.meetings
          .filter((meeting) => meeting.days.includes(day))
          .map((meeting) => {
            const start = parseMinutes(meeting.start);
            const end = parseMinutes(meeting.end);
            return (
              <div
                key={`${item.section.id}-${day}`}
                className="absolute inset-x-1 overflow-hidden rounded-md px-1 py-0.5 text-[11px] leading-tight text-white"
                style={{
                  top: ((start - START) / 60) * HOUR,
                  height: Math.max(22, ((end - start) / 60) * HOUR - 2),
                  background: colorFor(index),
                }}
              >
                <div className="font-semibold">{item.course.code}</div>
                <div>{meeting.room}</div>
              </div>
            );
          }),
      )}
    </div>
  );
}
