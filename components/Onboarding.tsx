"use client";

import { useState, type FormEvent } from "react";
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
import { DEFAULT_MEDICATION_BY_CONDITION } from "@/lib/conditionProfiles";
import { describeTrip } from "@/lib/describeTrip";
import { checkSunLifeCoverage, type SunLifeSeverity } from "@/lib/healthTripEngine";
import {
  BUDGET_LABELS,
  BUDGET_LEVELS,
  type BudgetLevel,
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
  type Condition,
} from "@/lib/types";

const ALERT_TONES: Record<SunLifeSeverity, CalloutTone> = {
  ok: "info",
  caution: "caution",
  blocking: "risk",
};

/** Props for {@link Onboarding}. */
export interface OnboardingProps {
  /** Draft to start from, including the current trip when editing. */
  initial: TripConfig;
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
 * two collects the health profile and coverage. The finished plan opens in the
 * workspace, so this screen never carries results or live agent logs.
 */
export function Onboarding({ initial, onComplete, onCancel }: OnboardingProps) {
  const [config, setConfig] = useState<TripConfig>(initial);
  const [step, setStep] = useState<1 | 2>(1);
  const [medicationTouched, setMedicationTouched] = useState(
    initial.medication !== DEFAULT_MEDICATION_BY_CONDITION[initial.condition],
  );
  const alert = checkSunLifeCoverage(config.days, config.hasSunLifeTravelCoverage);
  const canContinue = canContinueTripStep(config);

  function update<K extends keyof TripConfig>(key: K, value: TripConfig[K]): void {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function handleConditionChange(next: Condition): void {
    setConfig((current) => ({
      ...current,
      condition: next,
      medication: medicationTouched
        ? current.medication
        : DEFAULT_MEDICATION_BY_CONDITION[next],
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (step === 1) {
      if (canContinue) setStep(2);
      return;
    }
    onComplete(normalizeTripConfig(config));
  }

  function handleCancel(): void {
    setConfig(initial);
    setMedicationTouched(
      initial.medication !== DEFAULT_MEDICATION_BY_CONDITION[initial.condition],
    );
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
          <p className="t-body measure mt-5 text-muted">
            Tell us the trip and the health limits. We build the pacing, the concierge
            plan, and the live checks around them.
          </p>

          <ol className="mt-10 list-none p-0">
            {[
              ["Concierge team", "Stays, tables, trails, transit, and care."],
              ["Safety envelope", "Steps, walking, recovery, altitude, and heat."],
              ["Live checks", "Advisory, medication, customs, and coverage."],
            ].map(([title, detail], index) => (
              <li
                key={title}
                className="flex items-baseline gap-4 border-t border-hairline py-4"
              >
                <span className="t-data-sm w-5 shrink-0 text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="t-heading text-ink">{title}</p>
                  <p className="t-small mt-1 text-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="t-small measure mt-6 text-muted">
            Planning aid only. Not medical advice. Confirm every limit with your
            clinician and insurer before you travel.
          </p>
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
                  <Field id="onboarding-destination" label="Destination">
                    {(control) => (
                      <TextInput
                        {...control}
                        value={config.destination}
                        onChange={(event) =>
                          update("destination", event.currentTarget.value)
                        }
                        autoComplete="off"
                        enterKeyHint="done"
                        maxLength={120}
                        placeholder="City, country"
                      />
                    )}
                  </Field>

                  <Field id="onboarding-days" label="Duration">
                    {(control) => (
                      <Slider
                        id={control.id}
                        value={config.days}
                        min={2}
                        max={7}
                        onChange={(days) => update("days", days)}
                        ariaLabel="Duration"
                        ariaValueText={`${config.days} days`}
                        ariaDescribedBy={control["aria-describedby"]}
                        ariaInvalid={control["aria-invalid"]}
                      />
                    )}
                  </Field>

                  <Field id="onboarding-budget" label="Budget">
                    {(control) => (
                      <Select
                        {...control}
                        value={config.budget}
                        onChange={(event) => {
                          const next = event.currentTarget.value;
                          if (
                            next === "value" ||
                            next === "balanced" ||
                            next === "premium"
                          ) {
                            update("budget", next as BudgetLevel);
                          }
                        }}
                      >
                        {BUDGET_LEVELS.map((value) => (
                          <option key={value} value={value}>
                            {BUDGET_LABELS[value]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>

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
                          if (isCondition(next)) handleConditionChange(next);
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

                  <Field
                    id="onboarding-medication"
                    label="Medication"
                    hint="Name only. No doses."
                  >
                    {(control) => (
                      <TextInput
                        {...control}
                        value={config.medication}
                        onChange={(event) => {
                          setMedicationTouched(true);
                          update("medication", event.currentTarget.value);
                        }}
                        autoComplete="off"
                        maxLength={120}
                      />
                    )}
                  </Field>

                  <Checkbox
                    id="onboarding-coverage"
                    label="I have Sun Life group travel coverage"
                    checked={config.hasSunLifeTravelCoverage}
                    onChange={(checked) => update("hasSunLifeTravelCoverage", checked)}
                  />

                  <div className="flex flex-col gap-2">
                    <Checkbox
                      id="onboarding-capture"
                      label="Save this trip anonymously to improve pacing estimates"
                      checked={config.captureConsent}
                      onChange={(checked) => update("captureConsent", checked)}
                    />
                    <p className="t-small text-muted">
                      No name, email, or account. You can record the outcome after your
                      trip, and that is what calibrates future estimates.
                    </p>
                  </div>

                  <Callout tone={ALERT_TONES[alert.severity]} title={alert.title}>
                    <div className="flex flex-col gap-1">
                      {alert.messages.map((message) => (
                        <p key={message}>{message}</p>
                      ))}
                    </div>
                  </Callout>

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
                      {BUDGET_LABELS[config.budget]} ·{" "}
                      {config.interests || "No extra preferences"} ·{" "}
                      {config.hasSunLifeTravelCoverage
                        ? "Sun Life coverage recorded"
                        : "Sun Life coverage not confirmed"}
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
