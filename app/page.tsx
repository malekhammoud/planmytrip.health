export default function Home() {
  return (
    <div className="page-container flex min-h-dvh flex-col pt-10 md:pt-16">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-5">
        <p className="t-heading">
          PlanMyTrip
          <span className="t-data text-accent">.health</span>
        </p>
        <p className="t-label text-muted">Planning aid</p>
      </header>

      <main className="flex-1 pt-16 md:pt-24">
        <section aria-labelledby="baseline-heading">
          <p className="t-label text-muted">Health-first travel planning</p>
          <h1 id="baseline-heading" className="t-display mt-4">
            A travel plan paced to your health.
          </h1>
          <p className="t-body mt-6 text-muted">
            This is a pacing and risk-verification tool for people travelling with a
            medical condition. The full planner is under construction.
          </p>
        </section>
      </main>

      <footer className="mt-16 border-t border-hairline py-6 md:mt-24">
        <p className="t-small measure text-muted">
          Planning aid only. Not medical advice. Confirm with your clinician and insurer
          before you travel.
        </p>
      </footer>
    </div>
  );
}
