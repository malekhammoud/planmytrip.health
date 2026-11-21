"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { AgentTeamPanel } from "@/components/AgentTeamPanel";
import { MissionBand } from "@/components/MissionBand";
import { CareCardButton, ItineraryBoard } from "@/components/ItineraryBoard";
import { MissionControl } from "@/components/mission/MissionControl";
import { PlanPanel } from "@/components/PlanPanel";
import { AdjustmentsPanel } from "@/components/VerificationAdjustments";
import { Button, Callout, SectionHeader, type CalloutTone } from "@/components/ui";
import { useAgentPlan } from "@/hooks/useAgentPlan";
import { useSwarm } from "@/hooks/useSwarm";
import { swarmSummary } from "@/lib/swarmTelemetry";
import {
  applyVerification,
  type VerificationFindingInput,
} from "@/lib/verificationOverlay";
import { WORKER_IDS } from "@/lib/swarmTypes";
import type { HealthTripPlan, SunLifeSeverity } from "@/lib/healthTripEngine";
import { describeTrip } from "@/lib/describeTrip";
import {
  BUDGET_LABELS,
  type TripConfig,
} from "@/lib/agent/agentTypes";
import { TRANSPORT_LABELS } from "@/lib/types";

/** Props for {@link PlanWorkspace}. */
export interface PlanWorkspaceProps {
  trip: TripConfig;
  plan: HealthTripPlan;
  runToken: number;
  /** Opaque browser run id shared by both agent requests and the capture route. */
  runId: string;
  /** Anonymous install id scoped to this browser. */
  installId: string;
  /** False while onboarding covers the workspace; keeps the map sized correctly. */
  visible: boolean;
  onEditTrip: () => void;
  onReplan: () => void;
}

const ALERT_TONES: Record<SunLifeSeverity, CalloutTone> = {
  ok: "info",
  caution: "caution",
  blocking: "risk",
};

function revealStyle(index: number): CSSProperties {
  return { "--reveal-index": index } as CSSProperties;
}

/**
 * The one-page result screen: trip masthead, live mission band, seven-agent deck,
 * planning signal, route stage, safety envelope, and live verification. Both agent
 * streams stay mounted for the whole page, so nothing aborts as the reader scrolls.
 */
export function PlanWorkspace({
  trip,
  plan,
  runToken,
  runId,
  installId,
  visible,
  onEditTrip,
  onReplan,
}: PlanWorkspaceProps) {
  const { state, runInput, retry } = useAgentPlan({
    destination: trip.destination,
    origin: trip.origin,
    days: trip.days,
    condition: trip.condition,
    medication: trip.medication,
    interests: trip.interests,
    budget: trip.budget,
    transport: trip.transport,
    runId,
    installId,
    captureConsent: trip.captureConsent,
    hasSunLifeTravelCoverage: trip.hasSunLifeTravelCoverage,
    runToken,
  });

  const swarm = useSwarm({
    destination: trip.destination,
    condition: trip.condition,
    medication: trip.medication,
    runId,
    installId,
    captureConsent: trip.captureConsent,
    runToken,
  });

  const [adjustmentMaster, setAdjustmentMaster] = useState(true);
  const [disabledAdjustments, setDisabledAdjustments] = useState<readonly string[]>([]);
  const verificationFindings = useMemo<VerificationFindingInput[]>(
    () =>
      WORKER_IDS.flatMap((worker) => {
        const value = swarm.state.workers[worker];
        if (value.findings === null) return [];
        return [
          {
            worker,
            findings: value.findings,
            sourceUrl: value.sourceUrl ?? "",
            retrievedAt: value.retrievedAt ?? "",
          },
        ];
      }),
    [swarm.state.workers],
  );
  const overlay = useMemo(
    () =>
      applyVerification(
        plan,
        { condition: trip.condition },
        verificationFindings,
        { master: adjustmentMaster, disabledIds: disabledAdjustments },
      ),
    [plan, trip.condition, verificationFindings, adjustmentMaster, disabledAdjustments],
  );
  const verification = swarmSummary(swarm.state);

  const toggleAdjustment = (id: string, enabled: boolean): void => {
    setDisabledAdjustments((current) =>
      enabled
        ? current.filter((entry) => entry !== id)
        : [...new Set([...current, id])],
    );
  };

  return (
    <main className="page-container pt-10 md:pt-16">
      <header
        className="reveal-section flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-6"
        style={revealStyle(0)}
      >
        <div className="min-w-0">
          <p className="t-label text-muted">Current trip</p>
          <h1 className="t-title mt-2 max-w-3xl">
            {describeTrip({
              destination: trip.destination,
              days: trip.days,
              condition: trip.condition,
            })}
          </h1>
          <p className="t-data mt-2 text-muted">
            {TRANSPORT_LABELS[trip.transport]} · {BUDGET_LABELS[trip.budget]} ·{" "}
            {trip.interests || "No extra preferences"} ·{" "}
            {trip.hasSunLifeTravelCoverage
              ? "Sun Life coverage recorded"
              : "Sun Life coverage not confirmed"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onEditTrip}>
            Edit trip
          </Button>
          <Button variant="secondary" onClick={onReplan}>
            Plan again
          </Button>
        </div>
      </header>

      <MissionBand state={state} />

      <section
        aria-labelledby="team-heading"
        className="reveal-section"
        style={revealStyle(2)}
      >
        <SectionHeader index="01" title="Planning team" id="team-heading" />
        <AgentTeamPanel state={state} runInput={runInput} />
      </section>

      <section
        aria-labelledby="route-heading"
        className="reveal-section"
        style={revealStyle(3)}
      >
        <SectionHeader index="02" title="Route and days" id="route-heading" />
        <PlanPanel
          state={state}
          runInput={runInput}
          visible={visible}
          origin={trip.origin}
          transport={trip.transport}
          capture={{ runId, installId, consent: trip.captureConsent }}
          onRetry={retry}
        />
      </section>

      <section
        aria-labelledby="safety-heading"
        className="reveal-section"
        style={revealStyle(4)}
      >
        <SectionHeader
          index="03"
          title="Safety envelope"
          id="safety-heading"
          action={
            <CareCardButton
              destination={trip.destination}
              condition={trip.condition}
              medication={trip.medication}
              plan={overlay.plan}
              adjustments={overlay.adjustments}
            />
          }
        />
        <p className="t-small measure text-muted">
          The engine derives daily step, walking, recovery, altitude, and heat limits
          from your condition profile. These limits stay authoritative.
        </p>
        {verificationFindings.length > 0 ? (
          <AdjustmentsPanel
            adjustments={overlay.adjustments}
            master={adjustmentMaster}
            onMaster={setAdjustmentMaster}
            onToggle={toggleAdjustment}
          />
        ) : null}
        <div className="mt-6">
          <Callout
            tone={ALERT_TONES[plan.sunLifeAlert.severity]}
            title={plan.sunLifeAlert.title}
          >
            <div className="flex flex-col gap-1">
              {plan.sunLifeAlert.messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </Callout>
        </div>
        <div className="mt-8">
          <ItineraryBoard
            plan={overlay.plan}
            destination={trip.destination}
            condition={trip.condition}
            medication={trip.medication}
            adjustments={overlay.adjustments}
            verification={{ checked: verification.findings, total: 3 }}
          />
        </div>
      </section>

      <section
        aria-labelledby="verification-heading"
        className="reveal-section"
        style={revealStyle(5)}
      >
        <SectionHeader
          index="04"
          title="Live verification"
          id="verification-heading"
        />
        <p className="t-small measure text-muted">
          Three browser agents check the advisory, medication and customs rules, and
          emergency coverage. Their sessions run while this page stays open.
        </p>
        <div className="mt-6">
          <MissionControl
            state={swarm.state}
            runInput={swarm.runInput}
            destination={trip.destination}
            condition={trip.condition}
            medication={trip.medication}
            onRetry={swarm.retry}
            onRerun={swarm.rerun}
          />
        </div>
      </section>
    </main>
  );
}
