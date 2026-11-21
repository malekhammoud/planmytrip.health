"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useId, useState, type CSSProperties } from "react";
import { Button, DataRow, Metric } from "@/components/ui";
import { buildCareCard } from "@/lib/careCard";
import {
  CONDITION_PROFILES,
  type HealthTripDay,
  type HealthTripPlan,
  type ItineraryBlock,
} from "@/lib/healthTripEngine";
import { CONDITION_LABELS, type Condition } from "@/lib/types";
import { PacingStrip } from "./PacingStrip";
/** Props for {@link ItineraryBoard}. */
export interface ItineraryBoardProps {
  plan: HealthTripPlan;
  destination: string;
  condition: Condition;
  medication: string;
}

/** Props for {@link CareCardButton}. */
export interface CareCardButtonProps {
  destination: string;
  condition: Condition;
  medication: string;
  plan: HealthTripPlan;
}

type CopyState = "idle" | "copied" | "failed";

function formatCount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

function KpiStrip({ plan, condition }: { plan: HealthTripPlan; condition: Condition }) {
  const profileLabel = CONDITION_LABELS[condition];
  const profileFloor = CONDITION_PROFILES[condition].residualRiskFloor;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3">
      <div className="pb-6 md:pb-0 md:pr-4">
        <Metric
          label="Health Safety Score"
          value={plan.healthSafetyScore}
          unit="/100"
          sub="Modeled estimate"
          compare={{
            thisPlan: plan.healthSafetyScore,
            baseline: plan.baselineScore,
            baselineLabel: "Standard baseline",
          }}
          info={`Inputs for ${profileLabel}: profile floor ${profileFloor}/100, step and walking ceilings, planned daily load, exertion, recovery minutes, and trip length. Standard baseline: 10,000 steps, 8 km, exertion 2.2, no recovery.`}
        />
      </div>
      <div className="border-t border-hairline py-6 md:border-l md:border-t-0 md:px-4 md:py-0">
        <Metric
          label="Daily Step Ceiling"
          value={formatCount(plan.dailyStepCeiling)}
          unit="steps"
          sub="Hard limit per day for this profile"
        />
      </div>
      <div className="border-t border-hairline pt-6 md:border-l md:border-t-0 md:pl-4 md:pt-0">
        <Metric
          label="Flare / ER Risk Reduction"
          value={plan.riskReductionPct}
          unit="%"
          sub="Modeled estimate"
          info={`Inputs for ${profileLabel}: profile floor ${profileFloor}/100, planned daily load, condition ceilings, exertion, recovery minutes, trip length, and the standard sightseeing baseline (10,000 steps, 8 km, exertion 2.2, no recovery).`}
        />
      </div>
    </div>
  );
}

function CapsValue({ children }: { children: string }) {
  return <span className="t-data text-ink">{children}</span>;
}

function DayCaps({ day, mobile = false }: { day: HealthTripDay; mobile?: boolean }) {
  return (
    <div className={mobile ? "mt-4 grid grid-cols-2 gap-4 md:hidden" : "hidden md:block"}>
      <DataRow label="Step cap" layout="stacked">
        <CapsValue>{`${formatCount(day.stepCap)} steps`}</CapsValue>
      </DataRow>
      <DataRow label="Walk cap" layout="stacked">
        <CapsValue>{`${day.walkingCapKm.toFixed(1)} km`}</CapsValue>
      </DataRow>
    </div>
  );
}

function BlockList({ blocks }: { blocks: readonly ItineraryBlock[] }) {
  return (
    <ul className="mt-4 flex list-none flex-col gap-2 p-0">
      {blocks.map((block, index) => (
        <li
          key={`${index}-${block.label}`}
          className="flex items-baseline justify-between gap-4"
        >
          <span className="t-small text-ink">{block.label}</span>
          <span className="t-data shrink-0 text-muted">
            {formatDuration(block.durationMin)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ItineraryDayRow({ day, index }: { day: HealthTripDay; index: number }) {
  const style = { "--day-index": index } as CSSProperties;
  return (
    <li
      className="day-row border-t border-hairline py-8 md:grid md:grid-cols-[64px_minmax(0,1fr)_160px] md:gap-8"
      style={style}
    >
      <p aria-hidden="true" className="t-metric-day text-ink">
        {String(day.day).padStart(2, "0")}
      </p>
      <div className="mt-2 min-w-0 [overflow-wrap:anywhere] md:mt-0">
        <h3 className="t-heading text-ink">
          <span className="sr-only">Day {day.day}: </span>
          {day.title}
        </h3>
        <DayCaps day={day} mobile />
        <p className="t-body mt-4 text-muted">{day.pacingRule}</p>
        <PacingStrip blocks={day.blocks} day={day.day} />
        <BlockList blocks={day.blocks} />
        <div className="mt-6 rounded-frame bg-accent-soft p-3">
          <p className="t-label text-muted">Checkpoint</p>
          <p className="t-small mt-1 text-ink">{day.healthCheckpoint}</p>
        </div>
      </div>
      <div className="hidden md:block">
        <DayCaps day={day} />
      </div>
    </li>
  );
}

/**
 * KPI strip plus one paced row per day. Everything renders from the engine plan
 * alone, so the board is independent of the agent swarm. Day rows use the global
 * `.day-row` rise animation, which the global reduced-motion rule disables.
 */
export function ItineraryBoard({
  plan,
  destination,
  condition,
}: ItineraryBoardProps) {
  const listLabel = `Paced itinerary for ${destination.trim() || "this trip"}`;
  return (
    <div>
      <KpiStrip plan={plan} condition={condition} />
      {plan.itinerary.length === 0 ? (
        <p className="t-small mt-6 text-muted">
          No itinerary days were generated for this plan.
        </p>
      ) : (
        <ol aria-label={listLabel} className="mt-10 list-none p-0">
          {plan.itinerary.map((day, index) => (
            <ItineraryDayRow key={day.day} day={day} index={index} />
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Copy the deterministic care card with a two-second "Copied" label. The card is
 * plain text; when the Clipboard API is unavailable the component shows the same
 * text in a read-only, auto-selecting textarea (the one specified raw control
 * outside components/ui) so it can be copied by hand.
 */
export function CareCardButton({
  destination,
  condition,
  medication,
  plan,
}: CareCardButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const fallbackId = useId();
  const careCardText = buildCareCard(destination, condition, medication, plan);

  useEffect(() => {
    if (copyState !== "copied") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function handleCopy(): Promise<void> {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(careCardText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="secondary"
        leadingIcon={copyState === "copied" ? Check : Copy}
        onClick={() => {
          void handleCopy();
        }}
      >
        {copyState === "copied" ? "Copied" : "Copy care card"}
      </Button>
      <p role="status" className="sr-only">
        {copyState === "copied" ? "Care card copied." : ""}
      </p>
      {copyState === "failed" ? (
        <div className="w-80 max-w-[calc(100vw-48px)] text-left">
          <p role="status" className="t-small text-muted">
            Clipboard unavailable. Select the text below.
          </p>
          <label htmlFor={fallbackId} className="t-label mt-2 block text-muted">
            Care card text
          </label>
          {/* design-guard-ignore: components/ui has no fallback control; this read-only textarea is the specified clipboard fallback. */}<textarea
            id={fallbackId}
            readOnly
            rows={10}
            value={careCardText}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 block w-full resize-y rounded-frame border border-solid border-hairline-strong bg-surface p-3 t-data text-ink"
          />
        </div>
      ) : null}
    </div>
  );
}
