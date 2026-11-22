/**
 * Accessible modal map for picking an exact destination.
 *
 * Inputs: an optional initial map center and the current destination text.
 * Outputs: one reverse-geocoded place, or a cancel.
 * Invariants: the map is imported only in the browser; a map click always re-runs the
 * reverse lookup; the confirm action stays disabled until a place is named; Escape and a
 * backdrop click close the dialog; focus returns to the caller through onClose.
 */

"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type * as Leaflet from "leaflet";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui";
import { MAP_ATTRIBUTION, MAP_TILE_URL } from "@/lib/mapTiles";
import {
  parseGeocodePlaceResponse,
  type GeocodePlace,
} from "@/lib/geocode/types";

const DEFAULT_CENTER: [number, number] = [56.1304, -106.3468];
const DEFAULT_ZOOM = 3;
const INITIAL_ZOOM = 13;

/** Props for {@link LocationPickerDialog}. */
export interface LocationPickerDialogProps {
  open: boolean;
  /** Current destination text, used to center the map when no point is known. */
  initialQuery: string;
  /** Last suggestion coordinates, when the user selected one. */
  initialCenter: { lat: number; lng: number } | null;
  /** Field noun used in the instruction copy, e.g. "destination" or "starting point". */
  fieldLabel?: string;
  onClose: () => void;
  onConfirm: (place: GeocodePlace) => void;
}

interface Pin {
  lat: number;
  lng: number;
}

interface Center {
  lat: number;
  lng: number;
  zoom: number;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** The exact-location map dialog. */
export function LocationPickerDialog({
  open,
  initialQuery,
  initialCenter,
  fieldLabel = "destination",
  onClose,
  onConfirm,
}: LocationPickerDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markerRef = useRef<Leaflet.Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const requestRef = useRef(0);
  const [center, setCenter] = useState<Center>(() =>
    initialCenter === null
      ? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1], zoom: DEFAULT_ZOOM }
      : { ...initialCenter, zoom: INITIAL_ZOOM },
  );
  const [pin, setPin] = useState<Pin | null>(null);
  const [place, setPlace] = useState<GeocodePlace | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const centerRef = useRef(center);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(
    () => () => {
      // A pending reverse lookup must not write into an unmounted dialog.
      requestRef.current += 1;
    },
    [],
  );

  const pick = useCallback(async (lat: number, lng: number): Promise<void> => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setPin({ lat, lng });
    setPlace(null);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/geocode/reverse?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&mode=place`,
        { headers: { Accept: "application/json" } },
      );
      const body: unknown = await response.json();
      if (requestRef.current !== requestId) return;
      const next = parseGeocodePlaceResponse(body);
      if (next === null) {
        setError("That point could not be named. Pick another spot or type a city.");
        return;
      }
      setPlace(next);
    } catch {
      if (requestRef.current === requestId) {
        setError("The location lookup is unavailable. Pick another spot or type a city.");
      }
    } finally {
      if (requestRef.current === requestId) setPending(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || initialCenter !== null) return;
    const query = initialQuery.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/geocode/search?q=${encodeURIComponent(query)}&limit=1`,
          { headers: { Accept: "application/json" }, signal: controller.signal },
        );
        const body: unknown = await response.json();
        if (!response.ok || typeof body !== "object" || body === null) return;
        const results = (body as { results?: unknown }).results;
        if (!Array.isArray(results) || results.length === 0) return;
        const first = results[0] as { lat?: unknown; lng?: unknown };
        if (typeof first.lat !== "number" || typeof first.lng !== "number") return;
        setCenter({ lat: first.lat, lng: first.lng, zoom: INITIAL_ZOOM });
      } catch (cause) {
        if (!isAbort(cause)) {
          // The map remains usable at the default center.
        }
      }
    })();
    return () => controller.abort();
  }, [initialCenter, initialQuery, open]);

  useEffect(() => {
    if (!open) return;
    const element = mapElementRef.current;
    if (element === null) return;
    let cancelled = false;
    void import("leaflet").then((module) => {
      if (cancelled) return;
      const L = module.default ?? module;
      const map = L.map(element, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      }).setView([centerRef.current.lat, centerRef.current.lng], centerRef.current.zoom);
      map.attributionControl.setPrefix(false);
      map.attributionControl.setPosition("bottomleft");
      L.tileLayer(MAP_TILE_URL, {
        attribution: MAP_ATTRIBUTION,
        maxZoom: 19,
        minZoom: 2,
      }).addTo(map);
      map.on("click", (event) => {
        void pick(event.latlng.lat, event.latlng.lng);
      });
      leafletRef.current = L;
      mapRef.current = map;
      const timer = window.setTimeout(() => map.invalidateSize(), 0);
      return () => window.clearTimeout(timer);
    });
    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
    // The map is created once per open; center updates use the effect below.
  }, [open, pick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!open || map === null) return;
    map.setView([center.lat, center.lng], center.zoom);
  }, [center, open]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!open || L === null || map === null) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (pin === null) return;
    const icon = L.divIcon({
      className: "location-pick-marker",
      html: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    markerRef.current = L.marker([pin.lat, pin.lng], {
      icon,
      keyboard: false,
      title: "Selected location",
    }).addTo(map);
  }, [open, pin]);

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (panel === null) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-title"
        aria-describedby="location-picker-instruction"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className="anim-rise max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-frame border border-solid border-hairline-strong bg-paper"
      >
        <div className="flex items-start justify-between gap-4 border-b border-solid border-hairline px-4 py-4 md:px-6">
          <div>
            <p className="t-label text-muted">Pick on the map</p>
            <h2 id="location-picker-title" className="t-title mt-1">
              Set the exact location
            </h2>
          </div>
          <Button variant="ghost" aria-label="Close location picker" onClick={onClose}>
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>

        <div className="px-4 py-4 md:px-6">
          <p id="location-picker-instruction" className="t-small measure text-muted">
            Pan and zoom, then tap the map to place a pin. We name the point with the
            configured geocoder. For a broad city search, type in the {fieldLabel} field
            instead.
          </p>
          <div
            ref={mapElementRef}
            className="trip-map mt-4 h-72 w-full rounded-frame border border-solid border-hairline-strong md:h-96"
            role="region"
            aria-label={`Map for picking a ${fieldLabel}. Tap to place a pin.`}
          />
          <div className="mt-4 min-h-12 border-t border-solid border-hairline pt-3">
            {pending ? (
              <p role="status" className="t-small text-muted">
                Naming this point…
              </p>
            ) : place !== null ? (
              <p role="status" className="t-small text-ink">
                <MapPin size={14} strokeWidth={1.75} aria-hidden="true" className="mr-1 inline align-[-2px]" />
                {place.label}
              </p>
            ) : (
              <p role="status" className={error === null ? "t-small text-muted" : "t-small text-risk"}>
                {error ?? "No point selected yet."}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-solid border-hairline px-4 py-4 sm:flex-row sm:justify-end md:px-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={place === null || pending}
            onClick={() => {
              if (place !== null) onConfirm(place);
            }}
          >
            Use this location
          </Button>
        </div>
      </div>
    </div>
  );
}
