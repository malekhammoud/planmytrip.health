/**
 * Client-side error intake for the PlanMyTrip concierge.
 *
 * Runs before hydration and sends only the message, stack, route, and boundary.
 * No destination, condition, medication, form value, or storage is ever sent.
 */

import { installClientReporter } from "./lib/ops/client";
import { initAnalytics } from "./lib/analytics";

installClientReporter();
initAnalytics();
