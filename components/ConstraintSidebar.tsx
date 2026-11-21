"use client";

import {
  Button,
  Callout,
  Checkbox,
  Field,
  Select,
  Slider,
  TextInput,
  type CalloutTone,
} from "@/components/ui";
import type { SunLifeAlert, SunLifeSeverity } from "@/lib/healthTripEngine";
import {
  CONDITION_LABELS,
  CONDITIONS,
  isCondition,
  type Condition,
} from "@/lib/types";

/** Sun Life severity to Callout tone. `ok` is informational, never celebratory. */
const ALERT_TONES: Record<SunLifeSeverity, CalloutTone> = {
  ok: "info",
  caution: "caution",
  blocking: "risk",
};

/** Props for {@link ConstraintSidebar}. All state lives in page.tsx. */
export interface ConstraintSidebarProps {
  /** Destination label. The Deploy action is blocked while this is empty. */
  destination: string;
  /** Trip length in days, from 2 to 7. */
  days: number;
  /** Selected condition identifier. */
  condition: Condition;
  /** Medication name only; doses are never requested. */
  medication: string;
  /** Whether the user has confirmed Sun Life group travel coverage. */
  hasSunLifeTravelCoverage: boolean;
  /** Current Sun Life alert, derived by the page from the engine or the rules. */
  sunLifeAlert: SunLifeAlert;
  /** Called with the next destination label. */
  onDestinationChange: (destination: string) => void;
  /** Called with the next trip length. */
  onDaysChange: (days: number) => void;
  /** Called with the next condition; the page owns the medication default rule. */
  onConditionChange: (condition: Condition) => void;
  /** Called with the next medication label. */
  onMedicationChange: (medication: string) => void;
  /** Called with the next coverage checkbox state. */
  onCoverageChange: (hasCoverage: boolean) => void;
  /** Called when Deploy is activated; the page increments its deploy token. */
  onDeploy: () => void;
}

/**
 * The constraint rail: trip profile fields, the live Sun Life alert, and the
 * Deploy action. The page owns every value and the medication-default rule; this
 * component only renders controls and reports changes.
 */
export function ConstraintSidebar({
  destination,
  days,
  condition,
  medication,
  hasSunLifeTravelCoverage,
  sunLifeAlert,
  onDestinationChange,
  onDaysChange,
  onConditionChange,
  onMedicationChange,
  onCoverageChange,
  onDeploy,
}: ConstraintSidebarProps) {
  const destinationMissing = destination.trim().length === 0;
  const deployDescription = destinationMissing
    ? "deploy-note deploy-reason"
    : "deploy-note";

  return (
    <div className="flex flex-col gap-7">
      <p className="t-label text-muted">Trip profile</p>

      <Field id="trip-destination" label="Destination">
        {(control) => (
          <TextInput
            {...control}
            value={destination}
            onChange={(event) => onDestinationChange(event.currentTarget.value)}
            autoComplete="off"
            enterKeyHint="done"
          />
        )}
      </Field>

      <Field id="trip-days" label="Duration">
        {(control) => (
          <Slider
            id={control.id}
            value={days}
            min={2}
            max={7}
            onChange={onDaysChange}
            ariaLabel="Duration"
            ariaValueText={`${days} days`}
            ariaDescribedBy={control["aria-describedby"]}
            ariaInvalid={control["aria-invalid"]}
          />
        )}
      </Field>

      <Field id="trip-condition" label="Condition">
        {(control) => (
          <Select
            {...control}
            value={condition}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (isCondition(next)) onConditionChange(next);
            }}
          >
            {CONDITIONS.map((value) => (
              <option key={value} value={value}>
                {CONDITION_LABELS[value]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field id="trip-medication" label="Medication" hint="Name only. No doses.">
        {(control) => (
          <TextInput
            {...control}
            value={medication}
            onChange={(event) => onMedicationChange(event.currentTarget.value)}
            autoComplete="off"
          />
        )}
      </Field>

      <Checkbox
        id="sun-life-coverage"
        label="I have Sun Life group travel coverage"
        checked={hasSunLifeTravelCoverage}
        onChange={onCoverageChange}
      />

      <Callout tone={ALERT_TONES[sunLifeAlert.severity]} title={sunLifeAlert.title}>
        <div className="flex flex-col gap-1">
          {sunLifeAlert.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      </Callout>

      <div className="flex flex-col gap-2">
        <Button
          variant="accent"
          size="lg"
          fullWidth
          disabled={destinationMissing}
          aria-describedby={deployDescription}
          onClick={onDeploy}
        >
          Deploy 3-Agent Health Verification
        </Button>
        <p id="deploy-note" className="t-small text-muted">
          Runs 3 browser agents in parallel. Takes up to 2 minutes.
        </p>
        {destinationMissing ? (
          <p id="deploy-reason" className="t-small text-risk">
            Add a destination to deploy the verification.
          </p>
        ) : null}
      </div>
    </div>
  );
}
