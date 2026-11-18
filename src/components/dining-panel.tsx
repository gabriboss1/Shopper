"use client";

import { useEffect, useMemo, useState } from "react";
import { DINING_HALLS, type Diet } from "@/data/dining";
import { classOrigin, crowdColor, recommendDining, yaleNow, type YaleClock } from "@/lib/dining";
import type { Chosen } from "@/lib/schedule";
import { CampusMap } from "@/components/campus-map";

const DIETS: Diet[] = ["vegetarian", "vegan", "gluten-free"];

export function DiningPanel({ chosen }: { chosen: Chosen[] }) {
  const [collegeId, setCollegeId] = useState("silliman");
  const [diets, setDiets] = useState<Diet[]>([]);
  const [lowCrowd, setLowCrowd] = useState(false);
  const [closest, setClosest] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clock, setClock] = useState<YaleClock | null>(null);
  useEffect(() => setClock(yaleNow()), []);
  const options = useMemo(
    () => (clock ? recommendDining({ chosen, clock, collegeId, diets, lowCrowd, closest }) : []),
    [chosen, clock, collegeId, diets, lowCrowd, closest],
  );
  if (!clock) {
    return (
      <section className="rounded-xl border border-[#e4dccb] bg-white p-3">
        <h2 className="font-semibold">Eat nearby</h2>
      </section>
    );
  }
  const best = options.find((option) => option.open) ?? options[0];
  const selected = options.find((option) => option.hall.id === selectedId) ?? best;
  const origin = classOrigin(chosen, clock, collegeId);

  return (
    <section className="rounded-xl border border-[#e4dccb] bg-white p-3">
      <h2 className="font-semibold">Eat nearby</h2>
      {best ? (
        <p className="mt-1 text-sm">
          Best option right now: {best.hall.short} — {best.minutes} min walk, {best.crowd.toLowerCase()} crowd, {best.phrase}. {best.crowdLabel}
        </p>
      ) : (
        <p className="mt-1 text-sm">No dining hall matches those filters.</p>
      )}
      <p className="mt-1 text-xs text-[#5c564c]">From {origin.label}. Crowd figures are not a live feed.</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <label>
          College
          <select aria-label="Residential college" value={collegeId} onChange={(event) => setCollegeId(event.target.value)} className="ml-1 rounded border px-2 py-1">
            {DINING_HALLS.filter((hall) => hall.college).map((hall) => (
              <option key={hall.id} value={hall.id}>{hall.short}</option>
            ))}
          </select>
        </label>
        {DIETS.map((diet) => (
          <label key={diet} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={diets.includes(diet)}
              onChange={() => setDiets((current) => current.includes(diet) ? current.filter((item) => item !== diet) : [...current, diet])}
            />
            {diet}
          </label>
        ))}
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={lowCrowd} onChange={() => setLowCrowd((value) => !value)} />
          Low crowd
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={closest} onChange={() => setClosest((value) => !value)} />
          Closest
        </label>
      </div>
      <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
        {options.map((option) => (
          <li key={option.hall.id}>
            <button
              type="button"
              onClick={() => setSelectedId(option.hall.id)}
              className={`w-full rounded-lg border p-2 text-left ${selected?.hall.id === option.hall.id ? "border-[#00356b]" : "border-[#eee6d8]"}`}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: crowdColor(option.crowd) }} />
              <span className="font-medium">{option.hall.name}</span>
              <span className="mt-1 block text-xs text-[#5c564c]">
                {option.minutes} min walk · {option.crowd} · {option.crowdLabel} · {option.hours}
              </span>
              <span className="block text-xs">{option.menu.map((item) => item.name).join(" · ")}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="mt-3 h-48 overflow-hidden rounded-lg">
          <CampusMap
            pins={[]}
            legs={[]}
            className="h-48"
            extras={[
              { id: "origin", lat: origin.lat, lng: origin.lng, label: origin.label, color: "#00356b" },
              { id: selected.hall.id, lat: selected.hall.lat, lng: selected.hall.lng, label: `${selected.hall.short} · ${selected.crowd}`, color: crowdColor(selected.crowd) },
            ]}
          />
        </div>
      ) : null}
    </section>
  );
}
