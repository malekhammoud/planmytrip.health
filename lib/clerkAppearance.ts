/**
 * Clerk appearance tokens.
 *
 * Inputs: none. Outputs: the appearance object passed to ClerkProvider.
 * Invariants: every value is a literal CSS value, mirrored from the Paper and Ink tokens in
 * app/globals.css. Clerk resolves its own color variables inside the prebuilt components;
 * `var(--accent)` and other custom properties do not resolve there and leave the primary
 * button transparent. Keep the values in sync with the token block; the design guard does
 * not scan lib/, so this is the one deliberate literal-color bridge.
 */

/** Paper and Ink values used by Clerk's prebuilt sign-in and sign-up forms. */
export const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#1f3ad6",
    colorPrimaryForeground: "#ffffff",
    colorDanger: "#b42318",
    colorWarning: "#8a5a00",
    colorSuccess: "#1f3ad6",
    colorNeutral: "#12151c",
    colorForeground: "#12151c",
    colorMuted: "#eceae3",
    colorMutedForeground: "#565c66",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#12151c",
    colorBorder: "#dedbd2",
    borderRadius: "6px",
    fontFamily: '"Hanken Grotesk", ui-sans-serif, system-ui, sans-serif',
  },
} as const;
