/**
 * Destination combobox with city autocomplete, current location, and a map picker.
 *
 * Inputs: the controlled destination string and Field accessibility bindings.
 * Outputs: a canonical place label written through onChange.
 * Invariants: typing is never blocked; suggestions are debounced, bounded, and abortable;
 * current location is reverse-geocoded to a city label; the map picker returns an exact
 * place; a provider failure leaves the typed text usable.
 */

"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Button, TextInput } from "@/components/ui";
import { LocationPickerDialog } from "@/components/LocationPickerDialog";
import {
  describePlaceKind,
  parseGeocodePlaceResponse,
  parseGeocodeResults,
  type GeocodePlace,
} from "@/lib/geocode/types";

/** Props for {@link LocationField}. */
export interface LocationFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
  /** Field noun used in the list label, status copy, and map dialog, e.g. "destination". */
  label?: string;
  /**
   * What "use current location" writes. `city` fills the nearest city (destination);
   * `place` fills the exact reverse-geocoded place (starting point, same as a map pin).
   */
  currentLocationMode?: "city" | "place";
}

type StatusTone = "muted" | "risk";

function statusForLocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access was denied. Type a city or pick a point on the map.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your location is unavailable right now. Type a city instead.";
  }
  return "Finding your location took too long. Type a city instead.";
}

/** The destination field plus its autocomplete and location tools. */
export function LocationField({
  id,
  value,
  onChange,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  placeholder,
  label = "destination",
  currentLocationMode = "city",
}: LocationFieldProps) {
  const [suggestions, setSuggestions] = useState<readonly GeocodePlace[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tone, setTone] = useState<StatusTone>("muted");
  const [geolocating, setGeolocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lastPlace, setLastPlace] = useState<GeocodePlace | null>(null);
  const suppressRef = useRef<string | null>(null);
  const focusedRef = useRef(false);
  const mountedRef = useRef(true);
  const listId = `${id}-suggestions`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (suppressRef.current !== null && suppressRef.current === value) {
      suppressRef.current = null;
      return;
    }
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const response = await fetch(
            `/api/geocode/search?q=${encodeURIComponent(query)}&limit=6`,
            { headers: { Accept: "application/json" }, signal: controller.signal },
          );
          const body: unknown = await response.json();
          if (controller.signal.aborted) return;
          const results = parseGeocodeResults(body);
          setSuggestions(results);
          setOpen(results.length > 0 && focusedRef.current);
          setActive(results.length > 0 ? 0 : -1);
          if (!response.ok) {
            setTone("risk");
            setStatus("Location search is unavailable. Type the city and country instead.");
          } else if (results.length === 0) {
            setTone("muted");
            setStatus("No matching place. Try a nearby city or pick on the map.");
          } else {
            setStatus(null);
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setTone("risk");
          setStatus("Location search is unavailable. Type the city and country instead.");
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  function selectPlace(
    place: GeocodePlace,
    nextLabel = place.label,
    nextStatus: string | null = null,
  ): void {
    suppressRef.current = nextLabel;
    setLastPlace(place);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    setLoading(false);
    setTone("muted");
    setStatus(nextStatus);
    onChange(nextLabel);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.currentTarget.value;
    suppressRef.current = null;
    setLastPlace(null);
    setStatus(null);
    setTone("muted");
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    setLoading(next.trim().length >= 2);
    onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open && suggestions.length > 0) {
        setOpen(true);
        setActive(0);
        return;
      }
      setActive((current) =>
        suggestions.length === 0 ? -1 : Math.min(suggestions.length - 1, current + 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open && suggestions.length > 0) {
        setOpen(true);
        setActive(suggestions.length - 1);
        return;
      }
      setActive((current) => (suggestions.length === 0 ? -1 : Math.max(0, current - 1)));
      return;
    }
    if (event.key === "Enter" && open && active >= 0) {
      const place = suggestions[active];
      if (place !== undefined) {
        event.preventDefault();
        selectPlace(place);
      }
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  function useCurrentLocation(): void {
    if (!("geolocation" in navigator)) {
      setTone("risk");
      setStatus("This browser cannot read your location. Type a city instead.");
      return;
    }
    setGeolocating(true);
    setTone("muted");
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const response = await fetch(
              `/api/geocode/reverse?lat=${position.coords.latitude.toFixed(6)}&lon=${position.coords.longitude.toFixed(6)}&mode=${currentLocationMode}`,
              { headers: { Accept: "application/json" } },
            );
            const body: unknown = await response.json();
            const place = parseGeocodePlaceResponse(body);
            if (!mountedRef.current) return;
            if (place === null) {
              setTone("risk");
              setStatus(
                currentLocationMode === "place"
                  ? "We found your position but could not name the location. Type it instead."
                  : "We found your position but could not name the city. Type it instead.",
              );
              return;
            }
            selectPlace(
              place,
              currentLocationMode === "place" ? place.label : place.cityLabel,
              currentLocationMode === "place"
                ? "Using your current location."
                : "Using your current city.",
            );
          } catch {
            if (mountedRef.current) {
              setTone("risk");
              setStatus(
                currentLocationMode === "place"
                  ? "We found your position but could not name the location. Type it instead."
                  : "We found your position but could not name the city. Type it instead.",
              );
            }
          } finally {
            if (mountedRef.current) setGeolocating(false);
          }
        })();
      },
      (error) => {
        if (!mountedRef.current) return;
        setGeolocating(false);
        setTone("risk");
        setStatus(statusForLocationError(error));
      },
      {
        enableHighAccuracy: currentLocationMode === "place",
        timeout: 15_000,
        maximumAge: currentLocationMode === "place" ? 0 : 300_000,
      },
    );
  }

  const activeId = open && active >= 0 ? `${listId}-${active}` : undefined;
  const showNoResults =
    lastPlace === null &&
    !loading &&
    !open &&
    value.trim().length >= 2 &&
    suggestions.length === 0 &&
    status === null;
  const statusText =
    status ??
    (showNoResults ? "No matching place. Try a nearby city or pick on the map." : null);

  return (
    <div>
      <div className="relative">
        <TextInput
          id={id}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            focusedRef.current = true;
            if (suggestions.length > 0 && value.trim().length >= 2) setOpen(true);
          }}
          onBlur={() => {
            focusedRef.current = false;
            window.setTimeout(() => setOpen(false), 100);
          }}
          autoComplete="off"
          enterKeyHint="done"
          maxLength={120}
          placeholder={placeholder ?? "City, country"}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={activeId}
          aria-haspopup="listbox"
          aria-describedby={describedBy}
          aria-invalid={invalid === true ? true : undefined}
        />

        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label.charAt(0).toUpperCase()}${label.slice(1)} suggestions`}
            className="location-list absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-frame border border-solid border-hairline-strong bg-surface p-0"
          >
            {suggestions.map((place, index) => {
              const detail = [
                describePlaceKind(place.kind),
                place.cityLabel === place.label ? null : place.cityLabel,
              ]
                .filter((part): part is string => part !== null && part.length > 0)
                .join(" · ");
              return (
                <li
                  key={`${place.label}-${place.lat}-${place.lng}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => selectPlace(place)}
                  className={`cursor-pointer border-t border-solid border-hairline px-3 py-3 first:border-t-0 ${
                    index === active ? "bg-sunken" : "bg-surface"
                  }`}
                >
                  <p className="t-small text-ink">{place.label}</p>
                  {detail.length > 0 ? (
                    <p className="t-data-sm mt-1 text-muted">{detail}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="md"
          leadingIcon={LocateFixed}
          loading={geolocating}
          onClick={useCurrentLocation}
        >
          Use current location
        </Button>
        <Button
          variant="secondary"
          size="md"
          leadingIcon={MapPin}
          onClick={() => setPickerOpen(true)}
        >
          Pick on map
        </Button>
      </div>

      {loading ? (
        <p role="status" className="t-data-sm mt-2 text-muted">
          Searching cities…
        </p>
      ) : statusText !== null ? (
        <p
          role={tone === "risk" ? "alert" : "status"}
          className={`t-data-sm mt-2 ${tone === "risk" ? "text-risk" : "text-muted"}`}
        >
          {statusText}
        </p>
      ) : null}

      {pickerOpen ? (
        <LocationPickerDialog
          open
          fieldLabel={label}
          initialQuery={value}
          initialCenter={lastPlace === null ? null : { lat: lastPlace.lat, lng: lastPlace.lng }}
          onClose={() => {
            setPickerOpen(false);
            document.getElementById(id)?.focus();
          }}
          onConfirm={(place) => {
            selectPlace(place, place.label, "Pinned location selected.");
            setPickerOpen(false);
            document.getElementById(id)?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
