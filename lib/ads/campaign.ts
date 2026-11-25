/**
 * House advertising copy and destination personalization.
 *
 * Inputs: a free-text destination, an ad intent, and a variant.
 * Outputs: one campaign object with a city, a headline, body copy, a CTA label, and
 *          destination rows for the campaign file.
 * Invariants: the ad names at most the destination and never a health profile, condition,
 * or account. A curated city note is used only when the destination's country matches;
 * otherwise the generic health-trip copy stays safe for any place. All copy is a
 * planning aid, never medical advice.
 */

/** The two campaign jobs. `plan` asks for a trip start; `upgrade` sells Care Circle. */
export type AdIntent = "plan" | "upgrade";

/** The three house-ad layouts. */
export type AdVariant = "poster" | "strip" | "inline";

/** One row in the campaign file. */
export interface CampaignRow {
  term: string;
  detail: string;
}

/** Everything an ad layout needs to render one destination. */
export interface DestinationCampaign {
  /** Clean destination used for links and tracking. */
  destination: string;
  city: string;
  country: string;
  /** Deterministic two-digit campaign number, for the editorial furniture. */
  issue: string;
  headline: string;
  copy: string;
  meta: string;
  finePrint: string;
  ctaLabel: string;
  rows: readonly CampaignRow[];
}

/**
 * Curated notes keyed by normalized city. The tuple is country then note; the country
 * check prevents "Paris, Texas" from borrowing the Seine.
 */
const CITY_NOTES: Readonly<
  Record<string, readonly [country: string, note: string]>
> = {
  paris: [
    "France",
    "Seine-side walks, museum rest stops, and a route that ends before your energy does.",
  ],
  london: [
    "United Kingdom",
    "Museum mornings, park afternoons, and a pace that leaves room for the weather.",
  ],
  rome: [
    "Italy",
    "Ancient streets, long lunches, and a day that ends before your energy does.",
  ],
  florence: ["Italy", "Cobbles, museum mornings, and a route that is easy on the knees."],
  venice: ["Italy", "Bridge steps, short blocks, and a route that handles the canals."],
  milan: ["Italy", "Short hops, museum stops, and a day with room to recover."],
  naples: ["Italy", "Short blocks, shaded afternoons, and a route that manages the heat."],
  barcelona: [
    "Spain",
    "Gaudí mornings, shaded afternoons, and a route that fits the heat.",
  ],
  madrid: ["Spain", "Late dinners, shaded afternoons, and a route that respects the heat."],
  seville: ["Spain", "Early starts, shaded squares, and recovery at midday."],
  lisbon: ["Portugal", "Seven hills, short blocks, and recovery scheduled between them."],
  porto: ["Portugal", "River walks, short climbs, and a route that leaves room to rest."],
  amsterdam: ["Netherlands", "Canal walks, short blocks, and a route that is easy on the knees."],
  berlin: ["Germany", "Museum islands, long lunches, and a day that leaves room to recover."],
  munich: ["Germany", "Beer-garden pauses, short hops, and a day that does not overfill."],
  vienna: ["Austria", "Coffee houses, museum mornings, and a day that leaves room to rest."],
  prague: ["Czechia", "Cobbles, short blocks, and a route that is easy on the knees."],
  budapest: ["Hungary", "Thermal baths, short walks, and recovery on the schedule."],
  warsaw: ["Poland", "Short hops, museum stops, and a day with room to recover."],
  krakow: ["Poland", "Cobbles, short blocks, and a route that is easy on the knees."],
  athens: ["Greece", "Acropolis mornings, shaded afternoons, and a route that respects the climb."],
  santorini: ["Greece", "Cliff steps, short blocks, and a route that respects the climb."],
  istanbul: ["Turkey", "Mosque mornings, ferry afternoons, and a pace that handles the hills."],
  reykjavik: ["Iceland", "Weather-flexible days, short drives, and recovery after the road."],
  dublin: ["Ireland", "Short hops, pub stops, and a route that does not overfill the day."],
  edinburgh: ["United Kingdom", "Hill-light days, close-in stops, and a pace that accounts for the climbs."],
  copenhagen: ["Denmark", "Harbour days, short blocks, and recovery on the schedule."],
  stockholm: ["Sweden", "Island hops, short blocks, and a pace that stays calm."],
  oslo: ["Norway", "Ferries, forest walks, and a route that fits the daylight."],
  helsinki: ["Finland", "Ferry mornings, sauna afternoons, and a route that leaves room to rest."],
  zurich: ["Switzerland", "Lake walks, calm trains, and a route with altitude in mind."],
  geneva: ["Switzerland", "Lake walks, short blocks, and a route that respects the altitude."],
  brussels: ["Belgium", "Short hops, long lunches, and a day paced around both."],
  bruges: ["Belgium", "Cobbles, short blocks, and a route that is easy on the knees."],
  dubrovnik: ["Croatia", "Old-town steps, short blocks, and a route that respects the climb."],
  split: ["Croatia", "Harbour walks, short blocks, and recovery between the old town and the water."],
  ljubljana: ["Slovenia", "River walks, short blocks, and a day that leaves room to rest."],
  sarajevo: ["Bosnia and Herzegovina", "Hill views, short climbs, and a pace that leaves room to recover."],
  belgrade: ["Serbia", "River walks, long lunches, and a day paced around both."],
  bucharest: ["Romania", "Short hops, park stops, and a day with room to recover."],
  sofia: ["Bulgaria", "Short blocks, museum stops, and a day that leaves room to rest."],
  kyiv: ["Ukraine", "Short blocks, park stops, and a pace that stays calm."],
  moscow: ["Russia", "Museum mornings, short metro hops, and recovery between the long walks."],
  marrakech: ["Morocco", "Souks in the cool hours, rest at midday, and a route that respects the heat."],
  cairo: ["Egypt", "Early starts, indoor afternoons, and a route that respects the heat."],
  "cape town": ["South Africa", "Mountain views, wind-aware days, and recovery built into the route."],
  johannesburg: ["South Africa", "Short hops, shaded blocks, and recovery between stops."],
  nairobi: ["Kenya", "Altitude-aware pacing, short drives, and recovery on the schedule."],
  dubai: ["United Arab Emirates", "Indoor mornings, shaded afternoons, and a route built for the heat."],
  doha: ["Qatar", "Indoor mornings, short blocks, and recovery in the heat."],
  "tel aviv": ["Israel", "Beach mornings, shaded afternoons, and a route that leaves room to rest."],
  jerusalem: ["Israel", "Old-city steps, short blocks, and a route that respects the climb."],
  delhi: ["India", "Early starts, short outdoor blocks, and recovery in the heat."],
  mumbai: ["India", "Early starts, short blocks, and a route that manages the heat."],
  jaipur: ["India", "Early starts, shaded courtyards, and recovery at midday."],
  kolkata: ["India", "Tram rides, short blocks, and recovery at midday."],
  bangkok: ["Thailand", "Cool-hour starts, midday rest, and a route built around the heat."],
  "chiang mai": ["Thailand", "Cool mornings, temple stops, and heat-aware afternoons."],
  singapore: ["Singapore", "Heat-aware blocks, covered walks, and midday recovery."],
  "kuala lumpur": ["Malaysia", "Cool-hour starts, short blocks, and recovery at midday."],
  bali: ["Indonesia", "Heat-aware blocks, short drives, and recovery between stops."],
  jakarta: ["Indonesia", "Cool-hour starts, short blocks, and recovery in the heat."],
  hanoi: ["Vietnam", "Early starts, short blocks, and a route that manages the heat."],
  "ho chi minh city": ["Vietnam", "Early starts, shaded blocks, and recovery at midday."],
  "hong kong": ["Hong Kong", "Escalators, ferries, and a route that handles the hills."],
  beijing: ["China", "Short blocks, museum stops, and recovery between the big sights."],
  shanghai: ["China", "Neighbourhood days, short metro hops, and recovery between the long walks."],
  tokyo: ["Japan", "Neighbourhood days, train hops, and recovery between the long walks."],
  kyoto: ["Japan", "Temple mornings, quiet afternoons, and a route that respects the heat."],
  osaka: ["Japan", "Short hops, covered arcades, and a day with room to recover."],
  seoul: ["South Korea", "Neighbourhood days, subway hops, and rest between the long walks."],
  taipei: ["Taiwan", "Night markets, short blocks, and recovery in the heat."],
  sydney: ["Australia", "Coastal walks, ferry hops, and a pace that still leaves an afternoon."],
  melbourne: ["Australia", "Laneway stops, coffee, and a day with room to recover."],
  auckland: ["New Zealand", "Ferries, coastal walks, and a route that fits a slower day."],
  queenstown: ["New Zealand", "Altitude-aware days, short walks, and recovery between the views."],
  honolulu: ["United States", "Beach mornings, shaded afternoons, and recovery in the heat."],
  "new york": ["United States", "Big city, bounded days, and a route that does not depend on luck."],
  "san francisco": ["United States", "Hills, fog, and a route with recovery between them."],
  "los angeles": ["United States", "Drives, short blocks, and a day that does not fight the traffic."],
  chicago: ["United States", "Lake walks, museum mornings, and a route that handles the wind."],
  seattle: ["United States", "Coffee, ferries, and a route that respects the hills."],
  boston: ["United States", "History on foot, short blocks, and a route that is easy on the knees."],
  miami: ["United States", "Beach mornings, shaded afternoons, and recovery in the heat."],
  "new orleans": ["United States", "Short blocks, shaded courtyards, and a day that does not overfill."],
  toronto: ["Canada", "Waterfront walks, short hops, and a route that fits a slower day."],
  vancouver: ["Canada", "Seawall walks, forest air, and a route with room to breathe."],
  montreal: ["Canada", "Neighbourhood walks, long lunches, and a day paced around both."],
  "quebec city": ["Canada", "Cobbles, short blocks, and a route that handles the climb."],
  banff: ["Canada", "Altitude-aware days, short hikes, and recovery between the views."],
  "mexico city": ["Mexico", "Altitude-aware pacing, long lunches, and recovery in the afternoon."],
  oaxaca: ["Mexico", "Market mornings, shaded afternoons, and a day that leaves room to rest."],
  cancun: ["Mexico", "Beach mornings, shaded afternoons, and recovery in the heat."],
  havana: ["Cuba", "Cool-hour walks, short blocks, and a route that manages the heat."],
  "san juan": ["Puerto Rico", "Old-town steps, shaded squares, and recovery at midday."],
  cartagena: ["Colombia", "Heat-aware blocks, shaded afternoons, and recovery at midday."],
  bogota: ["Colombia", "Altitude-aware pacing, short blocks, and recovery between stops."],
  medellin: ["Colombia", "Short blocks, shaded afternoons, and a pace that stays calm."],
  quito: ["Ecuador", "Altitude-aware days, short blocks, and recovery between stops."],
  lima: ["Peru", "Coastal fog, short blocks, and a route that leaves room to rest."],
  cusco: ["Peru", "Altitude-aware pacing, short blocks, and recovery on the schedule."],
  "la paz": ["Bolivia", "Altitude-aware days, short blocks, and recovery between stops."],
  santiago: ["Chile", "Altitude-aware days, short drives, and recovery in the afternoon."],
  "buenos aires": ["Argentina", "Late nights, long lunches, and a day paced around both."],
  mendoza: ["Argentina", "Short drives, shaded afternoons, and recovery between the vineyards."],
  "rio de janeiro": ["Brazil", "Beach mornings, shaded afternoons, and a route that respects the heat."],
  "sao paulo": ["Brazil", "Short hops, shaded blocks, and recovery between stops."],
  montevideo: ["Uruguay", "River walks, short blocks, and a day that leaves room to rest."],
  nadi: ["Fiji", "Heat-aware blocks, short drives, and recovery between stops."],
};

/** Spelling variants that should reach a curated note. */
const CITY_ALIASES: Readonly<Record<string, string>> = {
  "new york city": "new york",
  nyc: "new york",
  cdmx: "mexico city",
  "new delhi": "delhi",
  bombay: "mumbai",
  "ho chi minh": "ho chi minh city",
  saigon: "ho chi minh city",
  cracow: "krakow",
  kiev: "kyiv",
  wien: "vienna",
  munchen: "munich",
  roma: "rome",
  firenze: "florence",
  venezia: "venice",
  milano: "milan",
  napoli: "naples",
  lisboa: "lisbon",
  oporto: "porto",
  bruxelles: "brussels",
  brugge: "bruges",
  sevilla: "seville",
  marrakesh: "marrakech",
  "la habana": "havana",
  cuzco: "cusco",
  rio: "rio de janeiro",
  sf: "san francisco",
  nola: "new orleans",
  quebec: "quebec city",
};

/** Country aliases used only to decide whether a curated city note applies. */
const COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "united states": [
    "usa",
    "us",
    "united states of america",
    "america",
    "ny",
    "ca",
    "wa",
    "il",
    "ma",
    "fl",
    "tx",
    "co",
    "or",
    "dc",
    "ga",
    "pa",
    "hi",
  ],
  "united kingdom": ["uk", "england", "scotland", "wales", "northern ireland", "great britain", "gb"],
  canada: ["ca", "on", "qc", "bc", "ab"],
  mexico: ["mx"],
  cuba: ["cu"],
  "puerto rico": ["pr"],
  colombia: ["co"],
  ecuador: ["ec"],
  peru: ["pe"],
  bolivia: ["bo", "plurinational state of bolivia"],
  chile: ["cl"],
  argentina: ["ar"],
  brazil: ["br"],
  uruguay: ["uy"],
  france: ["fr"],
  italy: ["it"],
  spain: ["es", "espana"],
  portugal: ["pt"],
  netherlands: ["nl", "holland"],
  germany: ["de", "deutschland"],
  austria: ["at", "osterreich"],
  switzerland: ["ch"],
  belgium: ["be"],
  denmark: ["dk"],
  sweden: ["se"],
  norway: ["no"],
  finland: ["fi"],
  ireland: ["ie"],
  iceland: ["is"],
  greece: ["gr"],
  croatia: ["hr"],
  slovenia: ["si"],
  serbia: ["rs"],
  romania: ["ro"],
  bulgaria: ["bg"],
  ukraine: ["ua"],
  russia: ["ru", "russian federation"],
  turkey: ["tr", "turkiye"],
  czechia: ["cz", "czech republic", "czech"],
  poland: ["pl"],
  hungary: ["hu"],
  morocco: ["ma"],
  egypt: ["eg"],
  "south africa": ["za"],
  kenya: ["ke"],
  "united arab emirates": ["ae", "uae"],
  israel: ["il"],
  india: ["in"],
  thailand: ["th"],
  singapore: ["sg"],
  malaysia: ["my"],
  indonesia: ["id"],
  vietnam: ["vn", "viet nam"],
  "hong kong": ["hk", "hong kong sar"],
  china: ["cn"],
  japan: ["jp"],
  "south korea": ["kr", "korea", "republic of korea"],
  taiwan: ["tw", "taiwan province of china"],
  australia: ["au"],
  "new zealand": ["nz"],
  fiji: ["fj"],
  "bosnia and herzegovina": ["ba", "bosnia"],
};

/** Rotating fallbacks when the browser has no last trip and no known time zone. */
export const FEATURED_DESTINATIONS = [
  "Paris, France",
  "London, United Kingdom",
  "Rome, Italy",
  "Lisbon, Portugal",
  "Tokyo, Japan",
  "Mexico City, Mexico",
  "New York, United States",
  "Barcelona, Spain",
  "Vancouver, Canada",
  "Marrakech, Morocco",
  "Reykjavik, Iceland",
  "Kyoto, Japan",
] as const;

/** Browser time zones mapped to a representative destination. Never stored. */
const TIMEZONE_DESTINATIONS: Readonly<Record<string, string>> = {
  "Europe/Paris": "Paris, France",
  "Europe/London": "London, United Kingdom",
  "Europe/Dublin": "Dublin, Ireland",
  "Europe/Lisbon": "Lisbon, Portugal",
  "Europe/Madrid": "Madrid, Spain",
  "Europe/Rome": "Rome, Italy",
  "Europe/Berlin": "Berlin, Germany",
  "Europe/Amsterdam": "Amsterdam, Netherlands",
  "Europe/Brussels": "Brussels, Belgium",
  "Europe/Vienna": "Vienna, Austria",
  "Europe/Prague": "Prague, Czechia",
  "Europe/Budapest": "Budapest, Hungary",
  "Europe/Warsaw": "Warsaw, Poland",
  "Europe/Athens": "Athens, Greece",
  "Europe/Istanbul": "Istanbul, Turkey",
  "Europe/Stockholm": "Stockholm, Sweden",
  "Europe/Oslo": "Oslo, Norway",
  "Europe/Copenhagen": "Copenhagen, Denmark",
  "Europe/Helsinki": "Helsinki, Finland",
  "Europe/Zurich": "Zurich, Switzerland",
  "Europe/Reykjavik": "Reykjavik, Iceland",
  "Europe/Kyiv": "Kyiv, Ukraine",
  "Europe/Kiev": "Kyiv, Ukraine",
  "Europe/Moscow": "Moscow, Russia",
  "America/New_York": "New York, United States",
  "America/Toronto": "Toronto, Canada",
  "America/Chicago": "Chicago, United States",
  "America/Denver": "Denver, United States",
  "America/Los_Angeles": "Los Angeles, United States",
  "America/Vancouver": "Vancouver, Canada",
  "America/Mexico_City": "Mexico City, Mexico",
  "America/Bogota": "Bogota, Colombia",
  "America/Lima": "Lima, Peru",
  "America/Santiago": "Santiago, Chile",
  "America/Sao_Paulo": "Sao Paulo, Brazil",
  "America/Argentina/Buenos_Aires": "Buenos Aires, Argentina",
  "America/Havana": "Havana, Cuba",
  "Asia/Tokyo": "Tokyo, Japan",
  "Asia/Seoul": "Seoul, South Korea",
  "Asia/Shanghai": "Shanghai, China",
  "Asia/Hong_Kong": "Hong Kong",
  "Asia/Singapore": "Singapore",
  "Asia/Bangkok": "Bangkok, Thailand",
  "Asia/Kolkata": "Kolkata, India",
  "Asia/Calcutta": "Kolkata, India",
  "Asia/Dubai": "Dubai, United Arab Emirates",
  "Asia/Jerusalem": "Tel Aviv, Israel",
  "Asia/Taipei": "Taipei, Taiwan",
  "Asia/Kuala_Lumpur": "Kuala Lumpur, Malaysia",
  "Asia/Ho_Chi_Minh": "Ho Chi Minh City, Vietnam",
  "Asia/Jakarta": "Jakarta, Indonesia",
  "Asia/Manila": "Manila, Philippines",
  "Asia/Kathmandu": "Kathmandu, Nepal",
  "Asia/Karachi": "Karachi, Pakistan",
  "Asia/Dhaka": "Dhaka, Bangladesh",
  "Asia/Riyadh": "Riyadh, Saudi Arabia",
  "Asia/Qatar": "Doha, Qatar",
  "Australia/Sydney": "Sydney, Australia",
  "Australia/Melbourne": "Melbourne, Australia",
  "Australia/Brisbane": "Brisbane, Australia",
  "Australia/Perth": "Perth, Australia",
  "Australia/Adelaide": "Adelaide, Australia",
  "Pacific/Auckland": "Auckland, New Zealand",
  "Pacific/Honolulu": "Honolulu, United States",
  "Pacific/Fiji": "Nadi, Fiji",
  "Africa/Cairo": "Cairo, Egypt",
  "Africa/Johannesburg": "Johannesburg, South Africa",
  "Africa/Nairobi": "Nairobi, Kenya",
  "Africa/Casablanca": "Marrakech, Morocco",
  "Africa/Lagos": "Lagos, Nigeria",
  "Africa/Accra": "Accra, Ghana",
};

const EMOJI_PATTERN = new RegExp(
  "\\p{Extended_Pictographic}|\\p{Regional_Indicator}",
  "gu",
);
const LETTER_OR_NUMBER = new RegExp("[\\p{L}\\p{N}]", "u");

/** Removes control characters, collapses whitespace, and returns null when unusable. */
export function safeDestination(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .replace(EMOJI_PATTERN, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length === 0 || clean.length > 140) return null;
  if (!LETTER_OR_NUMBER.test(clean)) return null;
  return clean;
}

/** Lowercase, accent-free key used for city and country matching. */
export function destinationKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value.replace(/(^|[\s-])(\S)/g, (_match, prefix: string, first: string) =>
    `${prefix}${first.toUpperCase()}`,
  );
}

function displaySegment(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return "";
  if (clean === clean.toUpperCase() && clean.length > 3) {
    return titleCase(clean.toLowerCase());
  }
  if (clean === clean.toLowerCase()) return titleCase(clean);
  return clean;
}

/** Splits a free-text destination into display city, display country, and raw segments. */
export function destinationParts(value: string): {
  city: string;
  country: string;
  segments: readonly string[];
} {
  const segments = value
    .split(",")
    .map((segment) => displaySegment(segment))
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return { city: "", country: "", segments: [] };
  const countryValue = segments.length > 1 ? segments[segments.length - 1] : "";
  const country = /^[A-Za-z]{2,3}$/.test(countryValue)
    ? countryValue.toUpperCase()
    : countryValue;
  return {
    city: segments[0],
    country,
    segments,
  };
}

/** The display city for a destination, or an empty string when unusable. */
export function cityName(value: string): string {
  return destinationParts(value).city;
}

/** The display country for a destination, or an empty string when there is none. */
export function countryName(value: string): string {
  return destinationParts(value).country;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function issueNumber(destination: string): string {
  return String((hashText(destination) % 89) + 1).padStart(2, "0");
}

/** Keeps a free-text destination from turning the campaign into a wall of type. */
function displayCity(value: string): string {
  if (value.length <= 36) return value;
  return `${value.slice(0, 33).trimEnd()}...`;
}

/** Keeps the campaign-file destination row readable in its narrow column. */
function displayPlace(value: string): string {
  if (value.length <= 64) return value;
  return `${value.slice(0, 61).trimEnd()}...`;
}

function knownNote(city: string, segments: readonly string[]): string | null {
  const key = destinationKey(city);
  const entry = CITY_NOTES[key] ?? CITY_NOTES[CITY_ALIASES[key] ?? ""];
  if (entry === undefined) return null;
  if (segments.length <= 1) return entry[1];
  const expected = destinationKey(entry[0]);
  const aliases = (COUNTRY_ALIASES[expected] ?? []).map(destinationKey);
  const tail = segments.slice(1).map(destinationKey);
  const matches = [expected, ...aliases].some((candidate) => tail.includes(candidate));
  return matches ? entry[1] : null;
}

/** Picks the featured destination for one UTC day. */
export function featuredDestination(now = new Date()): string {
  const year = now.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  const today = Date.UTC(year, now.getUTCMonth(), now.getUTCDate());
  const day = Math.floor((today - start) / 86_400_000);
  return FEATURED_DESTINATIONS[day % FEATURED_DESTINATIONS.length];
}

/** Maps a browser time zone to a representative destination when one is known. */
export function timezoneDestination(zone: string | null | undefined): string | null {
  if (typeof zone !== "string" || zone.length === 0) return null;
  return TIMEZONE_DESTINATIONS[zone] ?? null;
}

/** Builds the copy for one destination and one campaign job. */
export function campaignFor(
  value: string,
  intent: AdIntent = "plan",
): DestinationCampaign {
  const destination = safeDestination(value) ?? FEATURED_DESTINATIONS[0];
  const { city, country, segments } = destinationParts(destination);
  const safeCity = displayCity(city.length > 0 ? city : "your destination");
  const note = knownNote(safeCity, segments);
  const generic =
    "A day-by-day plan paced around your health, with a real route and a safety envelope.";
  const displayDestination =
    segments.length > 1
      ? [...segments.slice(0, -1), country].join(", ")
      : safeCity;
  const place = displayPlace(displayDestination);
  const ctaLabel =
    safeCity.length > 24 ? "Plan this trip" : `Plan ${safeCity}`;

  if (intent === "upgrade") {
    return {
      destination,
      city: safeCity,
      country,
      issue: issueNumber(destination),
      headline: `The ${safeCity} plan, with live checks.`,
      copy: `Care Circle adds live menus, room rates, and the destination advisory for ${safeCity}, so the plan carries current facts.`,
      meta: "$9/month or $60/year · Cancel from your account",
      finePrint: "Planning aid only. Not medical advice.",
      ctaLabel: "See Care Circle",
      rows: [
        { term: "Live checks", detail: "Menus, rates, advisory" },
        { term: "Trip length", detail: "Up to 20 days" },
        { term: "Saved trips", detail: "Unlimited" },
        { term: "Price", detail: "$9/month or $60/year" },
        { term: "Cancel", detail: "From your account" },
      ],
    };
  }

  return {
    destination,
    city: safeCity,
    country,
    issue: issueNumber(destination),
    headline: `Looking for a health trip to ${safeCity}?`,
    copy: `We've got you covered. ${note ?? generic}`,
    meta: "Free to start · Care Circle $9/month or $60/year",
    finePrint: "Planning aid only. Not medical advice.",
    ctaLabel,
    rows: [
      { term: "Destination", detail: place },
      { term: "Pace", detail: "Your health profile" },
      { term: "Route", detail: "Day by day, mapped" },
      { term: "Checks", detail: "Live on Care Circle" },
      { term: "Price", detail: "Free to start" },
    ],
  };
}

/** The planner path that prefills a destination after sign-in. */
export function plannerHref(destination: string): string {
  return `/?destination=${encodeURIComponent(destination)}`;
}

/** The sign-up path that returns to the prefilled planner. */
export function signUpHref(destination: string): string {
  return `/sign-up?redirect_url=${encodeURIComponent(plannerHref(destination))}`;
}
