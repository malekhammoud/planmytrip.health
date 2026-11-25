/**
 * Short-lived cross-site acquisition attribution.
 *
 * Inputs: UTM parameters on a PlanMyTrip signup link.
 * Outputs: an allowlisted campaign record in sessionStorage, or null.
 * Invariants: no query string, referrer, account id, or health field is stored. The record
 * expires after 30 minutes so a later organic signup is not misattributed.
 */

export interface Acquisition {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  at: number;
}

const KEY = "planmytrip.acquisition";
const MAX_AGE_MS = 30 * 60_000;

function clean(value: string | null): string {
  return (value ?? "").replace(/[^a-z0-9_-]/gi, "").slice(0, 60);
}

/** Stores the campaign from a signup URL when one is present. */
export function rememberAcquisition(search: URLSearchParams): Acquisition | null {
  const source = clean(search.get("utm_source"));
  if (source.length === 0) return null;
  const acquisition: Acquisition = {
    source,
    medium: clean(search.get("utm_medium")),
    campaign: clean(search.get("utm_campaign")),
    content: clean(search.get("utm_content")),
    at: Date.now(),
  };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(acquisition));
  } catch {
    // A blocked session store only loses attribution; it never blocks signup.
  }
  return acquisition;
}

/** Returns the fresh acquisition record, if this session has one. */
export function readAcquisition(): Acquisition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const value = JSON.parse(raw) as Partial<Acquisition>;
    if (
      typeof value.source !== "string" ||
      value.source.length === 0 ||
      typeof value.at !== "number" ||
      Date.now() - value.at > MAX_AGE_MS
    ) {
      return null;
    }
    return {
      source: value.source.slice(0, 60),
      medium: typeof value.medium === "string" ? value.medium.slice(0, 60) : "",
      campaign: typeof value.campaign === "string" ? value.campaign.slice(0, 60) : "",
      content: typeof value.content === "string" ? value.content.slice(0, 60) : "",
      at: value.at,
    };
  } catch {
    return null;
  }
}

/** Props to attach to a conversion event, or an empty object. */
export function acquisitionProps(): Record<string, string> {
  const acquisition = readAcquisition();
  if (acquisition === null) return {};
  return {
    acquisition_source: acquisition.source,
    acquisition_medium: acquisition.medium,
    acquisition_campaign: acquisition.campaign,
    acquisition_content: acquisition.content,
  };
}
