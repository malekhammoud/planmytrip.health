"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  Checkbox,
  Field,
  NumberInput,
  Select,
  Slider,
  TextInput,
} from "@/components/ui";
import { LocationField } from "@/components/LocationField";
import { describeTrip } from "@/lib/describeTrip";
import { TRIP_DAYS_MAX, TRIP_DAYS_MIN } from "@/lib/healthTripTypes";
import {
  BUDGET_LABELS,
  BUDGET_LEVELS,
  type TripConfig,
} from "@/lib/agent/agentTypes";
import {
  canContinueTripStep,
  normalizeTripConfig,
} from "@/lib/onboarding";
import {
  CONDITION_LABELS,
  CONDITIONS,
  isCondition,
  isTransportMode,
  TRANSPORT_HINTS,
  TRANSPORT_LABELS,
  TRANSPORT_MODES,
} from "@/lib/types";

/** Props for {@link Onboarding}. */
export interface OnboardingProps {
  /** Draft to start from, including the current trip when editing. */
  initial: TripConfig;
  /** Plan ceiling for the duration field. Defaults to the engine maximum. */
  maxDays?: number;
  /** Receives the normalized trip configuration when the user builds the plan. */
  onComplete: (config: TripConfig) => void;
  /** Returns to the existing workspace without rebuilding, when editing. */
  onCancel?: () => void;
}

function StepMark({
  index,
  label,
  active,
}: {
  index: string;
  label: string;
  active: boolean;
}) {
  return (
    <span
      aria-current={active ? "step" : undefined}
      className={`t-label ${active ? "text-ink" : "text-muted"}`}
    >
      {index} {label}
    </span>
  );
}

/**
 * Two-step trip onboarding. Step one collects the place and shape of the trip; step
 * two collects the health profile and research consent. The finished plan opens in the
 * workspace, so this screen never carries results or live agent logs.
 */
export function Onboarding({
  initial,
  maxDays = TRIP_DAYS_MAX,
  onComplete,
  onCancel,
}: OnboardingProps) {
  const daysMax = Math.max(
    TRIP_DAYS_MIN,
    Math.min(TRIP_DAYS_MAX, Math.round(maxDays)),
  );
  const [config, setConfig] = useState<TripConfig>(() => ({
    ...initial,
    days: Math.min(initial.days, daysMax),
  }));
  const [step, setStep] = useState<1 | 2>(1);
  const canContinue = canContinueTripStep(config);
  const budgetIndex = Math.max(0, BUDGET_LEVELS.indexOf(config.budget));

  function update<K extends keyof TripConfig>(key: K, value: TripConfig[K]): void {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (step === 1) {
      if (canContinue) setStep(2);
      return;
    }
    onComplete(normalizeTripConfig(config, daysMax));
  }

  function handleCancel(): void {
    setConfig({ ...initial, days: Math.min(initial.days, daysMax) });
    setStep(1);
    onCancel?.();
  }

  return (
    <main className="page-container pt-12 md:pt-20">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
        <section aria-labelledby="onboarding-heading">
          <p className="t-label text-muted">New trip</p>
          <h1 id="onboarding-heading" className="t-display measure mt-3">
            Plan a trip that fits your body.
          </h1>
        </section>

        <section aria-labelledby="onboarding-form-heading">
          {onCancel ? (
            <div className="mb-3 flex justify-end">
              <Button variant="ghost" onClick={handleCancel}>
                Back to plan
              </Button>
            </div>
          ) : null}
          <div className="flex items-center gap-4 border-t border-ink pt-4">
            <StepMark index="01" label="Trip" active={step === 1} />
            <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
            <StepMark index="02" label="Health" active={step === 2} />
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            {step === 1 ? (
              <>
                <h2 id="onboarding-form-heading" className="t-title">
                  The trip
                </h2>
                <div className="mt-6 flex flex-col gap-7">
                  <Field
                    id="onboarding-destination"
                    label="Destination"
                    hint="Type a city, use your current location, or pick an exact point on the map."
                  >
                    {(control) => (
                      <LocationField
                        id={control.id}
                        label="destination"
                        value={config.destination}
                        onChange={(value) => update("destination", value)}
                        aria-describedby={control["aria-describedby"]}
                        aria-invalid={control["aria-invalid"]}
                        placeholder="City, country"
                      />
                    )}
                  </Field>

                  <Field
                    id="onboarding-origin"
                    label="Starting from"
                    hint="Optional. Type a home city or airport, use your current location, or pick a point on the map."
                  >
                    {(control) => (
                      <LocationField
                        id={control.id}
                        label="starting point"
                        currentLocationMode="place"
                        value={config.origin}
                        onChange={(value) => update("origin", value)}
                        aria-describedby={control["aria-describedby"]}
                        aria-invalid={control["aria-invalid"]}
                        placeholder="City, airport, or address"
                      />
                    )}
                  </Field>

                  <Field
                    id="onboarding-days"
                    label="Duration"
                    hint={`${TRIP_DAYS_MIN} to ${daysMax} days.`}
                  >
                    {(control) => (
                      <div className="flex items-baseline gap-3">
                        <div className="w-24">
                          <NumberInput
                            id={control.id}
                            value={config.days}
                            min={TRIP_DAYS_MIN}
                            max={daysMax}
                            onValueChange={(days) => update("days", days)}
                            aria-describedby={control["aria-describedby"]}
                            aria-invalid={control["aria-invalid"]}
                          />
                        </div>
                        <span className="t-small text-muted">days</span>
                      </div>
                    )}
                  </Field>
                  {daysMax < TRIP_DAYS_MAX ? (
                    <p className="t-small -mt-4 text-muted">
                      The Free Preview includes trips up to {daysMax} days.{" "}
                      <a href="/pricing" className="text-accent hover:underline">
                        See plans
                      </a>
                      .
                    </p>
                  ) : null}

                  <Field
                    id="onboarding-checkin"
                    label="Start date"
                    hint="Optional. Needed for live hotel prices."
                  >
                    {(control) => (
                      <TextInput
                        {...control}
                        type="date"
                        value={config.checkIn}
                        onChange={(event) =>
                          update("checkIn", event.currentTarget.value)
                        }
                        autoComplete="off"
                      />
                    )}
                  </Field>

                  <Field
                    id="onboarding-travelers"
                    label="Travellers"
                    hint="1 to 8 people."
                  >
                    {(control) => (
                      <div className="flex items-baseline gap-3">
                        <div className="w-24">
                          <NumberInput
                            id={control.id}
                            value={config.travelers}
                            min={1}
                            max={8}
                            onValueChange={(travelers) => update("travelers", travelers)}
                            aria-describedby={control["aria-describedby"]}
                            aria-invalid={control["aria-invalid"]}
                          />
                        </div>
                        <span className="t-small text-muted">people</span>
                      </div>
                    )}
                  </Field>

                  <Field id="onboarding-budget" label="Budget">
                    {(control) => (
                      <Slider
                        id={control.id}
                        value={budgetIndex}
                        min={0}
                        max={BUDGET_LEVELS.length - 1}
                        step={1}
                        onChange={(index) => {
                          const next = BUDGET_LEVELS[index];
                          if (next !== undefined) update("budget", next);
                        }}
                        ariaLabel="Budget"
                        ariaValueText={`${BUDGET_LABELS[config.budget]} budget`}
                        ariaDescribedBy={control["aria-describedby"]}
                        ariaInvalid={control["aria-invalid"]}
                        tickLabels={BUDGET_LEVELS.map((value) => BUDGET_LABELS[value])}
                      />
                    )}
                  </Field>

                  <Field id="onboarding-transport" label="Getting around">
                    {(control) => (
                      <Select
                        {...control}
                        value={config.transport}
                        onChange={(event) => {
                          const next = event.currentTarget.value;
                          if (isTransportMode(next)) update("transport", next);
                        }}
                      >
                        {TRANSPORT_MODES.map((value) => (
                          <option key={value} value={value}>
                            {TRANSPORT_LABELS[value]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <p className="t-small -mt-4 text-muted">
                    {TRANSPORT_HINTS[config.transport]}
                  </p>

                  <Field
                    id="onboarding-interests"
                    label="What matters"
                    hint="Optional. Food, pace, access."
                  >
                    {(control) => (
                      <TextInput
                        {...control}
                        value={config.interests}
                        onChange={(event) =>
                          update("interests", event.currentTarget.value)
                        }
                        autoComplete="off"
                        maxLength={240}
                        placeholder="Quiet food, short walks, step-free access"
                      />
                    )}
                  </Field>
                </div>

                <div className="mt-8">
                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    fullWidth
                    disabled={!canContinue}
                  >
                    Continue
                  </Button>
                  <p className="t-small mt-2 text-muted">
                    {canContinue
                      ? "Next, add the health profile."
                      : "Add a destination to continue."}
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 id="onboarding-form-heading" className="t-title">
                  The health profile
                </h2>
                <div className="mt-6 flex flex-col gap-7">
                  <Field id="onboarding-condition" label="Condition">
                    {(control) => (
                      <Select
                        {...control}
                        value={config.condition}
                        onChange={(event) => {
                          const next = event.currentTarget.value;
                          if (isCondition(next)) update("condition", next);
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

                  <div className="flex flex-col gap-2">
                    <Checkbox
                      id="onboarding-capture"
                      label="Save this trip anonymously to improve pacing estimates"
                      checked={config.captureConsent}
                      onChange={(checked) => update("captureConsent", checked)}
                    />
                    <p className="t-small text-muted">
                      This research copy is not linked to your account. You can record the
                      outcome after your trip, and that is what calibrates future
                      estimates.
                    </p>
                  </div>

                  <div className="border-t border-hairline pt-4">
                    <p className="t-label text-muted">Review</p>
                    <p className="t-body mt-2 text-ink">
                      {describeTrip({
                        destination: config.destination,
                        days: config.days,
                        condition: config.condition,
                      })}
                    </p>
                    <p className="t-data mt-2 text-muted">
                      {config.checkIn ? `${config.checkIn} · ` : ""}
                      {config.travelers} {config.travelers === 1 ? "traveller" : "travellers"} ·{" "}
                      {TRANSPORT_LABELS[config.transport]} ·{" "}
                      {BUDGET_LABELS[config.budget]} ·{" "}
                      {config.interests || "No extra preferences"}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button type="submit" variant="accent" size="lg">
                    Build my plan
                  </Button>
                </div>
              </>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
