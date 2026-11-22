/**
 * Collapsed archive of recorded TinyFish runs attached to a cached plan.
 *
 * Inputs: the authenticated recording paths carried by cached verification state.
 * Outputs: a disclosure with one labelled video player per recorded worker.
 * Invariants: no player is rendered without a recording URL; the archive is closed by
 * default so the route stays the focus; every video streams through the
 * authenticated recording route and keeps its native controls.
 */

"use client";

import { useState } from "react";
import { Disclosure } from "@/components/ui";
import { MISSION_WORKERS } from "@/components/mission/missionMeta";
import type { WorkerId } from "@/lib/swarmTypes";

/** One cached worker recording. */
export interface CachedRecording {
  worker: WorkerId;
  url: string;
}

/** A compact, reopenable recording archive for a cached plan. */
export function CachedRecordings({
  recordings,
}: {
  recordings: readonly CachedRecording[];
}) {
  const [open, setOpen] = useState(false);
  if (recordings.length === 0) return null;

  return (
    <section aria-label="Recorded agent runs" className="mt-4 border-t border-solid border-hairline pt-3">
      <Disclosure
        title="Recorded agent runs"
        summary={`${recordings.length} ${recordings.length === 1 ? "video" : "videos"} · cached`}
        open={open}
        onToggle={() => setOpen((current) => !current)}
      >
        <p className="t-small measure text-muted">
          Recorded during the original verification run. These are recordings, not live
          views.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2">
          {recordings.map((recording) => {
            const meta = MISSION_WORKERS[recording.worker];
            return (
              <figure key={recording.worker} className="min-w-0">
                <figcaption className="t-label text-muted">{meta.name}</figcaption>
                <video
                  controls
                  playsInline
                  preload="none"
                  aria-label={`${meta.name} recorded browser run`}
                  className="mt-2 aspect-[16/10] w-full rounded-frame border border-solid border-hairline-strong bg-ink object-contain"
                >
                  <source src={recording.url} type="video/webm" />
                  Your browser cannot play this recording.
                </video>
              </figure>
            );
          })}
        </div>
      </Disclosure>
    </section>
  );
}
