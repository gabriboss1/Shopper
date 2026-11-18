"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BUILDINGS, DAYS, COURSES, getCourse, type BuildingId, type Course, type Day } from "@/data/courses";
import { conflictingEvents, formatMeeting, formatMinutes, optimize, parseMinutes, walkingMinutes, type ManualEvent, type Optimized } from "@/lib/schedule";
import { scheduleToIcs } from "@/lib/ics";
import { colorFor, type MapPin } from "@/components/campus-map";
import { CasPanel } from "@/components/cas-panel";

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
  const [ids, setIds] = useState<string[]>([]);
  const [paired, setPaired] = useState(false);
  const [toast, setToast] = useState<Course | null>(null);
  const [walks, setWalks] = useState<Record<string, { minutes: number; source: "google" | "coordinate" }>>({});
  const [ready, setReady] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [events, setEvents] = useState<ManualEvent[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDay, setEventDay] = useState<Day>("Tue");
  const [eventStart, setEventStart] = useState("15:00");
  const [eventEnd, setEventEnd] = useState("16:30");
  const [eventNote, setEventNote] = useState("");
  const [undo, setUndo] = useState<{ id: string; index: number; code: string } | null>(null);
  const [shareNote, setShareNote] = useState("");
  const undoTimer = useState<{ id: number | null }>({ id: null })[0];

  useEffect(() => {
    const seeded = ["cpsc-223", "econ-115", "engl-114", "math-120", "psyc-110", "hist-202"].join(",");
    const shared = new URLSearchParams(window.location.search).get("list");
    const sharedIds = shared?.split(",").filter((id) => getCourse(id)) ?? [];
    if (sharedIds.length > 0) {
      setIds(sharedIds);
    } else {
      const raw = localStorage.getItem("shopper-list");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed) && parsed.join(",") !== seeded) setIds(parsed.filter((id) => getCourse(id)));
        } catch {
          /* start empty */
        }
      }
    }
    setReady(true);
    let current = localStorage.getItem("shopper-profile");
    if (!current) {
      current = crypto.randomUUID();
      localStorage.setItem("shopper-profile", current);
    }
    setProfileId(current);
    void fetch(`/api/events?profileId=${current}`)
      .then((response) => response.json())
      .then((body: { events?: ManualEvent[] }) => {
        if (Array.isArray(body.events)) setEvents(body.events);
      })
      .catch(() => setEventNote("Calendar events are unavailable."));
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("shopper-list", JSON.stringify(ids));
  }, [ids, ready]);

  const departments = useMemo(() => ["All", ...Array.from(new Set(COURSES.map((course) => course.department)))], []);
  const list = useMemo(
    () => ids.map((id) => getCourse(id)).filter((course): course is Course => Boolean(course)),
    [ids],
  );
  const walkFn = useMemo(() => {
    return (from: BuildingId, to: BuildingId) => {
      const key = from < to ? `${from}|${to}` : `${to}|${from}`;
      return walks[key]?.minutes ?? walkingMinutes(from, to);
    };
  }, [walks]);
  const plan = useMemo(() => optimize(list, events, walkFn), [list, events, walkFn]);
  const dropped = new Map(plan.dropped.map((item) => [item.course.id, item]));
  const walkSource = Object.values(walks).some((item) => item.source === "google") ? "Google walking time" : "Coordinate estimate";

  useEffect(() => {
    const buildings = new Set<BuildingId>();
    for (const course of list) {
      for (const section of course.sections) {
        for (const meeting of section.meetings) buildings.add(meeting.buildingId);
      }
    }
    const places = [...buildings];
    const pairs: { from: BuildingId; to: BuildingId }[] = [];
    for (let i = 0; i < places.length; i += 1) {
      for (let j = i + 1; j < places.length; j += 1) pairs.push({ from: places[i], to: places[j] });
    }
    if (pairs.length === 0) return;
    let cancel = false;
    void fetch("/api/walk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairs }),
    })
      .then((response) => response.json())
      .then((body: { walks?: { from: BuildingId; to: BuildingId; minutes: number; source: "google" | "coordinate" }[] }) => {
        if (cancel || !body.walks) return;
        const next: Record<string, { minutes: number; source: "google" | "coordinate" }> = {};
        for (const row of body.walks) {
          const key = row.from < row.to ? `${row.from}|${row.to}` : `${row.to}|${row.from}`;
          next[key] = { minutes: row.minutes, source: row.source };
        }
        setWalks(next);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [list]);

  const results = COURSES.filter((course) => {
    const haystack = `${course.code} ${course.title} ${course.department} ${course.sections.map((section) => section.instructor).join(" ")}`.toLowerCase();
    const matchesText = haystack.includes(query.trim().toLowerCase());
    const matchesDept = department === "All" || course.department === department;
    return matchesText && matchesDept;
  });

  async function saveEvents(next: ManualEvent[]) {
    setEvents(next);
    if (!profileId) return;
    const response = await fetch("/api/events", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, events: next }),
    });
    setEventNote(response.ok ? "Events stored encrypted." : "Could not store events.");
  }

  function add(id: string) {
    const course = getCourse(id);
    if (course) setToast(course);
    setIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function remove(id: string) {
    setIds((current) => {
      const index = current.indexOf(id);
      if (index < 0) return current;
      if (undoTimer.id) window.clearTimeout(undoTimer.id);
      undoTimer.id = window.setTimeout(() => setUndo(null), 8000);
      setUndo({ id, index, code: getCourse(id)?.code ?? "Course" });
      return current.filter((item) => item !== id);
    });
  }

  function undoRemove() {
    if (!undo) return;
    if (undoTimer.id) window.clearTimeout(undoTimer.id);
    setIds((current) => {
      if (current.includes(undo.id)) return current;
      const copy = current.slice();
      copy.splice(Math.min(undo.index, copy.length), 0, undo.id);
      return copy;
    });
    setUndo(null);
  }

  async function copyLink() {
    const url = `${window.location.origin}/?list=${ids.join(",")}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch {
      setShareNote(url);
    }
    window.setTimeout(() => setShareNote(""), 2000);
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
            {paired ? "CAS paired" : "CAS not paired"} · {plan.chosen.length} in the week
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
            {paired ? (
              <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
                {results.map((course) => {
                  const added = ids.includes(course.id);
                  return (
                    <li key={course.id} className="rounded-lg border border-[#eee6d8] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" className="text-left" onClick={() => setToast(course)}>
                          <p className="font-medium">
                            {course.code} <span className="font-normal text-[#5c564c]">{course.title}</span>
                          </p>
                          <p className="text-xs text-[#00356b]">{course.department} · {course.major} · {course.distributional}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => (added ? remove(course.id) : add(course.id))}
                          className={`shrink-0 rounded-md px-2 py-1 text-sm ${added ? "bg-[#efe8dc] text-[#00356b]" : "bg-[#00356b] text-white"}`}
                        >
                          {added ? "Remove" : "Add"}
                        </button>
                      </div>
                      <ul className="mt-1 space-y-1 text-xs text-[#3d3832]">
                        {course.sections.map((section) => (
                          <li key={section.id}>
                            Section {section.label} · {section.instructor} · {formatMeeting(section)} · {BUILDINGS[section.meetings[0].buildingId].name} · Capacity unknown
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm">Pair CAS to search courses you can add.</p>
            )}
          </div>

          <div className="rounded-xl border border-[#e4dccb] bg-white p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Shopping list</h2>
              <div className="flex gap-3">
                <button type="button" className="text-sm text-[#00356b] underline" onClick={() => void copyLink()}>
                  Copy share link
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-[#5c564c]">The list starts empty. Higher courses stay when a walk is longer than 15 minutes.</p>
            {shareNote ? <p className="text-xs text-[#1f7a4d]">{shareNote}</p> : null}
            {list.length === 0 ? <p className="mt-3 text-sm">Add a course to build a week.</p> : null}
            <ol className="mt-3 space-y-2">
              {list.map((course, index) => {
                const chosen = plan.chosen.find((item) => item.course.id === course.id);
                const conflict = dropped.get(course.id);
                const eventHits = chosen ? conflictingEvents(chosen.section, events) : conflictingEvents(conflict?.section ?? course.sections[0], events);
                return (
                  <li key={course.id} className={`rounded-lg border p-2 ${conflict || eventHits.length > 0 ? "border-[#9b2335] bg-[#fdf2f3]" : "border-[#eee6d8]"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button type="button" className="text-left font-medium" onClick={() => setToast(course)}>
                          {index + 1}. {course.code}
                        </button>
                        <p className="text-sm text-[#3d3832]">{course.title}</p>
                        <p className="text-xs text-[#00356b]">{course.department} · {course.major} · {course.distributional}</p>
                        <p className="text-xs text-[#5c564c]">Capacity unknown</p>
                        {chosen ? <p className="text-xs text-[#1f7a4d]">Section {chosen.section.label}: {formatMeeting(chosen.section)}</p> : null}
                        {conflict ? <p className="text-xs font-medium text-[#9b2335]">{conflict.reason} ({walkSource}).</p> : null}
                        {eventHits.map((event) => (
                          <p key={event.id} className="text-xs font-medium text-[#9b2335]">Conflicts with {event.title}</p>
                        ))}
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
          <CasPanel onPaired={setPaired} />
          <form
            className="rounded-xl border border-[#e4dccb] bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const title = eventTitle.trim();
              if (!title || eventStart >= eventEnd) {
                setEventNote("Give the event a name and an end time after the start.");
                return;
              }
              void saveEvents([...events, { id: crypto.randomUUID(), title, day: eventDay, start: eventStart, end: eventEnd }]);
              setEventTitle("");
            }}
          >
            <h2 className="font-semibold">Your commitments</h2>
            <p className="mt-1 text-xs text-[#5c564c]">Add a class, practice, or job. Google and Outlook are not connected. Overlaps are marked on the list.</p>
            <input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Event name" aria-label="Event name" className="mt-2 w-full rounded-lg border border-[#d9d0c1] px-3 py-2" />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <select aria-label="Event day" value={eventDay} onChange={(event) => setEventDay(event.target.value as Day)} className="rounded-lg border border-[#d9d0c1] px-2 py-2">
                {DAYS.map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
              <input aria-label="Event start" type="time" value={eventStart} onChange={(event) => setEventStart(event.target.value)} className="rounded-lg border border-[#d9d0c1] px-2 py-2" />
              <input aria-label="Event end" type="time" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} className="rounded-lg border border-[#d9d0c1] px-2 py-2" />
            </div>
            <button type="submit" className="mt-2 rounded-md bg-[#00356b] px-3 py-2 text-sm text-white">Add event</button>
            <ul className="mt-2 space-y-1 text-sm">
              {events.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span>{item.title} · {item.day} {item.start}–{item.end}</span>
                  <button type="button" className="text-xs underline" onClick={() => void saveEvents(events.filter((event) => event.id !== item.id))}>Remove</button>
                </li>
              ))}
            </ul>
            {eventNote ? <p className="mt-2 text-xs">{eventNote}</p> : null}
          </form>
        </section>

        <section className="space-y-4">
          <Week plan={plan} events={events} walkSource={walkSource} />
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
                  {leg.day}: {leg.from.course.code} to {leg.to.course.code} · {leg.minutes} min · {walkSource}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      {toast ? <CourseToast course={toast} onClose={() => setToast(null)} /> : null}
      {undo ? (
        <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#00356b] px-4 py-2 text-sm text-white shadow-lg">
          <span>Removed {undo.code}</span>
          <button type="button" className="underline" onClick={undoRemove}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Week({ plan, events, walkSource }: { plan: Optimized; events: ManualEvent[]; walkSource: string }) {
  const hours = [];
  for (let minute = START; minute < END; minute += 60) hours.push(minute);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e4dccb] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Optimized week</h2>
        <button
          type="button"
          className="rounded-md bg-[#00356b] px-3 py-1.5 text-sm text-white"
          onClick={() => {
            const blob = new Blob(
              [scheduleToIcs(plan.chosen, plan.legs, events, plan.dropped.map((item) => ({ course: item.course, section: item.section })))],
              { type: "text/calendar" },
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "shopper.ics";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export .ics
        </button>
      </div>
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
            <DayColumn key={day} day={day} plan={plan} events={events} walkSource={walkSource} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, plan, events, walkSource }: { day: Day; plan: Optimized; events: ManualEvent[]; walkSource: string }) {
  const boxes: { key: string; start: number; end: number; title: string; detail: string; color: string; outline?: string }[] = [];
  events
    .filter((event) => event.day === day)
    .forEach((event) => {
      boxes.push({
        key: event.id,
        start: parseMinutes(event.start),
        end: parseMinutes(event.end),
        title: event.title,
        detail: "Commitment",
        color: "#6b655c",
      });
    });
  plan.chosen.forEach((item, index) => {
    item.section.meetings
      .filter((meeting) => meeting.days.includes(day))
      .forEach((meeting) => {
        const hits = conflictingEvents(item.section, events);
        const leg = plan.legs.find((itemLeg) => itemLeg.day === day && itemLeg.to.section.id === item.section.id);
        boxes.push({
          key: `${item.section.id}-${day}`,
          start: parseMinutes(meeting.start),
          end: parseMinutes(meeting.end),
          title: item.course.code,
          detail: leg ? `${leg.minutes} min from ${leg.from.course.code} · ${walkSource}` : hits[0] ? `Conflicts with ${hits[0].title}` : meeting.room,
          color: colorFor(index),
          outline: hits.length > 0 ? "2px solid #9b2335" : undefined,
        });
      });
  });
  const placed = placeSideBySide(boxes);
  return (
    <div className="relative border-l border-[#eee6d8]">
      {placed.map((box) => (
        <div
          key={box.key}
          className="absolute overflow-hidden rounded-md px-1 py-0.5 text-[11px] leading-tight text-white"
          style={{
            top: ((box.start - START) / 60) * HOUR,
            height: Math.max(28, ((box.end - box.start) / 60) * HOUR - 2),
            left: `calc(${(box.col / box.columns) * 100}% + 2px)`,
            width: `calc(${100 / box.columns}% - 4px)`,
            background: box.color,
            outline: box.outline,
          }}
        >
          <div className="font-semibold">{box.title}</div>
          <div>{box.detail}</div>
        </div>
      ))}
    </div>
  );
}

function placeSideBySide<T extends { start: number; end: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const columnEnds: number[] = [];
  const assigned = sorted.map((item) => {
    let col = columnEnds.findIndex((end) => end <= item.start);
    if (col < 0) {
      col = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[col] = item.end;
    }
    return { ...item, col };
  });
  return assigned.map((item) => {
    const cluster = assigned.filter((other) => other.start < item.end && item.start < other.end);
    const columns = Math.max(...cluster.map((other) => other.col + 1), 1);
    return { ...item, columns };
  });
}

function CourseToast({ course, onClose }: { course: Course; onClose: () => void }) {
  const meeting = course.sections[0]?.meetings[0];
  const pins = meeting
    ? [{ id: course.id, buildingId: meeting.buildingId, label: course.code, detail: formatMeeting(course.sections[0]) }]
    : [];
  return (
    <div className="fixed bottom-16 left-1/2 z-30 w-[min(420px,92vw)] -translate-x-1/2 rounded-xl border border-[#e4dccb] bg-white p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{course.code} · {course.title}</p>
          <p className="text-xs text-[#00356b]">{course.department} · {course.major} · {course.distributional}</p>
        </div>
        <button type="button" className="text-sm underline" onClick={onClose}>Close</button>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {course.sections.map((section) => (
          <li key={section.id}>
            Section {section.label} · {section.instructor} · {formatMeeting(section)} · {BUILDINGS[section.meetings[0].buildingId].name}
          </li>
        ))}
      </ul>
      <div className="mt-2 h-40 overflow-hidden rounded-lg">
        <CampusMap pins={pins} legs={[]} className="h-40" />
      </div>
    </div>
  );
}
