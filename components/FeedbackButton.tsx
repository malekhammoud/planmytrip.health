"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CheckCircle2, MessageSquare, Star, X } from "lucide-react";
import { Button, TextArea } from "@/components/ui";
import { capture } from "@/lib/analytics";

type Category = "bug" | "feature" | "other";

function actorId(): string {
  try {
    const key = "planmytrip.feedbackActor";
    const existing = window.localStorage.getItem(key);
    if (existing !== null && existing.length >= 8) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Site-wide feedback prompt. Users can report a bug or suggest a feature without
 * sharing any trip or health data. The central service clusters repeated requests
 * by distinct users; one user cannot move a feature threshold alone.
 */
export function FeedbackButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("other");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    }, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Tab") return;
    const panel = dialogRef.current;
    if (panel === null) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const submit = async () => {
    if ((rating === 0 && message.trim().length < 3) || state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          rating,
          message,
          page: window.location.pathname,
          actorId: actorId(),
          release: process.env.NEXT_PUBLIC_RELEASE,
        }),
      });
      if (response.ok) {
        capture("feedback_submitted", {
          category,
          rating,
          has_comment: message.trim().length > 0,
          page: window.location.pathname,
        });
      }
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={MessageSquare}
        onClick={(event) => {
          capture("feedback_opened", { page: window.location.pathname });
          triggerRef.current = event.currentTarget;
          setOpen(true);
        }}
        className={`t-small text-muted hover:text-ink ${className}`}
      >
        Feedback
      </Button>
      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pmt-feedback-title"
            onKeyDown={onDialogKeyDown}
            className="w-full max-w-lg rounded-frame border border-solid border-hairline bg-paper p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="pmt-feedback-title" className="t-heading">
                  Tell us what to improve
                </h2>
                <p className="t-small mt-1 text-muted">
                  Bug reports and repeated requests shape what we build. Please do not
                  include personal health details.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={X}
                aria-label="Close feedback"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
            {state === "done" ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <CheckCircle2 size={18} className="text-accent" aria-hidden="true" />
                <p className="t-small text-ink">Thank you. We read every note.</p>
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Feedback type">
                  {([
                    ["bug", "Something's broken"],
                    ["feature", "Feature idea"],
                    ["other", "Other"],
                  ] as const).map(([id, label]) => (
                    <Button
                      key={id}
                      variant={category === id ? "secondary" : "ghost"}
                      size="sm"
                      aria-pressed={category === id}
                      onClick={() => setCategory(id)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1" role="group" aria-label="Rate PlanMyTrip">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      variant="ghost"
                      size="sm"
                      aria-pressed={rating === n}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      onClick={() => {
                        setRating(n);
                        if (n <= 2 && category === "other") setCategory("bug");
                      }}
                    >
                      <Star size={20} fill={rating >= n ? "currentColor" : "none"} />
                    </Button>
                  ))}
                </div>
                <TextArea
                  id="pmt-feedback-message"
                  aria-label="Feedback message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="What is broken, missing, or confusing?"
                  className="mt-2"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    onClick={submit}
                    disabled={(rating === 0 && message.trim().length < 3) || state === "sending"}
                    loading={state === "sending"}
                  >
                    {state === "sending" ? "Sending…" : "Send feedback"}
                  </Button>
                  {state === "error" ? <span className="t-small text-risk">Could not send. Try again.</span> : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
