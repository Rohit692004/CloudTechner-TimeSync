export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "JPY"] as const;

export const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Singapore",
  "United Arab Emirates",
  "Germany",
  "France",
  "Japan",
  "Netherlands",
  "Ireland",
] as const;

export const PROJECT_STATUSES = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
] as const;

export const BILLING_MODELS = [
  { value: "TIME_AND_MATERIAL", label: "Time and material" },
  { value: "FIXED_FEE", label: "Milestones / Fixed fee" },
  { value: "RETAINER", label: "Retainer" },
  { value: "NON_BILLABLE", label: "Non-billable" },
] as const;

export const PROJECT_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  PROJECT_STATUSES.map((s) => [s.value, s.label])
);

export const BILLING_MODEL_LABEL: Record<string, string> = Object.fromEntries(
  BILLING_MODELS.map((b) => [b.value, b.label])
);
