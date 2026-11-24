/* eslint-disable @next/next/no-html-link-for-pages -- account, billing, and saved-trip links deliberately use a full navigation so a stale client router cannot trap the click. */
import { LogoLink } from "@/components/Logo";
import { Callout } from "@/components/ui";
import { MODEL_ARTIFACT, MODEL_AVAILABLE } from "@/lib/model/artifact";
import { predictFromArtifact } from "@/lib/model/predict";
import type { FeatureName } from "@/lib/model/types";
import {
  CONDITION_LABELS,
  type Condition,
} from "@/lib/types";

const SAMPLE_SCORE = 72;
const SAMPLE_CONDITION: Condition = "asthma_respiratory";

function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function number(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function Table({
  headers,
  rows,
  caption,
}: {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="t-small mb-3 text-left text-muted">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline-strong">
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={`t-label py-3 text-muted ${
                  index === 0 ? "pr-4 text-left" : "pl-4 text-right"
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-hairline">
              {row.map((cell, index) =>
                index === 0 ? (
                  <th
                    key={`${row[0]}-${index}`}
                    scope="row"
                    className="t-small py-3 pr-4 text-left font-normal text-ink"
                  >
                    {cell}
                  </th>
                ) : (
                  <td
                    key={`${row[0]}-${index}`}
                    className="t-data py-3 pl-4 text-right text-ink"
                  >
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Static model card and an illustrative exposure-risk curve. */
export default function ModelPage() {
  if (!MODEL_AVAILABLE) {
    return (
      <main className="page-container py-16">
        <h1 className="t-title">No model artifact</h1>
        <p className="t-body mt-4 text-muted">
          Run <span className="t-data">npm run model:train</span> to build one.
        </p>
        <a href="/" className="t-small mt-6 inline-flex min-h-11 items-center text-accent hover:underline">
          Back to the planner
        </a>
      </main>
    );
  }

  const artifact = MODEL_ARTIFACT;
  const synthetic = artifact.source === "synthetic";
  const metrics = artifact.metrics;
  const improvement =
    metrics.baselineBrier > 0
      ? (metrics.baselineBrier - metrics.brier) / metrics.baselineBrier
      : 0;
  const sampleFeatures = {
    peakExposure: 0.6,
    recoveryCoverage: 0.8,
    tripLength: 4,
    adherence: null,
    heatFlag: 0 as const,
    altitudeFlag: 0 as const,
    baselineBurden: null,
  };
  const curveRows = [0.4, 0.6, 0.8, 1.0].map((peakExposure) => {
    const prediction = (recoveryCoverage: number) =>
      predictFromArtifact(
        artifact,
        { ...sampleFeatures, peakExposure, recoveryCoverage },
        SAMPLE_SCORE,
        SAMPLE_CONDITION,
      ).pFlare;
    return [
      `${peakExposure.toFixed(2)}×`,
      percent(prediction(0.5)),
      percent(prediction(0.8)),
      percent(prediction(1.0)),
    ] as const;
  });
  const conditionRows = (
    Object.entries(artifact.training.byCondition) as [
      Condition,
      { n: number; events: number },
    ][]
  ).map(([condition, counts]) => [
    CONDITION_LABELS[condition],
    String(counts.n),
    String(counts.events),
    percent(counts.events / Math.max(1, counts.n)),
  ]);
  const coefficientRows = artifact.featureNames.map((name: FeatureName) => [
    name,
    number(artifact.coefficients[name] ?? 0),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-hairline">
        <div className="page-container flex h-16 items-center justify-between gap-6">
          <LogoLink />
          <a
            href="/"
            className="t-small inline-flex min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink hover:underline"
          >
            Back to planner
          </a>
        </div>
      </header>

      <main className="page-container flex-1 pt-12 md:pt-20">
        <p className="t-label text-muted">Model card</p>
        <h1 className="t-display measure mt-3">Flare calibration</h1>
        <p className="t-body measure mt-5 text-muted">
          The pacing engine is the prior. This model learns the residual between its
          modeled risk and the flare a traveler reports. It is a planning aid, not
          medical advice.
        </p>

        <div className="mt-8">
          <Callout
            tone={synthetic ? "caution" : "info"}
            title={synthetic ? "Trained on synthetic trips" : "Trained on consented outcomes"}
          >
            {synthetic
              ? "This artifact demonstrates the pipeline. It has no real outcomes, is not clinically validated, and is never used to change a live safety cap."
              : "This artifact is fit to consented, self-reported outcomes. It is observational, not clinically validated, and may only tighten a live safety cap."}
          </Callout>
        </div>

        <section aria-labelledby="model-summary" className="mt-12">
          <h2 id="model-summary" className="t-title">
            Summary
          </h2>
          <div className="mt-5 grid gap-x-12 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-t border-hairline pt-3">
              <p className="t-label text-muted">Model version</p>
              <p className="t-data mt-1 text-ink">{artifact.modelVersion}</p>
            </div>
            <div className="border-t border-hairline pt-3">
              <p className="t-label text-muted">Labeled trips</p>
              <p className="t-data mt-1 text-ink">{artifact.training.n}</p>
            </div>
            <div className="border-t border-hairline pt-3">
              <p className="t-label text-muted">Flares</p>
              <p className="t-data mt-1 text-ink">
                {artifact.training.events} ·{" "}
                {percent(artifact.training.events / Math.max(1, artifact.training.n))}
              </p>
            </div>
            <div className="border-t border-hairline pt-3">
              <p className="t-label text-muted">Trained</p>
              <p className="t-data mt-1 text-ink">
                {artifact.trainedAt.slice(0, 10)}
              </p>
            </div>
            <div className="border-t border-hairline pt-3">
              <p className="t-label text-muted">Pipeline</p>
              <p className="t-data mt-1 text-ink">v{artifact.pipelineVersion}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="model-performance" className="mt-12">
          <h2 id="model-performance" className="t-title">
            Out-of-fold performance
          </h2>
          <div className="mt-5">
            <Table
              caption={
                synthetic
                  ? "Nested out-of-fold holdouts are grouped by synthetic traveler."
                  : "Nested out-of-fold holdouts are grouped by install, so one install never appears on both sides."
              }
              headers={["Metric", "Model", "Engine only"]}
              rows={[
                ["Brier score", number(metrics.brier, 4), number(metrics.baselineBrier, 4)],
                ["Brier improvement", percent(improvement), "—"],
                ["Log loss", number(metrics.logLoss, 4), "—"],
                ["Calibration error", number(metrics.ece, 4), "—"],
                ["AUROC", number(metrics.auroc, 4), "—"],
                ["Calibration slope", number(metrics.calibrationSlope, 4), "1.0000"],
              ]}
            />
          </div>
        </section>

        <section aria-labelledby="model-coefficients" className="mt-12">
          <h2 id="model-coefficients" className="t-title">
            Coefficients
          </h2>
          <p className="t-small measure mt-2 text-muted">
            Standardized: one standard deviation of a feature changes the log-odds by
            this amount, holding the engine prior fixed.
          </p>
          <div className="mt-5">
            <Table
              caption="Intercept and v0 features."
              headers={["Term", "Coefficient"]}
              rows={[["intercept", number(artifact.coefficients.intercept)], ...coefficientRows]}
            />
          </div>
        </section>

        <section aria-labelledby="model-curve" className="mt-12">
          <h2 id="model-curve" className="t-title">
            Illustrative risk curve
          </h2>
          <p className="t-small measure mt-2 text-muted">
            Asthma profile, engine score {SAMPLE_SCORE}, four-day trip. Peak exposure is
            the share of the condition ceiling; recovery coverage is the share of the
            required recovery minutes. This table is a model demonstration, not a target.
          </p>
          <div className="mt-5">
            <Table
              caption="Probability of a reported flare by planned dose."
              headers={["Peak exposure", "Recovery 50%", "Recovery 80%", "Recovery 100%"]}
              rows={curveRows}
            />
          </div>
        </section>

        <section aria-labelledby="model-cohort" className="mt-12">
          <h2 id="model-cohort" className="t-title">
            Cohort
          </h2>
          <div className="mt-5">
            <Table
              caption={
                synthetic
                  ? "Synthetic trips by condition."
                  : "Consented trips by condition."
              }
              headers={["Condition", "Trips", "Flares", "Rate"]}
              rows={conditionRows}
            />
          </div>
        </section>

        <section aria-labelledby="model-limits" className="mt-12">
          <h2 id="model-limits" className="t-title">
            Limits
          </h2>
          <ul className="mt-4 list-none p-0">
            {[
              synthetic
                ? "Synthetic dose-response and synthetic outcomes."
                : "Consented, self-reported outcomes; not a controlled cohort.",
              "Self-reported flares are noisy; explicit negatives matter.",
              "Coefficients are predictive, not causal.",
              "A synthetic artifact never drives a live estimate.",
              "Recalibrate after any engine version change.",
            ].map((item) => (
              <li
                key={item}
                className="t-small border-t border-hairline py-3 text-muted"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="t-small mt-4 text-muted">
            Full model card: <span className="t-data">docs/MODEL_CARD.md</span>
          </p>
        </section>
      </main>

      <footer className="mt-16 border-t border-hairline md:mt-24">
        <div className="page-container py-6">
          <p className="t-small measure text-muted">
            Planning aid only. Not medical advice. Confirm with your clinician and insurer
            before you travel.
          </p>
        </div>
      </footer>
    </div>
  );
}
