import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetCacheMemory, writeCacheRow } from "./cacheStore";
import {
  parseVenueCachePayload,
  readCachedVenue,
  venueCacheKey,
  writeCachedVenue,
} from "./venueCache";
import type { MenuEvidence, HotelEvidence } from "@/lib/venue/types";

const previousMemory = process.env.PLANMYTRIP_CACHE_MEMORY;
const previousDatabase = process.env.DATABASE_URL;

const menu: MenuEvidence = {
  kind: "menu",
  placeId: "place-1",
  placeName: "Cafe",
  sourceUrl: "https://example.com/menu",
  retrievedAt: "2026-11-22T10:00:00.000Z",
  currency: "CAD",
  items: [],
  notes: [],
};

const hotel: HotelEvidence = {
  kind: "hotel",
  placeId: "place-2",
  placeName: "Hotel",
  sourceUrl: "https://example.com/hotel",
  retrievedAt: "2026-11-22T10:00:00.000Z",
  checkIn: "2026-12-10",
  checkOut: "2026-12-14",
  travelers: 2,
  roomType: null,
  nightlyRate: 189,
  total: null,
  taxesAndFees: null,
  currency: "CAD",
  cancellation: null,
  bookingUrl: null,
  notes: [],
};

describe("venue cache", () => {
  beforeAll(() => {
    process.env.PLANMYTRIP_CACHE_MEMORY = "1";
    delete process.env.DATABASE_URL;
  });
  afterAll(() => {
    if (previousMemory === undefined) delete process.env.PLANMYTRIP_CACHE_MEMORY;
    else process.env.PLANMYTRIP_CACHE_MEMORY = previousMemory;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
  });
  beforeEach(() => resetCacheMemory());

  it("reads a menu and a dated hotel quote with recorded telemetry", async () => {
    const menuKey = venueCacheKey({ kind: "menu", url: menu.sourceUrl, placeId: menu.placeId ?? "" });
    const hotelKey = venueCacheKey({
      kind: "hotel",
      url: hotel.sourceUrl,
      placeId: hotel.placeId ?? "",
      checkIn: hotel.checkIn,
      checkOut: hotel.checkOut,
      travelers: hotel.travelers,
    });
    await writeCachedVenue(
      menuKey,
      {
        evidence: menu,
        sources: [{ url: menu.sourceUrl, title: "Cafe menu", api: "fetch" }],
        activity: [{ text: "Read the menu", kind: "read", offsetSec: 12 }],
        durationSec: 18,
      },
      "2026-11-22T10:00:00.000Z",
    );
    await writeCachedVenue(
      hotelKey,
      {
        evidence: hotel,
        sources: [{ url: hotel.sourceUrl, title: "Hotel booking", api: "fetch" }],
        activity: [],
        durationSec: 0,
      },
      "2026-11-22T10:00:00.000Z",
    );
    const storedMenu = await readCachedVenue(menuKey);
    expect(storedMenu?.evidence.placeName).toBe("Cafe");
    expect(storedMenu?.sources[0]?.url).toBe(menu.sourceUrl);
    expect(storedMenu?.activity[0]?.offsetSec).toBe(12);
    const storedHotel = await readCachedVenue(hotelKey);
    expect(storedHotel?.evidence.kind).toBe("hotel");
    expect(storedHotel?.durationSec).toBe(0);
  });

  it("does not reuse a hotel quote for different dates", async () => {
    const key = venueCacheKey({
      kind: "hotel",
      url: hotel.sourceUrl,
      placeId: hotel.placeId ?? "",
      checkIn: "2026-12-10",
      checkOut: "2026-12-14",
      travelers: 2,
    });
    await writeCachedVenue(key, { evidence: hotel, sources: [], activity: [], durationSec: 0 });
    const other = venueCacheKey({
      kind: "hotel",
      url: hotel.sourceUrl,
      placeId: hotel.placeId ?? "",
      checkIn: "2027-01-10",
      checkOut: "2027-01-14",
      travelers: 2,
    });
    expect(await readCachedVenue(other)).toBeNull();
  });

  it("reads an evidence-only row written before the v2 envelope", async () => {
    const key = venueCacheKey({ kind: "menu", url: menu.sourceUrl, placeId: menu.placeId ?? "" });
    await writeCacheRow({
      key,
      kind: "venue",
      columns: {
        destination: "",
        days: null,
        condition: null,
        medication: "",
        interests: "",
        budget: "",
        transport: "",
      },
      payload: menu,
      createdAt: "2026-11-22T10:00:00.000Z",
      expiresAt: "2026-11-29T10:00:00.000Z",
    });
    const record = await readCachedVenue(key);
    expect(record?.evidence).toEqual(menu);
    expect(record?.sources).toEqual([
      { url: menu.sourceUrl, title: "Cafe page", api: "fetch" },
    ]);
    expect(record?.activity).toEqual([]);
  });

  it("keeps two venues on the same listing URL apart", () => {
    const shared = "https://www.happycow.net/north_america/canada/ontario/london/";
    const first = venueCacheKey({ kind: "menu", url: shared, placeId: "place-2" });
    const second = venueCacheKey({ kind: "menu", url: shared, placeId: "place-3" });
    expect(first).not.toBe(second);
  });

  it("rejects a malformed v2 payload", () => {
    expect(parseVenueCachePayload({ v: 2, evidence: { kind: "menu" } })).toBeNull();
  });
});
