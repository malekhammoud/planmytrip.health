"use client";

import { useState } from "react";
import { Button, Callout, Disclosure, Field, Select } from "@/components/ui";
import type {
  AdherenceLevel,
  CareLevel,
  FlareSeverity,
  TripCaptureContext,
} from "@/lib/data/types";

type SaveState = "idle" | "saving" | "saved" | "error";
type SetbackAnswer = "" | "yes" | "no";

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

function statusLine(
  state: SaveState,
  setback: SetbackAnswer,
  severity: FlareSeverity | "",
  care: CareLevel | "",
): string | null {
  if (state === "saving") return "Saving.";
  if (state === "saved") return "Outcome saved. You can update it later.";
  if (setback === "") return "Answer whether you had a health setback to save.";
  if (setback === "yes" && severity === "") return "Choose how serious the setback was.";
  if (setback === "yes" && care === "") return "Choose what care you sought.";
  return null;
}

/**
 * Post-trip label capture. It is rendered only when the traveler opted in and both
 * opaque ids exist. The setback answer, its severity, and the care level are explicit;
 * the panel starts collapsed so it stays out of the way until the trip is over.
 */
export function TripOutcomePanel({ capture }: { capture: TripCaptureContext }) {
  const [open, setOpen] = useState(false);
  const [setback, setSetback] = useState<SetbackAnswer>("");
  const [severity, setSeverity] = useState<FlareSeverity | "">("");
  const [care, setCare] = useState<CareLevel | "">("");
  const [adherence, setAdherence] = useState<AdherenceLevel>("same");
  const [state, setState] = useState<SaveState>("idle");

  if (
    !capture.consent ||
    capture.runId.length === 0 ||
    capture.installId.length === 0
  ) {
    return null;
  }

  const complete =
    setback === "no" ||
    (setback === "yes" && severity !== "" && care !== "");

  async function handleSubmit(): Promise<void> {
    if (!complete) return;
    const severityValue = setback === "yes" && severity !== "" ? severity : null;
    const careValue = setback === "yes" && care !== "" ? care : null;
    setState("saving");
    try {
      const response = await fetch("/api/trips/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: capture.runId,
          installId: capture.installId,
          outcome: {
            flare: setback === "yes",
            flareDay: null,
            severity: severityValue,
            care: careValue,
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
    <section aria-label="After your trip" className="mt-12 border-t border-hairline pt-8">
      <Disclosure
        title="After your trip"
        summary="Open this after you return."
        open={open}
        onToggle={() => setOpen((current) => !current)}
        level={3}
      >
        <div className="pt-4">
          <p className="t-body measure text-muted">
            Record how it went. This is what calibrates future pacing estimates. This
            research copy is stored separately from your account.
          </p>

          <div className="mt-6 flex flex-col gap-6">
            <Field
              id="outcome-setback"
              label="Did you have a health setback during the trip or within 7 days after?"
              hint="An explicit answer is required. It is the label that calibrates future estimates."
            >
              {(control) => (
                <Select
                  {...control}
                  value={setback}
                  placeholder="Select an answer"
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    if (next === "yes" || next === "no") {
                      setSetback(next);
                    }
                  }}
                >
                  <option value="yes">Yes, I had a health setback</option>
                  <option value="no">No health setback</option>
                </Select>
              )}
            </Field>

            {setback === "yes" ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <Field id="outcome-severity" label="Severity">
                  {(control) => (
                    <Select
                      {...control}
                      value={severity}
                      placeholder="Select severity"
                      onChange={(event) => {
                        const next = event.currentTarget.value;
                        if (
                          next === "mild" ||
                          next === "moderate" ||
                          next === "severe"
                        ) {
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
                      placeholder="Select care"
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
                onClick={() => {
                  void handleSubmit();
                }}
                loading={state === "saving"}
                disabled={!complete}
              >
                Save outcome
              </Button>
              <p aria-live="polite" className="t-small text-muted">
                {statusLine(state, setback, severity, care)}
              </p>
            </div>

            {state === "error" ? (
              <Callout tone="caution" title="Outcome not saved">
                The trip record could not be reached. Try again in a moment.
              </Callout>
            ) : null}
          </div>
        </div>
      </Disclosure>
    </section>
  );
}
