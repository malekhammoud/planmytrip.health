import { Callout, LinkButton } from "@/components/ui";

/** Props for {@link UpgradeCallout}. */
export interface UpgradeCalloutProps {
  /** The gated capability, in sentence case, such as "Live verification". */
  feature: string;
}

/**
 * Calm upgrade prompt for a paid capability. It links to the pricing page and never
 * offers an action the current plan cannot perform.
 */
export function UpgradeCallout({ feature }: UpgradeCalloutProps) {
  return (
    <Callout tone="info" title="Included in Care Circle">
      <p>{feature} is part of the Care Circle plan.</p>
      <div className="mt-3">
        <LinkButton href="/pricing" variant="secondary">
          See plans
        </LinkButton>
      </div>
    </Callout>
  );
}
