"use client";

import { useState } from "react";
import { Button, Callout, Field, Select } from "@/components/ui";
import type {
  AdherenceLevel,
  CareLevel,
  FlareSeverity,
  TripCaptureContext,
} from "@/lib/data/types";

type SaveState = "idle" | "saving" | "saved" | "error";
type FlareAnswer = "" | "yes" | "no";

const SEVERITIES: readonly FlareSeverity[] = ["mild", "moderate", "severe"];
const CARE: readonly CareLevel[] = ["none", "clinic", "er", "hospital"];
const ADHERENCE: readonly AdherenceLevel[] = ["less", "same", "more"];

const SEVERITY_LABEL: Record<FlareSeverity, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
};

const CARE_LABEL: Record<CareLevel, string> = {
  none: "No care sought",
  clinic: "Clinic visit",
  er: "Emergency room",
  hospital: "Hospital stay",
};

const ADHERENCE_LABEL: Record<AdherenceLevel, string> = {
  less: "Less than planned",
  same: "About as planned",
  more: "More than planned",
};

/**
 * Post-trip label capture. It is rendered only when the traveler opted in and both
 * opaque ids exist. The flare answer is explicit; submitting an unchecked box is a
 * deliberate "no", never silence.
 */
export function TripOutcomePanel({ capture }: { capture: TripCaptureContext }) {
  const [flare, setFlare] = useState<FlareAnswer>("");
  const [severity, setSeverity] = useState<FlareSeverity>("mild");
  const [care, setCare] = useState<CareLevel>("none");
  const [adherence, setAdherence] = useState<AdherenceLevel>("same");
  const [state, setState] = useState<SaveState>("idle");

  if (
    !capture.consent ||
    capture.runId.length === 0 ||
    capture.installId.length === 0
  ) {
    return null;
  }

  async function handleSubmit(): Promise<void> {
    if (flare === "") return;
    setState("saving");
    try {
      const response = await fetch("/api/trips/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: capture.runId,
          installId: capture.installId,
          outcome: {
            flare: flare === "yes",
            flareDay: null,
            severity: flare === "yes" ? severity : null,
            care: flare === "yes" ? care : null,
            adherence,
            notes: null,
          },
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <section
      aria-labelledby="trip-outcome-heading"
      className="mt-12 border-t border-hairline pt-8"
    >
      <h3 id="trip-outcome-heading" className="t-title text-ink">
        After your trip
      </h3>
      <p className="t-body measure mt-3 text-muted">
        Record how it went. This is what calibrates future pacing estimates. This
        research copy is stored separately from your account.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <Field
          id="outcome-flare"
          label="Did you have a flare during the trip or within 7 days after?"
          hint="An explicit answer is required. It is the label that calibrates future estimates."
        >
          {(control) => (
            <Select
              {...control}
              value={flare}
              placeholder="Select an answer"
              onChange={(event) => {
                const next = event.currentTarget.value;
                if (next === "yes" || next === "no") {
                  setFlare(next);
                }
              }}
            >
              <option value="yes">Yes, I had a flare</option>
              <option value="no">No flare</option>
            </Select>
          )}
        </Field>

        {flare === "yes" ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="outcome-severity" label="Severity">
              {(control) => (
                <Select
                  {...control}
                  value={severity}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    if (next === "mild" || next === "moderate" || next === "severe") {
                      setSeverity(next);
                    }
                  }}
                >
                  {SEVERITIES.map((value) => (
                    <option key={value} value={value}>
                      {SEVERITY_LABEL[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field id="outcome-care" label="Care sought">
              {(control) => (
                <Select
                  {...control}
                  value={care}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    if (
                      next === "none" ||
                      next === "clinic" ||
                      next === "er" ||
                      next === "hospital"
                    ) {
                      setCare(next);
                    }
                  }}
                >
                  {CARE.map((value) => (
                    <option key={value} value={value}>
                      {CARE_LABEL[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        ) : null}

        <Field
          id="outcome-adherence"
          label="How closely did you follow the pace?"
          hint="A rough answer is enough."
        >
          {(control) => (
            <Select
              {...control}
              value={adherence}
              onChange={(event) => {
                const next = event.currentTarget.value;
                if (next === "less" || next === "same" || next === "more") {
                  setAdherence(next);
                }
              }}
            >
              {ADHERENCE.map((value) => (
                <option key={value} value={value}>
                  {ADHERENCE_LABEL[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="secondary"
            onClick={handleSubmit}
            loading={state === "saving"}
            disabled={flare === ""}
          >
            Save outcome
          </Button>
          <p aria-live="polite" className="t-small text-muted">
            {flare === "" ? "Answer whether you had a flare to save." : null}
            {state === "saving" ? "Saving." : null}
            {state === "saved" ? "Outcome saved. You can update it later." : null}
          </p>
        </div>

        {state === "error" ? (
          <Callout tone="caution" title="Outcome not saved">
            The trip record could not be reached. Try again in a moment.
          </Callout>
        ) : null}
      </div>
    </section>
  );
}
