"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { PlannerDay, PlannerPlace } from "@/lib/agent/agentTypes";

// VERIFY: Confirm the production tile licence, attribution text, and request volume
// with the chosen tile provider before launch. The public OSM tiles are not a
// high-volume production endpoint.
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CATEGORY_LABEL: Record<PlannerPlace["category"], string> = {
  stay: "Stay",
  eat: "Table",
  hike: "Hike",
  visit: "Visit",
  care: "Care",
};

function mappable(place: PlannerPlace): place is PlannerPlace & {
  lat: number;
  lng: number;
} {
  return place.lat !== null && place.lng !== null;
}

/** Leaflet route map with one marker per selected place and one line per day. */
export function TripMap({
  places,
  days,
  visible = true,
}: {
  places: readonly PlannerPlace[];
  days: readonly PlannerDay[];
  visible?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const mapped = useMemo(() => places.filter(mappable), [places]);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    let cancelled = false;
    void import("leaflet").then((module) => {
      if (cancelled) return;
      const L = module.default ?? module;
      const map = L.map(element, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      }).setView([20, 0], 2);
      map.attributionControl.setPrefix(false);
      map.attributionControl.setPosition("bottomleft");
      L.tileLayer(TILE_URL, {
        attribution: ATTRIBUTION,
        maxZoom: 19,
        minZoom: 2,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      leafletRef.current = L;
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !visible || L === null || map === null || layer === null) return;
    map.invalidateSize();
    layer.clearLayers();

    for (const [index, place] of mapped.entries()) {
      const icon = L.divIcon({
        className: "trip-map-marker",
        html: `<span class="trip-map-marker__hit"></span><span class="trip-map-marker__pin"><span class="trip-map-marker__dot trip-map-marker__dot--${place.category}"><span class="trip-map-marker__index">${index + 1}</span></span></span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([place.lat, place.lng], { icon, title: place.name })
        .bindTooltip(
          `${place.geocoded === true ? "Approximate · " : ""}${CATEGORY_LABEL[place.category]} · ${place.name}`,
          { direction: "top", offset: [0, -6] },
        )
        .addTo(layer);
    }

    const byId = new Map(mapped.map((place) => [place.id, place]));
    for (const day of days) {
      const points: Leaflet.LatLngExpression[] = [];
      for (const item of day.blocks) {
        if (item.placeId === null) continue;
        const place = byId.get(item.placeId);
        if (place !== undefined) points.push([place.lat, place.lng]);
      }
      if (points.length > 1) {
        L.polyline(points, {
          color: "var(--accent)",
          weight: 1.5,
          opacity: 0.65,
          dashArray: "4 4",
        }).addTo(layer);
      }
    }

    if (mapped.length > 0) {
      const bounds = L.latLngBounds(
        mapped.map((place) => [place.lat, place.lng] as [number, number]),
      );
      map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
    }
  }, [days, mapped, ready, visible]);

  if (mapped.length === 0) {
    return (
      <p className="t-small text-muted">
        No verified coordinates were returned. The itinerary below still lists every
        selected place.
      </p>
    );
  }

  return (
    <figure>
      <div
        ref={containerRef}
        className="trip-map h-80 w-full rounded-frame border border-hairline-strong md:h-96"
        role="region"
        aria-label="Map of selected stays, tables, hikes, visits, and care. Numbered markers match the list below."
      />
      <details className="mt-2 border-t border-hairline pt-2">
        <summary className="t-small min-h-11 cursor-pointer text-muted">
          Mapped places · {mapped.length}
        </summary>
        <ol className="mt-2 grid list-none grid-cols-1 gap-x-6 p-0 md:grid-cols-2">
          {mapped.map((place, index) => (
            <li
              key={place.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hairline py-2"
            >
              <span className="t-data-sm w-5 shrink-0 text-muted">{index + 1}</span>
              <span className="t-label shrink-0 text-muted">
                {CATEGORY_LABEL[place.category]}
              </span>
              <span className="t-small min-w-0 text-ink">{place.name}</span>
              {place.area ? (
                <span className="t-data-sm text-muted">{place.area}</span>
              ) : null}
              {place.geocoded === true ? (
                <span className="t-data-sm text-muted">approximate</span>
              ) : null}
            </li>
          ))}
        </ol>
      </details>
      <figcaption className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {(["stay", "eat", "hike", "visit", "care"] as const).map((category) => (
          <span key={category} className="t-small flex items-center gap-2 text-muted">
            <span
              aria-hidden="true"
              className={`trip-map-legend-dot trip-map-legend-dot--${category}`}
            />
            {CATEGORY_LABEL[category]}
          </span>
        ))}
        <span className="t-data-sm text-muted">
          {mapped.length} of {places.length} places mapped · OpenStreetMap
          contributors
        </span>
      </figcaption>
    </figure>
  );
}
