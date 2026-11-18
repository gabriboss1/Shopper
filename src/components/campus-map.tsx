"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { BUILDINGS, type BuildingId } from "@/data/courses";
import type { Leg } from "@/lib/schedule";

export type MapPin = {
  id: string;
  buildingId: BuildingId;
  label: string;
  detail: string;
};

const COLORS = ["#00356b", "#286dc0", "#8c6a2f", "#1f7a4d", "#9b2335", "#5c4b8a", "#0e6b6b", "#b85c38"];

export function colorFor(index: number): string {
  return COLORS[index % COLORS.length];
}

export function CampusMap({ pins, legs }: { pins: MapPin[]; legs: Leg[] }) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinsRef = useRef(pins);
  const legsRef = useRef(legs);
  pinsRef.current = pins;
  legsRef.current = legs;

  const signature = pins.map((pin) => pin.id).join(",") + legs.map((leg) => `${leg.day}${leg.from.section.id}${leg.to.section.id}${leg.minutes}`).join(",");

  useEffect(() => {
    let cancelled = false;
    const host = node.current;
    if (!host) return;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !host) return;
      const pins = pinsRef.current;
      const legs = legsRef.current;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(host).setView([41.3111, -72.9267], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      pins.forEach((pin, index) => {
        const place = BUILDINGS[pin.buildingId];
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${colorFor(index)};color:white;border-radius:999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)">${index + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([place.lat, place.lng], { icon }).bindPopup(`<strong>${pin.label}</strong><br/>${place.short} · ${pin.detail}`).addTo(map);
      });

      for (const leg of legs) {
        const fromMeeting = leg.from.section.meetings[0];
        const toMeeting = leg.to.section.meetings[0];
        if (!fromMeeting || !toMeeting) continue;
        const a = BUILDINGS[fromMeeting.buildingId];
        const b = BUILDINGS[toMeeting.buildingId];
        L.polyline(
          [
            [a.lat, a.lng],
            [b.lat, b.lng],
          ],
          { color: "#00356b", weight: 3, opacity: 0.8 },
        )
          .bindTooltip(`${leg.day}: ${leg.minutes} min walk`, { sticky: true })
          .addTo(map);
      }

      if (pins.length > 0) {
        const bounds = L.latLngBounds(pins.map((pin) => [BUILDINGS[pin.buildingId].lat, BUILDINGS[pin.buildingId].lng]));
        map.fitBounds(bounds.pad(0.3));
      }
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 0);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [signature]);

  return <div ref={node} className="h-[420px] w-full rounded-xl" />;
}
