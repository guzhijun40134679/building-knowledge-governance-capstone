import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const AUTH_STORAGE_KEY = "whitepaper_auth_token";

const detectApiBase = () => {
  const configured = import.meta.env.VITE_API_BASE?.trim();
  if (configured) {
    return configured;
  }
  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }
  if (!import.meta.env.DEV) {
    return window.location.origin;
  }
  const { protocol, hostname } = window.location;
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }
  return `${protocol}//${hostname}:8000`;
};

const API_BASE = detectApiBase();

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  employee: "Employee",
  viewer: "Viewer",
};

const TAB_LABELS = {
  crm: "CRM Services",
  tasks: "Task Center",
  templates: "Service Templates",
  crm_data: "CRM Data Center",
  query: "Knowledge Search",
  import: "Excel Import",
  intake: "Document Intake",
  review: "Review Queue",
  master: "Master",
  staging: "Staging",
  logs: "Audit Log",
  fields: "Field Management",
  accounts: "Account Management",
  system_update: "System Update",
};

const NAV_GROUPS = [
  { key: "crm", label: "CRM", tabs: ["crm", "tasks", "templates", "crm_data"] },
  { key: "housing", label: "Building Knowledge", tabs: ["query", "import", "intake", "review", "master", "staging"] },
  { key: "system", label: "System", tabs: ["system_update", "logs", "fields", "accounts"] },
];

const NAV_GROUP_BY_TAB = Object.fromEntries(
  NAV_GROUPS.flatMap((group) => group.tabs.map((tab) => [tab, group.key]))
);

const FIELD_GROUP_LABELS = {
  basic: "Basic Information",
  insurance: "Insurance",
  electricity: "Electricity",
  internet: "Internet",
  move_in: "Move-in / Keys / Service Elevator",
  contacts: "Contacts",
  custom: "Other Fields",
};

const FIELD_GROUP_ORDER = ["basic", "insurance", "electricity", "internet", "move_in", "contacts", "custom"];

const BOOL_FIELD_KEYS = new Set([
  "insurance_required",
  "electricity_required",
  "internet_self_setup_required",
]);

const OPTIONAL_BOOL_FIELD_KEYS = new Set([
  "insurance_required",
  "electricity_required",
  "internet_self_setup_required",
]);

const INSURANCE_STATUS_FIELD_KEYS = new Set([
  "insurance_coi_required",
  "insurance_renters_required",
  "insurance_personal_property_required",
  "insurance_personal_liability_required",
  "insurance_interested_party_required",
  "insurance_additional_insured_required",
  "insurance_certificate_holder_required",
]);

const FIELD_TYPE_LABELS = {
  text: "Text",
  boolean: "Boolean",
};

const FIELD_SCOPE_LABELS = {
  master_and_staging: "Master + Staging",
  staging_only: "Staging only",
};

const FIELD_REQUEST_STATUS_LABELS = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

const INTAKE_MODE_OPTIONS = [
  { value: "full_package", label: "Complete document package" },
  { value: "supplement", label: "Supplemental documents" },
];

const SUPPLEMENT_SCOPE_OPTIONS = [
  { value: "insurance", label: "Insurance" },
  { value: "electricity", label: "Electricity" },
  { value: "internet", label: "Internet" },
  { value: "move_in", label: "Move-in" },
  { value: "all", label: "Full building review" },
];

const INTAKE_PARSE_STATUS_LABELS = {
  queued: "Queued",
  running: "Processing",
  completed: "Completed",
  failed: "Failed",
};

const INTAKE_PARSE_STATUS_TONES = {
  queued: "amber",
  running: "blue",
  completed: "green",
  failed: "red",
};

const STRUCTURED_MOVE_IN_FIELD_KEYS = new Set([
  "insurance_coi_required",
  "insurance_coi_trigger",
  "key_pickup_notes",
  "service_elevator_booking_notes",
]);

const NETWORK_PROVIDER_FIELDS = [
  {
    fieldKey: "internet_verizon_supported",
    planFieldKey: "internet_verizon_plan_tiers",
    noteFieldKey: "internet_verizon_notes",
    label: "Verizon",
    tiers: [
      { value: "300 Mbps ($49.99/mo)", shortLabel: "300 Mbps", price: "$49.99" },
      { value: "500 Mbps ($74.99/mo)", shortLabel: "500 Mbps", price: "$74.99" },
      { value: "1 Gig ($89.99/mo)", shortLabel: "1 Gig", price: "$89.99" },
      { value: "2 Gig ($109.99/mo)", shortLabel: "2 Gig", price: "$109.99" },
    ],
  },
  {
    fieldKey: "internet_xfinity_supported",
    planFieldKey: "internet_xfinity_plan_tiers",
    noteFieldKey: "internet_xfinity_notes",
    label: "Xfinity",
    tiers: [
      { value: "100 Mbps ($30/mo)", shortLabel: "100 Mbps", price: "$30" },
      { value: "300 Mbps ($45/mo)", shortLabel: "300 Mbps", price: "$45" },
      { value: "500 Mbps ($60/mo)", shortLabel: "500 Mbps", price: "$60" },
      { value: "1 Gig ($70/mo)", shortLabel: "1 Gig", price: "$70" },
    ],
  },
  {
    fieldKey: "internet_spectrum_supported",
    planFieldKey: "internet_spectrum_plan_tiers",
    noteFieldKey: "internet_spectrum_notes",
    label: "Spectrum",
    tiers: [
      { value: "100 Mbps ($30/mo)", shortLabel: "100 Mbps", price: "$30" },
      { value: "500 Mbps ($40/mo)", shortLabel: "500 Mbps", price: "$40" },
      { value: "1 Gig ($50/mo)", shortLabel: "1 Gig", price: "$50" },
    ],
  },
  {
    fieldKey: "internet_astound_supported",
    planFieldKey: "internet_astound_plan_tiers",
    noteFieldKey: "internet_astound_notes",
    label: "Astound",
    tiers: [
      { value: "300 Mbps ($30/mo)", shortLabel: "300 Mbps", price: "$30" },
      { value: "1 Gig ($40/mo)", shortLabel: "1 Gig", price: "$40" },
      { value: "1.5 Gig ($60/mo)", shortLabel: "1.5 Gig", price: "$60" },
      { value: "2 Gig ($80/mo)", shortLabel: "2 Gig", price: "$80" },
    ],
  },
];

const NETWORK_SUPPORT_FIELD_KEYS = new Set(
  NETWORK_PROVIDER_FIELDS.map((item) => item.fieldKey)
);

const NETWORK_PLAN_FIELD_KEYS = new Set(
  NETWORK_PROVIDER_FIELDS.map((item) => item.planFieldKey)
);

const FIXED_NETWORK_PROVIDER_SET = new Set(
  NETWORK_PROVIDER_FIELDS.map((item) => item.label)
);

const CORE_FIELD_ORDER = [
  "building_name",
  "address",
  "insurance_required",
  "insurance_coverage_amount",
  "electricity_required",
  "electricity_provider",
  "internet_self_setup_required",
  "move_in_notes",
  "source_type",
  "source_file",
  "info_cutoff_date",
];

const createId = () =>
  globalThis?.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const WRITE_TIMEOUT_MS = 15000;
const HEALTH_RETRY_ATTEMPTS = 4;
const HEALTH_RETRY_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildInitialMessages = () => [
  {
    id: createId(),
    role: "assistant",
    sourceMode: "master",
    content:
      "Welcome. You can search either Master or Staging knowledge. Select a building, then ask about insurance, electricity, internet, move-in requirements, or other approved facts. If the selected knowledge base does not contain the answer, I will say so clearly.",
  },
];

const authTabsByRole = {
  super_admin: ["crm", "tasks", "templates", "crm_data", "query", "import", "intake", "review", "master", "staging", "system_update", "logs", "fields", "accounts"],
  admin: ["crm", "tasks", "templates", "query", "import", "intake", "review", "master", "staging", "logs"],
  employee: ["crm", "tasks", "query", "intake", "review", "master", "staging"],
  viewer: ["query", "master", "staging"],
};

const CRM_CASE_STATUS_OPTIONS = [
  ["", "All statuses"],
  ["active", "Active"],
  ["paused", "Paused"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

const CRM_CASE_FILTER_STATUS_OPTIONS = [
  ...CRM_CASE_STATUS_OPTIONS,
  ["deleted", "Deleted"],
];

const CRM_CASE_STATUS_LABELS = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  deleted: "Deleted",
};

const CRM_SERVICE_STATUS_LABELS = {
  pending: "Not started",
  open: "Not started",
  in_progress: "In progress",
  waiting_customer: "Waiting for customer",
  at_risk: "At risk / Incomplete",
  completed: "Completed",
  terminated: "Terminated",
  not_needed: "Not needed",
};

const CRM_APPLICABILITY_LABELS = {
  required: "Required",
  optional: "Optional",
  not_needed: "Not needed",
  unknown: "Needs confirmation",
};

const CRM_SCOPE_LABELS = {
  case_level: "Case-wide",
  customer_level: "Per customer",
};

const CRM_GROUP_TARGET_LABEL = "Entire group / This case";

const CRM_NEED_STATUS_LABELS = {
  required: "Required",
  optional: "Optional",
  not_needed: "Not needed",
  unknown: "Needs confirmation",
};

const CRM_SUBMISSION_STATUS_LABELS = {
  not_applicable: "No submission required",
  not_submitted: "Not submitted / Not ordered",
  submitted: "Submitted / Ordered",
  rejected: "Rejected",
  approved: "Approved",
  unknown: "Needs confirmation",
};

const CRM_COMPLETION_STATUS_LABELS = {
  not_applicable: "Not applicable",
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  waived: "Not required / Waived",
  failed: "Failed",
  unknown: "Needs confirmation",
};

const CRM_INTRO_STATUS_LABELS = {
  not_introduced: "Not introduced",
  introduced_to_group: "Introduced in the group",
  introduced_to_customer: "Introduced directly",
  not_needed: "Not needed",
  unknown: "Needs confirmation",
};

const CRM_FOLLOW_UP_STATUS_LABELS = {
  not_required: "No follow-up needed",
  required: "Follow-up required",
  scheduled: "Scheduled",
  overdue: "Overdue",
  unknown: "Needs confirmation",
};

const CRM_AGENT_COMPLETION_STATUS_LABELS = {
  open: "Open",
  pending_customer: "Waiting for customer",
  pending_external: "Waiting for building / vendor",
  completed: "Completed",
  escalated: "Escalation required",
  unknown: "Needs review",
};

const CRM_TASK_STATUS_LABELS = {
  open: "Open",
  scheduled: "Scheduled",
  in_progress: "In progress",
  waiting_customer: "Waiting for customer",
  waiting_external: "Waiting for a third party",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const CRM_TASK_PRIORITY_LABELS = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const CRM_TASK_TYPE_LABELS = {
  assign_responsible_customer: "Assign service owner",
  intro: "Introduce / Inform",
  collect_info: "Collect information",
  follow_up: "Follow up",
  verify: "Verify",
  deadline_check: "Pre-move-in check",
  escalation: "Escalation reminder",
  sim_card_sent_record: "SIM card dispatch record",
  manual: "Manual task",
};

const CRM_TIMELINE_EVENT_LABELS = {
  crm_case_created: "Case created",
  crm_case_updated: "Case updated",
  crm_case_building_bound: "Building linked",
  crm_case_building_snapshot_refreshed: "Building snapshot refreshed",
  crm_case_services_generated: "Services / tasks generated",
  crm_service_progress_updated: "Service status",
  crm_guest_service_progress_updated: "Customer progress",
  crm_task_created: "Task created",
  crm_task_updated: "Task updated",
  communication: "Communication",
  notification: "Notification record",
};

const BUSINESS_SUMMARY_SECTION_LABELS = {
  building_identity: "Building name / Address",
  renters_insurance: "Renters Insurance",
  moving_coi: "Moving / Delivery COI",
  insurance: "Insurance",
  internet: "Internet",
  electricity: "Electricity",
  move_in_process: "Move-in Process",
  key_pickup: "Key Pickup",
  service_elevator: "Service Elevator Reservation",
  move_in: "Move-in / Moving",
  payments: "Deposits / Payments",
  contacts: "Contacts",
  other_notes: "Other Notes",
};

const BUSINESS_SUMMARY_DETAIL_LABELS = {
  checklist: "Pre-move-in Checklist",
  deadlines: "Deadlines",
  required_before_keys: "Requirements Before Key Pickup",
  coordination_notes: "Move-in Coordination Notes",
  location: "Pickup Location",
  contact_person_or_team: "Pickup Contact",
  channel: "Channel",
  contact_info: "Contact Information",
  prerequisites: "Prerequisites",
  timing: "Timing / Conditions",
  booking_method: "Reservation Method",
  submit_to: "Submit To",
  advance_notice: "Advance Notice",
  available_windows: "Available Time Windows",
  coi_required: "COI Required",
  missing_info: "Missing Information",
  contact_type: "Contact Type",
  person_or_team: "Person / Team",
  email: "Email",
  phone: "Phone",
  purpose: "Purpose",
  hours: "Business / Contact Hours",
};

const CRM_TEMPLATE_CATEGORY_LABELS = {
  building: "Building-rule driven",
  general: "General service",
  sales: "Sales service",
  custom: "Custom",
};

const CRM_TEMPLATE_AUTO_SOURCE_LABELS = {
  "": "Do not determine from building rules",
  insurance: "Insurance rules",
  electricity: "Electricity rules",
  internet: "Internet rules",
};

const CRM_NOTIFICATION_STATUS_LABELS = {
  draft: "Draft",
  approved: "Approved",
  // The current backend records a status change only; it does not send a WeChat message.
  sent: "Marked as sent",
  failed: "Could not mark as sent",
  cancelled: "Cancelled",
};

const CRM_SERVICE_DELIVERY_MODE_LABELS = {
  sop_only: "SOP / Self-service guide only",
  assisted: "Staff-assisted",
  agency: "Handled by our team",
  sales: "Sold / Ordered through our team",
  not_needed: "Not needed",
  unknown: "Needs confirmation",
};

const CRM_PHONE_INTENT_LABELS = {
  interested: "Interested",
  existing_number: "Already has a number",
  considering_transfer: "Considering a transfer",
  transferred: "Transferred",
  declined: "Declined",
  unknown: "Needs confirmation",
};

const CRM_PHONE_INTENT_OPTIONS = [
  "unknown",
  "interested",
  "existing_number",
  "considering_transfer",
  "transferred",
  "declined",
];

const CRM_PHONE_INTENT_STEP_KEY = "phone_intent";

const CRM_SIM_TYPE_LABELS = {
  unknown: "Needs confirmation",
  esim: "eSIM",
  physical: "Physical SIM",
};

const CRM_SIM_DELIVERY_LABELS = {
  unknown: "Needs confirmation",
  mail: "Mail",
  pickup: "Office pickup",
};

const CRM_SIM_PICKUP_LOCATION_LABELS = {
  lic_office: "LIC Office",
  boston_office: "Boston Office",
  manhattan_office: "Manhattan Office",
};

const CRM_STAFF_FLOW_OPTIONS = [
  ["not_introduced", "Not introduced"],
  ["introduced", "Introduced"],
  ["following_up", "Confirming / Following up"],
  ["service_confirmed", "Customer confirmed"],
  ["info_collected", "Information collected"],
  ["completed", "Staff work completed"],
  ["terminated", "Terminated"],
];

const CRM_CUSTOMER_FLOW_OPTIONS = [
  ["waiting_intro", "Waiting for introduction"],
  ["intent_unknown", "Customer intent unknown"],
  ["service_confirmed", "Service confirmed"],
  ["info_provided", "Information provided"],
  ["completed", "Completed"],
  ["declined", "Declined"],
  ["not_needed", "Not needed"],
];

const CRM_STAFF_FLOW_LABELS = Object.fromEntries(CRM_STAFF_FLOW_OPTIONS);
const CRM_CUSTOMER_FLOW_LABELS = Object.fromEntries(CRM_CUSTOMER_FLOW_OPTIONS);
const CRM_CUSTOMER_FLOW_KEYS = new Set(CRM_CUSTOMER_FLOW_OPTIONS.map(([value]) => value));

const CRM_DEFAULT_STAFF_TO_CUSTOMER_MAP = {
  not_introduced: "waiting_intro",
  introduced: "intent_unknown",
  following_up: "intent_unknown",
  service_confirmed: "service_confirmed",
  info_collected: "info_provided",
  completed: "completed",
  terminated: "declined",
};

const CRM_STAFF_FLOW_DESCRIPTIONS = {
  not_introduced: "The service has not yet been explained in the group or directly to the customer.",
  introduced: "Staff completed the introduction; the next step is to confirm the customer's intent.",
  following_up: "Staff is confirming whether the customer wants to proceed.",
  service_confirmed: "The customer confirmed that they want this service.",
  info_collected: "Staff has collected the information required to proceed.",
  completed: "Staff confirmed that the service workflow is complete.",
  terminated: "The customer declined, no further work is needed, or staff must record a termination reason.",
};

const CRM_RESPONSIBILITY_STATUS_LABELS = {
  unassigned: "No owner assigned",
  assigned: "Owner assigned",
  confirmed: "Owner confirmed",
  declined: "Owner declined",
  changed: "Owner changed",
};

const CRM_COMMUNICATION_CHANNEL_LABELS = {
  wechat_group: "WeChat group",
  phone: "Phone",
  email: "Email",
  internal_note: "Internal note",
  ai_draft: "AI draft",
};

const CRM_BUILDING_PROVIDER_LABELS = {
  pseg: "PSEG",
  "pse&g": "PSE&G",
  coned: "Con Edison",
  con_edison: "Con Edison",
  other: "Other",
  unknown: "Needs confirmation",
};

const crmEnumLabel = (labels, value, fallback = "Needs confirmation") => {
  if (!value) return fallback;
  return labels[value] || value;
};

const crmStatusTone = (status) => {
  if (status === "completed") return "green";
  if (status === "terminated" || status === "cancelled" || status === "failed" || status === "urgent" || status === "overdue" || status === "escalated" || status === "at_risk") return "red";
  if (status === "not_needed" || status === "paused" || status === "waived" || status === "not_required" || status === "not_applicable") return "slate";
  if (status === "waiting_customer" || status === "waiting_external" || status === "pending_customer" || status === "pending_external" || status === "unknown" || status === "high" || status === "optional" || status === "scheduled") return "amber";
  return "blue";
};

const crmApplicabilityTone = (value) => {
  if (value === "required") return "blue";
  if (value === "optional") return "amber";
  if (value === "not_needed") return "slate";
  return "amber";
};

const createEmptyCrmGuest = () => ({
  full_name: "",
  phone: "",
  email: "",
  wechat: "",
  notes: "",
});

const createEmptyStagingBuildingForm = () => ({
  building_name: "",
  address: "",
  aliases: "",
  notes: "",
  insurance_required: "",
  electricity_required: "",
  internet_self_setup_required: "",
});

const normalizeCrmGuestDrafts = (guests) =>
  guests
    .map((guest) => ({
      full_name: String(guest.full_name || "").trim(),
      phone: String(guest.phone || "").trim(),
      email: String(guest.email || "").trim(),
      wechat: String(guest.wechat || "").trim(),
      notes: String(guest.notes || "").trim(),
    }))
    .filter((guest) => guest.full_name);

const createEmptyCrmTemplateStep = () => ({
  step_key: `step_${Date.now()}`,
  title: "",
  scope: "group",
  display_order: 100,
  active: true,
  field_schema: [],
});

const createEmptyCrmTemplateTaskRule = (flowStepKey = "") => ({
  key: `rule_${Date.now()}`,
  title: "",
  timing: "immediate",
  days: 0,
  due_hour: 9,
  due_minute: 0,
  flow_step_key: flowStepKey,
  task_type: "follow_up",
  priority: "normal",
  description: "",
});

const createEmptyCrmFlowStep = () => ({
  step_key: `custom_${Date.now()}`,
  enabled: true,
  staff_flow_status: "following_up",
  staff_label: "Custom step",
  customer_flow_status: "intent_unknown",
  customer_label: "Customer confirmation pending",
  service_status: "",
  required_fields: [],
  description: "",
  is_completion: false,
  is_risk: false,
});

const crmNormalizeFlowStep = (step = {}, index = 0, profile = {}) => {
  const staffStatus = CRM_STAFF_FLOW_LABELS[step.staff_flow_status] ? step.staff_flow_status : "not_introduced";
  const customerStatus = CRM_CUSTOMER_FLOW_KEYS.has(step.customer_flow_status)
    ? step.customer_flow_status
    : (profile.staff_to_customer_map || CRM_DEFAULT_STAFF_TO_CUSTOMER_MAP)[staffStatus] || "waiting_intro";
  const requiredFields = Array.isArray(step.required_fields)
    ? step.required_fields
    : Array.isArray(profile.required_fields_by_stage?.[staffStatus])
      ? profile.required_fields_by_stage[staffStatus]
      : [];
  return {
    step_key: String(step.step_key || staffStatus || `step_${index + 1}`).trim() || `step_${index + 1}`,
    enabled: step.enabled !== false && step.active !== false,
    staff_flow_status: staffStatus,
    staff_label: String(step.staff_label || step.label || profile.staff_labels?.[staffStatus] || CRM_STAFF_FLOW_LABELS[staffStatus] || staffStatus),
    customer_flow_status: customerStatus,
    customer_label: String(step.customer_label || profile.customer_labels?.[customerStatus] || CRM_CUSTOMER_FLOW_LABELS[customerStatus] || customerStatus),
    service_status: CRM_SERVICE_STATUS_LABELS[step.service_status] ? step.service_status : "",
    required_fields: requiredFields.map((item) => String(item).trim()).filter(Boolean),
    description: String(step.description || ""),
    is_completion: Boolean(step.is_completion),
    is_risk: Boolean(step.is_risk),
    is_terminal: Boolean(step.is_terminal),
    task_rules: Array.isArray(step.task_rules) ? step.task_rules : [],
    display_order: Number(step.display_order || (index + 1) * 10),
  };
};

const createDefaultCrmFlowProfile = () => ({
  staff_labels: Object.fromEntries(CRM_STAFF_FLOW_OPTIONS),
  customer_labels: Object.fromEntries(CRM_CUSTOMER_FLOW_OPTIONS),
  skip_stages: [],
  staff_to_customer_map: CRM_DEFAULT_STAFF_TO_CUSTOMER_MAP,
  required_fields_by_stage: {},
  flow_steps: [],
  terminal_rules: [
    {
      customer_flow_status: "declined",
      service_status: "terminated",
      cancel_open_tasks: true,
      require_reason: true,
    },
  ],
});

const crmNormalizeFlowProfile = (profile = {}) => {
  const defaults = createDefaultCrmFlowProfile();
  const safeProfile = profile && typeof profile === "object" ? profile : {};
  const merged = {
    ...defaults,
    ...safeProfile,
    staff_labels: {
      ...defaults.staff_labels,
      ...(safeProfile.staff_labels || {}),
    },
    customer_labels: {
      ...defaults.customer_labels,
      ...(safeProfile.customer_labels || {}),
    },
    staff_to_customer_map: {
      ...CRM_DEFAULT_STAFF_TO_CUSTOMER_MAP,
      ...(safeProfile.staff_to_customer_map || {}),
    },
    skip_stages: Array.isArray(safeProfile.skip_stages) ? safeProfile.skip_stages : [],
    required_fields_by_stage:
      safeProfile.required_fields_by_stage && typeof safeProfile.required_fields_by_stage === "object"
        ? safeProfile.required_fields_by_stage
        : {},
    terminal_rules: Array.isArray(safeProfile.terminal_rules) ? safeProfile.terminal_rules : defaults.terminal_rules,
  };
  const rawFlowSteps = Array.isArray(safeProfile.flow_steps) ? safeProfile.flow_steps : [];
  merged.flow_steps = rawFlowSteps.length
    ? rawFlowSteps.map((step, index) => crmNormalizeFlowStep(step, index, merged))
    : CRM_STAFF_FLOW_OPTIONS.map(([statusKey], index) =>
        crmNormalizeFlowStep(
          {
            step_key: statusKey,
            enabled: crmFlowStageIsEnabled(merged.skip_stages || [], "staff", statusKey),
            staff_flow_status: statusKey,
            staff_label: merged.staff_labels?.[statusKey],
            customer_flow_status: merged.staff_to_customer_map?.[statusKey],
            required_fields: merged.required_fields_by_stage?.[statusKey] || [],
            display_order: (index + 1) * 10,
          },
          index,
          merged
        )
      );
  return merged;
};

// Keep full-width Chinese comma and enumeration punctuation as accepted input delimiters.
const crmParseFlowFieldList = (value) =>
  String(value || "")
    .split(/[,\n，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const crmFormatFlowFieldList = (value) => (Array.isArray(value) ? value.join(", ") : "");

const createEmptyCrmTemplateDraft = () => ({
  id: "",
  service_key: "",
  name: "",
  description: "",
  category: "general",
  active: true,
  display_order: 100,
  service_scope: "case_level",
  service_delivery_mode: "assisted",
  building_driven: false,
  auto_source: "",
  flow_profile: crmNormalizeFlowProfile(),
  steps: [createEmptyCrmTemplateStep()],
  task_rules: [createEmptyCrmTemplateTaskRule()],
});

const crmTemplateToDraft = (template = {}) => {
  const config = template.config || {};
  const taskRules = Array.isArray(template.task_rules)
    ? template.task_rules
    : Array.isArray(config.task_rules)
      ? config.task_rules
      : [];
  return {
    id: template.id || "",
    service_key: template.service_key || "",
    name: template.name || "",
    description: template.description || "",
    category: template.category || "general",
    active: template.active !== false,
    display_order: Number(template.display_order || 100),
    service_scope: template.service_scope || config.service_scope || "case_level",
    service_delivery_mode: template.service_delivery_mode || config.service_delivery_mode || "assisted",
    building_driven: Boolean(config.building_driven),
    auto_source: config.auto_source || "",
    flow_profile: crmNormalizeFlowProfile(template.flow_profile || config.flow_profile),
    steps: (template.steps || []).map((step) => ({
      step_key: step.step_key || "",
      title: step.title || "",
      scope: step.scope || "group",
      display_order: Number(step.display_order || 100),
      active: step.active !== false,
      field_schema: Array.isArray(step.field_schema) ? step.field_schema : [],
    })),
    task_rules: taskRules.map((rule, index) => ({
      key: rule.key || `rule_${index + 1}`,
      title: rule.title || "",
      timing: rule.timing === "immediate" ? "immediate" : "lease_start_minus_days",
      days: Number(rule.days ?? rule.days_before ?? 0),
      due_hour: Number(rule.due_hour ?? 9),
      due_minute: Number(rule.due_minute ?? 0),
      flow_step_key: rule.flow_step_key || "",
      task_type: rule.task_type || "follow_up",
      priority: rule.priority || "normal",
      description: rule.description || "",
    })),
  };
};

const crmFlowProfileForPayload = (profile = {}) => {
  const normalized = crmNormalizeFlowProfile(profile);
  return {
    ...normalized,
    flow_steps: (normalized.flow_steps || []).map(({ service_status, ...step }) => step),
  };
};

const crmTemplateDraftToPayload = (draft) => ({
  service_key: draft.service_key.trim(),
  name: draft.name.trim(),
  description: draft.description.trim(),
  category: draft.category || "general",
  active: Boolean(draft.active),
  display_order: Number(draft.display_order || 100),
  config: {
    building_driven: Boolean(draft.building_driven),
    auto_source: draft.building_driven ? draft.auto_source || "" : "",
    service_scope: draft.service_scope || "case_level",
    service_delivery_mode: draft.service_delivery_mode || "assisted",
    flow_profile: crmFlowProfileForPayload(draft.flow_profile),
    task_rules_configured: true,
    task_rules: (draft.task_rules || [])
      .filter((rule) => String(rule.title || "").trim())
      .map((rule, index) => ({
        key: String(rule.key || `rule_${index + 1}`).trim(),
        title: String(rule.title || "").trim(),
        timing: rule.timing === "immediate" ? "immediate" : "lease_start_minus_days",
        days: Number(rule.timing === "immediate" ? 0 : rule.days || 0),
        due_hour: Number(rule.due_hour ?? 9),
        due_minute: Number(rule.due_minute ?? 0),
        flow_step_key: String(rule.flow_step_key || "").trim(),
        task_type: rule.task_type || "follow_up",
        priority: rule.priority || "normal",
        description: String(rule.description || "").trim(),
      })),
  },
  steps: (draft.steps || [])
    .filter((step) => String(step.title || "").trim() && String(step.step_key || "").trim())
    .map((step) => ({
      step_key: String(step.step_key || "").trim(),
      title: String(step.title || "").trim(),
      scope: step.scope || "group",
      display_order: Number(step.display_order || 100),
      active: step.active !== false,
      field_schema: Array.isArray(step.field_schema) ? step.field_schema : [],
    })),
});

const toSourceUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
};

const normalizeFieldDisplay = (fieldKey, fieldDefinitions) => {
  return (
    fieldDefinitions.find((item) => item.field_key === fieldKey)?.display_name || fieldKey
  );
};

const getFieldDefinition = (fieldKey, fieldDefinitions) => {
  return fieldDefinitions.find((item) => item.field_key === fieldKey) || null;
};

const normalizeGroupKey = (groupKey) =>
  FIELD_GROUP_LABELS[groupKey] ? groupKey : "custom";

const fieldGroupIndex = (groupKey) => {
  const index = FIELD_GROUP_ORDER.indexOf(normalizeGroupKey(groupKey));
  return index >= 0 ? index : FIELD_GROUP_ORDER.length;
};

const inferReviewFieldGroup = (fieldKey, fieldDefinitions) => {
  const definition = getFieldDefinition(fieldKey, fieldDefinitions);
  if (definition?.group_key) return normalizeGroupKey(definition.group_key);
  if (["building_name", "address", "document_type", "source_type", "source_file", "source_date", "info_cutoff_date"].includes(fieldKey)) {
    return "basic";
  }
  if (fieldKey?.startsWith("insurance_") || fieldKey === "insurance_required" || fieldKey === "insurance_coverage_amount") {
    return "insurance";
  }
  if (fieldKey?.startsWith("electricity_")) return "electricity";
  if (fieldKey?.startsWith("internet_")) return "internet";
  if (["move_in_notes", "key_pickup_notes", "service_elevator_booking_notes"].includes(fieldKey)) {
    return "move_in";
  }
  if (fieldKey?.startsWith("building_") && fieldKey?.endsWith("_contact")) return "contacts";
  return "custom";
};

const groupReviewRecords = (records = [], fieldDefinitions = []) => {
  const groups = new Map();
  records.forEach((record) => {
    const groupKey = inferReviewFieldGroup(record.field_name, fieldDefinitions);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(record);
  });
  return Array.from(groups.entries())
    .sort(([groupA], [groupB]) => fieldGroupIndex(groupA) - fieldGroupIndex(groupB))
    .map(([groupKey, groupRecords]) => ({
      groupKey,
      label: FIELD_GROUP_LABELS[groupKey] || groupKey,
      records: groupRecords.sort((a, b) => {
        const defA = getFieldDefinition(a.field_name, fieldDefinitions);
        const defB = getFieldDefinition(b.field_name, fieldDefinitions);
        const orderDelta = (defA?.display_order ?? 9999) - (defB?.display_order ?? 9999);
        if (orderDelta !== 0) return orderDelta;
        return normalizeFieldDisplay(a.field_name, fieldDefinitions).localeCompare(
          normalizeFieldDisplay(b.field_name, fieldDefinitions),
          "zh-CN",
        );
      }),
    }));
};

const MANUALLY_RENDERED_DETAIL_FIELD_KEYS = new Set([
  "building_name",
  "address",
  "insurance_required",
  "insurance_coverage_amount",
  "insurance_coi_required",
  "insurance_coi_trigger",
  "electricity_required",
  "electricity_provider",
  "internet_self_setup_required",
  "internet_provider",
  "internet_notes",
  "move_in_notes",
  "key_pickup_notes",
  "service_elevator_booking_notes",
  "source_type",
  "source_file",
  "info_cutoff_date",
  ...NETWORK_PROVIDER_FIELDS.map((item) => item.fieldKey),
  ...NETWORK_PROVIDER_FIELDS.map((item) => item.planFieldKey),
  ...NETWORK_PROVIDER_FIELDS.map((item) => item.noteFieldKey),
]);

const dynamicDetailFieldsByGroup = (fieldDefinitions, viewKey) => {
  const visibilityKey =
    viewKey === "master" ? "visible_in_master_detail" : "visible_in_staging_detail";
  const groups = {};
  fieldDefinitions
    .filter(
      (item) =>
        item?.active &&
        item?.[visibilityKey] &&
        !MANUALLY_RENDERED_DETAIL_FIELD_KEYS.has(item.field_key)
    )
    .sort((a, b) => {
      const groupDelta = fieldGroupIndex(a?.group_key) - fieldGroupIndex(b?.group_key);
      if (groupDelta !== 0) return groupDelta;
      const orderDelta = (a?.display_order ?? 999) - (b?.display_order ?? 999);
      if (orderDelta !== 0) return orderDelta;
      return String(a?.display_name || "").localeCompare(String(b?.display_name || ""), "zh-CN");
    })
    .forEach((item) => {
      const groupKey = item.group_key || "custom";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
  return groups;
};

const isBooleanField = (fieldKey, fieldDefinitions) => {
  if (BOOL_FIELD_KEYS.has(fieldKey)) return true;
  return getFieldDefinition(fieldKey, fieldDefinitions)?.field_type === "boolean";
};

const isInsuranceStatusField = (fieldKey) => INSURANCE_STATUS_FIELD_KEYS.has(fieldKey);

const formatBoolLabel = (value) => {
  if (value === 1 || value === "true" || value === true) return "Yes";
  if (value === 0 || value === "false" || value === false) return "No";
  if (value === 2 || value === "optional") return "Optional";
  return "Unknown";
};

const supportsOptionalBoolean = (fieldKey) => OPTIONAL_BOOL_FIELD_KEYS.has(fieldKey);

const toEditableMasterValue = (fieldKey, value, fieldDefinitions) => {
  if (isBooleanField(fieldKey, fieldDefinitions)) {
    if (value === 1 || value === "1" || value === true || value === "true") return "true";
    if (value === 0 || value === "0" || value === false || value === "false") return "false";
    if (value === 2 || value === "2" || value === "optional") return "optional";
    return "";
  }
  return value ?? "";
};

const networkStatusTone = (status) => {
  if (status === "supported") return "green";
  if (status === "unsupported") return "red";
  return "amber";
};

const networkStatusLabel = (status) => {
  if (status === "supported") return "Available";
  if (status === "unsupported") return "Unavailable";
  return "To Be Confirmed";
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (value) => {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatLeaseDays = (value) => {
  if (value === null || value === undefined) return "Not Entered";
  if (value === 0) return "Lease starts today";
  if (value > 0) return `${value} day${value === 1 ? "" : "s"} until the lease starts`;
  const elapsed = Math.abs(value);
  return `Lease started ${elapsed} day${elapsed === 1 ? "" : "s"} ago`;
};

const formatCrmSourceLabel = (source) => {
  if (source === "master") return "Master Library";
  if (source === "staging") return "Staging Library";
  return "Not Linked";
};

const getCrmStepValues = (service, stepKey) => {
  const value = service?.group_progress?.[stepKey];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};

const getCrmGuestStepValues = (guest, serviceId, stepKey) => {
  const progress = (guest?.service_progress || []).find(
    (item) => item.service_id === serviceId && item.step_key === stepKey
  );
  return {
    value: progress?.value && typeof progress.value === "object" ? progress.value : {},
    sensitive: progress?.sensitive && typeof progress.sensitive === "object" ? progress.sensitive : {},
    note: progress?.note || "",
    updated_at: progress?.updated_at || "",
  };
};

const crmTaskDate = (task) => {
  if (!task?.due_at) return null;
  const parsed = new Date(task.due_at);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const crmTaskDateKey = (task) => {
  const parsed = crmTaskDate(task);
  if (!parsed) return "";
  return crmDateKey(parsed);
};

const crmDateKey = (date = new Date()) => {
  const copy = new Date(date);
  if (Number.isNaN(copy.getTime())) return "";
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const crmTaskClosed = (task) => ["completed", "cancelled", "done"].includes(task?.status);

const crmOpenTasks = (tasks = []) =>
  tasks.filter((task) => !crmTaskClosed(task));

const crmServiceClosed = (service = {}) =>
  ["completed", "terminated", "not_needed"].includes(service?.service_status) ||
  ["completed", "terminated", "not_needed"].includes(service?.status) ||
  ["completed", "waived", "not_applicable"].includes(service?.completion_status) ||
  ["completed", "declined", "not_needed"].includes(service?.customer_flow_status);

const crmTasksForService = (service, tasks = []) =>
  (tasks || [])
    .filter((task) => task.case_service_id === service?.id)
    .sort((a, b) => {
      const waitingForResponsible =
        crmServiceResponsibilityRequired(service) && !service?.responsible_customer_id;
      const aAssign = waitingForResponsible && a.task_type === "assign_responsible_customer";
      const bAssign = waitingForResponsible && b.task_type === "assign_responsible_customer";
      if (aAssign !== bAssign) return aAssign ? -1 : 1;
      return String(a.due_at || "").localeCompare(String(b.due_at || ""));
    });

const crmNextTaskForService = (service, tasks = []) =>
  crmServiceClosed(service) ? null : crmTasksForService(service, crmOpenTasks(tasks))[0] || null;

const crmMonthCalendarDays = (monthDate = new Date()) => {
  const monthStart = new Date(monthDate);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - startOffset);
  const todayKey = crmDateKey();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = crmDateKey(date);
    return {
      date,
      dateKey,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: dateKey === todayKey,
    };
  });
};

const crmTasksByDate = (tasks = []) =>
  (tasks || []).reduce((acc, task) => {
    const key = crmTaskDateKey(task);
    if (!key) return acc;
    acc[key] = acc[key] || [];
    acc[key].push(task);
    return acc;
  }, {});

const crmOpenTaskCountForDate = (tasks = []) =>
  crmOpenTasks(tasks).length;

const crmCalendarMonthLabel = (date = new Date()) =>
  date.toLocaleDateString("en-US", { year: "numeric", month: "long" });

const CRM_CALENDAR_CRITICAL_SERVICE_KEYS = new Set([
  "insurance",
  "renters_insurance",
  "internet",
  "internet_setup",
]);

const CRM_CALENDAR_FOLLOW_UP_MARKER = "Created from a calendar critical-date task";
const CRM_INTERNET_VERIFICATION_MARKER = "Internet verification-code appointment";
const CRM_INTERNET_INFO_DEFER_MARKER = "Internet account information deferred";
const CRM_INTERNET_APPOINTMENT_DEFER_MARKER = "Verification-code appointment pending";

// Retain legacy Chinese markers so tasks created by the original interface still reopen correctly.
const CRM_CALENDAR_FOLLOW_UP_MARKERS = [
  CRM_CALENDAR_FOLLOW_UP_MARKER,
  "由日历关键日期任务创建",
];
const CRM_INTERNET_VERIFICATION_MARKERS = [
  CRM_INTERNET_VERIFICATION_MARKER,
  "网络验证码预约窗口",
];
const CRM_INTERNET_INFO_DEFER_MARKERS = [
  CRM_INTERNET_INFO_DEFER_MARKER,
  "网络开户信息稍后补充",
  "补充网络开户信息",
];
const CRM_INTERNET_APPOINTMENT_DEFER_MARKERS = [
  CRM_INTERNET_APPOINTMENT_DEFER_MARKER,
  "验证码预约时间待确认",
  "预约网络验证码窗口",
];
const crmTextIncludesAny = (text, markers = []) =>
  markers.some((marker) => String(text || "").includes(marker));

const crmTaskServiceKey = (task = {}) =>
  task.service_key || task.service_type || "";

const crmTaskIsInsuranceOrInternet = (task = {}) =>
  CRM_CALENDAR_CRITICAL_SERVICE_KEYS.has(crmTaskServiceKey(task));

const crmTaskServiceStillRelevant = (task = {}) =>
  task.service_need_status !== "not_needed" &&
  !["waived", "not_applicable"].includes(task.service_completion_status);

const crmTaskIsEarliestServiceDate = (task = {}) => {
  const ruleKey = String(task.created_from_rule || "");
  const title = String(task.title || "");
  return (
    ruleKey.includes(":insurance_ddl_") ||
    title.includes("Insurance DDL") ||
    title.includes("Renter's Insurance DDL") ||
    title.includes("保险 DDL") ||
    title.includes("租房保险 DDL")
  );
};

const crmTaskIsCalendarFollowUp = (task = {}) =>
  task.task_type === "follow_up" &&
  (crmTextIncludesAny(task.description, CRM_CALENDAR_FOLLOW_UP_MARKERS) ||
    crmTextIncludesAny(task.description, CRM_INTERNET_INFO_DEFER_MARKERS) ||
    crmTextIncludesAny(task.description, CRM_INTERNET_APPOINTMENT_DEFER_MARKERS));

const crmTaskIsInternetVerificationAppointment = (task = {}) =>
  crmTaskIsInsuranceOrInternet(task) &&
  task.task_type === "verify" &&
  (String(task.title || "").toLowerCase().includes("verification code") ||
    String(task.title || "").includes("验证码") ||
    crmTextIncludesAny(task.description, CRM_INTERNET_VERIFICATION_MARKERS));

const crmCalendarCriticalTasks = (tasks = []) =>
  (tasks || []).filter((task) => {
    if (task.task_type === "sim_card_sent_record") return true;
    if (crmTaskIsCalendarFollowUp(task)) return true;
    if (crmTaskIsInternetVerificationAppointment(task)) return true;
    return (
      crmTaskIsInsuranceOrInternet(task) &&
      crmTaskIsEarliestServiceDate(task) &&
      crmTaskServiceStillRelevant(task)
    );
  });

const crmCalendarTasksForScope = (tasks = [], scope = "critical") =>
  scope === "all" ? tasks || [] : crmCalendarCriticalTasks(tasks);

const crmDateAtNineIso = (date = new Date()) => {
  const local = new Date(date);
  if (Number.isNaN(local.getTime())) return "";
  local.setHours(9, 0, 0, 0);
  return local.toISOString();
};

const crmDateTimeLocalInputValue = (value = "") => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const crmDateTimeLocalToIso = (value = "") => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const crmInternetVerificationQueueTasks = (tasks = []) =>
  crmOpenTasks(tasks)
    .filter(crmTaskIsInternetVerificationAppointment)
    .sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")));

const crmTaskInternetDeferPhase = (task = {}) => {
  const text = `${task.title || ""}\n${task.description || ""}`;
  if (
    crmTaskServiceKey(task) &&
    !["internet", "internet_setup"].includes(crmTaskServiceKey(task))
  ) {
    return "";
  }
  if (crmTextIncludesAny(text, CRM_INTERNET_INFO_DEFER_MARKERS)) return "collect";
  if (crmTextIncludesAny(text, CRM_INTERNET_APPOINTMENT_DEFER_MARKERS)) return "appointment";
  return "";
};

const crmTaskIsInternetDeferTask = (task = {}) => Boolean(crmTaskInternetDeferPhase(task));

const crmChineseNumberValue = (value = "") => {
  const text = String(value || "").trim();
  if (/^\d+$/.test(text)) return Number(text);
  const digits = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tensRaw, onesRaw] = text.split("十");
    const tens = tensRaw ? digits[tensRaw] || 0 : 1;
    const ones = onesRaw ? digits[onesRaw] || 0 : 0;
    return tens * 10 + ones;
  }
  return digits[text] ?? null;
};

const crmParseReminderDueAt = (text = "", now = new Date()) => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const baseDate = new Date(now);
  if (Number.isNaN(baseDate.getTime())) return "";
  baseDate.setHours(0, 0, 0, 0);
  const makeDueAt = (date) => crmDateAtNineIso(date);
  if (raw.includes("今天") || raw.includes("当天") || /\b(today|same day)\b/i.test(raw)) {
    return makeDueAt(baseDate);
  }
  if (raw.includes("后天") || /\bday after tomorrow\b/i.test(raw)) {
    const target = new Date(baseDate);
    target.setDate(target.getDate() + 2);
    return makeDueAt(target);
  }
  if (raw.includes("明天") || /\b(tomorrow|next day)\b/i.test(raw)) {
    const target = new Date(baseDate);
    target.setDate(target.getDate() + 1);
    return makeDueAt(target);
  }
  const daysMatch =
    raw.match(/(\d+|[一二两三四五六七八九十]{1,3})\s*天后/) ||
    raw.match(/\bin\s+(\d+)\s+days?\b/i);
  if (daysMatch) {
    const days = crmChineseNumberValue(daysMatch[1]);
    if (Number.isFinite(days) && days >= 0) {
      const target = new Date(baseDate);
      target.setDate(target.getDate() + days);
      return makeDueAt(target);
    }
  }
  const ordinalDayMatch = raw.match(/第\s*(\d+|[一二两三四五六七八九十]{1,3})\s*[天日]/);
  if (ordinalDayMatch) {
    const ordinalDay = crmChineseNumberValue(ordinalDayMatch[1]);
    if (Number.isFinite(ordinalDay) && ordinalDay > 0) {
      const target = new Date(baseDate);
      target.setDate(target.getDate() + ordinalDay - 1);
      return makeDueAt(target);
    }
  }
  if (/次日|隔天/.test(raw)) {
    const target = new Date(baseDate);
    target.setDate(target.getDate() + 1);
    return makeDueAt(target);
  }
  const englishNextWeekMatch = raw.match(
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  );
  if (englishNextWeekMatch) {
    const weekdayMap = {
      monday: 0,
      tuesday: 1,
      wednesday: 2,
      thursday: 3,
      friday: 4,
      saturday: 5,
      sunday: 6,
    };
    const weekday = weekdayMap[englishNextWeekMatch[1].toLowerCase()];
    const mondayOffset = (baseDate.getDay() + 6) % 7;
    const target = new Date(baseDate);
    target.setDate(baseDate.getDate() - mondayOffset + 7 + weekday);
    return makeDueAt(target);
  }
  const nextWeekMatch = raw.match(/下周([一二三四五六日天1-7])/);
  if (nextWeekMatch) {
    const map = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6, "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6 };
    const weekday = map[nextWeekMatch[1]];
    const mondayOffset = (baseDate.getDay() + 6) % 7;
    const target = new Date(baseDate);
    target.setDate(baseDate.getDate() - mondayOffset + 7 + weekday);
    return makeDueAt(target);
  }
  const fullDateMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (fullDateMatch) {
    const target = new Date(Number(fullDateMatch[1]), Number(fullDateMatch[2]) - 1, Number(fullDateMatch[3]));
    return Number.isNaN(target.getTime()) ? "" : makeDueAt(target);
  }
  const monthDayMatch = raw.match(/(?:^|[^\d])(\d{1,2})-(\d{1,2})(?:$|[^\d])/);
  if (monthDayMatch) {
    const target = new Date(baseDate.getFullYear(), Number(monthDayMatch[1]) - 1, Number(monthDayMatch[2]));
    if (Number.isNaN(target.getTime())) return "";
    if (target < baseDate) {
      target.setFullYear(target.getFullYear() + 1);
    }
    return makeDueAt(target);
  }
  return "";
};

const crmQuickFollowUpTitle = (text = "", task = {}) => {
  let cleaned = String(text || "")
    .replace(/(\d{4}-\d{1,2}-\d{1,2})/g, "")
    .replace(/(?:^|[^\d])(\d{1,2}-\d{1,2})(?:$|[^\d])/g, " ")
    .replace(/今天|明天|后天|当天|次日|隔天/g, "")
    .replace(/(\d+|[一二两三四五六七八九十]{1,3})\s*天后/g, "")
    .replace(/第\s*(\d+|[一二两三四五六七八九十]{1,3})\s*[天日]/g, "")
    .replace(/下周[一二三四五六日天1-7]/g, "")
    .replace(/提醒我|提醒一下|提醒客服|提醒/g, "")
    .replace(/\b(day after tomorrow|today|tomorrow|same day|next day)\b/gi, "")
    .replace(/\bin\s+\d+\s+days?\b/gi, "")
    .replace(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b(remind me|remind staff|reminder)\b/gi, "")
    .replace(/[，,。.!！：:；;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return `Follow up - ${task.title || "Critical-date task"}`;
  if (/^(follow up|confirm|remind|contact|chase)\b/i.test(cleaned) || /^(跟进|确认|提醒|联系|催)/.test(cleaned)) {
    return cleaned;
  }
  return `Follow up - ${cleaned}`;
};

const crmTaskPriorityTone = (priority) => {
  if (priority === "urgent") return "red";
  if (priority === "high") return "amber";
  if (priority === "low") return "slate";
  return "blue";
};

const crmServiceDisabled = (service) =>
  crmServiceClosed(service) ||
  service?.service_status === "not_needed" ||
  service?.customer_flow_status === "not_needed" ||
  service?.need_status === "not_needed" ||
  service?.completion_status === "not_applicable" ||
  service?.completion_status === "waived" ||
  service?.status === "not_needed";

const crmCustomerLabel = (customers = [], customerId = "") => {
  if (!customerId) return CRM_GROUP_TARGET_LABEL;
  const customer = customers.find((item) => item.id === customerId);
  return customer?.full_name || customerId;
};

const crmTaskCaseLabel = (task) =>
  task?.case_group_name || task?.group_name || "Unnamed Case";

const crmTaskAssigneeLabel = (task) =>
  task?.assigned_to_name || task?.assigned_username || task?.assigned_to || "Unassigned";

const crmTaskTargetLabel = (task) =>
  task?.target_customer_name || task?.customer_name || CRM_GROUP_TARGET_LABEL;

const crmPhoneIntentValueFromProgress = (progress = {}) =>
  progress?.value?.phone_intent ||
  progress?.value?.intent ||
  progress?.value?.status ||
  "unknown";

const crmPhoneIntentLabel = (value) =>
  crmEnumLabel(CRM_PHONE_INTENT_LABELS, value, "To Be Confirmed");

const crmServiceDeliveryModeValue = (service) =>
  service?.service_delivery_mode ||
  service?.delivery_mode ||
  service?.group_progress?.service_delivery_mode ||
  service?.group_progress?.delivery_mode ||
  service?.template?.service_delivery_mode ||
  "";

const crmServiceDeliveryModeLabel = (service) =>
  crmEnumLabel(CRM_SERVICE_DELIVERY_MODE_LABELS, crmServiceDeliveryModeValue(service), "");

const crmServiceResponsibilityRequired = (service) =>
  service?.service_scope === "case_level" &&
  !crmServiceClosed(service) &&
  service?.service_status !== "not_needed" &&
  service?.customer_flow_status !== "not_needed" &&
  service?.need_status !== "not_needed" &&
  !["waived", "not_applicable"].includes(service?.completion_status);

const crmCoveredCustomerLabels = (customers = [], service = {}) => {
  const coveredIds = Array.isArray(service.covered_customer_ids) && service.covered_customer_ids.length
    ? service.covered_customer_ids
    : service.service_scope === "case_level"
      ? customers.map((customer) => customer.id)
      : [];
  return coveredIds
    .map((customerId) => crmCustomerLabel(customers, customerId))
    .filter(Boolean);
};

const crmCommunicationChannelLabel = (channel) =>
  crmEnumLabel(CRM_COMMUNICATION_CHANNEL_LABELS, channel, "Communication");

const crmProviderLabel = (provider) => {
  if (!provider) return "";
  const value = String(provider).trim();
  return CRM_BUILDING_PROVIDER_LABELS[value.toLowerCase()] || value;
};

const crmServiceLabel = (serviceKey) => {
  const labels = {
    insurance: "Renter's Insurance",
    electricity: "Electricity Account",
    internet: "Internet Setup",
    sim_card: "SIM Card",
    phone_card: "SIM Card",
    internet_setup: "Internet Setup",
    electricity_account: "Electricity Account",
    renters_insurance: "Renter's Insurance",
  };
  return labels[serviceKey] || serviceKey || "No Linked Service";
};

const crmCalendarBuckets = (tasks = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const monthEnd = new Date(today);
  monthEnd.setDate(today.getDate() + 30);
  return [
    {
      key: "overdue",
      title: "Overdue Tasks",
      tasks: crmOpenTasks(tasks).filter((task) => task.is_overdue),
    },
    {
      key: "today",
      title: "Today's Tasks",
      tasks: crmOpenTasks(tasks).filter((task) => crmTaskDateKey(task) === crmDateKey(today)),
    },
    {
      key: "week",
      title: "This Week",
      tasks: crmOpenTasks(tasks).filter((task) => {
        const due = crmTaskDate(task);
        return due && due > today && due <= weekEnd;
      }),
    },
    {
      key: "month",
      title: "This Month",
      tasks: crmOpenTasks(tasks).filter((task) => {
        const due = crmTaskDate(task);
        return due && due > weekEnd && due <= monthEnd;
      }),
    },
  ];
};

const addDaysToIso = (value, days) => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
};

const splitProviderLabels = (value) =>
  String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const splitPlanTierLabels = (value) =>
  String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinPlanTierLabels = (values) => [...new Set(values.filter(Boolean))].join("\n");

const togglePlanTierValue = (currentValue, planValue) => {
  const current = splitPlanTierLabels(currentValue);
  if (current.includes(planValue)) {
    return joinPlanTierLabels(current.filter((item) => item !== planValue));
  }
  return joinPlanTierLabels([...current, planValue]);
};

const extractExtraProviderText = (value) =>
  splitProviderLabels(value)
    .filter((label) => !FIXED_NETWORK_PROVIDER_SET.has(label))
    .filter((label, index, list) => list.indexOf(label) === index)
    .join(", ");

const buildCombinedProviderText = (values) => {
  const supported = NETWORK_PROVIDER_FIELDS.filter(
    (item) =>
      values?.[item.fieldKey] === "true" ||
      splitPlanTierLabels(values?.[item.planFieldKey]).length > 0
  ).map((item) => item.label);
  const extra = splitProviderLabels(values?.internet_provider).filter(
    (label) => !FIXED_NETWORK_PROVIDER_SET.has(label)
  );
  return [...new Set([...supported, ...extra])].join(", ");
};

const toBuildingDraftFromDetail = (data, fieldDefinitions) => ({
  ...Object.fromEntries(
    CORE_FIELD_ORDER.map((fieldKey) => [
      fieldKey,
      toEditableMasterValue(fieldKey, data[fieldKey], fieldDefinitions),
    ])
  ),
  internet_self_setup_required: toEditableMasterValue(
    "internet_self_setup_required",
    data.internet_self_setup_required,
    fieldDefinitions
  ),
  internet_provider: extractExtraProviderText(data.internet_provider),
  internet_notes: data.internet_notes ?? "",
  source_date: data.source_date ?? "",
  ...Object.fromEntries(
    Object.entries(data.extensions || {}).map(([fieldKey, value]) => [
      fieldKey,
      toEditableMasterValue(fieldKey, value, fieldDefinitions),
    ])
  ),
});

const toEditableFieldDraftState = (draft, fallbackDisplayName = "") => ({
  field_key: draft?.field_key || "",
  display_name: draft?.display_name || fallbackDisplayName,
  field_type: draft?.field_type || "text",
  group_key: draft?.group_key || "custom",
  excel_header_name:
    draft?.excel_header_name || draft?.display_name || fallbackDisplayName,
  scope: draft?.scope || "master_and_staging",
  aliases: Array.isArray(draft?.aliases)
    ? draft.aliases.join("\n")
    : String(draft?.aliases || ""),
  query_keywords: Array.isArray(draft?.query_keywords)
    ? draft.query_keywords.join("\n")
    : String(draft?.query_keywords || ""),
  answer_template: draft?.answer_template || "",
  visible_in_master_detail: draft?.visible_in_master_detail !== false,
  visible_in_staging_detail: draft?.visible_in_staging_detail !== false,
  visible_in_query: draft?.visible_in_query !== false,
  description: draft?.description || "",
});

const ReadOnlyMetaRow = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
    <div className="text-xs font-medium text-slate-500">{label}</div>
    <div className="mt-1 text-sm text-slate-700">{value || "—"}</div>
  </div>
);

const CollapsibleText = ({ text, emptyText = "—", initialExpanded = false }) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const content = String(text || "").trim();
  if (!content) {
    return <div className="text-slate-500">{emptyText}</div>;
  }
  const long = content.length > 180;
  const display = expanded || !long ? content : `${content.slice(0, 180)}...`;
  return (
    <div className="space-y-2">
      <div className="whitespace-pre-wrap break-words text-slate-600">{display}</div>
      {long ? (
        <button
          type="button"
          className="text-xs font-medium text-blue-600 transition hover:text-blue-500"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Show Less" : "Show All"}
        </button>
      ) : null}
    </div>
  );
};

const EvidenceList = ({ items = [] }) => {
  if (!items.length) {
    return <div className="text-slate-500">No direct evidence excerpts are available.</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={`${item.page || 1}-${index}-${item.quote || ""}`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
        >
          <div className="text-xs font-medium text-slate-400">Page {item.page || 1}</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
            {item.quote || "—"}
          </div>
        </div>
      ))}
    </div>
  );
};

const SummaryTable = ({ title, columns = [], rows = [], footer = null }) => {
  if (!rows.length) {
    return null;
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded-2xl border border-slate-200 bg-white p-4">
            {rows.length > 1 ? (
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                Record {rowIndex + 1}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {columns.map((column) => (
                <div key={column} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-medium text-slate-500">{column}</div>
                  <div className="mt-2 text-sm text-slate-700">
                    <CollapsibleText text={row[column] || ""} emptyText="—" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
};

const reviewStatusTone = (status) => {
  if (status === "migrated_to_staging") return "green";
  if (status === "migrated_to_master") return "green";
  if (status === "rejected") return "red";
  if (status === "conflict") return "amber";
  return "blue";
};

const REVIEW_EMPTY_MARKERS = new Set([
  "",
  "未知",
  "n/a",
  "na",
  "none",
  "null",
  "unknown",
  "待确认",
]);

const isWritableReviewRecord = (record) => {
  const fieldName = record?.field_name || "";
  return fieldName && !fieldName.startsWith("__") && fieldName !== "source_date";
};

const isEmptyReviewValue = (value) => REVIEW_EMPTY_MARKERS.has(String(value ?? "").trim().toLowerCase());

const effectiveReviewResolution = (record, resolutions = {}) => {
  const selected = resolutions[record.record_id];
  if (["use_new", "use_old", "skip"].includes(selected)) return selected;
  return record.conflict_with_long_term ? "" : "use_new";
};

const buildReviewDecisionStats = (records = [], edits = {}, resolutions = {}) => {
  const writableRecords = records.filter(isWritableReviewRecord);
  let conflictCount = 0;
  let unresolvedConflictCount = 0;
  let writeCount = 0;
  let skipCount = 0;

  writableRecords.forEach((record) => {
    const resolution = effectiveReviewResolution(record, resolutions);
    const editedValue = edits[record.record_id] ?? record.new_value ?? "";
    if (record.conflict_with_long_term) {
      conflictCount += 1;
      if (!resolution) {
        unresolvedConflictCount += 1;
        return;
      }
    }
    if (resolution === "use_new" && !isEmptyReviewValue(editedValue)) {
      writeCount += 1;
      return;
    }
    skipCount += 1;
  });

  return {
    totalCount: writableRecords.length,
    nonConflictCount: writableRecords.length - conflictCount,
    conflictCount,
    unresolvedConflictCount,
    writeCount,
    skipCount,
  };
};

const ReviewRecordCard = ({
  record,
  fieldDefinitions,
  value,
  onChange,
  resolution,
  onResolutionChange,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">
          {normalizeFieldDisplay(record.field_name, fieldDefinitions)}
        </div>
        <div className="mt-1 text-xs text-slate-500">{record.field_name}</div>
      </div>
      <StatusPill tone={reviewStatusTone(record.review_status)}>{record.review_status}</StatusPill>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="text-xs font-medium text-slate-500">Current Value</div>
        <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
          {record.old_value || "—"}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="text-xs font-medium text-slate-500">Proposed Value (Editable)</div>
        <textarea
          className="mt-2 min-h-[96px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
          value={value ?? ""}
          onChange={onChange}
          disabled={resolution !== "use_new"}
        />
      </div>
    </div>

    {isWritableReviewRecord(record) ? (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="mb-2 text-xs font-medium text-slate-500">
          {record.conflict_with_long_term ? "Conflict Resolution (Required)" : "Write Strategy"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              resolution === "use_new"
                ? "bg-emerald-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => onResolutionChange("use_new")}
          >
            Use Proposed Value
          </button>
          {record.conflict_with_long_term ? (
            <button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                resolution === "use_old"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => onResolutionChange("use_old")}
            >
              Keep Current Value
            </button>
          ) : null}
          <button
            type="button"
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              resolution === "skip"
                ? "bg-slate-700 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => onResolutionChange("skip")}
          >
            Skip
          </button>
        </div>
        <div className="mt-2 text-xs leading-5 text-slate-500">
          {resolution === "use_old"
            ? "Keep the current value and do not overwrite it with this extraction."
            : resolution === "skip"
            ? "This field will not be written."
            : isEmptyReviewValue(value)
            ? "The proposed value is blank or unknown. Approval will skip it instead of clearing the current value."
            : "Approval will write the proposed value shown above."}
        </div>
      </div>
    ) : null}

    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {record.conflict_with_long_term ? <StatusPill tone="amber">Conflicts with Master</StatusPill> : null}
      {record.low_confidence ? <StatusPill tone="amber">Low Confidence</StatusPill> : null}
      {record.missing_required_detail ? <StatusPill tone="red">Key Details Missing</StatusPill> : null}
      {(record.review_flags || []).includes("no_direct_evidence") ? (
        <StatusPill tone="amber">No Direct Evidence Match</StatusPill>
      ) : null}
      {(record.review_flags || []).includes("ambiguous_property_liability_split") ? (
        <StatusPill tone="amber">Property / Liability Split Unclear</StatusPill>
      ) : null}
      {(record.review_flags || []).includes("ambiguous_party_type") ? (
        <StatusPill tone="amber">Additional Party Type Unclear</StatusPill>
      ) : null}
      {record.ai_confidence ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
          AI Confidence: {record.ai_confidence}
        </span>
      ) : null}
    </div>

    {record.manual_review_reason ? (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-800">
        {record.manual_review_reason}
      </div>
    ) : null}

    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-xs font-medium text-slate-500">Evidence</div>
      <div className="mt-2">
        <EvidenceList items={record.evidence_items || []} />
      </div>
    </div>
  </div>
);

const NetworkDetails = ({ network, emptyMessage = "No structured internet information is available for this building." }) => {
  if (!network) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {network.reference_notice ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
          {network.reference_notice}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Plans</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {(network.providers || []).map((provider) => (
            <tr key={provider.key} className="border-t border-slate-200">
                <td className="px-4 py-3 text-slate-800">{provider.label}</td>
                <td className="px-4 py-3">
                  <StatusPill tone={networkStatusTone(provider.status)}>
                    {networkStatusLabel(provider.status)}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {splitPlanTierLabels(provider.plans).length ? (
                    <div className="flex flex-wrap gap-2">
                      {splitPlanTierLabels(provider.plans).map((plan) => (
                        <span
                          key={`${provider.key}-${plan}`}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                          {plan}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="whitespace-pre-wrap break-words">{provider.note || "—"}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="font-medium text-slate-900">Wi-Fi Setup</div>
          <div className="mt-2 space-y-1 text-slate-600">
            <div>{network.wifi_mode || "Not Specified"}</div>
            <div>{network.mode_detail || "—"}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="font-medium text-slate-900">Additional Providers</div>
          <div className="mt-2 text-slate-600">
            {network.extra_providers?.length ? network.extra_providers.join(", ") : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="font-medium text-slate-900">Building Information</div>
          <div className="mt-2 space-y-1 text-slate-600">
            <div>{network.building_name || "—"}</div>
            <div>{network.address || "Address Unknown"}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="font-medium text-slate-900">Website / Contact</div>
          <div className="mt-2 space-y-1 text-slate-600">
            <div>{network.website || "Website Not Provided"}</div>
            <div>{network.contact || "Contact Not Provided"}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <div className="font-medium text-slate-900">Additional Notes</div>
        <div className="mt-2">
          <CollapsibleText text={network.notes} />
        </div>
        <div className="mt-3 text-xs text-slate-400">Source: {network.source_file || "Unknown"}</div>
      </div>
    </div>
  );
};

const NetworkPlanButtonGroup = ({ provider, value, disabled, onToggle }) => {
  const selectedValues = splitPlanTierLabels(value);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {provider.tiers.map((tier) => {
        const selected = selectedValues.includes(tier.value);
        return (
          <button
            key={`${provider.label}-${tier.value}`}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(tier.value)}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
              selected
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            } disabled:cursor-not-allowed disabled:opacity-60`}
            title={`${tier.shortLabel} at ${tier.price} per month`}
          >
            <div className="font-semibold">{tier.shortLabel}</div>
            <div className={`mt-1 ${selected ? "text-slate-200" : "text-slate-500"}`}>
              {tier.price}
            </div>
          </button>
        );
      })}
    </div>
  );
};

const NetworkProviderEditorCard = ({
  provider,
  draft,
  disabled,
  onStatusChange,
  onPlanToggle,
  onPlanTextChange,
  onNoteTextChange,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-slate-800">{provider.label}</div>
      <StatusPill tone="blue">Manual Verification</StatusPill>
    </div>
    <div className="mt-3">
      <select
        disabled={disabled}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        value={String(draft[provider.fieldKey] ?? "")}
        onChange={(event) => onStatusChange(event.target.value)}
      >
        <option value="">To Be Confirmed</option>
        <option value="true">Available</option>
        <option value="false">Unavailable</option>
      </select>
    </div>
    <div className="mt-3 text-xs leading-5 text-slate-500">
      Check the official provider website first, then select one or more plan tiers below. Selected tiers are synchronized to Excel and the SQLite mirror.
    </div>
    <NetworkPlanButtonGroup
      provider={provider}
      value={draft[provider.planFieldKey] ?? ""}
      disabled={disabled}
      onToggle={onPlanToggle}
    />
    <label className="mt-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-500">Selected Plans (Editable)</span>
      <textarea
        disabled={disabled}
        className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        placeholder="One plan tier per line"
        value={draft[provider.planFieldKey] ?? ""}
        onChange={(event) => onPlanTextChange(event.target.value)}
      />
    </label>
    <label className="mt-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-500">Notes / Contact</span>
      <textarea
        disabled={disabled}
        className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        placeholder={`${provider.label} contact, website, or setup instructions`}
        value={draft[provider.noteFieldKey] ?? ""}
        onChange={(event) => onNoteTextChange(event.target.value)}
      />
    </label>
  </div>
);

const buildEmptyQueryAssist = () => ({
  question: "",
  matched: null,
  sourceMode: "master",
  factAnswer: "",
  aiAnswer: "",
  answerMode: "database-only",
  aiEnabled: false,
  aiLoading: false,
  aiMessage: "",
  networkPanelHint: false,
  message: "",
  buildingSwitchCandidate: null,
  selectionConflictMessage: "",
  temporarySuggestions: [],
});

const isWelcomeLetterReviewGroup = (group) =>
  Boolean(group?.source_document && String(group.source_document.source_type || "").startsWith("welcome_letter_"));

const hasSubstantiveStagingSnapshot = (snapshot) => {
  if (!snapshot) return false;
  if (["insurance_required", "electricity_required", "internet_self_setup_required"].some((fieldKey) => {
    const value = snapshot[fieldKey];
    return value === 1 || value === 0 || value === 2 || value === "true" || value === "false" || value === "optional";
  })) {
    return true;
  }
  if (
    [
      "insurance_coverage_amount",
      "electricity_provider",
      "internet_provider",
      "internet_notes",
      "move_in_notes",
    ].some((fieldKey) => String(snapshot[fieldKey] || "").trim())
  ) {
    return true;
  }
  if ([
    "insurance_coi_required",
    "insurance_coi_trigger",
    "key_pickup_notes",
    "service_elevator_booking_notes",
    ...NETWORK_PROVIDER_FIELDS.map((item) => item.planFieldKey),
    ...NETWORK_PROVIDER_FIELDS.map((item) => item.noteFieldKey),
  ].some((fieldKey) =>
    String(snapshot?.extensions?.[fieldKey] || "").trim()
  )) {
    return true;
  }
  return NETWORK_PROVIDER_FIELDS.some((item) => {
    const value = snapshot?.extensions?.[item.fieldKey];
    return value === "true" || value === "false" || value === true || value === false;
  });
};

const toEditableImportPreview = (data) => ({
  batch_id: data.batch_id,
  file_name: data.file_name,
  validation: data.validation || null,
  available_fields: data.available_fields || [],
  sheets: (data.sheets || []).map((sheet) => ({
    ...sheet,
    headers: (sheet.headers || []).map((header) => ({
      ...header,
      action: header.suggested?.field_key ? "map" : "ignore",
      mapped_field_key: header.suggested?.field_key || "",
      new_field_display_name: header.original_header,
      field_type: "text",
    })),
  })),
});

const SectionCard = ({ title, subtitle, action, children, bodyClassName = "p-5", className = "" }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action || null}
    </header>
    <div className={bodyClassName}>{children}</div>
  </section>
);

const DrawerPanel = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/25">
    <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={onClose}
        >
          Close
        </button>
      </header>
      <div className="p-5">{children}</div>
    </aside>
  </div>
);

const StatusPill = ({ tone = "slate", children }) => {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
};

const crmStaffFlowValue = (service = {}) => {
  if (!service) return "unknown";
  if (service.staff_flow_status && CRM_STAFF_FLOW_LABELS[service.staff_flow_status]) return service.staff_flow_status;
  if (service.need_status === "not_needed" || service.intro_status === "not_needed") return "completed";
  if (service.status === "terminated" || service.completion_status === "failed") return "terminated";
  if (service.agent_completion_status === "completed" || service.completion_status === "completed") return "completed";
  if (service.agent_completion_status === "pending_external" || service.submission_status === "submitted") return "info_collected";
  if (service.agent_completion_status === "pending_customer") return "service_confirmed";
  if (service.follow_up_status === "required" || service.follow_up_status === "overdue" || service.follow_up_status === "scheduled") return "following_up";
  if (["introduced_to_group", "introduced_to_customer"].includes(service.intro_status)) return "introduced";
  if (service.intro_status === "not_introduced") return "not_introduced";
  return "not_introduced";
};

const crmCustomerFlowValue = (service = {}) => {
  if (!service) return "unknown";
  if (service.customer_flow_status && CRM_CUSTOMER_FLOW_LABELS[service.customer_flow_status]) return service.customer_flow_status;
  if (service.need_status === "not_needed" || ["waived", "not_applicable"].includes(service.completion_status)) return "not_needed";
  if (service.completion_status === "completed") return "completed";
  if (service.status === "terminated" || service.completion_status === "failed") return "declined";
  if (["submitted", "approved"].includes(service.submission_status)) return "info_provided";
  if (service.completion_status === "in_progress") return "service_confirmed";
  if (service.need_status === "optional" || service.need_status === "required") return "intent_unknown";
  return "waiting_intro";
};

const crmFlowProfileForService = (service = {}) => service.flow_snapshot || service.template?.flow_profile || {};

const crmFlowStageIsEnabled = (skipStages = [], groupKey = "", statusKey = "") => {
  const stageSet = new Set(skipStages || []);
  return !stageSet.has(statusKey) && !stageSet.has(`${groupKey}:${statusKey}`);
};

const crmFlowStepsForService = (service = {}) =>
  [...(crmNormalizeFlowProfile(crmFlowProfileForService(service)).flow_steps || [])].sort(
    (a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)
  );
const crmEnabledFlowStepsForService = (service = {}) => crmFlowStepsForService(service).filter((step) => step.enabled !== false);

const crmIsInternetService = (service = {}) => ["internet", "internet_setup"].includes(service?.service_key);
const crmIsPhoneCardService = (service = {}) => ["phone_card", "sim_card"].includes(service?.service_key);

const crmCustomerLevelProgressVisible = (service = {}) => {
  if (service?.service_scope !== "customer_level") return false;
  if (!crmIsPhoneCardService(service)) return true;
  const staffStatus = service?.staff_flow_status || crmActiveFlowStepForService(service)?.staff_flow_status || "";
  return ["introduced", "following_up", "service_confirmed", "info_collected", "completed", "terminated"].includes(staffStatus);
};

const crmReopenFlowStepKey = (service = {}) =>
  crmEnabledFlowStepsForService(service).find(
    (step) => !step.is_completion && !step.is_risk && !step.is_terminal && step.service_status !== "completed"
  )?.step_key ||
  crmFlowStepKeyForStaffStatus(service, "not_introduced") ||
  service.active_flow_step_key ||
  "";

const crmReopenServicePatch = (service = {}) => ({
  applicability: service.applicability === "not_needed" ? "required" : service.applicability || "required",
  active_flow_step_key: crmReopenFlowStepKey(service),
  service_status: "pending",
  status: "pending",
  need_status: service.applicability === "optional" ? "optional" : "required",
  submission_status: "not_submitted",
  completion_status: "not_started",
  intro_status: "not_introduced",
  follow_up_status: "required",
  agent_completion_status: "open",
  termination_reason: "",
});

const crmInternetFlowStepKind = (step = {}) => {
  const text = `${step.step_key || ""} ${step.staff_label || ""} ${step.customer_label || ""}`.toLowerCase();
  if (text.includes("验证码") || text.includes("验证窗口") || text.includes("verification")) return "verification";
  if (
    text.includes("collect") ||
    text.includes("account information") ||
    text.includes("收集") ||
    text.includes("信息") ||
    text.includes("开户信息")
  ) return "collect";
  if (
    text.includes("confirmed internet setup") ||
    text.includes("确认找我们开网") ||
    text.includes("确认开网") ||
    step.staff_flow_status === "service_confirmed"
  ) return "confirm";
  return "";
};

const crmInternetFlowStepByKind = (service = {}, kind = "") => {
  const steps = crmEnabledFlowStepsForService(service);
  if (kind === "collect") {
    return (
      steps.find((step) => crmInternetFlowStepKind(step) === "collect") ||
      steps.find((step) => step.staff_flow_status === "info_collected" && crmInternetFlowStepKind(step) !== "verification") ||
      null
    );
  }
  if (kind === "verification") {
    return (
      steps.find((step) => crmInternetFlowStepKind(step) === "verification") ||
      steps.find((step) => step.staff_flow_status === "info_collected") ||
      null
    );
  }
  return steps.find((step) => crmInternetFlowStepKind(step) === kind) || null;
};

const crmInternetDeferTasksForService = (service = {}, tasks = [], phase = "") =>
  crmOpenTasks(tasks).filter((task) => {
    if (task.case_service_id !== service?.id) return false;
    const taskPhase = crmTaskInternetDeferPhase(task);
    return phase ? taskPhase === phase : Boolean(taskPhase);
  });

const crmInternetDeferPhaseLabel = (phase = "") =>
  phase === "appointment"
    ? "Waiting to Schedule a Verification-Code Window"
    : "Waiting for Customer Account Information";

const crmInternetWizardPhaseForService = (service = {}, tasks = []) => {
  if (!crmIsInternetService(service) || crmServiceDisabled(service)) return "";
  const pending = crmInternetDeferTasksForService(service, tasks)[0];
  if (pending) return crmTaskInternetDeferPhase(pending);
  const activeKind = crmInternetFlowStepKind(crmActiveFlowStepForService(service) || {});
  if (activeKind === "collect") return "appointment";
  if (activeKind === "confirm") return "collect";
  return "";
};

const crmInternetActionForService = (service = {}, tasks = []) => {
  if (!crmIsInternetService(service) || crmServiceDisabled(service)) return null;
  const needsResponsible = crmServiceResponsibilityRequired(service) && !service.responsible_customer_id;
  if (needsResponsible) {
    return {
      type: "responsible",
      label: "Assign Owner",
      title: "Assign an Internet Service Owner First",
      description: "A specific customer must own the internet setup and verification-code coordination.",
    };
  }
  const pendingTask = crmInternetDeferTasksForService(service, tasks)[0];
  if (pendingTask) {
    const phase = crmTaskInternetDeferPhase(pendingTask);
    return {
      type: "wizard",
      phase,
      pendingTask,
      label: phase === "appointment" ? "Continue Scheduling Verification" : "Continue Collecting Account Information",
      title: phase === "appointment" ? "Verification Window Not Scheduled" : "Account Information Incomplete",
      description:
        phase === "appointment"
          ? "The customer could not choose a verification-code time earlier. Continue scheduling here."
          : "The customer could not provide the account information earlier. Continue collecting it here.",
    };
  }
  const activeKind = crmInternetFlowStepKind(crmActiveFlowStepForService(service) || {});
  if (activeKind === "confirm") {
    return {
      type: "wizard",
      phase: "collect",
      label: "Collect Account Information",
      title: "Next: Collect Internet Account Information",
      description: "The customer confirmed internet setup through our team. Collect the account holder, phone number, and notes.",
    };
  }
  if (activeKind === "collect") {
    return {
      type: "wizard",
      phase: "appointment",
      label: "Schedule Verification Window",
      title: "Next: Schedule a Verification-Code Window",
      description: "Account information has been collected. Schedule a time when the customer can receive the verification code.",
    };
  }
  return {
    type: "details",
    label: "View Details",
    title: "No Internet Action Is Ready Yet",
    description: "Advance the workflow to “Customer confirmed internet setup through our team” before collecting information and scheduling verification.",
  };
};

const crmActiveFlowStepForService = (service = {}) => {
  const steps = crmEnabledFlowStepsForService(service);
  if (!steps.length) return null;
  return (
    steps.find((step) => step.step_key === service.active_flow_step_key) ||
    steps.find((step) => step.staff_flow_status === service.staff_flow_status) ||
    steps[0]
  );
};

const crmRequiredFieldsForServiceStep = (service = {}) => {
  const activeStep = crmActiveFlowStepForService(service);
  if (Array.isArray(activeStep?.required_fields) && activeStep.required_fields.length) return activeStep.required_fields;
  return crmFlowProfileForService(service)?.required_fields_by_stage?.[crmStaffFlowValue(service)] || [];
};

const crmFlowStepKeyForStaffStatus = (service = {}, staffStatus = "") =>
  crmEnabledFlowStepsForService(service).find((step) => step.staff_flow_status === staffStatus)?.step_key || "";

const crmFlowOptionsForService = (service = {}, groupKey = "") => {
  if (groupKey === "staff") {
    const steps = crmEnabledFlowStepsForService(service);
    if (steps.length) return steps.map((step) => [step.step_key, step.staff_label || step.step_key]);
  }
  const baseOptions = groupKey === "staff" ? CRM_STAFF_FLOW_OPTIONS : CRM_CUSTOMER_FLOW_OPTIONS;
  const profile = crmFlowProfileForService(service);
  const labels = groupKey === "staff" ? profile.staff_labels || {} : profile.customer_labels || {};
  return baseOptions
    .filter(([value]) => crmFlowStageIsEnabled(profile.skip_stages || [], groupKey, value))
    .map(([value, label]) => [value, labels[value] || label]);
};

const crmServiceFlowSummary = (service = {}) => [
  ["staff", "Staff Workflow", crmActiveFlowStepForService(service)?.staff_label || Object.fromEntries(crmFlowOptionsForService(service, "staff"))[crmStaffFlowValue(service)] || "Not Introduced"],
  [
    "customer",
    "Customer Workflow",
    crmActiveFlowStepForService(service)?.customer_flow_status === crmCustomerFlowValue(service)
      ? crmActiveFlowStepForService(service)?.customer_label || "Waiting for Introduction"
      : Object.fromEntries(crmFlowOptionsForService(service, "customer"))[crmCustomerFlowValue(service)] || "Waiting for Introduction",
  ],
];

const crmServiceFlowSummaryForDisplay = (service = {}, tasks = []) => {
  const summary = crmServiceFlowSummary(service);
  const pendingInternetTask = crmInternetDeferTasksForService(service, tasks)[0];
  if (!pendingInternetTask) return summary;
  const label = crmInternetDeferPhaseLabel(crmTaskInternetDeferPhase(pendingInternetTask));
  return summary.map((item) => (item[0] === "customer" ? [item[0], item[1], label] : item));
};

const crmTaskServiceStatusSnapshot = (task = {}) => ({
  staff_flow_status: task.service_staff_flow_status,
  customer_flow_status: task.service_customer_flow_status,
  service_status: task.service_status,
  need_status: task.service_need_status,
  submission_status: task.service_submission_status,
  completion_status: task.service_completion_status,
  intro_status: task.service_intro_status,
  follow_up_status: task.service_follow_up_status,
  agent_completion_status: task.service_agent_completion_status,
});

const crmServiceFlowPatchForChange = (service = {}, groupKey = "", value = "") =>
  groupKey === "staff" ? { active_flow_step_key: value } : { customer_flow_status: value };

const crmServiceFlowPatchNotice = (groupKey = "", value = "") => {
  if (groupKey === "staff" && value === "completed") return "Staff workflow completed.";
  if (groupKey === "customer" && value === "completed") return "Customer workflow completed; staff follow-up was closed.";
  if (groupKey === "customer" && value === "declined") return "The customer declined; the service was terminated.";
  if (groupKey === "customer" && value === "not_needed") return "The service was marked not needed and staff follow-up was closed.";
  return "Service workflow updated.";
};

const crmServiceStatusPatchForChange = (service = {}, key = "", value = "") => {
  const current = service || {};
  const patch = { [key]: value };
  const ensureRequired = () => {
    if (!["required", "optional"].includes(current.need_status)) {
      patch.need_status = current.applicability === "optional" ? "optional" : "required";
    }
  };

  if (key === "need_status") {
    if (value === "not_needed") {
      return {
        ...patch,
        status: "not_needed",
        submission_status: "not_applicable",
        completion_status: "waived",
        intro_status: "not_needed",
        follow_up_status: "not_required",
        agent_completion_status: "completed",
      };
    }
    if (["required", "optional"].includes(value) && ["waived", "not_applicable"].includes(current.completion_status)) {
      return {
        ...patch,
        status: "pending",
        submission_status: "not_submitted",
        completion_status: "not_started",
        follow_up_status: "required",
        agent_completion_status: "open",
      };
    }
    return patch;
  }

  if (key === "completion_status") {
    if (value === "completed") {
      ensureRequired();
      return {
        ...patch,
        status: "completed",
        submission_status: ["approved", "submitted"].includes(current.submission_status)
          ? current.submission_status
          : "submitted",
        intro_status: ["introduced_to_group", "introduced_to_customer"].includes(current.intro_status)
          ? current.intro_status
          : "introduced_to_group",
        follow_up_status: "not_required",
        agent_completion_status: "completed",
      };
    }
    if (value === "not_started") {
      ensureRequired();
      return {
        ...patch,
        status: "pending",
        submission_status: "not_submitted",
        follow_up_status: "required",
        agent_completion_status: "open",
      };
    }
    if (value === "in_progress") {
      ensureRequired();
      return {
        ...patch,
        status: "in_progress",
        follow_up_status: "required",
        agent_completion_status: current.responsible_customer_id ? "pending_customer" : "open",
      };
    }
    if (["waived", "not_applicable"].includes(value)) {
      return {
        ...patch,
        status: "not_needed",
        need_status: "not_needed",
        submission_status: "not_applicable",
        intro_status: "not_needed",
        follow_up_status: "not_required",
        agent_completion_status: "completed",
      };
    }
    if (value === "failed") {
      ensureRequired();
      return {
        ...patch,
        status: "terminated",
        follow_up_status: "required",
        agent_completion_status: "escalated",
      };
    }
    if (value === "unknown") {
      return {
        ...patch,
        status: "pending",
        submission_status: "unknown",
        follow_up_status: "unknown",
        agent_completion_status: "unknown",
      };
    }
  }

  if (key === "submission_status") {
    if (["submitted", "approved"].includes(value) && !["completed", "waived", "not_applicable"].includes(current.completion_status)) {
      ensureRequired();
      return {
        ...patch,
        status: "in_progress",
        completion_status: "in_progress",
        follow_up_status: "required",
        agent_completion_status: "pending_external",
      };
    }
    if (value === "not_submitted" && ["completed", "waived", "not_applicable"].includes(current.completion_status)) {
      ensureRequired();
      return {
        ...patch,
        status: "pending",
        completion_status: "not_started",
        follow_up_status: "required",
        agent_completion_status: "open",
      };
    }
  }

  if (key === "agent_completion_status") {
    if (value === "completed") {
      ensureRequired();
      return {
        ...patch,
        status: "completed",
        submission_status: ["approved", "submitted"].includes(current.submission_status)
          ? current.submission_status
          : "submitted",
        completion_status: "completed",
        intro_status: ["introduced_to_group", "introduced_to_customer"].includes(current.intro_status)
          ? current.intro_status
          : "introduced_to_group",
        follow_up_status: "not_required",
      };
    }
    if (value === "open" && current.completion_status === "completed") {
      ensureRequired();
      return {
        ...patch,
        status: "pending",
        submission_status: "not_submitted",
        completion_status: "not_started",
        follow_up_status: "required",
      };
    }
    if (["pending_customer", "pending_external"].includes(value) && !["completed", "waived", "not_applicable"].includes(current.completion_status)) {
      ensureRequired();
      return {
        ...patch,
        status: "in_progress",
        completion_status: "in_progress",
        follow_up_status: "required",
      };
    }
  }

  if (key === "follow_up_status" && value === "not_required" && current.completion_status === "completed") {
    return {
      ...patch,
      agent_completion_status: "completed",
      status: "completed",
    };
  }

  return patch;
};

const CrmServiceStatusGrid = ({ service, onPatch, disabled = false }) => {
  const handleFlowChange = (groupKey, value) => {
    const patch = crmServiceFlowPatchForChange(service, groupKey, value);
    const selectedStep = groupKey === "staff" ? crmEnabledFlowStepsForService(service).find((step) => step.step_key === value) : null;
    if (groupKey === "customer" && value === "declined") {
      const reason = window.prompt("Record why the customer declined or the service was terminated:", service.termination_reason || "");
      if (!reason?.trim()) return;
      patch.termination_reason = reason.trim();
    }
    if (
      groupKey === "staff" &&
      (selectedStep?.staff_flow_status === "terminated" || selectedStep?.service_status === "terminated" || selectedStep?.is_terminal)
    ) {
      const reason = window.prompt("Record the reason for terminating this service:", service.termination_reason || "");
      if (!reason?.trim()) return;
      patch.termination_reason = reason.trim();
    }
    onPatch?.(service, patch, crmServiceFlowPatchNotice(groupKey, value), { groupKey, selectedStep, value });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[
        ["staff", "Staff Workflow", "Changing this automatically advances the customer workflow.", crmFlowOptionsForService(service, "staff"), crmActiveFlowStepForService(service)?.step_key || crmStaffFlowValue(service)],
        ["customer", "Customer Workflow", "Use this to correct customer status manually; it does not change the staff workflow.", crmFlowOptionsForService(service, "customer"), crmCustomerFlowValue(service)],
      ].map(([key, title, subtitle, options, value]) => (
        <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="block">
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{subtitle}</span>
            <select
              disabled={disabled}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              value={value}
              onChange={(event) => handleFlowChange(key, event.target.value)}
            >
              {options.map(([optionValue, text]) => (
                <option key={optionValue} value={optionValue}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
    </div>
  );
};

const CrmCompactServiceCard = ({
  service,
  customers = [],
  tasks = [],
  isSelected = false,
  disabled = false,
  onSelect,
  onOpenWorkbench,
  onPrimaryAction,
  onResponsibleChange,
  onDraft,
}) => {
  const nextTask = crmNextTaskForService(service, tasks);
  const disabledService = crmServiceDisabled(service);
  const deliveryModeLabel = crmServiceDeliveryModeLabel(service);
  const flowSummary = crmServiceFlowSummaryForDisplay(service, tasks);
  const internetAction = crmInternetActionForService(service, tasks);
  const needsResponsible = crmServiceResponsibilityRequired(service) && !service.responsible_customer_id;
  const responsibleLabel =
    service.service_scope === "case_level"
      ? service.responsible_customer_id
        ? crmCustomerLabel(customers, service.responsible_customer_id)
        : "Unassigned"
      : "Handled Separately per Customer";
  const primaryLabel = crmServiceClosed(service)
    ? "View Details"
    : internetAction
    ? internetAction.label
    : needsResponsible
      ? "Assign Owner"
      : service.service_scope === "customer_level"
        ? "Manage Customers"
        : nextTask
          ? "Handle Next Step"
          : "View Details";

  return (
    <article
      className={`rounded-2xl border px-4 py-3 transition ${
        disabledService
          ? isSelected
            ? "border-slate-300 bg-slate-50 opacity-75 shadow-sm"
            : "border-slate-200 bg-slate-50 opacity-75"
          : isSelected
            ? "border-slate-900 bg-white shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-slate-900">{service.service_name}</div>
            <StatusPill tone={crmStatusTone(service.service_status || service.status)}>
              {CRM_SERVICE_STATUS_LABELS[service.service_status] || CRM_SERVICE_STATUS_LABELS[service.status] || service.status}
            </StatusPill>
            {needsResponsible ? <StatusPill tone="amber">Owner Missing</StatusPill> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{CRM_SCOPE_LABELS[service.service_scope] || service.service_scope}</span>
            <span>Owner: {responsibleLabel}</span>
            {deliveryModeLabel ? <span>Delivery: {deliveryModeLabel}</span> : null}
          </div>
        </button>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            disabled={disabled || (disabledService && primaryLabel !== "View Details")}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onPrimaryAction}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onOpenWorkbench}
          >
            Details
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
        {flowSummary.map(([key, label, value]) => (
          <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-700">{label}: </span>
            <span className="text-slate-800">{value}</span>
          </div>
        ))}
      </div>

      {service.service_scope === "case_level" && needsResponsible ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 sm:grid-cols-[1fr_190px] sm:items-center">
          <div>
            <div className="font-semibold">Assign a Case-Level Service Owner First</div>
            <div className="mt-1">Covered customers: {crmCoveredCustomerLabels(customers, service).join(" / ") || "No Customers"}</div>
          </div>
          <select
            disabled={disabled}
            className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            value={service.responsible_customer_id || ""}
            onChange={(event) => onResponsibleChange?.(event.target.value)}
          >
            <option value="">Select an Owner</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name || customer.wechat || customer.id}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {service.service_scope === "customer_level" && crmCustomerLevelProgressVisible(service) ? (
        <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-slate-50 px-3 py-2">
          {customers.map((customer) => {
            const progress = getCrmGuestStepValues(customer, service.id, CRM_PHONE_INTENT_STEP_KEY);
            const fallbackProgress = (customer.service_progress || []).find(
              (item) => item.service_id === service.id || item.service_key === service.service_key
            );
            const intentValue =
              crmPhoneIntentValueFromProgress(progress) !== "unknown"
                ? crmPhoneIntentValueFromProgress(progress)
                : crmPhoneIntentValueFromProgress({ value: fallbackProgress?.value || {} });
            return (
              <span key={customer.id} className="rounded-lg bg-white px-2.5 py-1 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{customer.full_name || "Unnamed Customer"}</span>
                <span className="ml-1">{crmPhoneIntentLabel(intentValue)}</span>
              </span>
            );
          })}
        </div>
      ) : null}
      {service.service_scope === "customer_level" && !crmCustomerLevelProgressVisible(service) ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Complete the plan introduction before recording each customer's intent and information.
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="font-semibold text-slate-700">Next: </span>
          {nextTask ? `${nextTask.title} · ${formatDateTime(nextTask.due_at)}` : "No Open Tasks"}
        </div>
        <button
          type="button"
          className="self-start rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 sm:self-auto"
          onClick={onDraft}
        >
          Notification Draft
        </button>
      </div>
    </article>
  );
};

const CrmCustomerLevelProgressPanel = ({ service, customers = [], onPatch, onCreateFollowUp, disabled = false }) => {
  if (service?.service_scope !== "customer_level") return null;
  if (!crmCustomerLevelProgressVisible(service)) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
        Advance the staff workflow to “SIM card plans introduced” before recording intent and information for each customer.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Per-Customer Service Status</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            SIM card service is decided per customer. The group introduction may be shared, while intent, information collection, and follow-up are tracked separately.
          </div>
        </div>
        <StatusPill tone="blue">One Record per Customer</StatusPill>
      </div>
      <div className="mt-3 space-y-3">
        {customers.map((customer) => {
          const progress = getCrmGuestStepValues(customer, service.id, CRM_PHONE_INTENT_STEP_KEY);
          const intent = crmPhoneIntentValueFromProgress(progress);
          const simType = progress.value.sim_type || "unknown";
          const deliveryMethod = progress.value.delivery_method || "unknown";
          const pickupLocation = progress.value.pickup_location || "";
          return (
            <div key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{customer.full_name || "Unnamed Customer"}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {customer.wechat ? `WeChat: ${customer.wechat}` : "WeChat name not entered"}
                    {progress.updated_at ? ` · Updated ${formatDateTime(progress.updated_at)}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    disabled={disabled}
                    className="min-w-[150px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={intent}
                    onChange={(event) =>
                      onPatch?.(customer, service, CRM_PHONE_INTENT_STEP_KEY, { phone_intent: event.target.value })
                    }
                  >
                    {CRM_PHONE_INTENT_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {CRM_PHONE_INTENT_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  {onCreateFollowUp ? (
                    <button
                      type="button"
                      disabled={disabled}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() =>
                        onCreateFollowUp({
                          serviceId: service.id,
                          customerId: customer.id,
                          title: `Follow up on SIM card interest - ${customer.full_name || "Customer"}`,
                        })
                      }
                    >
                      Create Follow-up
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">SIM Type</span>
                  <select
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={simType}
                    onChange={(event) =>
                      onPatch?.(customer, service, CRM_PHONE_INTENT_STEP_KEY, {
                        sim_type: event.target.value,
                        ...(event.target.value === "esim"
                          ? { delivery_method: "unknown", pickup_location: "" }
                          : {}),
                      })
                    }
                  >
                    {Object.entries(CRM_SIM_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {simType === "physical" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Delivery Method</span>
                    <select
                      disabled={disabled}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      value={deliveryMethod}
                      onChange={(event) =>
                        onPatch?.(customer, service, CRM_PHONE_INTENT_STEP_KEY, {
                          delivery_method: event.target.value,
                          ...(event.target.value !== "pickup" ? { pickup_location: "" } : {}),
                        })
                      }
                    >
                      {Object.entries(CRM_SIM_DELIVERY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {simType === "physical" && deliveryMethod === "pickup" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Pickup Location</span>
                    <select
                      disabled={disabled}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      value={pickupLocation}
                      onChange={(event) =>
                        onPatch?.(customer, service, CRM_PHONE_INTENT_STEP_KEY, {
                          pickup_location: event.target.value,
                        })
                      }
                    >
                      <option value="">Select an Office</option>
                      {Object.entries(CRM_SIM_PICKUP_LOCATION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Dispatch Date</span>
                  <input
                    type="date"
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={progress.value.sent_date || ""}
                    onChange={(event) =>
                      onPatch?.(customer, service, CRM_PHONE_INTENT_STEP_KEY, {
                        sent_date: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              {simType === "physical" && deliveryMethod === "mail" ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Mailing Address</span>
                    <input
                      key={`${service.id}-${customer.id}-mail-${progress.updated_at || "empty"}`}
                      disabled={disabled}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      defaultValue={progress.value.mailing_address || ""}
                      placeholder="Mailing address"
                      onBlur={(event) => {
                        if (event.target.value !== (progress.value.mailing_address || "")) {
                          onPatch?.(customer, service, CRM_PHONE_INTENT_STEP_KEY, {
                            mailing_address: event.target.value,
                          });
                        }
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Tracking number</span>
                    <input
                      key={`${service.id}-${customer.id}-tracking-${progress.updated_at || "empty"}`}
                      disabled={disabled}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      defaultValue={progress.value.tracking_number || ""}
                      placeholder="Optional"
                      onBlur={(event) => {
                        if (event.target.value !== (progress.value.tracking_number || "")) {
                          onPatch?.(customer, service, CRM_PHONE_INTENT_STEP_KEY, {
                            tracking_number: event.target.value,
                          });
                        }
                      }}
                    />
                  </label>
                </div>
              ) : null}
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Information Collected</span>
                <input
                  key={`${service.id}-${customer.id}-${progress.updated_at || "empty"}`}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  defaultValue={progress.note}
                  placeholder="Example: Has an out-of-state number and is considering a transfer; wants to review plan pricing first"
                  onBlur={(event) => {
                    if (event.target.value !== progress.note) {
                      onPatch?.(customer, service, CRM_PHONE_INTENT_STEP_KEY, {}, { note: event.target.value });
                    }
                  }}
                />
              </label>
            </div>
          );
        })}
        {customers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
            Add a Customer to the Case before tracking a per-customer service status.
          </div>
        ) : null}
      </div>
    </div>
  );
};

const CrmInternetNextActionPanel = ({
  service,
  customers = [],
  tasks = [],
  disabled = false,
  onPrimaryAction,
  onDefer,
  onResponsibleChange,
}) => {
  if (!crmIsInternetService(service)) return null;
  const action = crmInternetActionForService(service, tasks);
  const flowSummary = crmServiceFlowSummaryForDisplay(service, tasks);
  const responsibleId = service?.responsible_customer_id || "";
  const responsibleName = responsibleId ? crmCustomerLabel(customers, responsibleId) : "Unassigned";
  const coveredLabels = crmCoveredCustomerLabels(customers, service).join(" / ") || "No Customers";

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-blue-950">{action?.title || "Next Internet Step"}</div>
          <div className="mt-1 text-xs leading-5 text-blue-800">
            {action?.description || "Continue from the current internet setup progress."}
          </div>
        </div>
        <StatusPill tone={action?.type === "responsible" ? "amber" : action?.type === "wizard" ? "blue" : "slate"}>
          {action?.type === "responsible" ? "Owner Missing" : action?.type === "wizard" ? "Ready to Continue" : "Pending"}
        </StatusPill>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
        {flowSummary.map(([key, label, value]) => (
          <div key={key} className="rounded-xl bg-white px-3 py-2">
            <span className="font-semibold text-slate-800">{label}: </span>
            <span>{value}</span>
          </div>
        ))}
        <div className="rounded-xl bg-white px-3 py-2">
          <span className="font-semibold text-slate-800">Owner: </span>
          <span>{responsibleName}</span>
        </div>
        <div className="rounded-xl bg-white px-3 py-2">
          <span className="font-semibold text-slate-800">Covered Customers: </span>
          <span>{coveredLabels}</span>
        </div>
      </div>

      {action?.pendingTask ? (
        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
          Existing reminder: <span className="font-semibold text-slate-900">{action.pendingTask.title}</span>
          <span className="ml-1">{formatDateTime(action.pendingTask.due_at)}</span>
        </div>
      ) : null}

      {crmServiceResponsibilityRequired(service) ? (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-blue-900">
            {responsibleId ? "Change Owner" : "Assign Owner"}
          </span>
          <select
            disabled={disabled}
            className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            value={responsibleId}
            onChange={(event) => onResponsibleChange?.(event.target.value)}
          >
            <option value="">Select an Owner</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name || customer.wechat || customer.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !action || action.type === "details" || action.type === "responsible"}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onPrimaryAction}
        >
          {action?.label || "View Details"}
        </button>
        {action?.type === "wizard" ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onDefer?.(action.phase)}
          >
            {action.pendingTask ? "Adjust Reminder" : "Handle Later"}
          </button>
        ) : null}
      </div>
    </div>
  );
};

const CrmInternetSetupWizardModal = ({
  service,
  customers = [],
  globalTasks = [],
  phase = "collect",
  disabled = false,
  onClose,
  onSubmitInfo,
  onSubmitAppointment,
  onDefer,
}) => {
  const responsibleId = service?.responsible_customer_id || "";
  const responsible = customers.find((customer) => customer.id === responsibleId) || null;
  const [accountHolder, setAccountHolder] = useState(responsible?.full_name || "");
  const [phone, setPhone] = useState(responsible?.phone || "");
  const [notes, setNotes] = useState("");
  const [slotValue, setSlotValue] = useState(() => {
    const nextSlot = new Date();
    nextSlot.setHours(nextSlot.getHours() + 1, 0, 0, 0);
    return crmDateTimeLocalInputValue(nextSlot);
  });
  const [durationMinutes, setDurationMinutes] = useState("15");
  const queue = crmInternetVerificationQueueTasks(globalTasks).slice(0, 8);
  const sameSlotTasks = slotValue ? queue.filter((task) => crmDateTimeLocalInputValue(task.due_at) === slotValue) : [];

  if (!service) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {phase === "appointment" ? "Schedule a Verification-Code Window" : "Collect Internet Account Information"}
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-500">
              {phase === "appointment"
                ? "Choose a time when the customer can receive the verification code. Confirmation advances the workflow automatically."
                : "After the customer confirms internet setup through our team, record the account information. Confirmation advances the workflow automatically."}
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!responsibleId ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              Assign an internet service owner on the service card first. Future verification appointments will be linked to that customer.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Current owner: <span className="font-semibold text-slate-900">{crmCustomerLabel(customers, responsibleId)}</span>
            </div>
          )}

          {phase === "appointment" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Window Start</span>
                  <input
                    type="datetime-local"
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    value={slotValue}
                    onChange={(event) => setSlotValue(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Window Length</span>
                  <select
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                  </select>
                </label>
              </div>
              {sameSlotTasks.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  {sameSlotTasks.length} internet verification appointment{sameSlotTasks.length === 1 ? "" : "s"} already use this time. Because one account must process them sequentially, choose another window.
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr]">
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onDefer?.("appointment")}
                >
                  Handle Later
                </button>
                <button
                  type="button"
                  disabled={disabled || !responsibleId || !slotValue}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() =>
                    onSubmitAppointment?.({
                      dueAt: crmDateTimeLocalToIso(slotValue),
                      durationMinutes,
                      responsibleCustomerId: responsibleId,
                      responsibleName: crmCustomerLabel(customers, responsibleId),
                    })
                  }
                >
                  Confirm Appointment and Advance Workflow
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Account Holder</span>
                  <input
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    value={accountHolder}
                    onChange={(event) => setAccountHolder(event.target.value)}
                    placeholder="Example: Alex"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Mobile Number</span>
                  <input
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Used for account setup and verification codes"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Account Information / Notes</span>
                <textarea
                  disabled={disabled}
                  className="min-h-[104px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Paste the account information provided by the customer"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr]">
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onDefer?.("collect")}
                >
                  Handle Later
                </button>
                <button
                  type="button"
                  disabled={disabled || !responsibleId}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() =>
                    onSubmitInfo?.({
                      account_holder: accountHolder.trim(),
                      phone: phone.trim(),
                      notes: notes.trim(),
                    })
                  }
                >
                  Confirm Information and Continue to Verification Scheduling
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CrmInternetDeferDrawer = ({
  service,
  customers = [],
  phase = "collect",
  disabled = false,
  onClose,
  onSave,
}) => {
  const defaultDueAt = () => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return crmDateTimeLocalInputValue(next);
  };
  const [dueAt, setDueAt] = useState(defaultDueAt);
  const [note, setNote] = useState("");

  useEffect(() => {
    setDueAt(defaultDueAt());
    setNote("");
  }, [service?.id, phase]);

  if (!service) return null;

  const isAppointment = phase === "appointment";
  const title = isAppointment ? "Schedule the Verification Window Later" : "Collect Internet Account Information Later";
  const description = isAppointment
    ? "The customer cannot choose a verification-code time now. Create a reminder and resume scheduling later from the Task Center or service card."
    : "The customer cannot provide the account information now. Create a reminder and resume collection later from the Task Center or service card.";
  const responsibleName = crmCustomerLabel(customers, service.responsible_customer_id || "");

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/25">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-sm leading-6 text-slate-500">{description}</div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            <div>Service: <span className="font-semibold text-slate-900">{service.service_name || "Internet Setup"}</span></div>
            <div>Owner: <span className="font-semibold text-slate-900">{responsibleName}</span></div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Reminder Time</span>
            <input
              type="datetime-local"
              disabled={disabled}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Notes</span>
            <textarea
              disabled={disabled}
              className="min-h-[120px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Example: Customer will reply tonight, needs a parent's confirmation, or wants to schedule tomorrow"
            />
          </label>

          <button
            type="button"
            disabled={disabled || !dueAt}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() =>
              onSave?.({
                phase,
                dueAt: crmDateTimeLocalToIso(dueAt),
                note: note.trim(),
              })
            }
          >
            Save Reminder
          </button>
        </div>
      </div>
    </div>
  );
};

const CrmTimelinePanel = ({ timeline = [] }) => (
  <div className="space-y-3">
    {timeline.map((item) => (
      <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{item.title || CRM_TIMELINE_EVENT_LABELS[item.event_type] || "System Record"}</div>
            <div className="mt-1 text-xs text-slate-500">
              {item.actor_name || "System"} · {formatDateTime(item.occurred_at)}
            </div>
          </div>
          <StatusPill tone={item.event_type === "communication" ? "blue" : item.event_type === "notification" ? "amber" : "slate"}>
            {CRM_TIMELINE_EVENT_LABELS[item.event_type] || item.event_type || "Event"}
          </StatusPill>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          {item.service_name ? <span className="rounded-lg bg-slate-100 px-2 py-1">Service: {item.service_name}</span> : null}
          {item.task_title ? <span className="rounded-lg bg-slate-100 px-2 py-1">Task: {item.task_title}</span> : null}
          {item.customer_name ? <span className="rounded-lg bg-slate-100 px-2 py-1">Customer: {item.customer_name}</span> : null}
        </div>
        {item.summary ? (
          <div className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            {item.summary}
          </div>
        ) : null}
      </div>
    ))}
    {timeline.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        No important events yet. Completed tasks, service updates, and communication records will appear here automatically.
      </div>
    ) : null}
  </div>
);

const BusinessSummaryPanel = ({ artifacts = {}, summary = {}, llmLogs = [] }) => {
  const resolvedSummary = summary && Object.keys(summary).length ? summary : artifacts?.business_summary || {};
  const documentClassification = artifacts?.document_classification || {};
  const overallSummary = artifacts?.overall_summary || "";
  const workflowHints = artifacts?.workflow_hints || {};
  const fieldMappingValues = artifacts?.field_mapping?.values || {};
  const validationWarnings = artifacts?.validation_warnings || [];
  const visibleSections = Object.entries(BUSINESS_SUMMARY_SECTION_LABELS).filter(
    ([key]) => Array.isArray(resolvedSummary?.[key]) && resolvedSummary[key].length
  );
  const hasArtifacts =
    visibleSections.length ||
    documentClassification.document_type ||
    Object.keys(fieldMappingValues).length ||
    validationWarnings.length ||
    llmLogs.length ||
    overallSummary;
  if (!hasArtifacts) return null;
  return (
    <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <div className="text-sm font-semibold text-slate-900">AI Business Summary</div>
      <div className="mt-1 text-xs leading-5 text-slate-600">
        This summary only assists review. Official writes must still rely on the source evidence attached to each field.
      </div>
      {documentClassification.document_type ? (
        <div className="mt-3 grid gap-2 rounded-2xl border border-blue-100 bg-white p-3 text-xs text-slate-600 md:grid-cols-3">
          <div>
            <div className="font-semibold text-slate-900">Document Type</div>
            <div className="mt-1">{documentClassification.document_type}</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">Suggested Building</div>
            <div className="mt-1">
              {documentClassification.suggested_target_building?.building_name ||
                documentClassification.suggested_target_building?.address ||
                "—"}
            </div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">Affected Domains</div>
            <div className="mt-1">
              {(documentClassification.affected_domains || []).join(" / ") || "—"}
            </div>
          </div>
        </div>
      ) : null}
      {overallSummary ? (
        <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 text-xs leading-5 text-slate-600">
          <div className="font-semibold text-slate-900">Overall Summary</div>
          <div className="mt-2 whitespace-pre-wrap">{overallSummary}</div>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {visibleSections.map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-blue-100 bg-white p-3">
            <div className="text-xs font-semibold text-blue-700">{label}</div>
            <div className="mt-2 space-y-2">
              {resolvedSummary[key].slice(0, 5).map((item, index) => (
                <div key={`${key}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  <div className="font-semibold text-slate-900">{item.title || "Summary"}</div>
                  <div className="mt-1">{item.value || item.quote}</div>
                  {item.details && Object.keys(item.details).length ? (
                    <div className="mt-2 grid gap-1 rounded-lg bg-white p-2">
                      {Object.entries(item.details).map(([detailKey, detailValue]) => (
                        <div key={detailKey} className="flex gap-2">
                          <span className="shrink-0 font-semibold text-slate-500">
                            {BUSINESS_SUMMARY_DETAIL_LABELS[detailKey] || detailKey}
                          </span>
                          <span className="text-slate-600">
                            {typeof detailValue === "object"
                              ? JSON.stringify(detailValue)
                              : String(detailValue || "—")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 text-slate-400">Page {item.page || 1} · Source: {item.quote || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {Object.keys(workflowHints || {}).some((key) => Object.keys(workflowHints[key] || {}).length) ? (
        <details className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-900">CRM Workflow Hints</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3">
            {JSON.stringify(workflowHints, null, 2)}
          </pre>
        </details>
      ) : null}
      {Object.keys(fieldMappingValues).length ? (
        <details className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-900">
            Field Mapping Draft ({Object.keys(fieldMappingValues).length})
          </summary>
          <div className="mt-2 space-y-2">
            {Object.entries(fieldMappingValues).slice(0, 16).map(([fieldKey, payload]) => (
              <div key={fieldKey} className="rounded-xl bg-slate-50 p-3">
                <div className="font-semibold text-slate-900">{fieldKey}</div>
                <div className="mt-1">Value: {String(payload?.value ?? "—")}</div>
                <div className="mt-1 text-slate-400">
                  Evidence: {payload?.evidence_items?.[0]?.quote || payload?.evidence || "—"}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {validationWarnings.length ? (
        <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
          <div className="font-semibold">Parsing Validation Warnings</div>
          <div className="mt-1 whitespace-pre-wrap">{validationWarnings.join("\n")}</div>
        </div>
      ) : null}
      {llmLogs.length ? (
        <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-900">
            Raw LLM Call Logs (Administrators Only, {llmLogs.length})
          </summary>
          <div className="mt-3 space-y-3">
            {llmLogs.map((log) => (
              <details key={log.id} className="rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer font-semibold text-slate-800">
                  {log.stage} · {log.model || "model"} · {formatDateTime(log.created_at)}
                </summary>
                {log.error ? <div className="mt-2 rounded-lg bg-red-50 p-2 text-red-700">{log.error}</div> : null}
                <div className="mt-2 font-semibold">System Prompt</div>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{log.system_prompt}</pre>
                <div className="mt-2 font-semibold">User Payload</div>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">
                  {JSON.stringify(log.user_payload || {}, null, 2)}
                </pre>
                <div className="mt-2 font-semibold">Raw Response</div>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{log.raw_response || "—"}</pre>
              </details>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
};

const CrmTaskInlineActions = ({ task, onComplete, onDelay, onFollowUp, onDraft, onViewCase, onResumeInternet }) => (
  <div className="flex flex-wrap gap-2">
    {crmTaskIsInternetDeferTask(task) ? (
      <button
        type="button"
        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
        onClick={(event) => {
          event.stopPropagation();
          onResumeInternet?.(task);
        }}
      >
        Continue
      </button>
    ) : null}
    <button
      type="button"
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      onClick={(event) => {
        event.stopPropagation();
        onViewCase?.(task);
      }}
    >
      View Case
    </button>
    {!crmTaskClosed(task) ? (
      <button
        type="button"
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        onClick={(event) => {
          event.stopPropagation();
          onComplete?.(task);
        }}
      >
        Mark Complete
      </button>
    ) : null}
    <button
      type="button"
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      onClick={(event) => {
        event.stopPropagation();
        onDelay?.(task);
      }}
    >
      Delay
    </button>
    <button
      type="button"
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      onClick={(event) => {
        event.stopPropagation();
        onFollowUp?.(task);
      }}
    >
      Create Follow-up
    </button>
    <button
      type="button"
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      onClick={(event) => {
        event.stopPropagation();
        onDraft?.(task);
      }}
    >
      Generate Notification Draft
    </button>
  </div>
);

const CrmTaskDetailPanel = ({
  task,
  caseDetail = null,
  onComplete,
  onDelay,
  onFollowUp,
  onDraft,
  onViewCase,
  onResumeInternet,
}) => {
  if (!task) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        Select a task to view its Case, service status, communication records, and available actions.
      </div>
    );
  }
  const relatedEvents = (caseDetail?.communication_events || []).filter(
    (event) =>
      !event.case_service_id ||
      !task.case_service_id ||
      event.case_service_id === task.case_service_id
  );
  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-semibold text-slate-900">{task.title || task.task_title}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill tone={crmStatusTone(task.status)}>
            {CRM_TASK_STATUS_LABELS[task.status] || task.status}
          </StatusPill>
          <StatusPill tone={crmTaskPriorityTone(task.priority)}>
            {CRM_TASK_PRIORITY_LABELS[task.priority] || task.priority}
          </StatusPill>
          {task.is_overdue ? <StatusPill tone="red">Overdue</StatusPill> : null}
        </div>
      </div>
      <div className="grid gap-2">
        <ReadOnlyMetaRow label="Case" value={crmTaskCaseLabel(task)} />
        <ReadOnlyMetaRow label="Service" value={task.service_name || crmServiceLabel(task.service_type)} />
        <ReadOnlyMetaRow label="Target Customer" value={crmTaskTargetLabel(task)} />
        <ReadOnlyMetaRow label="Owner" value={crmTaskAssigneeLabel(task)} />
        <ReadOnlyMetaRow label="Due At" value={formatDateTime(task.due_at)} />
        <ReadOnlyMetaRow label="Task Description" value={task.description || "—"} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Current Service Status</div>
        <div className="mt-3 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
          {crmServiceFlowSummary(crmTaskServiceStatusSnapshot(task)).map(([key, label, value]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="font-semibold text-slate-900">{label}</div>
              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-800">{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold text-slate-900">Related Communications</div>
        <div className="space-y-2">
          {relatedEvents.slice(0, 4).map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
              <div className="font-medium text-slate-800">{formatDateTime(event.created_at)} · {crmCommunicationChannelLabel(event.channel)}</div>
              <div className="mt-1">{event.summary}</div>
            </div>
          ))}
          {relatedEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
              No related communication records.
            </div>
          ) : null}
        </div>
      </div>
      <CrmTaskInlineActions
        task={task}
        onComplete={onComplete}
        onDelay={onDelay}
        onFollowUp={onFollowUp}
        onDraft={onDraft}
        onViewCase={onViewCase}
        onResumeInternet={onResumeInternet}
      />
    </div>
  );
};

const CrmCalendarDayTasksPanel = ({
  dateKey,
  tasks = [],
  onOpenTask,
  taskActionHandlers = {},
  preview = false,
  quickFollowUpInputs = {},
  onQuickFollowUpChange,
  onQuickFollowUpSubmit,
  disabled = false,
}) => {
  if (!dateKey) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        Hover over or select a calendar date to see its tasks.
      </div>
    );
  }
  const sortedTasks = [...tasks].sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")));
  const openCount = crmOpenTaskCountForDate(sortedTasks);
  const highCount = crmOpenTasks(sortedTasks).filter((task) => ["high", "urgent"].includes(task.priority)).length;
  const overdueCount = crmOpenTasks(sortedTasks).filter((task) => task.is_overdue).length;
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">{formatDateOnly(dateKey)}</div>
            <div className="mt-1 text-sm text-slate-500">
              {preview ? "Hover to preview; select the date to keep it open." : "Tasks for this date are pinned."}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            <StatusPill tone={openCount ? "blue" : "slate"}>{openCount} Open</StatusPill>
            {highCount ? <StatusPill tone="amber">{highCount} High Priority</StatusPill> : null}
            {overdueCount ? <StatusPill tone="red">{overdueCount} Overdue</StatusPill> : null}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {sortedTasks.map((task) => {
          const closed = crmTaskClosed(task);
          return (
            <div
              key={task.id}
              className={`rounded-xl border px-3 py-3 transition hover:border-slate-300 ${
                closed ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-white"
              }`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onOpenTask?.(task)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {crmTaskCaseLabel(task)} · {task.service_name || crmServiceLabel(task.service_type)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTime(task.due_at)} · {crmTaskAssigneeLabel(task)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusPill tone={crmTaskPriorityTone(task.priority)}>
                      {CRM_TASK_PRIORITY_LABELS[task.priority] || task.priority}
                    </StatusPill>
                    <StatusPill tone={crmStatusTone(task.status)}>
                      {CRM_TASK_STATUS_LABELS[task.status] || task.status}
                    </StatusPill>
                  </div>
                </div>
              </button>
              {!preview ? (
                <div className="mt-3 space-y-3">
                  <CrmTaskInlineActions task={task} {...taskActionHandlers} />
                  {crmTaskIsEarliestServiceDate(task) || crmTaskIsCalendarFollowUp(task) ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="mb-2 text-xs font-semibold text-slate-700">Quick Follow-up Reminder</div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          disabled={disabled}
                          value={quickFollowUpInputs[task.id] || ""}
                          placeholder="Example: Remind me tomorrow to follow up on Alex's insurance"
                          onChange={(event) => onQuickFollowUpChange?.(task.id, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              onQuickFollowUpSubmit?.(task);
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={disabled || !String(quickFollowUpInputs[task.id] || "").trim()}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => onQuickFollowUpSubmit?.(task)}
                        >
                          Create Reminder
                        </button>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-500">
                        Supports today, tomorrow, day after tomorrow, in 2 days, next Monday, 05-10, and 2026-05-10. Relative dates use the original task date. Chinese date phrases remain supported.
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {sortedTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No tasks on this date match the current filters.
          </div>
        ) : null}
      </div>
    </div>
  );
};

const CrmCalendarDayCell = ({
  day,
  tasks = [],
  selected = false,
  onHover,
  onLeave,
  onSelectDate,
  onOpenTask,
}) => {
  const sortedTasks = [...tasks].sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")));
  const openTasks = crmOpenTasks(sortedTasks);
  const openCount = openTasks.length;
  const overdueCount = openTasks.filter((task) => task.is_overdue).length;
  const highCount = openTasks.filter((task) => ["high", "urgent"].includes(task.priority)).length;
  return (
    <div
      className={`min-h-[132px] rounded-xl border p-2 text-left transition ${
        selected
          ? "border-slate-900 bg-slate-50"
          : day.isCurrentMonth
            ? "border-slate-200 bg-white hover:border-slate-300"
            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
      }`}
      onMouseEnter={() => onHover?.(day.dateKey)}
      onMouseLeave={() => onLeave?.()}
    >
      <button
        type="button"
        className="w-full rounded-lg text-left outline-none transition focus:ring-2 focus:ring-blue-100"
        onClick={() => onSelectDate?.(day.dateKey)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`text-sm font-semibold ${day.isToday ? "text-blue-700" : "text-slate-800"}`}>
            {day.day}
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {openCount ? <StatusPill tone="blue">{openCount}</StatusPill> : null}
            {overdueCount ? <StatusPill tone="red">Overdue</StatusPill> : null}
            {highCount ? <StatusPill tone="amber">High</StatusPill> : null}
          </div>
        </div>
      </button>
      <div className="mt-2 space-y-1">
        {sortedTasks.slice(0, 2).map((task) => (
          <button
            type="button"
            key={task.id}
            className={`block w-full truncate rounded-lg px-2 py-1 text-left text-xs transition hover:bg-slate-200 ${
              crmTaskClosed(task) ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => onOpenTask?.(task)}
          >
            {task.title}
          </button>
        ))}
        {sortedTasks.length > 2 ? (
          <div className="px-2 text-xs font-medium text-slate-500">{sortedTasks.length - 2} more task{sortedTasks.length - 2 === 1 ? "" : "s"}</div>
        ) : null}
      </div>
    </div>
  );
};

const CrmMonthCalendarView = ({
  tasks = [],
  calendarMonth,
  selectedDate,
  hoveredDate,
  onMonthChange,
  onToday,
  onHoverDate,
  onLeaveDate,
  onSelectDate,
  onOpenTask,
}) => {
  const monthDays = crmMonthCalendarDays(calendarMonth);
  const tasksByDate = crmTasksByDate(tasks);
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-base font-semibold text-slate-900">{crmCalendarMonthLabel(calendarMonth)}</div>
          <div className="mt-1 text-sm text-slate-500">Shows the filtered tasks by due date.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => onMonthChange?.(-1)}
          >
            Previous Month
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => onToday?.()}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => onMonthChange?.(1)}
          >
            Next Month
          </button>
        </div>
      </div>
      <div className="px-5 pb-5">
        <div className="grid grid-cols-7 gap-2">
          {weekdayLabels.map((label) => (
            <div key={label} className="px-2 py-1 text-center text-xs font-semibold text-slate-500">
              {label}
            </div>
          ))}
          {monthDays.map((day) => (
            <CrmCalendarDayCell
              key={day.dateKey}
              day={day}
              tasks={tasksByDate[day.dateKey] || []}
              selected={day.dateKey === selectedDate || day.dateKey === hoveredDate}
              onHover={onHoverDate}
              onLeave={onLeaveDate}
              onSelectDate={onSelectDate}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const DynamicFieldEditor = ({
  field,
  value,
  disabled,
  fieldDefinitions,
  onChange,
}) => {
  if (isBooleanField(field.field_key, fieldDefinitions)) {
    return (
      <select
        disabled={disabled}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
        {supportsOptionalBoolean(field.field_key) ? <option value="optional">Optional</option> : null}
      </select>
    );
  }
  if (isInsuranceStatusField(field.field_key)) {
    return (
      <select
        disabled={disabled}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Not Mentioned</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
        <option value="optional">Optional</option>
        <option value="manual_review">Manual Review Required</option>
      </select>
    );
  }
  return (
    <textarea
      disabled={disabled}
      className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

const CrmFieldInput = ({ field, value, disabled, onChange }) => {
  const type = field?.type || "text";
  const baseClass =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
  if (type === "checkbox") {
    return (
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          disabled={disabled}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-blue-200"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>Completed</span>
      </label>
    );
  }
  if (type === "select") {
    return (
      <select
        disabled={disabled}
        className={baseClass}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (type === "textarea") {
    return (
      <textarea
        disabled={disabled}
        className={`${baseClass} min-h-[78px]`}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <input
      type={type === "date" ? "date" : type === "sensitive" ? "password" : "text"}
      disabled={disabled}
      className={baseClass}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

// These localized status and sheet names are persisted by the legacy Excel contract.
// Keep the Chinese keys for compatibility, but never expose them as fixed English-UI copy.
const formatStagingLibraryStatus = (value) => ({
  "已入正式": "Promoted to Master",
  "临时": "Staging",
  "待补充": "Needs more information",
}[value] || value || "Needs more information");

const formatExcelSheetName = (value) => ({
  "楼宇主表": "Building Master Sheet",
  "套餐人工确认表": "Manually Confirmed Plans",
  "字段说明": "Field Guide",
}[value] || value || "Building Master Sheet");

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) || "");
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("crm");
  const [openNavGroups, setOpenNavGroups] = useState({ crm: true, housing: false, system: false });
  const [loginForm, setLoginForm] = useState({ username: "superadmin", password: "" });
  const [loginError, setLoginError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUserForm, setAdminUserForm] = useState({
    username: "",
    display_name: "",
    role: "employee",
    password: "",
  });
  const [adminUserDrafts, setAdminUserDrafts] = useState({});
  const [adminUserResetPasswords, setAdminUserResetPasswords] = useState({});
  const [isAccountBusy, setIsAccountBusy] = useState(false);

  const [overview, setOverview] = useState(null);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [runtimeHealth, setRuntimeHealth] = useState(null);
  const [isCheckingRuntimeHealth, setIsCheckingRuntimeHealth] = useState(false);
  const [systemUpdateStatus, setSystemUpdateStatus] = useState(null);
  const [isCheckingSystemUpdate, setIsCheckingSystemUpdate] = useState(false);
  const [isRunningSystemUpdate, setIsRunningSystemUpdate] = useState(false);
  const [systemUpdateOptions, setSystemUpdateOptions] = useState({
    restart_after_update: true,
    allow_dirty: false,
  });

  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [masterBuildings, setMasterBuildings] = useState([]);
  const [stagingBuildings, setStagingBuildings] = useState([]);
  const [crmCases, setCrmCases] = useState([]);
  const [crmOwners, setCrmOwners] = useState([]);
  const [crmTemplates, setCrmTemplates] = useState([]);
  const [selectedCrmTemplateId, setSelectedCrmTemplateId] = useState("");
  const [crmTemplateDraft, setCrmTemplateDraft] = useState(createEmptyCrmTemplateDraft);
  const [isCrmTemplateNew, setIsCrmTemplateNew] = useState(false);
  const [selectedCrmCaseId, setSelectedCrmCaseId] = useState("");
  const [selectedCrmCaseDetail, setSelectedCrmCaseDetail] = useState(null);
  const [selectedCrmServiceId, setSelectedCrmServiceId] = useState("");
  const [selectedCrmTaskId, setSelectedCrmTaskId] = useState("");
  const [internetSetupWizard, setInternetSetupWizard] = useState(null);
  const [internetDeferDrawer, setInternetDeferDrawer] = useState(null);
  const [isCrmWorkbenchOpen, setIsCrmWorkbenchOpen] = useState(false);
  const [crmCaseTab, setCrmCaseTab] = useState("services");
  const [isCrmCreateOpen, setIsCrmCreateOpen] = useState(false);
  const [taskCenterTab, setTaskCenterTab] = useState("list");
  const [calendarMode, setCalendarMode] = useState("bucket");
  const [calendarTaskScope, setCalendarTaskScope] = useState("critical");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [hoveredCalendarDate, setHoveredCalendarDate] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [quickFollowUpInputs, setQuickFollowUpInputs] = useState({});
  const [crmGlobalTasks, setCrmGlobalTasks] = useState([]);
  const [crmTaskStats, setCrmTaskStats] = useState({});
  const [crmTaskOwners, setCrmTaskOwners] = useState([]);
  const [crmAnalytics, setCrmAnalytics] = useState(null);
  const [crmAnalyticsFilters, setCrmAnalyticsFilters] = useState({
    owner_user_id: "",
    case_status: "",
    service_type: "",
    building_source: "",
    date_from: "",
    date_to: "",
  });
  const [isCrmAnalyticsLoading, setIsCrmAnalyticsLoading] = useState(false);
  const [selectedGlobalTask, setSelectedGlobalTask] = useState(null);
  const [taskFilters, setTaskFilters] = useState({
    scope: "critical",
    assigned_to: "",
    status: "",
    service_type: "",
    priority: "",
    date_from: "",
    date_to: "",
    case_status: "",
    overdue: "",
    mine: "",
  });
  const [crmCaseSummary, setCrmCaseSummary] = useState(null);
  const [isCrmCaseSummaryLoading, setIsCrmCaseSummaryLoading] = useState(false);
  const [isCrmSnapshotOpen, setIsCrmSnapshotOpen] = useState(false);
  const [crmScope, setCrmScope] = useState("my");
  const [crmSearch, setCrmSearch] = useState("");
  const [crmStatusFilter, setCrmStatusFilter] = useState("");
  const [crmOwnerFilter, setCrmOwnerFilter] = useState("");
  const [crmCaseForm, setCrmCaseForm] = useState({
    group_name: "",
    unit: "",
    group_creator_name: "",
    group_creator_contact: "",
    agent_team_t: "",
    agent_team_m: "",
    lease_start_date: "",
  });
  const [crmCaseGuests, setCrmCaseGuests] = useState([createEmptyCrmGuest()]);
  const [crmCreateBuildingSource, setCrmCreateBuildingSource] = useState("master");
  const [crmCreateBuildingSearch, setCrmCreateBuildingSearch] = useState("");
  const [crmCreateBuildingCandidates, setCrmCreateBuildingCandidates] = useState([]);
  const [crmCreateSelectedBuilding, setCrmCreateSelectedBuilding] = useState(null);
  const [crmCaseDeleteDraft, setCrmCaseDeleteDraft] = useState({ open: false, reason: "" });
  const [crmCommunicationSummary, setCrmCommunicationSummary] = useState("");
  const [crmBuildingSource, setCrmBuildingSource] = useState("master");
  const [crmBuildingSearch, setCrmBuildingSearch] = useState("");
  const [crmBuildingCandidates, setCrmBuildingCandidates] = useState([]);
  const [isCrmBusy, setIsCrmBusy] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedStagingKey, setSelectedStagingKey] = useState("");
  const [querySourceMode, setQuerySourceMode] = useState("master");
  const [selectedBuildingDetail, setSelectedBuildingDetail] = useState(null);
  const [selectedStagingDetail, setSelectedStagingDetail] = useState(null);
  const [masterSearch, setMasterSearch] = useState("");
  const [stagingSearch, setStagingSearch] = useState("");
  const [stagingStatusFilter, setStagingStatusFilter] = useState("all");
  const [masterDraft, setMasterDraft] = useState({});
  const [stagingDraft, setStagingDraft] = useState({});
  const [masterSummary, setMasterSummary] = useState(null);
  const [isMasterSummaryLoading, setIsMasterSummaryLoading] = useState(false);
  const [stagingSummary, setStagingSummary] = useState(null);
  const [isStagingSummaryLoading, setIsStagingSummaryLoading] = useState(false);
  const [isStagingCreateOpen, setIsStagingCreateOpen] = useState(false);
  const [stagingCreateContext, setStagingCreateContext] = useState("staging");
  const [stagingCreateForm, setStagingCreateForm] = useState(createEmptyStagingBuildingForm);
  const [isCreatingStagingBuilding, setIsCreatingStagingBuilding] = useState(false);
  const [isSavingMaster, setIsSavingMaster] = useState(false);
  const [isSavingStaging, setIsSavingStaging] = useState(false);
  const [isSubmittingStagingReview, setIsSubmittingStagingReview] = useState(false);

  const [messages, setMessages] = useState(buildInitialMessages);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPickingQueryBuilding, setIsPickingQueryBuilding] = useState(false);
  const [queryAssist, setQueryAssist] = useState(buildEmptyQueryAssist);
  const [networkPanel, setNetworkPanel] = useState({
    loading: false,
    open: false,
    matched: null,
    message: "",
    buildingId: "",
    sourceMode: "master",
  });

  const [importFile, setImportFile] = useState(null);
  const [masterExcelFile, setMasterExcelFile] = useState(null);
  const [pdfIntakeFiles, setPdfIntakeFiles] = useState([]);
  const [imageIntakeFiles, setImageIntakeFiles] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [masterExcelStatus, setMasterExcelStatus] = useState(null);
  const [masterExcelPreview, setMasterExcelPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isMasterExcelBusy, setIsMasterExcelBusy] = useState(false);

  const [intakeText, setIntakeText] = useState("");
  const [intakeSourceKind, setIntakeSourceKind] = useState("welcome");
  const [intakeSourceFileName, setIntakeSourceFileName] = useState("email_text.txt");
  const [intakeMode, setIntakeMode] = useState("full_package");
  const [supplementScope, setSupplementScope] = useState("insurance");
  const [intakeStagingSearch, setIntakeStagingSearch] = useState("");
  const [intakeStagingCandidates, setIntakeStagingCandidates] = useState([]);
  const [intakeTargetStaging, setIntakeTargetStaging] = useState(null);
  const [intakeResult, setIntakeResult] = useState(null);
  const [intakeJobs, setIntakeJobs] = useState([]);
  const [isSubmittingIntake, setIsSubmittingIntake] = useState(false);

  const [reviewGroups, setReviewGroups] = useState([]);
  const [selectedReviewGroupId, setSelectedReviewGroupId] = useState("");
  const [selectedReviewGroup, setSelectedReviewGroup] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewEdits, setReviewEdits] = useState({});
  const [reviewResolutions, setReviewResolutions] = useState({});
  const [reviewStatusFilter, setReviewStatusFilter] = useState("actionable");
  const [reviewStageFilter, setReviewStageFilter] = useState("");
  const [reviewBuildingSearch, setReviewBuildingSearch] = useState("");
  const [reviewBuildingCandidates, setReviewBuildingCandidates] = useState([]);
  const [reviewMasterBuildingSearch, setReviewMasterBuildingSearch] = useState("");
  const [reviewMasterBuildingCandidates, setReviewMasterBuildingCandidates] = useState([]);
  const [isConfirmingReviewBuilding, setIsConfirmingReviewBuilding] = useState(false);
  const [isConfirmingReviewMasterBuilding, setIsConfirmingReviewMasterBuilding] = useState(false);
  const [isReviewMutating, setIsReviewMutating] = useState(false);
  const [isDeletingReviewGroup, setIsDeletingReviewGroup] = useState(false);
  const [isReparsingReviewGroup, setIsReparsingReviewGroup] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState({
    action_type: "",
    building_name: "",
    field_name: "",
    user_role: "",
  });
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isDeletingMaster, setIsDeletingMaster] = useState(false);
  const [fieldRequests, setFieldRequests] = useState([]);
  const [fieldRequestForm, setFieldRequestForm] = useState({
    display_name: "",
    requirement_text: "",
  });
  const [fieldDraft, setFieldDraft] = useState(null);
  const [fieldEditDrafts, setFieldEditDrafts] = useState({});
  const [isDraftingField, setIsDraftingField] = useState(false);
  const [isSubmittingFieldRequest, setIsSubmittingFieldRequest] = useState(false);
  const [isMutatingFieldRequest, setIsMutatingFieldRequest] = useState(false);
  const [isSavingFieldDefinition, setIsSavingFieldDefinition] = useState(false);
  const [newFieldForm, setNewFieldForm] = useState({
    field_key: "",
    display_name: "",
    field_type: "text",
    description: "",
  });
  const [aliasDrafts, setAliasDrafts] = useState({});
  const querySearchInputRef = useRef(null);
  const queryRequestRef = useRef({ id: 0, factController: null, aiController: null });

  const availableTabs = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    return authTabsByRole[currentUser.role] || ["query"];
  }, [currentUser]);

  const availableNavGroups = useMemo(() => {
    const availableSet = new Set(availableTabs);
    return NAV_GROUPS.map((group) => ({
      ...group,
      tabs: group.tabs.filter((tab) => availableSet.has(tab)),
    })).filter((group) => group.tabs.length);
  }, [availableTabs]);

  const selectedBuildingSummary = useMemo(
    () => masterBuildings.find((item) => item.id === selectedBuildingId) || null,
    [masterBuildings, selectedBuildingId]
  );

  const selectedStagingBuildingSummary = useMemo(
    () => stagingBuildings.find((item) => item.id === selectedStagingKey) || null,
    [stagingBuildings, selectedStagingKey]
  );

  const selectedQueryBuildingSummary =
    querySourceMode === "staging" ? selectedStagingBuildingSummary : selectedBuildingSummary;

  const selectedStagingCanPromote = useMemo(
    () => hasSubstantiveStagingSnapshot(selectedStagingDetail),
    [selectedStagingDetail]
  );

  const activeIntakeJobs = useMemo(
    () => intakeJobs.filter((job) => ["queued", "running"].includes(job.parse_status || "")),
    [intakeJobs]
  );

  const visibleStagingBuildings = useMemo(() => {
    if (stagingStatusFilter === "all") {
      return stagingBuildings;
    }
    // `library_status` is persisted by the existing Excel/DB contract; keep the Chinese fallback for compatibility.
    return stagingBuildings.filter((item) => (item.library_status || "待补充") === stagingStatusFilter);
  }, [stagingBuildings, stagingStatusFilter]);

  const canCreateStagingBuilding = ["admin", "super_admin"].includes(currentUser?.role);

  const selectedCrmCase = selectedCrmCaseDetail?.case || null;
  const selectedCrmService = useMemo(() => {
    const services = selectedCrmCaseDetail?.services || [];
    return (
      services.find((service) => service.id === selectedCrmServiceId) ||
      services[0] ||
      null
    );
  }, [selectedCrmCaseDetail, selectedCrmServiceId]);
  const selectedCrmTask = useMemo(() => {
    const tasks = selectedCrmCaseDetail?.tasks || [];
    return tasks.find((task) => task.id === selectedCrmTaskId) || null;
  }, [selectedCrmCaseDetail, selectedCrmTaskId]);
  const selectedCrmCustomers = selectedCrmCaseDetail?.customers || selectedCrmCaseDetail?.guests || [];
  const internetWizardService = internetSetupWizard?.serviceId
    ? (selectedCrmCaseDetail?.services || []).find((service) => service.id === internetSetupWizard.serviceId)
    : null;
  const internetDeferService = internetDeferDrawer?.serviceId
    ? (selectedCrmCaseDetail?.services || []).find((service) => service.id === internetDeferDrawer.serviceId)
    : null;

  const apiFetch = async (path, options = {}, extra = {}) => {
    const { timeoutMs = 0, idempotencyKey = "", skipAuth = false } = extra;
    const headers = new Headers(options.headers || {});
    if (!skipAuth && token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (idempotencyKey) {
      headers.set("X-Idempotency-Key", idempotencyKey);
    }
    const controller = new AbortController();
    const timeoutId =
      timeoutMs > 0
        ? setTimeout(() => {
            controller.abort();
          }, timeoutMs)
        : null;
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: timeoutMs > 0 ? controller.signal : options.signal,
      });
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (error?.name === "AbortError" && timeoutMs > 0) {
        const timeoutError = new Error("Request timed out");
        timeoutError.code = "TIMEOUT";
        throw timeoutError;
      }
      throw error;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      let detail = "";
      try {
        const data = await response.json();
        detail = data.detail || data.message || "";
      } catch {
        detail = "";
      }
      if (response.status === 401 && !skipAuth) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setToken("");
        setCurrentUser(null);
        setLoginError(detail || "Your session has expired. Please sign in again.");
      }
      throw new Error(detail || `Request failed (HTTP ${response.status})`);
    }
    if (response.status === 204) {
      return null;
    }
    return response.json();
  };

  const openProtectedFile = async (path, fallbackName = "source-file") => {
    if (!path) return;
    setPageError("");
    try {
      const response = await fetch(toSourceUrl(path), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Could not open the file (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.click();
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setPageError(error.message || `Could not open ${fallbackName}.`);
    }
  };

  const loadRuntimeHealth = async ({ silent = false } = {}) => {
    if (!silent) {
      setIsCheckingRuntimeHealth(true);
    }
    try {
      const canViewDiagnostics = ["super_admin", "admin"].includes(currentUser?.role);
      const data = await apiFetch(
        canViewDiagnostics ? "/admin/health" : "/health",
        {},
        { timeoutMs: 4000, skipAuth: !canViewDiagnostics }
      );
      setRuntimeHealth(data);
      return data;
    } finally {
      if (!silent) {
        setIsCheckingRuntimeHealth(false);
      }
    }
  };

  const checkRuntimeRecovery = async () => {
    setIsCheckingRuntimeHealth(true);
    try {
      for (let attempt = 0; attempt < HEALTH_RETRY_ATTEMPTS; attempt += 1) {
        try {
          const data = await apiFetch("/health", {}, { timeoutMs: 4000, skipAuth: true });
          setRuntimeHealth(data);
          return data;
        } catch (error) {
          if (attempt === HEALTH_RETRY_ATTEMPTS - 1) {
            throw error;
          }
          await sleep(HEALTH_RETRY_DELAY_MS);
        }
      }
      return null;
    } finally {
      setIsCheckingRuntimeHealth(false);
    }
  };

  const loadSystemUpdateStatus = async ({ checkRemote = false } = {}) => {
    if (currentUser?.role !== "super_admin") {
      return null;
    }
    setIsCheckingSystemUpdate(true);
    try {
      const data = await apiFetch(`/system/update-status${checkRemote ? "?check_remote=1" : ""}`);
      setSystemUpdateStatus(data);
      return data;
    } finally {
      setIsCheckingSystemUpdate(false);
    }
  };

  const handleRunSystemUpdate = async () => {
    if (currentUser?.role !== "super_admin" || isRunningSystemUpdate) {
      return;
    }
    const dirty = systemUpdateStatus?.dirty;
    if (dirty && !systemUpdateOptions.allow_dirty) {
      setPageError("The code directory has uncommitted changes. Commit or clean them first, or allow updates with a dirty working tree.");
      return;
    }
    const confirmed = window.confirm(
      "The system will back up the database and uploaded files, pull the latest version from Git, and rebuild the frontend. Update now?"
    );
    if (!confirmed) {
      return;
    }
    setIsRunningSystemUpdate(true);
    setPageError("");
    setPageNotice("The system update has started. Keep the launcher window open.");
    try {
      const data = await apiFetch("/system/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(systemUpdateOptions),
      });
      setSystemUpdateStatus((prev) => ({
        ...(prev || {}),
        last_update: data.last_update,
        restart_required: data.restart_scheduled,
      }));
      if (data.restart_scheduled) {
        setPageNotice("Update complete. The backend is restarting automatically, and this page will resume when the service is available.");
        await sleep(2500);
        await checkRuntimeRecovery().catch(() => null);
      } else {
        setPageNotice("Update complete. Automatic restart was disabled, so restart the backend manually to activate the new version.");
      }
      await loadSystemUpdateStatus({ checkRemote: false }).catch(() => null);
    } catch (error) {
      setPageError(error.message || "System update failed.");
    } finally {
      setIsRunningSystemUpdate(false);
    }
  };

  const runResilientMutation = async ({
    path,
    options = {},
    timeoutNotice = "The service may be unresponsive after sleep. Checking it and attempting recovery.",
  }) => {
    const idempotencyKey = createId();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await apiFetch(path, options, {
          timeoutMs: WRITE_TIMEOUT_MS,
          idempotencyKey,
        });
      } catch (error) {
        const shouldRecover =
          attempt === 0 &&
          (error?.code === "TIMEOUT" ||
            /Failed to fetch/i.test(String(error?.message || "")) ||
            /NetworkError/i.test(String(error?.message || "")));
        if (!shouldRecover) {
          throw error;
        }
        setPageNotice(timeoutNotice);
        await checkRuntimeRecovery();
      }
    }
    throw new Error("The write did not complete after service recovery. Please try again shortly.");
  };

  const loadOverview = async () => {
    const data = await apiFetch("/dashboard/overview");
    setOverview(data);
  };

  const loadFields = async () => {
    const data = await apiFetch("/fields");
    const nextFields = data.fields || [];
    setFieldDefinitions(nextFields);
    setFieldEditDrafts(
      Object.fromEntries(nextFields.map((field) => [field.field_key, seedFieldEditDraft(field)]))
    );
  };

  const loadFieldRequests = async () => {
    const data = await apiFetch("/field-requests");
    setFieldRequests(data.requests || []);
  };

  const loadMasterBuildings = async (query = "") => {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    const data = await apiFetch(`/master/buildings${suffix}`);
    setMasterBuildings(data.buildings || []);
  };

  const loadStagingBuildings = async (query = "") => {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    const data = await apiFetch(`/staging/buildings${suffix}`);
    setStagingBuildings(data.buildings || []);
  };

  const loadCrmTemplates = async ({ includeInactive = false } = {}) => {
    if (currentUser?.role === "viewer") return;
    const suffix = includeInactive ? "?include_inactive=1" : "";
    const data = await apiFetch(`/crm/service-templates${suffix}`);
    setCrmTemplates(data.templates || []);
    return data.templates || [];
  };

  const loadCrmCases = async (options = {}) => {
    if (currentUser?.role === "viewer") return [];
    const params = new URLSearchParams();
    const effectiveScope = currentUser?.role === "super_admin" ? options.scope ?? crmScope : "my";
    params.set("scope", effectiveScope);
    if ((options.search ?? crmSearch).trim()) params.set("q", (options.search ?? crmSearch).trim());
    if (options.status ?? crmStatusFilter) params.set("status", options.status ?? crmStatusFilter);
    if ((options.status ?? crmStatusFilter) === "deleted") {
      params.set("include_deleted", "1");
    }
    if (currentUser?.role === "super_admin" && (options.owner ?? crmOwnerFilter).trim()) {
      params.set("owner_user_id", (options.owner ?? crmOwnerFilter).trim());
    }
    const data = await apiFetch(`/crm/cases?${params.toString()}`);
    const cases = data.cases || [];
    setCrmCases(cases);
    setCrmOwners(data.owners || []);
    if (selectedCrmCaseId && !cases.some((item) => item.id === selectedCrmCaseId)) {
      setSelectedCrmCaseId("");
      setSelectedCrmCaseDetail(null);
      setSelectedCrmServiceId("");
      setSelectedCrmTaskId("");
      setCrmCaseSummary(null);
      setIsCrmSnapshotOpen(false);
    } else if (!selectedCrmCaseId && cases[0]) {
      setSelectedCrmCaseId(cases[0].id);
    }
    return cases;
  };

  const loadCrmTasks = async (nextFilters = taskFilters) => {
    if (currentUser?.role === "viewer") return [];
    const params = new URLSearchParams();
    Object.entries(nextFilters || {}).forEach(([key, value]) => {
      const normalizedValue = String(value || "").trim();
      if (!normalizedValue) return;
      if (key === "date_from") {
        params.set("from", normalizedValue);
      } else if (key === "date_to") {
        params.set("to", normalizedValue);
      } else {
        params.set(key, normalizedValue);
      }
    });
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch(`/crm/tasks${suffix}`);
    setCrmGlobalTasks(data.tasks || []);
    setCrmTaskStats(data.stats || {});
    setCrmTaskOwners(data.owners || []);
    return data.tasks || [];
  };

  const buildCrmAnalyticsQuery = (nextFilters = crmAnalyticsFilters) => {
    const params = new URLSearchParams();
    Object.entries(nextFilters || {}).forEach(([key, value]) => {
      const normalizedValue = String(value || "").trim();
      if (!normalizedValue) return;
      if (key === "date_from") {
        params.set("from", normalizedValue);
      } else if (key === "date_to") {
        params.set("to", normalizedValue);
      } else {
        params.set(key, normalizedValue);
      }
    });
    return params.toString();
  };

  const loadCrmAnalytics = async (nextFilters = crmAnalyticsFilters) => {
    if (currentUser?.role !== "super_admin") return null;
    setIsCrmAnalyticsLoading(true);
    try {
      const suffix = buildCrmAnalyticsQuery(nextFilters);
      const data = await apiFetch(`/crm/analytics${suffix ? `?${suffix}` : ""}`);
      setCrmAnalytics(data);
      return data;
    } finally {
      setIsCrmAnalyticsLoading(false);
    }
  };

  const loadCrmCaseDetail = async (caseId) => {
    if (!caseId) {
      setSelectedCrmCaseDetail(null);
      setSelectedCrmServiceId("");
      setSelectedCrmTaskId("");
      setCrmCaseSummary(null);
      setIsCrmSnapshotOpen(false);
      return null;
    }
    const data = await apiFetch(`/crm/cases/${caseId}`);
    setSelectedCrmCaseDetail(data);
    if (!selectedCrmServiceId && data.services?.[0]) {
      setSelectedCrmServiceId(data.services[0].id);
    } else if (
      selectedCrmServiceId &&
      !data.services?.some((service) => service.id === selectedCrmServiceId)
    ) {
      setSelectedCrmServiceId(data.services?.[0]?.id || "");
    }
    if (selectedCrmTaskId && !data.tasks?.some((task) => task.id === selectedCrmTaskId)) {
      setSelectedCrmTaskId("");
    }
    return data;
  };

  const loadCrmCaseSummary = async (caseId) => {
    if (!caseId) {
      setCrmCaseSummary(null);
      return null;
    }
    setIsCrmCaseSummaryLoading(true);
    try {
      const data = await apiFetch(`/crm/cases/${caseId}/summary`);
      setCrmCaseSummary(data);
      return data;
    } finally {
      setIsCrmCaseSummaryLoading(false);
    }
  };

  const getStagingReloadQuery = () => (activeTab === "staging" ? stagingSearch : masterSearch).trim();

  const loadMasterExcelStatus = async () => {
    const data = await apiFetch("/master-excel/status");
    setMasterExcelStatus(data);
  };

  const loadMasterBuildingDetail = async (buildingId) => {
    if (!buildingId) {
      setSelectedBuildingDetail(null);
      setMasterDraft({});
      return;
    }
    const data = await apiFetch(`/master/buildings/${buildingId}`);
    setSelectedBuildingDetail(data);
    setMasterDraft(toBuildingDraftFromDetail(data, fieldDefinitions));
  };

  const loadStagingBuildingDetail = async (stagingKey) => {
    if (!stagingKey) {
      setSelectedStagingDetail(null);
      setStagingDraft({});
      return;
    }
    const data = await apiFetch(`/staging/buildings/${stagingKey}`);
    setSelectedStagingDetail(data);
    setStagingDraft(toBuildingDraftFromDetail(data, fieldDefinitions));
  };

  const loadMasterSummary = async (buildingId) => {
    if (!buildingId) {
      setMasterSummary(null);
      return;
    }
    setIsMasterSummaryLoading(true);
    try {
      const data = await apiFetch(`/master/buildings/${buildingId}/summary`);
      setMasterSummary(data);
    } finally {
      setIsMasterSummaryLoading(false);
    }
  };

  const loadStagingSummary = async (stagingKey) => {
    if (!stagingKey) {
      setStagingSummary(null);
      return;
    }
    setIsStagingSummaryLoading(true);
    try {
      const data = await apiFetch(`/staging/buildings/${stagingKey}/summary`);
      setStagingSummary(data);
    } finally {
      setIsStagingSummaryLoading(false);
    }
  };

  const loadBuildingNetwork = async (recordKey, options = {}) => {
    const { preserveOpen = false, sourceMode = querySourceMode } = options;
    if (!recordKey) {
      setNetworkPanel({
        loading: false,
        open: false,
        matched: null,
        message: "",
        buildingId: "",
        sourceMode,
      });
      return null;
    }

    setNetworkPanel((prev) => ({
      ...prev,
      loading: true,
      open:
        preserveOpen && prev.buildingId === recordKey && prev.sourceMode === sourceMode
          ? prev.open
          : false,
      buildingId: recordKey,
      sourceMode,
    }));
    try {
      const path =
        sourceMode === "staging"
          ? `/staging/buildings/${recordKey}/network`
          : `/master/buildings/${recordKey}/network`;
      const data = await apiFetch(path);
      setNetworkPanel((prev) => ({
        ...prev,
        loading: false,
        matched: data.matched || null,
        message: data.message || "",
        buildingId: recordKey,
        sourceMode,
      }));
      return data;
    } catch (error) {
      setNetworkPanel((prev) => ({
        ...prev,
        loading: false,
        matched: null,
        message: error.message || "Could not load the internet-service information.",
        buildingId: recordKey,
        sourceMode,
      }));
      return null;
    }
  };

  const loadReviewGroups = async (status = reviewStatusFilter, stage = reviewStageFilter) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (stage) params.set("stage", stage);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch(`/review/groups${suffix}`);
    const groups = data.groups || [];
    setReviewGroups(groups);
    if (
      selectedReviewGroupId &&
      !groups.some((group) => group.submission_group_id === selectedReviewGroupId)
    ) {
      setSelectedReviewGroupId("");
      setSelectedReviewGroup(null);
      setReviewComment("");
      setReviewEdits({});
      setReviewResolutions({});
      setReviewBuildingSearch("");
      setReviewBuildingCandidates([]);
      setReviewMasterBuildingSearch("");
      setReviewMasterBuildingCandidates([]);
    }
    return groups;
  };

  const loadReviewGroupDetail = async (groupId) => {
    if (!groupId) {
      setSelectedReviewGroup(null);
      setReviewComment("");
      setReviewEdits({});
      setReviewResolutions({});
      setReviewBuildingSearch("");
      setReviewBuildingCandidates([]);
      setReviewMasterBuildingSearch("");
      setReviewMasterBuildingCandidates([]);
      return;
    }
    const data = await apiFetch(`/review/groups/${groupId}`);
    setSelectedReviewGroup(data);
    setReviewComment("");
    setReviewBuildingSearch("");
    setReviewBuildingCandidates([]);
    setReviewMasterBuildingSearch("");
    setReviewMasterBuildingCandidates([]);
    setReviewEdits(
      Object.fromEntries((data.records || []).map((item) => [item.record_id, item.new_value || ""]))
    );
    setReviewResolutions(
      Object.fromEntries(
        (data.records || [])
          .filter(isWritableReviewRecord)
          .map((item) => [item.record_id, item.conflict_with_long_term ? "" : "use_new"])
      )
    );
  };

  const loadReviewBuildingCandidates = async () => {
    const query = reviewBuildingSearch.trim();
    if (!query) {
      setReviewBuildingCandidates([]);
      return;
    }
    const data = await apiFetch(`/staging/buildings?q=${encodeURIComponent(query)}`);
    setReviewBuildingCandidates(data.buildings || []);
  };

  const loadIntakeStagingCandidates = async () => {
    const query = intakeStagingSearch.trim();
    if (!query) {
      setIntakeStagingCandidates([]);
      return;
    }
    const data = await apiFetch(`/staging/buildings?q=${encodeURIComponent(query)}`);
    setIntakeStagingCandidates(data.buildings || []);
  };

  const loadIntakeJobs = async () => {
    const data = await apiFetch("/intake/jobs?limit=12");
    setIntakeJobs(data.jobs || []);
    return data.jobs || [];
  };

  const upsertIntakeJob = (job) => {
    if (!job?.source_document_id) {
      return;
    }
    setIntakeJobs((prev) => {
      const existing = prev.filter((item) => item.source_document_id !== job.source_document_id);
      return [job, ...existing].slice(0, 12);
    });
  };

  const loadCrmBuildingCandidates = async () => {
    const query = crmBuildingSearch.trim();
    if (!query) {
      setCrmBuildingCandidates([]);
      return;
    }
    const path =
      crmBuildingSource === "staging"
        ? `/staging/buildings?q=${encodeURIComponent(query)}`
        : `/master/buildings?q=${encodeURIComponent(query)}`;
    const data = await apiFetch(path);
    setCrmBuildingCandidates(data.buildings || []);
  };

  const loadCrmCreateBuildingCandidates = async () => {
    const query = crmCreateBuildingSearch.trim();
    if (!query) {
      setCrmCreateBuildingCandidates([]);
      return;
    }
    const path =
      crmCreateBuildingSource === "staging"
        ? `/staging/buildings?q=${encodeURIComponent(query)}`
        : `/master/buildings?q=${encodeURIComponent(query)}`;
    const data = await apiFetch(path);
    setCrmCreateBuildingCandidates(data.buildings || []);
  };

  const openStagingCreate = (context = "staging", seed = {}) => {
    if (!canCreateStagingBuilding) {
      setPageError("Only an administrator can add a building to Staging manually.");
      return;
    }
    setStagingCreateContext(context);
    setStagingCreateForm({
      ...createEmptyStagingBuildingForm(),
      ...seed,
    });
    setIsStagingCreateOpen(true);
  };

  const handleCreateStagingBuilding = async (event) => {
    event.preventDefault();
    if (isCreatingStagingBuilding) {
      return;
    }
    if (!stagingCreateForm.building_name.trim()) {
      setPageError("Enter a building name before adding it to Staging.");
      return;
    }
    setIsCreatingStagingBuilding(true);
    setPageError("");
    try {
      const data = await apiFetch("/staging/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stagingCreateForm),
      });
      const building = data.building;
      if (!building?.id) {
        throw new Error("The building was written to Staging, but the API did not return the record.");
      }
      setPageNotice(data.message || "Building added to Staging.");
      loadStagingBuildings(stagingSearch.trim()).catch(() => null);
      if (stagingCreateContext === "crm_create") {
        setCrmCreateBuildingSource("staging");
        setCrmCreateSelectedBuilding(building);
        setCrmCreateBuildingSearch(building.building_name || "");
        setCrmCreateBuildingCandidates([]);
      } else if (stagingCreateContext === "intake") {
        setIntakeTargetStaging(building);
        setIntakeStagingSearch(building.building_name || "");
        setIntakeStagingCandidates([]);
      } else {
        setSelectedStagingKey(building.id);
        setSelectedStagingDetail(building);
        setStagingDraft(toBuildingDraftFromDetail(building, fieldDefinitions));
      }
      setIsStagingCreateOpen(false);
      setStagingCreateForm(createEmptyStagingBuildingForm());
    } catch (error) {
      setPageError(error.message);
    } finally {
      setIsCreatingStagingBuilding(false);
    }
  };

  const appendIntakeMetadata = (formData) => {
    if (intakeSourceKind === "chat") {
      formData.append("target_staging_key", intakeTargetStaging?.id || "");
      formData.append("captured_at", new Date().toISOString());
      return;
    }
    formData.append("intake_mode", intakeMode);
    if (intakeMode === "supplement") {
      formData.append("supplement_scope", supplementScope);
      formData.append("target_staging_key", intakeTargetStaging?.id || "");
    }
  };

  const handleConfirmReviewBuilding = async (stagingKey) => {
    if (!selectedReviewGroupId || !stagingKey || isConfirmingReviewBuilding) {
      return;
    }
    setIsConfirmingReviewBuilding(true);
    setPageError("");
    try {
      await apiFetch(`/review/groups/${selectedReviewGroupId}/confirm-staging-building`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staging_key: stagingKey }),
      });
      setPageNotice("The review group is now linked to the selected Staging building, and its existing-value baseline has been refreshed.");
      await loadReviewGroupDetail(selectedReviewGroupId);
    } catch (error) {
      setPageError(error.message || "Could not confirm the building.");
    } finally {
      setIsConfirmingReviewBuilding(false);
    }
  };

  const loadReviewMasterBuildingCandidates = async () => {
    const query = reviewMasterBuildingSearch.trim();
    if (!query) {
      setReviewMasterBuildingCandidates([]);
      return;
    }
    const data = await apiFetch(`/master/buildings?q=${encodeURIComponent(query)}`);
    setReviewMasterBuildingCandidates(data.buildings || []);
  };

  const handleConfirmReviewMasterBuilding = async (buildingId) => {
    if (!selectedReviewGroupId || !buildingId || isConfirmingReviewMasterBuilding) {
      return;
    }
    setIsConfirmingReviewMasterBuilding(true);
    setPageError("");
    try {
      await apiFetch(`/review/groups/${selectedReviewGroupId}/confirm-master-building`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building_id: buildingId }),
      });
      setPageNotice("Master building selected. Approved changes will be written to this record.");
      await loadReviewGroupDetail(selectedReviewGroupId);
    } catch (error) {
      setPageError(error.message || "Could not select the Master building.");
    } finally {
      setIsConfirmingReviewMasterBuilding(false);
    }
  };

  const loadAuditLogs = async (nextFilters = auditFilters) => {
    const params = new URLSearchParams({ limit: "100" });
    Object.entries(nextFilters || {}).forEach(([key, value]) => {
      if (value?.trim()) {
        params.set(key, value.trim());
      }
    });
    const data = await apiFetch(`/audit-logs?${params.toString()}`);
    setAuditLogs(data.logs || []);
  };

  const loadAdminUsers = async () => {
    if (currentUser?.role !== "super_admin") return [];
    const data = await apiFetch("/admin/users");
    setAdminUsers(data.users || []);
    setAdminUserDrafts(
      Object.fromEntries(
        (data.users || []).map((item) => [
          item.id,
          {
            display_name: item.display_name || "",
            role: item.role || "employee",
            is_active: Boolean(item.is_active),
          },
        ])
      )
    );
    return data.users || [];
  };

  const loadEverything = async () => {
    await Promise.all([
      loadRuntimeHealth({ silent: true }).catch(() => null),
      loadOverview(),
      loadFields(),
      currentUser?.role !== "viewer" ? loadCrmTemplates().catch(() => {}) : Promise.resolve(),
      currentUser?.role !== "viewer" ? loadCrmCases().catch(() => {}) : Promise.resolve(),
      currentUser?.role !== "viewer" ? loadCrmTasks().catch(() => {}) : Promise.resolve(),
      currentUser?.role !== "viewer" ? loadFieldRequests().catch(() => {}) : Promise.resolve(),
      currentUser?.role !== "viewer" ? loadIntakeJobs().catch(() => {}) : Promise.resolve(),
      loadMasterBuildings(masterSearch.trim()),
      loadStagingBuildings(getStagingReloadQuery()),
      currentUser?.role !== "viewer"
        ? loadReviewGroups(reviewStatusFilter, reviewStageFilter)
        : Promise.resolve(),
      currentUser?.role === "super_admin" || currentUser?.role === "admin"
        ? loadMasterExcelStatus().catch(() => {})
        : Promise.resolve(),
      currentUser?.role === "super_admin" || currentUser?.role === "admin"
        ? loadAuditLogs()
        : Promise.resolve(),
      currentUser?.role === "super_admin" ? loadAdminUsers().catch(() => {}) : Promise.resolve(),
      currentUser?.role === "super_admin" ? loadSystemUpdateStatus().catch(() => {}) : Promise.resolve(),
    ]);
  };

  const appendAssistantMessage = (content, sourceMode = querySourceMode) => {
    setMessages((prev) => [...prev, { id: createId(), role: "assistant", sourceMode, content }]);
  };

  const cancelPendingQueryRequests = () => {
    queryRequestRef.current.factController?.abort();
    queryRequestRef.current.aiController?.abort();
    queryRequestRef.current = {
      id: queryRequestRef.current.id + 1,
      factController: null,
      aiController: null,
    };
    setIsSending(false);
  };

  const resetQueryContextPanels = (sourceMode = querySourceMode) => {
    setQueryAssist(buildEmptyQueryAssist());
    setNetworkPanel({
      loading: false,
      open: false,
      matched: null,
      message: "",
      buildingId: "",
      sourceMode,
    });
  };

  const startPickingQueryBuilding = () => {
    setIsPickingQueryBuilding(true);
    setTimeout(() => {
      querySearchInputRef.current?.focus();
      querySearchInputRef.current?.select?.();
    }, 0);
  };

  const clearCurrentQueryBuilding = () => {
    cancelPendingQueryRequests();
    if (querySourceMode === "staging") {
      setSelectedStagingKey("");
    } else {
      setSelectedBuildingId("");
    }
    setIsPickingQueryBuilding(false);
    resetQueryContextPanels(querySourceMode);
    appendAssistantMessage("The current building has been unlinked. Future questions will search the full knowledge base.", querySourceMode);
  };

  const handleQueryBuildingSelect = (itemId) => {
    const currentId = querySourceMode === "staging" ? selectedStagingKey : selectedBuildingId;
    if (currentId && currentId !== itemId && !isPickingQueryBuilding) {
      startPickingQueryBuilding();
      appendAssistantMessage("A building is already selected. Confirm that you want to choose a different building first.", querySourceMode);
      return;
    }
    if (currentId !== itemId) {
      cancelPendingQueryRequests();
      resetQueryContextPanels(querySourceMode);
    }
    if (querySourceMode === "staging") {
      setSelectedStagingKey(itemId);
    } else {
      setSelectedBuildingId(itemId);
    }
    if (isPickingQueryBuilding) {
      setIsPickingQueryBuilding(false);
      if (currentId && currentId !== itemId) {
        const target = (querySourceMode === "staging" ? stagingBuildings : masterBuildings).find(
          (item) => item.id === itemId
        );
        appendAssistantMessage(
          `Switched to ${target?.building_name || "the new building"}. Future answers will use this building.`,
          querySourceMode
        );
      }
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsAuthLoading(true);
    setLoginError("");
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Sign-in failed.");
      }
      const data = await response.json();
      localStorage.setItem(AUTH_STORAGE_KEY, data.token);
      setReviewGroups([]);
      setSelectedReviewGroupId("");
      setSelectedReviewGroup(null);
      setReviewComment("");
      setReviewEdits({});
      setReviewResolutions({});
      setReviewBuildingSearch("");
      setReviewBuildingCandidates([]);
      setReviewMasterBuildingSearch("");
      setReviewMasterBuildingCandidates([]);
      setSelectedCrmCaseId("");
      setSelectedCrmCaseDetail(null);
      setSelectedCrmServiceId("");
      setSelectedCrmTaskId("");
      setSelectedGlobalTask(null);
      setActiveTab((authTabsByRole[data.user.role] || ["query"])[0] || "query");
      setToken(data.token);
      setCurrentUser(data.user);
      setLoginForm((prev) => ({ ...prev, password: "" }));
      setPageNotice(`Welcome, ${data.user.display_name || data.user.username}.`);
    } catch (error) {
      setLoginError(error.message || "Sign-in failed.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await apiFetch("/auth/logout", { method: "POST" });
      }
    } catch {
      // noop
    } finally {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setToken("");
      setCurrentUser(null);
      setActiveTab("query");
      setMessages(buildInitialMessages());
      setSelectedBuildingId("");
      setSelectedStagingKey("");
      setSelectedBuildingDetail(null);
      setSelectedStagingDetail(null);
      setStagingDraft({});
      setQueryAssist(buildEmptyQueryAssist());
      setNetworkPanel({
        loading: false,
        open: false,
        matched: null,
        message: "",
        buildingId: "",
        sourceMode: "master",
      });
      setImportPreview(null);
      setMasterExcelPreview(null);
      setMasterExcelStatus(null);
      setFieldRequests([]);
      setReviewGroups([]);
      setSelectedReviewGroupId("");
      setSelectedReviewGroup(null);
      setReviewComment("");
      setReviewEdits({});
      setReviewResolutions({});
      setReviewBuildingSearch("");
      setReviewBuildingCandidates([]);
      setReviewMasterBuildingSearch("");
      setReviewMasterBuildingCandidates([]);
      setCrmCases([]);
      setCrmOwners([]);
      setCrmTemplates([]);
      setSelectedCrmTemplateId("");
      setCrmTemplateDraft(createEmptyCrmTemplateDraft());
      setIsCrmTemplateNew(false);
      setCrmGlobalTasks([]);
      setCrmTaskStats({});
      setCrmTaskOwners([]);
      setSelectedCrmCaseId("");
      setSelectedCrmCaseDetail(null);
      setSelectedCrmServiceId("");
      setSelectedCrmTaskId("");
      setSelectedGlobalTask(null);
      setCrmBuildingCandidates([]);
      setAuditLogs([]);
      setAdminUsers([]);
      setAdminUserDrafts({});
      setAdminUserResetPasswords({});
      setFieldDraft(null);
      setPageNotice("");
      setRuntimeHealth(null);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (passwordChangeForm.new_password !== passwordChangeForm.confirm_password) {
      setPageError("The new passwords do not match.");
      return;
    }
    if (passwordChangeForm.new_password.length < 8) {
      setPageError("The new password must be at least 8 characters long.");
      return;
    }
    setIsAccountBusy(true);
    setPageError("");
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: passwordChangeForm.current_password,
          new_password: passwordChangeForm.new_password,
        }),
      });
      setPasswordChangeForm({ current_password: "", new_password: "", confirm_password: "" });
      setIsPasswordChangeOpen(false);
      setPageNotice("Password updated. The default password will no longer block the next local-network launch.");
    } catch (error) {
      setPageError(error.message || "Could not change the password.");
    } finally {
      setIsAccountBusy(false);
    }
  };

  const handleCreateAdminUser = async (event) => {
    event.preventDefault();
    if (currentUser?.role !== "super_admin" || isAccountBusy) return;
    setIsAccountBusy(true);
    setPageError("");
    try {
      await apiFetch("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminUserForm.username,
          display_name: adminUserForm.display_name,
          role: adminUserForm.role,
          password: adminUserForm.password,
          is_active: true,
        }),
      });
      setAdminUserForm({ username: "", display_name: "", role: "employee", password: "" });
      await loadAdminUsers();
      setPageNotice("Account created.");
    } catch (error) {
      setPageError(error.message || "Could not create the account.");
    } finally {
      setIsAccountBusy(false);
    }
  };

  const handleUpdateAdminUser = async (userItem) => {
    if (currentUser?.role !== "super_admin" || !userItem?.id || isAccountBusy) return;
    const draft = adminUserDrafts[userItem.id] || {};
    setIsAccountBusy(true);
    setPageError("");
    try {
      await apiFetch(`/admin/users/${userItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: draft.display_name ?? userItem.display_name,
          role: draft.role ?? userItem.role,
          is_active: draft.is_active ?? Boolean(userItem.is_active),
        }),
      });
      await loadAdminUsers();
      setPageNotice("Account updated.");
    } catch (error) {
      setPageError(error.message || "Could not update the account.");
    } finally {
      setIsAccountBusy(false);
    }
  };

  const handleResetAdminUserPassword = async (userItem) => {
    const password = String(adminUserResetPasswords[userItem?.id] || "").trim();
    if (currentUser?.role !== "super_admin" || !userItem?.id || isAccountBusy) return;
    if (password.length < 8) {
      setPageError("The reset password must be at least 8 characters long.");
      return;
    }
    setIsAccountBusy(true);
    setPageError("");
    try {
      await apiFetch(`/admin/users/${userItem.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setAdminUserResetPasswords((prev) => ({ ...prev, [userItem.id]: "" }));
      await loadAdminUsers();
      setPageNotice(`Password reset for ${userItem.username}; existing sessions for this account were cleared.`);
    } catch (error) {
      setPageError(error.message || "Could not reset the password.");
    } finally {
      setIsAccountBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (!token) {
        return;
      }
      setIsAuthLoading(true);
      try {
        const data = await apiFetch("/auth/me");
        if (cancelled) return;
        setCurrentUser(data.user);
      } catch (error) {
        if (cancelled) return;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setToken("");
        setCurrentUser(null);
        setLoginError(error.message || "Your session is no longer valid. Please sign in again.");
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || "query");
    }
    if (currentUser.role === "viewer") {
      setReviewGroups([]);
      setSelectedReviewGroupId("");
      setSelectedReviewGroup(null);
      setReviewComment("");
      setReviewEdits({});
      setReviewResolutions({});
      setReviewBuildingSearch("");
      setReviewBuildingCandidates([]);
      setReviewMasterBuildingSearch("");
      setReviewMasterBuildingCandidates([]);
      setAuditLogs([]);
    }
    loadEverything().catch((error) => {
      setPageError(error.message || "Could not initialize the page.");
    });
  }, [currentUser]);

  useEffect(() => {
    const groupKey = NAV_GROUP_BY_TAB[activeTab];
    if (!groupKey) {
      return;
    }
    setOpenNavGroups((prev) => ({ ...prev, [groupKey]: true }));
  }, [activeTab]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    if (activeTab === "master") {
      loadMasterBuildings(masterSearch.trim()).catch((error) => {
        setPageError(error.message || "Could not load the Master list.");
      });
    }
    if (activeTab === "staging") {
      loadStagingBuildings(stagingSearch.trim()).catch((error) => {
        setPageError(error.message || "Could not load the Staging list.");
      });
    }
    if (activeTab === "crm" && currentUser.role !== "viewer") {
      Promise.all([loadCrmTemplates(), loadCrmCases()]).catch((error) => {
        setPageError(error.message || "Could not load CRM services.");
      });
    }
    if (activeTab === "tasks" && currentUser.role !== "viewer") {
      Promise.all([loadCrmTemplates(), loadCrmTasks()]).catch((error) => {
        setPageError(error.message || "Could not load the Task Center.");
      });
    }
    if (activeTab === "templates" && ["super_admin", "admin"].includes(currentUser.role)) {
      loadCrmTemplates({ includeInactive: true }).catch((error) => {
        setPageError(error.message || "Could not load service templates.");
      });
    }
    if (activeTab === "crm_data" && currentUser.role === "super_admin") {
      Promise.all([loadCrmTemplates({ includeInactive: true }), loadCrmAnalytics()]).catch((error) => {
        setPageError(error.message || "Could not load the CRM Data Center.");
      });
    }
    if (activeTab === "accounts" && currentUser.role === "super_admin") {
      loadAdminUsers().catch((error) => {
        setPageError(error.message || "Could not load Account Management.");
      });
    }
    if (activeTab === "system_update" && currentUser.role === "super_admin") {
      loadSystemUpdateStatus().catch((error) => {
        setPageError(error.message || "Could not load the system update status.");
      });
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role === "viewer") {
      return;
    }
    const hasActiveJob = intakeJobs.some((job) =>
      ["queued", "running"].includes(job.parse_status || "")
    );
    if (!hasActiveJob) {
      return;
    }
    const timer = setInterval(() => {
      loadIntakeJobs()
        .then((jobs) => {
          const justCompleted = jobs.some((job) =>
            ["completed", "failed"].includes(job.parse_status || "")
          );
          if (justCompleted) {
            loadOverview().catch(() => null);
            loadReviewGroups(reviewStatusFilter, reviewStageFilter).catch(() => null);
            loadStagingBuildings(getStagingReloadQuery()).catch(() => null);
          }
        })
        .catch(() => null);
    }, 2500);
    return () => clearInterval(timer);
  }, [currentUser, intakeJobs, reviewStatusFilter, reviewStageFilter, stagingSearch, stagingStatusFilter]);

  useEffect(() => {
    if (!currentUser || activeTab !== "crm" || !selectedCrmCaseId) {
      setCrmCaseSummary(null);
      setIsCrmSnapshotOpen(false);
      return;
    }
    setIsCrmSnapshotOpen(false);
    loadCrmCaseDetail(selectedCrmCaseId).catch((error) => {
      setPageError(error.message || "Could not load the CRM case details.");
    });
    loadCrmCaseSummary(selectedCrmCaseId).catch((error) => {
      setPageError(error.message || "Could not load the CRM case summary.");
    });
  }, [selectedCrmCaseId, activeTab, currentUser]);

  useEffect(() => {
    if (activeTab !== "templates" || isCrmTemplateNew || selectedCrmTemplateId || !crmTemplates.length) {
      return;
    }
    handleSelectCrmTemplate(crmTemplates[0]);
  }, [activeTab, crmTemplates, isCrmTemplateNew, selectedCrmTemplateId]);

  useEffect(() => {
    if (!currentUser) {
      setRuntimeHealth(null);
      return;
    }
    const timer = setInterval(() => {
      loadRuntimeHealth({ silent: true }).catch(() => null);
    }, 60000);
    return () => clearInterval(timer);
  }, [currentUser]);

  useEffect(() => {
    if (!selectedBuildingId || !currentUser) {
      return;
    }
    loadMasterBuildingDetail(selectedBuildingId).catch((error) => {
      setPageError(error.message || "Could not load the Master record details.");
    });
  }, [selectedBuildingId, currentUser, fieldDefinitions]);

  useEffect(() => {
    if (!selectedBuildingId || !currentUser) {
      setMasterSummary(null);
      return;
    }
    loadMasterSummary(selectedBuildingId).catch((error) => {
      setPageError(error.message || "Could not load the Master summary.");
    });
  }, [selectedBuildingId, currentUser]);

  useEffect(() => {
    if (!selectedStagingKey || !currentUser) {
      setSelectedStagingDetail(null);
      setStagingDraft({});
      setStagingSummary(null);
      return;
    }
    loadStagingBuildingDetail(selectedStagingKey).catch((error) => {
      setPageError(error.message || "Could not load the Staging record details.");
    });
  }, [selectedStagingKey, currentUser, fieldDefinitions]);

  useEffect(() => {
    if (!selectedStagingKey || !currentUser) {
      setStagingSummary(null);
      return;
    }
    loadStagingSummary(selectedStagingKey).catch((error) => {
      setPageError(error.message || "Could not load the Staging summary.");
    });
  }, [selectedStagingKey, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    const targetKey = querySourceMode === "staging" ? selectedStagingKey : selectedBuildingId;
    if (!targetKey) {
      setNetworkPanel({
        loading: false,
        open: false,
        matched: null,
        message: "",
        buildingId: "",
        sourceMode: querySourceMode,
      });
      return;
    }
    loadBuildingNetwork(targetKey, { sourceMode: querySourceMode }).catch((error) => {
      setPageError(error.message || "Could not load the internet-service information.");
    });
  }, [selectedBuildingId, selectedStagingKey, querySourceMode, currentUser]);

  useEffect(() => {
    cancelPendingQueryRequests();
    setIsPickingQueryBuilding(false);
    resetQueryContextPanels(querySourceMode);
  }, [querySourceMode]);

  useEffect(() => {
    if (activeTab !== "query") {
      queryRequestRef.current.factController?.abort();
      queryRequestRef.current.aiController?.abort();
      queryRequestRef.current = {
        id: queryRequestRef.current.id + 1,
        factController: null,
        aiController: null,
      };
      setIsSending(false);
    }
  }, [activeTab]);

  const sendQueryWithContext = async (
    userText,
    {
      sourceMode = querySourceMode,
      buildingIdOverride = undefined,
      stagingKeyOverride = undefined,
      clearInput = true,
    } = {}
  ) => {
    if (!userText || isSending) {
      return;
    }

    queryRequestRef.current.factController?.abort();
    queryRequestRef.current.aiController?.abort();
    const requestId = queryRequestRef.current.id + 1;
    const factController = new AbortController();
    queryRequestRef.current = { id: requestId, factController, aiController: null };

    const userMessage = { id: createId(), role: "user", content: userText };
    const assistantMessage = {
      id: createId(),
      role: "assistant",
      sourceMode,
      content: "Working…",
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    if (clearInput) {
      setQuestion("");
    }
    setIsSending(true);
    setPageError("");

    try {
      const data = await apiFetch("/query/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building_id:
            sourceMode === "master"
              ? buildingIdOverride !== undefined
                ? buildingIdOverride
                : selectedBuildingId || null
              : null,
          staging_key:
            sourceMode === "staging"
              ? stagingKeyOverride !== undefined
                ? stagingKeyOverride
                : selectedStagingKey || null
              : null,
          source_mode: sourceMode,
          question: userText,
          include_ai: false,
        }),
        signal: factController.signal,
      });
      if (queryRequestRef.current.id !== requestId) return;
      const matchedRecordKey =
        sourceMode === "staging"
          ? data.matched?.staging_key || stagingKeyOverride || selectedStagingKey || ""
          : data.matched?.id || buildingIdOverride || selectedBuildingId || "";
      if (sourceMode === "staging" && data.matched?.staging_key) {
        setSelectedStagingKey(data.matched.staging_key);
      }
      if (sourceMode === "master" && data.matched?.id) {
        setSelectedBuildingId(data.matched.id);
      }
      const reply = data.fact_answer || data.answer || data.message || "No approved answer is currently available.";
      const shouldLoadAi = Boolean(
        data.ai_explanation_enabled && data.matched && !data.building_switch_candidate
      );
      setQueryAssist({
        question: userText,
        matched: data.matched || null,
        sourceMode: data.source_mode || sourceMode,
        factAnswer: data.fact_answer || reply,
        aiAnswer: "",
        answerMode: "database-only",
        aiEnabled: Boolean(data.ai_explanation_enabled),
        aiLoading: shouldLoadAi,
        aiMessage: "",
        networkPanelHint: Boolean(data.network_panel_hint),
        message: data.message || "",
        buildingSwitchCandidate: data.building_switch_candidate || null,
        selectionConflictMessage: data.selection_conflict_message || "",
        temporarySuggestions: data.temporary_suggestions || [],
      });
      if (matchedRecordKey && !data.building_switch_candidate) {
        loadBuildingNetwork(matchedRecordKey, {
          preserveOpen: true,
          sourceMode,
        }).catch(() => {});
      }
      setMessages((prev) =>
        prev.map((item) => (item.id === assistantMessage.id ? { ...item, content: reply } : item))
      );
      if (shouldLoadAi) {
        const aiController = new AbortController();
        queryRequestRef.current.aiController = aiController;
        apiFetch("/query/explanation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: aiController.signal,
          body: JSON.stringify({
            building_id: sourceMode === "master" ? data.matched?.id || null : null,
            staging_key: sourceMode === "staging" ? data.matched?.staging_key || null : null,
            source_mode: sourceMode,
            question: userText,
          }),
        })
          .then((explanation) => {
            if (queryRequestRef.current.id !== requestId) return;
            setQueryAssist((prev) => ({
              ...prev,
              aiAnswer: explanation.ai_answer || "",
              answerMode: explanation.answer_mode || "database-only",
              aiLoading: false,
              aiMessage: explanation.message || "",
            }));
          })
          .catch((error) => {
            if (queryRequestRef.current.id !== requestId || error?.name === "AbortError") return;
            setQueryAssist((prev) => ({
              ...prev,
              aiLoading: false,
              aiMessage: "AI explanation is temporarily unavailable",
            }));
          });
      }
    } catch (error) {
      if (queryRequestRef.current.id !== requestId || error?.name === "AbortError") return;
      const message = error.message || "Knowledge search failed.";
      setPageError(message);
      setQueryAssist({
        question: userText,
        matched: null,
        sourceMode,
        factAnswer: "",
        aiAnswer: "",
        answerMode: "database-only",
        aiEnabled: false,
        aiLoading: false,
        aiMessage: "",
        networkPanelHint: false,
        message,
        buildingSwitchCandidate: null,
        selectionConflictMessage: "",
        temporarySuggestions: [],
      });
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: `Sorry, the search failed: ${message}` }
            : item
        )
      );
    } finally {
      if (queryRequestRef.current.id === requestId) {
        setIsSending(false);
      }
    }
  };

  const handleQuerySend = async () => {
    const userText = question.trim();
    await sendQueryWithContext(userText);
  };

  const handleSwitchCandidateRetry = async () => {
    const candidate = queryAssist.buildingSwitchCandidate;
    const originalQuestion = queryAssist.question?.trim();
    if (!candidate || !originalQuestion || isSending) {
      return;
    }
    if (querySourceMode === "staging") {
      setSelectedStagingKey(candidate.staging_key || candidate.id || "");
    } else {
      setSelectedBuildingId(candidate.id || "");
    }
    setIsPickingQueryBuilding(false);
    appendAssistantMessage(
      `Switched to ${candidate.building_name}. Searching this building again now.`,
      querySourceMode
    );
    await sendQueryWithContext(originalQuestion, {
      sourceMode: querySourceMode,
      buildingIdOverride: querySourceMode === "master" ? candidate.id || null : undefined,
      stagingKeyOverride:
        querySourceMode === "staging" ? candidate.staging_key || candidate.id || null : undefined,
      clearInput: false,
    });
  };

  const handleOpenTemporarySuggestion = async (candidate) => {
    const stagingKey = candidate?.staging_key || candidate?.id || "";
    if (!stagingKey) return;
    const originalQuestion = queryAssist.question?.trim();
    cancelPendingQueryRequests();
    setQuerySourceMode("staging");
    setSelectedStagingKey(stagingKey);
    setPageNotice("Switched to the Staging record. Amber notices identify information that has not yet been promoted to Master.");
    if (originalQuestion) {
      setTimeout(() => {
        sendQueryWithContext(originalQuestion, {
          sourceMode: "staging",
          stagingKeyOverride: stagingKey,
          clearInput: false,
        });
      }, 0);
    }
  };

  const handleMasterExcelDownload = async () => {
    setPageError("");
    try {
      const response = await fetch(`${API_BASE}/master-excel/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Could not download the standard workbook.");
      }
      const blob = await response.blob();
      const downloadName =
        response.headers
          .get("content-disposition")
          ?.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)?.[1] ||
        response.headers
          .get("content-disposition")
          ?.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)?.[2] ||
        "building-knowledge-master.xlsx";
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = decodeURIComponent(downloadName);
      anchor.click();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setPageError(error.message || "Could not download the standard workbook.");
    }
  };

  const handleCrmExcelDownload = async () => {
    if (currentUser?.role !== "super_admin") return;
    setPageError("");
    try {
      const suffix = buildCrmAnalyticsQuery(crmAnalyticsFilters);
      const response = await fetch(`${API_BASE}/crm/export.xlsx${suffix ? `?${suffix}` : ""}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Could not download the CRM report.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const downloadName =
        disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)?.[1] ||
        disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)?.[2] ||
        "crm-operations-report.xlsx";
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = decodeURIComponent(downloadName);
      anchor.click();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setPageError(error.message || "Could not download the CRM report.");
    }
  };

  const handleMasterExcelReconcile = async () => {
    if (isMasterExcelBusy) {
      return;
    }
    setIsMasterExcelBusy(true);
    setPageError("");
    try {
      const data = await apiFetch("/excel-mirrors/refresh", {
        method: "POST",
      });
      setPageNotice(
        `Excel mirrors refreshed: Master added ${data.master?.created || 0}, updated ${data.master?.updated || 0}, and removed ${data.master?.deleted || 0}; Staging contains ${data.staging?.inserted || 0} rows.`
      );
      await Promise.all([
        loadOverview(),
        loadReviewGroups(reviewStatusFilter),
        loadMasterExcelStatus().catch(() => {}),
        loadMasterBuildings(masterSearch.trim()),
        loadStagingBuildings(getStagingReloadQuery()),
        selectedBuildingId ? loadMasterBuildingDetail(selectedBuildingId).catch(() => {}) : Promise.resolve(),
        selectedStagingKey ? loadStagingBuildingDetail(selectedStagingKey).catch(() => {}) : Promise.resolve(),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not refresh the Excel mirrors.");
    } finally {
      setIsMasterExcelBusy(false);
    }
  };

  const handleMasterExcelPreview = async () => {
    if (!masterExcelFile || isMasterExcelBusy) {
      return;
    }
    setIsMasterExcelBusy(true);
    setPageError("");
    try {
      const formData = new FormData();
      formData.append("file", masterExcelFile);
      const response = await fetch(`${API_BASE}/master-excel/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Could not preview the standard workbook.");
      }
      const data = await response.json();
      setMasterExcelPreview(toEditableImportPreview(data));
      setPageNotice(`Standard-workbook preview completed for ${data.file_name}.`);
    } catch (error) {
      setPageError(error.message || "Could not preview the standard workbook.");
    } finally {
      setIsMasterExcelBusy(false);
    }
  };

  const handleImportPreview = async () => {
    if (!importFile || isImporting) {
      return;
    }
    setIsImporting(true);
    setPageError("");
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const response = await fetch(`${API_BASE}/imports/excel/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Could not preview the import.");
      }
      const data = await response.json();
      setImportPreview(toEditableImportPreview(data));
      setPageNotice(`Header preview completed for ${data.file_name}.`);
    } catch (error) {
      setPageError(error.message || "Could not preview the import.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportHeaderChange = (sheetIndex, headerIndex, patch) => {
    setImportPreview((prev) => {
      if (!prev) return prev;
      const sheets = [...prev.sheets];
      const headers = [...sheets[sheetIndex].headers];
      headers[headerIndex] = { ...headers[headerIndex], ...patch };
      sheets[sheetIndex] = { ...sheets[sheetIndex], headers };
      return { ...prev, sheets };
    });
  };

  const handleMasterExcelHeaderChange = (sheetIndex, headerIndex, patch) => {
    setMasterExcelPreview((prev) => {
      if (!prev) return prev;
      const sheets = [...prev.sheets];
      const headers = [...sheets[sheetIndex].headers];
      headers[headerIndex] = { ...headers[headerIndex], ...patch };
      sheets[sheetIndex] = { ...sheets[sheetIndex], headers };
      return { ...prev, sheets };
    });
  };

  const handleImportConfirm = async () => {
    if (!importPreview || isImporting) {
      return;
    }
    setIsImporting(true);
    setPageError("");
    try {
      const payload = {
        batch_id: importPreview.batch_id,
        sheets: importPreview.sheets.map((sheet) => ({
          sheet_name: sheet.sheet_name,
          header_row_index: sheet.header_row_index,
          mappings: sheet.headers.map((header) => ({
            original_header: header.original_header,
            mapped_field_key:
              header.action === "map"
                ? header.mapped_field_key || null
                : header.action === "create"
                ? header.new_field_display_name
                : null,
            action: header.action,
            new_field_display_name: header.new_field_display_name || header.original_header,
            field_type: header.field_type || "text",
          })),
        })),
      };
      const data = await apiFetch("/imports/excel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setPageNotice(`Import complete: ${data.rows} rows and ${data.fields} fields were added to the Review Queue.`);
      setImportPreview(null);
      setImportFile(null);
      await Promise.all([
        loadOverview(),
        loadReviewGroups(),
        loadMasterBuildings(masterSearch.trim()),
        loadStagingBuildings(getStagingReloadQuery()),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not confirm the import.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleMasterExcelConfirm = async () => {
    if (!masterExcelPreview || isMasterExcelBusy) {
      return;
    }
    setIsMasterExcelBusy(true);
    setPageError("");
    try {
      const payload = {
        batch_id: masterExcelPreview.batch_id,
        sheets: masterExcelPreview.sheets.map((sheet) => ({
          sheet_name: sheet.sheet_name,
          header_row_index: sheet.header_row_index,
          mappings: sheet.headers.map((header) => ({
            original_header: header.original_header,
            mapped_field_key:
              header.action === "map"
                ? header.mapped_field_key || null
                : header.action === "create"
                ? header.new_field_display_name
                : null,
            action: header.action,
            new_field_display_name: header.new_field_display_name || header.original_header,
            field_type: header.field_type || "text",
          })),
        })),
      };
      const data = await apiFetch("/master-excel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setPageNotice(`Standard-workbook changes were added to the Review Queue: ${data.rows} rows and ${data.fields} fields.`);
      setMasterExcelPreview(null);
      setMasterExcelFile(null);
      await Promise.all([
        loadOverview(),
        loadFields(),
        loadReviewGroups(),
        loadMasterBuildings(masterSearch.trim()),
        loadStagingBuildings(getStagingReloadQuery()),
        loadMasterExcelStatus().catch(() => {}),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not confirm the standard-workbook import.");
    } finally {
      setIsMasterExcelBusy(false);
    }
  };

  const submitIntake = async (mode, payloadBuilder) => {
    if (isSubmittingIntake) {
      return;
    }
    if (intakeMode === "supplement" && !intakeTargetStaging?.id) {
      setPageError("Select a Staging building before submitting supplemental documents.");
      return;
    }
    setIsSubmittingIntake(true);
    setPageError("");
    try {
      const { path, options } = payloadBuilder();
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Could not submit ${mode}.`);
      }
      const data = await response.json();
      setIntakeResult({ mode, ...data });
      if (data.source_document_id) {
        upsertIntakeJob({
          source_document_id: data.source_document_id,
          source_file: data.source_file || "",
          parse_status: data.parse_status || "queued",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (mode === "PDF processing") {
        setPdfIntakeFiles([]);
      }
      if (mode === "Image processing") {
        setImageIntakeFiles([]);
      }
      setPageNotice(data.message || `${mode} was submitted for background processing.`);
      loadIntakeJobs().catch(() => null);
    } catch (error) {
      setPageError(error.message || `Could not submit ${mode}.`);
    } finally {
      setIsSubmittingIntake(false);
    }
  };

  const reviewDecisionStats = buildReviewDecisionStats(
    selectedReviewGroup?.records || [],
    reviewEdits,
    reviewResolutions
  );
  const reviewHasUnresolvedConflicts = reviewDecisionStats.unresolvedConflictCount > 0;

  const handleReviewAction = async (action) => {
    if (!selectedReviewGroupId || isReviewMutating) {
      return;
    }
    if (action === "approved" && reviewHasUnresolvedConflicts) {
      setPageError("Some conflicting fields still need a decision. Choose Use proposed value or Keep existing value for each one.");
      return;
    }
    setIsReviewMutating(true);
    setPageError("");
    try {
      const records = selectedReviewGroup?.records || [];
      const data = await runResilientMutation({
        path: `/review/groups/${selectedReviewGroupId}/decision`,
        timeoutNotice: "The service may be unresponsive after sleep while saving the review decision. Checking it and attempting recovery.",
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            comment: reviewComment,
            updates: records.map((record) => {
              const resolution = effectiveReviewResolution(record, reviewResolutions);
              const payload = {
                record_id: record.record_id,
                new_value: reviewEdits[record.record_id] ?? record.new_value ?? "",
              };
              if (resolution) {
                payload.resolution = resolution;
              }
              return payload;
            }),
          }),
        },
      });
      if (action === "approved" && data?.no_effective_changes) {
        setPageNotice("The review group was closed. No valid fields were written, and existing values were retained.");
      } else if (action === "approved" && data?.status === "migrated_to_staging") {
        setPageNotice("The review decision was written to Staging. Submit it for promotion when it is ready for Master review.");
      } else {
        setPageNotice(`Review action submitted: ${action}`);
      }
      const [, nextReviewGroups] = await Promise.all([
        loadOverview(),
        loadReviewGroups(reviewStatusFilter),
        loadStagingBuildings(getStagingReloadQuery()),
        loadAuditLogs().catch(() => {}),
        loadMasterExcelStatus().catch(() => {}),
        selectedStagingKey ? loadStagingBuildingDetail(selectedStagingKey).catch(() => {}) : Promise.resolve(),
        selectedBuildingId ? loadMasterBuildingDetail(selectedBuildingId).catch(() => {}) : Promise.resolve(),
      ]);
      const stillExists = (nextReviewGroups || []).some(
        (group) => group.submission_group_id === selectedReviewGroupId
      );
      if (stillExists) {
        await loadReviewGroupDetail(selectedReviewGroupId);
      } else {
        setSelectedReviewGroupId("");
        setSelectedReviewGroup(null);
        setReviewComment("");
        setReviewEdits({});
        setReviewResolutions({});
        setReviewBuildingSearch("");
        setReviewBuildingCandidates([]);
        setReviewMasterBuildingSearch("");
        setReviewMasterBuildingCandidates([]);
      }
      await loadMasterBuildings(masterSearch.trim());
    } catch (error) {
      setPageError(error.message || "Review failed.");
    } finally {
      setIsReviewMutating(false);
    }
  };

  const reviewApproveLabel = selectedReviewGroup
    ? selectedReviewGroup.approval_stage === "to_staging"
      ? "Write to Staging"
      : "Write to Master"
    : "Approve and migrate";

  const reviewApproveHint = selectedReviewGroup
    ? selectedReviewGroup.approval_stage === "to_staging"
      ? "Approval writes this record only to Staging. An administrator must then submit it for Master review, and a Super Admin must approve the promotion."
      : selectedReviewGroup.matched_master_building
      ? "A Master building was selected manually. Approval will force an update to that Master record."
      : "Approval writes this record to Master. Only a Super Admin can perform this action."
    : "";

  const canDecideSelectedReview = Boolean(
    selectedReviewGroup?.can_write_to_staging || selectedReviewGroup?.can_write_to_master
  );

  const handleDeleteReviewGroup = async () => {
    if (!selectedReviewGroupId || isDeletingReviewGroup) {
      return;
    }
    if (!window.confirm("Delete this pending review group? This directly removes its temporary review records.")) {
      return;
    }
    setIsDeletingReviewGroup(true);
    setPageError("");
    try {
      const data = await apiFetch(`/review/groups/${selectedReviewGroupId}`, {
        method: "DELETE",
      });
      setPageNotice(`Review group deleted; ${data.deleted_records || 0} records were removed.`);
      setSelectedReviewGroupId("");
      setSelectedReviewGroup(null);
      setReviewComment("");
      setReviewEdits({});
      setReviewResolutions({});
      setReviewBuildingSearch("");
      setReviewBuildingCandidates([]);
      setReviewMasterBuildingSearch("");
      setReviewMasterBuildingCandidates([]);
      await Promise.all([
        loadOverview(),
        loadReviewGroups(reviewStatusFilter),
        loadStagingBuildings(getStagingReloadQuery()),
        loadAuditLogs().catch(() => {}),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not delete the review group.");
    } finally {
      setIsDeletingReviewGroup(false);
    }
  };

  const handleReparseReviewGroup = async () => {
    if (!selectedReviewGroupId || isReparsingReviewGroup) {
      return;
    }
    setIsReparsingReviewGroup(true);
    setPageError("");
    try {
      await apiFetch(`/review/groups/${selectedReviewGroupId}/reparse`, {
        method: "POST",
      });
      setPageNotice("The current source was reprocessed using the latest rules.");
      await Promise.all([
        loadOverview(),
        loadReviewGroups(reviewStatusFilter),
        loadStagingBuildings(getStagingReloadQuery()),
        loadAuditLogs().catch(() => {}),
      ]);
      await loadReviewGroupDetail(selectedReviewGroupId);
    } catch (error) {
      setPageError(error.message || "Reprocessing failed.");
    } finally {
      setIsReparsingReviewGroup(false);
    }
  };

  const handleMasterSave = async () => {
    if (!selectedBuildingDetail || isSavingMaster) {
      return;
    }
    setIsSavingMaster(true);
    setPageError("");
    try {
      const updates = { ...masterDraft };
      delete updates.source_date;
      updates.internet_provider = buildCombinedProviderText(masterDraft) || "";
      const payload = {
        updates,
        note: "Master record edited in the frontend",
      };
      const data = await runResilientMutation({
        path: `/master/buildings/${selectedBuildingDetail.id}`,
        timeoutNotice: "The service may be unresponsive after sleep while saving Master. Checking it and attempting recovery.",
        options: {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      });
      if (data?.removed_from_master) {
        setSelectedBuildingDetail(null);
        setMasterDraft({});
        setMasterSummary(null);
        setSelectedBuildingId("");
        setPageNotice(data.message || "This record was removed from the Master mirror.");
      } else {
        setSelectedBuildingDetail(data);
        setMasterDraft(toBuildingDraftFromDetail(data, fieldDefinitions));
        setSelectedBuildingId(data.id);
        setPageNotice("Master updated.");
      }
      await Promise.all([
        loadMasterBuildings(masterSearch.trim()),
        loadStagingBuildings(getStagingReloadQuery()),
        loadReviewGroups(reviewStatusFilter),
        loadAuditLogs().catch(() => {}),
        loadOverview(),
        loadMasterExcelStatus().catch(() => {}),
        data?.id ? loadMasterSummary(data.id).catch(() => {}) : Promise.resolve(),
      ]);
      if (data?.id) {
        await loadBuildingNetwork(data.id, {
          preserveOpen: true,
          sourceMode: "master",
        }).catch(() => {});
      }
    } catch (error) {
      setPageError(error.message || "Could not save the Master record.");
    } finally {
      setIsSavingMaster(false);
    }
  };

  const handleStagingSave = async () => {
    if (!selectedStagingDetail || isSavingStaging) {
      return;
    }
    setIsSavingStaging(true);
    setPageError("");
    try {
      const isUpdateRequest = currentUser?.role === "employee";
      const updates = { ...stagingDraft };
      delete updates.source_date;
      delete updates.source_type;
      delete updates.source_file;
      delete updates.info_cutoff_date;
      delete updates.library_status;
      updates.internet_provider = buildCombinedProviderText(stagingDraft) || "";
      const data = await runResilientMutation({
        path: isUpdateRequest
          ? `/staging/buildings/${selectedStagingDetail.id}/request-update`
          : `/staging/buildings/${selectedStagingDetail.id}`,
        timeoutNotice: isUpdateRequest
          ? "The service may be unresponsive after sleep while submitting the Staging update request. Checking it and attempting recovery."
          : "The service may be unresponsive after sleep while saving Staging. Checking it and attempting recovery.",
        options: {
          method: isUpdateRequest ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates,
            note: isUpdateRequest ? "Staff submitted a Staging update request" : "Staging record edited in the frontend",
          }),
        },
      });
      if (isUpdateRequest) {
        setPageNotice(data.message || "Staging update request submitted.");
        setReviewStageFilter("to_staging");
        setActiveTab("review");
        await Promise.all([
          loadReviewGroups(reviewStatusFilter, "to_staging"),
          loadOverview(),
          loadAuditLogs().catch(() => {}),
        ]);
        if (data?.group_id) {
          setSelectedReviewGroupId(data.group_id);
          await loadReviewGroupDetail(data.group_id);
        }
        return;
      }
      setSelectedStagingDetail(data);
      setSelectedStagingKey(data.id);
      setStagingDraft(toBuildingDraftFromDetail(data, fieldDefinitions));
      setPageNotice("Staging updated. Submit it for Master review when it is ready for promotion.");
      await Promise.all([
        loadStagingBuildings(getStagingReloadQuery()),
        loadReviewGroups(reviewStatusFilter),
        loadOverview(),
        loadMasterExcelStatus().catch(() => {}),
        data?.id ? loadStagingSummary(data.id).catch(() => {}) : Promise.resolve(),
      ]);
      if (querySourceMode === "staging") {
        await loadBuildingNetwork(data.id, {
          preserveOpen: true,
          sourceMode: "staging",
        }).catch(() => {});
      }
    } catch (error) {
      setPageError(error.message || "Could not save the Staging record.");
    } finally {
      setIsSavingStaging(false);
    }
  };

  const handleSubmitStagingForReview = async () => {
    if (!selectedStagingDetail || isSubmittingStagingReview) {
      return;
    }
    setIsSubmittingStagingReview(true);
    setPageError("");
    try {
      const data = await runResilientMutation({
        path: `/staging/buildings/${selectedStagingDetail.id}/submit-master-review`,
        timeoutNotice: "The service may be unresponsive after sleep while submitting a promotion review. Checking it and attempting recovery.",
        options: {
          method: "POST",
        },
      });
      setPageNotice(data.message || "Promotion review submitted.");
      setReviewStatusFilter("actionable");
      setReviewStageFilter("to_master");
      setActiveTab("review");
      await Promise.all([
        loadReviewGroups("actionable", "to_master"),
        loadOverview(),
        loadStagingBuildings(getStagingReloadQuery()),
        loadAuditLogs().catch(() => {}),
      ]);
      setSelectedReviewGroupId(data.group_id);
      await loadReviewGroupDetail(data.group_id);
    } catch (error) {
      setPageError(error.message || "Could not submit the promotion review.");
    } finally {
      setIsSubmittingStagingReview(false);
    }
  };

  const handleDeleteMasterBuilding = async () => {
    if (!selectedBuildingDetail || isDeletingMaster) {
      return;
    }
    if (
      !window.confirm(
        `Delete the Master building “${selectedBuildingDetail.building_name}”? This also deletes its row from the standard workbook.`
      )
    ) {
      return;
    }
    setIsDeletingMaster(true);
    setPageError("");
    try {
      await apiFetch(`/master/buildings/${selectedBuildingDetail.id}`, {
        method: "DELETE",
      });
      setPageNotice(`Master building deleted: ${selectedBuildingDetail.building_name}`);
      if (selectedBuildingId === selectedBuildingDetail.id) {
        setSelectedBuildingId("");
        setSelectedBuildingDetail(null);
        setMasterDraft({});
        setMasterSummary(null);
      }
      if (querySourceMode === "master") {
        setQueryAssist(buildEmptyQueryAssist());
      }
      setNetworkPanel({
        loading: false,
        open: false,
        matched: null,
        message: "",
        buildingId: "",
        sourceMode: querySourceMode,
      });
      await Promise.all([
        loadOverview(),
        loadMasterBuildings(masterSearch.trim()),
        loadStagingBuildings(getStagingReloadQuery()),
        loadReviewGroups(reviewStatusFilter),
        loadAuditLogs().catch(() => {}),
        loadMasterExcelStatus().catch(() => {}),
        selectedStagingKey ? loadStagingBuildingDetail(selectedStagingKey).catch(() => {}) : Promise.resolve(),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not delete the Master building.");
    } finally {
      setIsDeletingMaster(false);
    }
  };

  const handleDraftFieldRequest = async (event) => {
    event.preventDefault();
    if (!fieldRequestForm.display_name.trim() || !fieldRequestForm.requirement_text.trim()) {
      setPageError("Enter a field name and requirement description first.");
      return;
    }
    setIsDraftingField(true);
    setPageError("");
    try {
      const data = await apiFetch("/field-requests/draft-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldRequestForm),
      });
      setFieldDraft(toEditableFieldDraftState(data.draft || null, fieldRequestForm.display_name));
      setPageNotice(data.used_ai ? "AI generated a field draft." : "Local rules generated a field draft for your review.");
    } catch (error) {
      setPageError(error.message || "Could not generate the field draft.");
    } finally {
      setIsDraftingField(false);
    }
  };

  const patchFieldDraft = (key, value) => {
    setFieldDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const loadFieldRequestIntoDraft = (requestItem) => {
    setFieldRequestForm({
      display_name: requestItem.display_name || requestItem.draft?.display_name || "",
      requirement_text: requestItem.requirement_text || "",
    });
    setFieldDraft(toEditableFieldDraftState(requestItem.draft || {}, requestItem.display_name || ""));
    setPageNotice("This field request has been loaded into the draft editor above. You can continue refining it.");
  };

  const handleSubmitFieldRequest = async (applyImmediately = false) => {
    if (!fieldDraft) {
      setPageError("Generate a field draft first.");
      return;
    }
    setIsSubmittingFieldRequest(true);
    setPageError("");
    try {
      const payload = {
        display_name: fieldRequestForm.display_name.trim() || fieldDraft.display_name,
        requirement_text: fieldRequestForm.requirement_text.trim(),
        draft: {
          ...fieldDraft,
          aliases: String(fieldDraft.aliases || "")
            .split(/[\n,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
          query_keywords: String(fieldDraft.query_keywords || "")
            .split(/[\n,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
        },
        apply_immediately: applyImmediately,
      };
      const data = await apiFetch("/field-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setFieldDraft(null);
      setFieldRequestForm({ display_name: "", requirement_text: "" });
      setPageNotice(
        applyImmediately ? "Field confirmed and activated immediately." : "Field request submitted for Super Admin approval."
      );
      await Promise.all([
        loadFields(),
        loadFieldRequests().catch(() => {}),
        loadMasterBuildings(masterSearch.trim()),
        loadStagingBuildings(getStagingReloadQuery()),
        selectedBuildingId ? loadMasterBuildingDetail(selectedBuildingId).catch(() => {}) : Promise.resolve(),
        selectedStagingKey ? loadStagingBuildingDetail(selectedStagingKey).catch(() => {}) : Promise.resolve(),
      ]);
      if (data?.field) {
        setFieldEditDrafts((prev) => ({
          ...prev,
          [data.field.field_key]: {
            display_name: data.field.display_name,
            description: data.field.description || "",
            group_key: data.field.group_key || "custom",
            excel_header_name: data.field.excel_header_name || data.field.display_name,
            scope: data.field.scope || "master_and_staging",
            visible_in_master_detail: Boolean(data.field.visible_in_master_detail),
            visible_in_staging_detail: Boolean(data.field.visible_in_staging_detail),
            visible_in_query: Boolean(data.field.visible_in_query),
            query_keywords: (data.field.query_keywords || []).join("\n"),
            answer_template: data.field.answer_template || "",
            active: Boolean(data.field.active),
          },
        }));
      }
    } catch (error) {
      setPageError(error.message || "Could not submit the field request.");
    } finally {
      setIsSubmittingFieldRequest(false);
    }
  };

  const handleApproveFieldRequest = async (requestId) => {
    setIsMutatingFieldRequest(true);
    setPageError("");
    try {
      await apiFetch(`/field-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "Super Admin approved the field request" }),
      });
      setPageNotice("Field request approved and activated.");
      await Promise.all([
        loadFields(),
        loadFieldRequests(),
        loadMasterBuildings(masterSearch.trim()),
        loadStagingBuildings(getStagingReloadQuery()),
        selectedBuildingId ? loadMasterBuildingDetail(selectedBuildingId).catch(() => {}) : Promise.resolve(),
        selectedStagingKey ? loadStagingBuildingDetail(selectedStagingKey).catch(() => {}) : Promise.resolve(),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not approve the field request.");
    } finally {
      setIsMutatingFieldRequest(false);
    }
  };

  const handleRejectFieldRequest = async (requestId) => {
    setIsMutatingFieldRequest(true);
    setPageError("");
    try {
      await apiFetch(`/field-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "Super Admin rejected the field request" }),
      });
      setPageNotice("Field request rejected.");
      await loadFieldRequests();
    } catch (error) {
      setPageError(error.message || "Could not reject the field request.");
    } finally {
      setIsMutatingFieldRequest(false);
    }
  };

  const seedFieldEditDraft = (field) => ({
    display_name: field.display_name,
    description: field.description || "",
    group_key: field.group_key || "custom",
    excel_header_name: field.excel_header_name || field.display_name,
    scope: field.scope || "master_and_staging",
    visible_in_master_detail: Boolean(field.visible_in_master_detail),
    visible_in_staging_detail: Boolean(field.visible_in_staging_detail),
    visible_in_query: Boolean(field.visible_in_query),
    query_keywords: (field.query_keywords || []).join("\n"),
    answer_template: field.answer_template || "",
    active: Boolean(field.active),
  });

  const handleSaveFieldDefinition = async (fieldKey) => {
    const draft = fieldEditDrafts[fieldKey];
    if (!draft) return;
    setIsSavingFieldDefinition(true);
    setPageError("");
    try {
      await apiFetch(`/fields/${fieldKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          query_keywords: String(draft.query_keywords || "")
            .split(/[\n,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      setPageNotice("Field catalog updated.");
      await Promise.all([
        loadFields(),
        loadFieldRequests().catch(() => {}),
        selectedBuildingId ? loadMasterBuildingDetail(selectedBuildingId).catch(() => {}) : Promise.resolve(),
        selectedStagingKey ? loadStagingBuildingDetail(selectedStagingKey).catch(() => {}) : Promise.resolve(),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not save the field.");
    } finally {
      setIsSavingFieldDefinition(false);
    }
  };

  const handleCreateField = async (event) => {
    event.preventDefault();
    setPageError("");
    try {
      await apiFetch("/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFieldForm),
      });
      setPageNotice("Field created.");
      setNewFieldForm({
        field_key: "",
        display_name: "",
        field_type: "text",
        description: "",
      });
      await loadFields();
    } catch (error) {
      setPageError(error.message || "Could not create the field.");
    }
  };

  const handleCreateAlias = async (fieldKey) => {
    const aliasName = (aliasDrafts[fieldKey] || "").trim();
    if (!aliasName) {
      return;
    }
    setPageError("");
    try {
      await apiFetch(`/fields/${fieldKey}/aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias_name: aliasName }),
      });
      setPageNotice("Field alias added.");
      setAliasDrafts((prev) => ({ ...prev, [fieldKey]: "" }));
      await loadFields();
    } catch (error) {
      setPageError(error.message || "Could not add the alias.");
    }
  };

  const handleResetStandardFields = async () => {
    if (!window.confirm("Reset fields and aliases to the current standard headers? Obsolete fields and related temporary records will be removed.")) {
      return;
    }
    setPageError("");
    try {
      const data = await apiFetch("/fields/reset-standard", {
        method: "POST",
      });
      setPageNotice(
        `Field catalog reset to the standard headers. Removed ${data.deleted_staging_records || 0} pending-review records and ${data.deleted_field_values || 0} extension-field values.`
      );
      setSelectedReviewGroupId("");
      setSelectedReviewGroup(null);
      setReviewComment("");
      setReviewEdits({});
      setReviewResolutions({});
      setReviewBuildingSearch("");
      setReviewBuildingCandidates([]);
      setReviewMasterBuildingSearch("");
      setReviewMasterBuildingCandidates([]);
      await Promise.all([
        loadFields(),
        loadOverview(),
        loadReviewGroups(reviewStatusFilter),
        loadStagingBuildings(getStagingReloadQuery()),
        loadAuditLogs().catch(() => {}),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not reset the standard fields.");
    }
  };

  const handleLegacyBootstrap = async () => {
    setPageError("");
    try {
      const data = await apiFetch("/bootstrap/legacy", { method: "POST" });
      setPageNotice(
        `Historical sources imported into the Review Queue: ${data.summary?.building_spreadsheets || 0} building rows, ${data.summary?.internet_records || 0} internet records, and ${data.summary?.pdf_sources || 0} PDFs.`
      );
      await Promise.all([
        loadOverview(),
        loadReviewGroups(),
        loadStagingBuildings(getStagingReloadQuery()),
        loadAuditLogs().catch(() => {}),
      ]);
    } catch (error) {
      setPageError(error.message || "Could not import the historical sources.");
    }
  };

  const handleAuditFilterChange = (patch) => {
    setAuditFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleCreateCrmCase = async (event) => {
    event.preventDefault();
    if (!crmCaseForm.group_name.trim() || isCrmBusy) return;
    if (!crmCreateSelectedBuilding?.id) {
      setPageError("Link a Master or Staging building before creating a case.");
      return;
    }
    const guests = normalizeCrmGuestDrafts(crmCaseGuests);
    if (!guests.length) {
      setPageError("Add at least one customer from the group before creating a case.");
      return;
    }
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch("/crm/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...crmCaseForm,
          building_source: crmCreateBuildingSource,
          building_id: crmCreateSelectedBuilding.id,
          guests,
        }),
      });
      setCrmCaseForm({
        group_name: "",
        unit: "",
        group_creator_name: "",
        group_creator_contact: "",
        agent_team_t: "",
        agent_team_m: "",
        lease_start_date: "",
      });
      setCrmCaseGuests([createEmptyCrmGuest()]);
      setCrmCreateBuildingSource("master");
      setCrmCreateBuildingSearch("");
      setCrmCreateBuildingCandidates([]);
      setCrmCreateSelectedBuilding(null);
      setSelectedCrmCaseId(data.case?.id || "");
      setSelectedCrmCaseDetail(data);
      setCrmCaseSummary(null);
      setIsCrmSnapshotOpen(false);
      setIsCrmCreateOpen(false);
      setCrmCaseTab("services");
      setPageNotice("CRM case created.");
      await loadCrmCases();
      if (data.case?.id) {
        await loadCrmCaseSummary(data.case.id).catch(() => {});
      }
    } catch (error) {
      setPageError(error.message || "Could not create the CRM case.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const patchCrmCase = async (patch, notice = "CRM case updated.") => {
    if (!selectedCrmCaseId || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${selectedCrmCaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSelectedCrmCaseDetail(data);
      setPageNotice(notice);
      await loadCrmCases();
      await loadCrmCaseSummary(selectedCrmCaseId).catch(() => {});
    } catch (error) {
      setPageError(error.message || "Could not update the CRM case.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleBindCrmBuilding = async (candidate) => {
    if (!candidate?.id) return;
    await patchCrmCase(
      {
        building_source: crmBuildingSource,
        building_id: candidate.id,
      },
      crmBuildingSource === "staging"
        ? "Staging building linked. This information has not yet been promoted to Master."
        : "Master building linked and service snapshot generated."
    );
    setCrmBuildingCandidates([]);
  };

  const handleDeleteCrmCase = async (event) => {
    event.preventDefault();
    if (!selectedCrmCaseId || isCrmBusy) return;
    const reason = crmCaseDeleteDraft.reason.trim();
    if (!reason) {
      setPageError("Enter a reason before deleting the case.");
      return;
    }
    setIsCrmBusy(true);
    setPageError("");
    try {
      await apiFetch(`/crm/cases/${selectedCrmCaseId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      setCrmCaseDeleteDraft({ open: false, reason: "" });
      setSelectedCrmCaseId("");
      setSelectedCrmCaseDetail(null);
      setSelectedCrmServiceId("");
      setSelectedCrmTaskId("");
      setCrmCaseSummary(null);
      setPageNotice("CRM case deleted and archived; incomplete tasks were cancelled.");
      await Promise.all([loadCrmCases(), loadCrmTasks().catch(() => {})]);
    } catch (error) {
      setPageError(error.message || "Could not delete the CRM case.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleRestoreCrmCase = async () => {
    if (!selectedCrmCaseId || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/restore`, {
        method: "POST",
      });
      setSelectedCrmCaseDetail((prev) => (prev ? { ...prev, case: data.case || prev.case } : prev));
      setPageNotice("CRM case restored.");
      setCrmStatusFilter("");
      await loadCrmCases({ status: "" });
      if (data.case?.id) {
        await loadCrmCaseDetail(data.case.id);
      }
    } catch (error) {
      setPageError(error.message || "Could not restore the CRM case.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleRefreshCrmSnapshot = async () => {
    if (!selectedCrmCaseId || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/refresh-building-snapshot`, {
        method: "POST",
      });
      setSelectedCrmCaseDetail(data);
      setPageNotice("The current case service snapshot was refreshed from the building knowledge base.");
      await loadCrmCases();
      await loadCrmCaseSummary(selectedCrmCaseId).catch(() => {});
    } catch (error) {
      setPageError(error.message || "Could not refresh the building snapshot.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleGenerateCrmServices = async () => {
    if (!selectedCrmCaseId || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/generate-services`, {
        method: "POST",
      });
      setSelectedCrmCaseDetail(data);
      setPageNotice("Services and tasks were regenerated from the current building snapshot.");
      await loadCrmCases();
      await loadCrmCaseSummary(selectedCrmCaseId).catch(() => {});
    } catch (error) {
      setPageError(error.message || "Could not generate CRM services.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleOpenCrmBuildingDetail = () => {
    if (!selectedCrmCase?.building_id || !selectedCrmCase?.building_source) return;
    if (selectedCrmCase.building_source === "staging") {
      setSelectedStagingKey(selectedCrmCase.building_id);
      setActiveTab("staging");
    } else {
      setSelectedBuildingId(selectedCrmCase.building_id);
      setActiveTab("master");
    }
  };

  const handleCrmServiceStatus = async (service, status) => {
    if (!selectedCrmCaseId || !service?.id || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/services/${service.id}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setSelectedCrmCaseDetail(data);
    } catch (error) {
      setPageError(error.message || "Could not update the service-line status.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCrmServicePatch = async (service, patch, notice = "Service-line status updated.", meta = {}) => {
    if (!selectedCrmCaseId || !service?.id || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/services/${service.id}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSelectedCrmCaseDetail(data);
      setPageNotice(notice);
      await loadCrmCases();
      if (
        meta.groupKey === "staff" &&
        crmIsInternetService(service) &&
        crmInternetFlowStepKind(meta.selectedStep) === "confirm"
      ) {
        setSelectedCrmServiceId(service.id);
        setSelectedCrmTaskId("");
        setInternetSetupWizard({ serviceId: service.id, phase: "collect" });
      }
      return data;
    } catch (error) {
      setPageError(error.message || "Could not update the service line.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCrmTaskStatus = async (task, status) => {
    if (!task?.id || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setSelectedCrmCaseDetail(data);
      const tasks = await loadCrmTasks().catch(() => crmGlobalTasks);
      const nextTask = (tasks || []).find((item) => item.id === task.id);
      if (nextTask) {
        setSelectedGlobalTask(nextTask);
      }
      setPageNotice(status === "completed" ? "Task completed." : "Task status updated.");
      await loadCrmCases();
    } catch (error) {
      setPageError(error.message || "Could not update the task.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleDelayCrmTask = async (task, days = 1) => {
    if (!task?.id || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const nextDueAt = addDaysToIso(task.due_at, days);
      const data = await apiFetch(`/crm/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_at: nextDueAt, status: "scheduled" }),
      });
      setSelectedCrmCaseDetail(data);
      const tasks = await loadCrmTasks().catch(() => crmGlobalTasks);
      setSelectedGlobalTask((tasks || []).find((item) => item.id === task.id) || null);
      setPageNotice("Task postponed.");
      await loadCrmCases();
    } catch (error) {
      setPageError(error.message || "Could not postpone the task.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCreateCrmFollowUpTask = async ({
    caseId = "",
    serviceId = "",
    customerId = "",
    title = "Create follow-up",
    description = "",
    dueAt = "",
    priority = "normal",
    assignedTo = "",
    taskType = "follow_up",
    successNotice = "Follow-up task created.",
  } = {}) => {
    const effectiveCaseId = caseId || selectedCrmCaseId;
    if (!effectiveCaseId || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${effectiveCaseId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          case_service_id: serviceId,
          target_customer_id: customerId,
          task_type: taskType,
          due_at: dueAt || addDaysToIso("", 1),
          assigned_to: assignedTo,
          priority,
          status: "open",
        }),
      });
      setSelectedCrmCaseDetail(data);
      await Promise.all([loadCrmTasks().catch(() => {}), loadCrmCases().catch(() => {})]);
      setPageNotice(successNotice);
    } catch (error) {
      setPageError(error.message || "Could not create the follow-up task.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCreateCalendarQuickFollowUp = async (task) => {
    const inputValue = String(quickFollowUpInputs[task?.id] || "").trim();
    if (!task?.id || !inputValue) return;
    const dueAt = crmParseReminderDueAt(inputValue, task.due_at || new Date());
    if (!dueAt) {
      setPageError("I could not recognize a reminder date. Try: remind me tomorrow, remind me in two days, or remind me next Monday.");
      return;
    }
    await handleCreateCrmFollowUpTask({
      caseId: task.case_id,
      serviceId: task.case_service_id,
      customerId: task.target_customer_id || task.customer_id,
      title: crmQuickFollowUpTitle(inputValue, task),
      description: `${CRM_CALENDAR_FOLLOW_UP_MARKER}: ${task.title || "Original task"}\nOriginal input: ${inputValue}`,
      dueAt,
      assignedTo: task.assigned_to || task.assigned_user_id,
      priority: ["high", "urgent"].includes(task.priority) ? task.priority : "normal",
    });
    setQuickFollowUpInputs((prev) => ({ ...prev, [task.id]: "" }));
  };

  const openInternetWizardForService = (service, phase = "") => {
    if (!service?.id) return;
    const effectivePhase = phase || crmInternetWizardPhaseForService(service, selectedCrmCaseDetail?.tasks || []) || "collect";
    setSelectedCrmServiceId(service.id);
    setSelectedCrmTaskId("");
    setInternetDeferDrawer(null);
    setInternetSetupWizard({ serviceId: service.id, phase: effectivePhase });
  };

  const handleOpenInternetDeferDrawer = (service, phase = "collect") => {
    if (!service?.id) return;
    setSelectedCrmServiceId(service.id);
    setSelectedCrmTaskId("");
    setInternetSetupWizard(null);
    setInternetDeferDrawer({ serviceId: service.id, phase });
  };

  const handleInternetWizardDefer = (phase = "collect") => {
    const service = (selectedCrmCaseDetail?.services || []).find((item) => item.id === internetSetupWizard?.serviceId);
    if (!service?.id) return;
    handleOpenInternetDeferDrawer(service, phase);
  };

  const handleResumeInternetTask = async (task) => {
    const phase = crmTaskInternetDeferPhase(task);
    if (!phase || !task?.case_id) return false;
    setSelectedGlobalTask(task);
    setSelectedCrmTaskId(task.id);
    setSelectedCrmCaseId(task.case_id);
    setPageError("");
    try {
      const detail = await loadCrmCaseDetail(task.case_id);
      const service = (detail?.services || []).find((item) => item.id === task.case_service_id);
      if (!service?.id) {
        setPageError("No matching internet-service record was found for this task.");
        return true;
      }
      setSelectedCrmServiceId(service.id);
      setInternetDeferDrawer(null);
      setInternetSetupWizard({ serviceId: service.id, phase });
      return true;
    } catch (error) {
      setPageError(error.message || "Could not load the internet-service task.");
      return true;
    }
  };

  const handleSaveInternetDeferTask = async ({ phase = "collect", dueAt = "", note = "" } = {}) => {
    const service = internetDeferService;
    const effectiveCaseId = selectedCrmCaseId || selectedCrmCase?.id || service?.case_id || "";
    if (!service?.id || !effectiveCaseId || isCrmBusy) return;
    if (!dueAt) {
      setPageError("Choose a reminder time.");
      return;
    }
    const isAppointment = phase === "appointment";
    const marker = isAppointment ? CRM_INTERNET_APPOINTMENT_DEFER_MARKER : CRM_INTERNET_INFO_DEFER_MARKER;
    const title = isAppointment ? "Schedule internet verification-code window" : "Collect internet account information";
    const responsibleName = crmCustomerLabel(selectedCrmCustomers, service.responsible_customer_id || "");
    const existingTask = crmInternetDeferTasksForService(service, selectedCrmCaseDetail?.tasks || [], phase)[0];
    const description = [
      marker,
      isAppointment ? "The customer cannot confirm a verification-code time yet. Continue scheduling later." : "The customer cannot provide account information yet. Continue collecting it later.",
      note ? `Note: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    setIsCrmBusy(true);
    setPageError("");
    try {
      const payload = {
        title: `${title}${responsibleName && responsibleName !== CRM_GROUP_TARGET_LABEL ? ` - ${responsibleName}` : ""}`,
        description,
        case_service_id: service.id,
        target_customer_id: service.responsible_customer_id || "",
        task_type: "follow_up",
        due_at: dueAt,
        assigned_to: selectedCrmCase?.owner_user_id || currentUser?.id || "",
        priority: "normal",
        status: "open",
      };
      const data = existingTask?.id
        ? await apiFetch(`/crm/tasks/${existingTask.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await apiFetch(`/crm/cases/${effectiveCaseId}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      setSelectedCrmCaseDetail(data);
      setInternetDeferDrawer(null);
      setPageNotice(existingTask?.id ? "Reminder task updated." : "Reminder task created.");
      const tasks = await loadCrmTasks().catch(() => crmGlobalTasks);
      if (selectedGlobalTask?.id) {
        setSelectedGlobalTask((tasks || []).find((item) => item.id === selectedGlobalTask.id) || selectedGlobalTask);
      }
      await loadCrmCases().catch(() => {});
    } catch (error) {
      setPageError(error.message || "Could not save the reminder.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCreateInternetVerificationAppointment = async (service, appointment = {}) => {
    if (!selectedCrmCaseId || !service?.id) return;
    if (!appointment.dueAt) {
      setPageError("Choose a start time for the internet verification-code window.");
      return;
    }
    if (!appointment.responsibleCustomerId) {
      setPageError("Assign an owner for the internet service before scheduling a verification-code window.");
      return;
    }
    await handleCreateCrmFollowUpTask({
      caseId: selectedCrmCaseId,
      serviceId: service.id,
      customerId: appointment.responsibleCustomerId,
      title: `Internet verification-code window - ${appointment.responsibleName || "Customer"}`,
      description: `${CRM_INTERNET_VERIFICATION_MARKER}\nThe customer must be available to receive a verification code while the internet account is being opened.\nWindow length: ${appointment.durationMinutes || "15"} minutes.`,
      dueAt: appointment.dueAt,
      assignedTo: selectedCrmCase?.owner_user_id || currentUser?.id || "",
      priority: "high",
      taskType: "verify",
      successNotice: "Internet verification-code appointment created and added to the Task Center.",
    });
  };

  const handleInternetWizardInfoSubmit = async (values = {}) => {
    const service = (selectedCrmCaseDetail?.services || []).find((item) => item.id === internetSetupWizard?.serviceId);
    if (!selectedCrmCaseId || !service?.id || isCrmBusy) return;
    const collectStep = crmInternetFlowStepByKind(service, "collect");
    const deferTask = crmInternetDeferTasksForService(service, selectedCrmCaseDetail?.tasks || [], "collect")[0];
    if (!collectStep?.step_key) {
      setPageError("The current internet template has no Information collected step. Configure it in Service Templates first.");
      return;
    }
    setIsCrmBusy(true);
    setPageError("");
    try {
      let data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/services/${service.id}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_flow_step_key: collectStep.step_key,
          step_key: collectStep.step_key,
          value: {
            account_holder: values.account_holder || "",
            phone: values.phone || "",
            notes: values.notes || "",
          },
          note: values.notes || "",
        }),
      });
      if (deferTask?.id) {
        data = await apiFetch(`/crm/tasks/${deferTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
      }
      setSelectedCrmCaseDetail(data);
      setInternetSetupWizard({ serviceId: service.id, phase: "appointment" });
      setPageNotice("Internet account information recorded. Next, schedule a verification-code window.");
      await Promise.all([loadCrmTasks().catch(() => {}), loadCrmCases().catch(() => {})]);
    } catch (error) {
      setPageError(error.message || "Could not save the internet account information.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleInternetWizardAppointmentSubmit = async (appointment = {}) => {
    const service = (selectedCrmCaseDetail?.services || []).find((item) => item.id === internetSetupWizard?.serviceId);
    if (!selectedCrmCaseId || !service?.id || isCrmBusy) return;
    const verificationStep = crmInternetFlowStepByKind(service, "verification");
    const deferTask = crmInternetDeferTasksForService(service, selectedCrmCaseDetail?.tasks || [], "appointment")[0];
    if (!verificationStep?.step_key) {
      setPageError("The current internet template has no Verification-code window step. Configure it in Service Templates first.");
      return;
    }
    if (!appointment.dueAt) {
      setPageError("Choose a start time for the internet verification-code window.");
      return;
    }
    if (!appointment.responsibleCustomerId) {
      setPageError("Assign an owner for the internet service before scheduling a verification-code window.");
      return;
    }
    setIsCrmBusy(true);
    setPageError("");
    try {
      await apiFetch(`/crm/cases/${selectedCrmCaseId}/services/${service.id}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_flow_step_key: verificationStep.step_key,
          step_key: verificationStep.step_key,
          value: {
            verification_window: appointment.dueAt,
            duration_minutes: appointment.durationMinutes || "15",
          },
          note: `Verification-code window: ${formatDateTime(appointment.dueAt)}`,
        }),
      });
      let data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Internet verification-code window - ${appointment.responsibleName || "Customer"}`,
          description: `${CRM_INTERNET_VERIFICATION_MARKER}\nThe customer must be available to receive a verification code while the internet account is being opened.\nWindow length: ${appointment.durationMinutes || "15"} minutes.`,
          case_service_id: service.id,
          target_customer_id: appointment.responsibleCustomerId,
          task_type: "verify",
          due_at: appointment.dueAt,
          assigned_to: selectedCrmCase?.owner_user_id || currentUser?.id || "",
          priority: "high",
          status: "open",
        }),
      });
      if (deferTask?.id) {
        data = await apiFetch(`/crm/tasks/${deferTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
      }
      setSelectedCrmCaseDetail(data);
      setInternetSetupWizard(null);
      setPageNotice("Verification-code window scheduled and the internet-service status was updated automatically.");
      await Promise.all([loadCrmTasks().catch(() => {}), loadCrmCases().catch(() => {})]);
    } catch (error) {
      setPageError(error.message || "Could not schedule the verification-code window.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCreateCrmNotificationDraft = async ({ caseId = "", serviceId = "", taskId = "", prompt = "" } = {}) => {
    const effectiveCaseId = caseId || selectedCrmCaseId;
    if (!effectiveCaseId || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch("/crm/ai/notification-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: effectiveCaseId,
          case_service_id: serviceId,
          task_id: taskId,
          prompt,
          channel: "wechat",
          recipient_type: "group",
        }),
      });
      setSelectedCrmCaseDetail(data);
      await loadCrmTasks().catch(() => {});
      setPageNotice("AI notification draft generated. Human approval is still required.");
    } catch (error) {
      setPageError(error.message || "Could not generate the notification draft.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleViewCrmTaskCase = (task) => {
    if (!task?.case_id) return;
    setSelectedCrmCaseId(task.case_id);
    setSelectedCrmTaskId(task.id);
    setSelectedCrmServiceId(task.case_service_id || "");
    setIsCrmWorkbenchOpen(true);
    setCrmCaseTab("tasks");
    setActiveTab("crm");
  };

  const handleCreateCrmCommunicationEvent = async (event) => {
    event.preventDefault();
    if (!selectedCrmCaseId || !crmCommunicationSummary.trim() || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/communication-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "wechat_group",
          direction: "internal",
          summary: crmCommunicationSummary,
        }),
      });
      setSelectedCrmCaseDetail(data);
      setCrmCommunicationSummary("");
      setPageNotice("Communication record saved.");
    } catch (error) {
      setPageError(error.message || "Could not save the communication record.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleExtractCrmCommunication = async (communicationEvent) => {
    if (!selectedCrmCaseId || !communicationEvent?.id || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(
        `/crm/cases/${selectedCrmCaseId}/communication-events/${communicationEvent.id}/extract-to-review`,
        { method: "POST" }
      );
      setPageNotice(data.message || "The communication record was added to the building-knowledge Review Queue.");
      await loadIntakeJobs().catch(() => null);
    } catch (error) {
      setPageError(error.message || "Could not extract building knowledge.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCrmNotificationAction = async (notification, action) => {
    if (!notification?.id || isCrmBusy) return;
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/notifications/${notification.id}/${action}`, {
        method: "POST",
      });
      setSelectedCrmCaseDetail(data);
      setPageNotice(action === "send" ? "Notification marked as sent. This system did not send a WeChat message." : "Notification draft approved.");
    } catch (error) {
      setPageError(error.message || "Could not update the notification record.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleSelectCrmTemplate = (template) => {
    setSelectedCrmTemplateId(template?.id || "");
    setCrmTemplateDraft(crmTemplateToDraft(template));
    setIsCrmTemplateNew(false);
  };

  const handleNewCrmTemplate = () => {
    setSelectedCrmTemplateId("");
    setCrmTemplateDraft(createEmptyCrmTemplateDraft());
    setIsCrmTemplateNew(true);
  };

  const handleSaveCrmTemplate = async (overridePatch = null, notice = "") => {
    if (!["super_admin", "admin"].includes(currentUser?.role || "") || isCrmBusy) return;
    const nextDraft = overridePatch ? { ...crmTemplateDraft, ...overridePatch } : crmTemplateDraft;
    const payload = crmTemplateDraftToPayload(nextDraft);
    if (!payload.name || !payload.service_key) {
      setPageError("Enter both a service name and service key.");
      return;
    }
    setIsCrmBusy(true);
    setPageError("");
    try {
      const endpoint = isCrmTemplateNew
        ? "/crm/service-templates"
        : `/crm/service-templates/${selectedCrmTemplateId || nextDraft.id}`;
      const data = await apiFetch(endpoint, {
        method: isCrmTemplateNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const templates = await loadCrmTemplates({ includeInactive: true });
      const savedTemplate = data.template || templates.find((item) => item.service_key === payload.service_key);
      if (savedTemplate) {
        setSelectedCrmTemplateId(savedTemplate.id);
        setCrmTemplateDraft(crmTemplateToDraft(savedTemplate));
        setIsCrmTemplateNew(false);
      }
      setPageNotice(notice || (payload.active ? "Service template saved. New cases will use the latest version." : "Service template deactivated. Existing cases are retained."));
    } catch (error) {
      setPageError(error.message || "Could not save the service template.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleDisableCrmTemplate = () => {
    handleSaveCrmTemplate({ active: false }, "Service template deactivated. It is removed from new-case setup, while historical cases are retained.");
  };

  const handleCrmGroupFieldChange = async (service, step, field, value) => {
    if (!selectedCrmCaseId || !service?.id || !step?.step_key || isCrmBusy) return;
    const currentValues = getCrmStepValues(service, step.step_key);
    const nextValues = { ...currentValues, [field.key]: value };
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(`/crm/cases/${selectedCrmCaseId}/services/${service.id}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_key: step.step_key, value: nextValues }),
      });
      setSelectedCrmCaseDetail(data);
    } catch (error) {
      setPageError(error.message || "Could not update the group-level progress.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCrmGuestFieldChange = async (guest, service, step, field, value) => {
    if (!selectedCrmCaseId || !guest?.id || !service?.id || !step?.step_key || isCrmBusy) return;
    const current = getCrmGuestStepValues(guest, service.id, step.step_key);
    const body =
      field.type === "sensitive"
        ? { step_key: step.step_key, value: current.value, sensitive: { ...current.sensitive, [field.key]: value } }
        : { step_key: step.step_key, value: { ...current.value, [field.key]: value } };
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(
        `/crm/cases/${selectedCrmCaseId}/guests/${guest.id}/services/${service.id}/progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      setSelectedCrmCaseDetail(data);
    } catch (error) {
      setPageError(error.message || "Could not update customer progress.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleCrmGuestServiceValuePatch = async (guest, service, stepKey, patch, { note, notice = "Customer status updated." } = {}) => {
    if (!selectedCrmCaseId || !guest?.id || !service?.id || !stepKey || isCrmBusy) return;
    const current = getCrmGuestStepValues(guest, service.id, stepKey);
    setIsCrmBusy(true);
    setPageError("");
    try {
      const data = await apiFetch(
        `/crm/cases/${selectedCrmCaseId}/guests/${guest.id}/services/${service.id}/progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step_key: stepKey,
            value: { ...current.value, ...patch },
            note: note === undefined ? current.note : note,
          }),
        }
      );
      setSelectedCrmCaseDetail(data);
      setPageNotice(notice);
      await loadCrmCases().catch(() => {});
    } catch (error) {
      setPageError(error.message || "Could not update the customer status.");
    } finally {
      setIsCrmBusy(false);
    }
  };

  const handleRollbackLog = async (log) => {
    if (!log?.target_record_id || isRollingBack) {
      return;
    }
    setIsRollingBack(true);
    setPageError("");
    try {
      await apiFetch(`/master/buildings/${log.target_record_id}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_log_id: log.id,
          note: "Audit-log rollback from the frontend",
        }),
      });
      setPageNotice(`Field rolled back: ${log.field_name || "Unnamed field"}`);
      if (selectedBuildingId === log.target_record_id) {
        await loadMasterBuildingDetail(log.target_record_id);
        await loadMasterSummary(log.target_record_id).catch(() => {});
        await loadBuildingNetwork(log.target_record_id, {
          preserveOpen: true,
          sourceMode: "master",
        }).catch(() => {});
      }
      await Promise.all([
        loadAuditLogs(auditFilters),
        loadMasterBuildings(masterSearch.trim()),
        loadStagingBuildings(getStagingReloadQuery()),
        loadReviewGroups(reviewStatusFilter),
        loadOverview(),
        loadMasterExcelStatus().catch(() => {}),
        selectedStagingKey ? loadStagingBuildingDetail(selectedStagingKey).catch(() => {}) : Promise.resolve(),
      ]);
    } catch (error) {
      setPageError(error.message || "Rollback failed.");
    } finally {
      setIsRollingBack(false);
    }
  };

  if (!token || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Building Knowledge Operations</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sign in with a local account. All permissions are enforced by the backend.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleLogin}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, username: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </label>
            {loginError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {loginError}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAuthLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
            Default accounts are created by the backend initialization script. Use `superadmin` first to verify the full workflow.
            If you need another account, ask a Super Admin to create it under System → Account Management. Self-service registration is disabled.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-3 sm:px-4 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
        <header className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Building Knowledge & CRM Console</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Approved answers come only from Master. Excel files, Welcome Letters, and staff changes enter the Review Queue before an authorized reviewer promotes them.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="blue">{ROLE_LABELS[currentUser.role] || currentUser.role}</StatusPill>
              <StatusPill tone="slate">{currentUser.display_name || currentUser.username}</StatusPill>
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  setPageError("");
                  setIsPasswordChangeOpen(true);
                }}
              >
                Change password
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          </div>
          {overview && activeTab !== "crm" ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Master buildings", overview.master_buildings],
                currentUser.role === "viewer" ? null : ["Pending reviews", overview.staging_pending],
                ["Import batches", overview.import_batches],
                ["Source documents", overview.source_documents],
                ["Audit records", overview.audit_logs],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-medium text-slate-500">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </header>

        {pageNotice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {pageNotice}
          </div>
        ) : null}
        {pageError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError}
          </div>
        ) : null}
        {isPasswordChangeOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 py-6">
            <form
              className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl"
              onSubmit={handleChangePassword}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Change Password</div>
                  <div className="mt-1 text-sm text-slate-500">Change every default password before using the system on a local network.</div>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  onClick={() => setIsPasswordChangeOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Current password</span>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={passwordChangeForm.current_password}
                    onChange={(event) =>
                      setPasswordChangeForm((prev) => ({ ...prev, current_password: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">New password</span>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={passwordChangeForm.new_password}
                    onChange={(event) =>
                      setPasswordChangeForm((prev) => ({ ...prev, new_password: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</span>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={passwordChangeForm.confirm_password}
                    onChange={(event) =>
                      setPasswordChangeForm((prev) => ({ ...prev, confirm_password: event.target.value }))
                    }
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={isAccountBusy}
                className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAccountBusy ? "Saving…" : "Save new password"}
              </button>
            </form>
          </div>
        ) : null}
        {isStagingCreateOpen ? (
          <DrawerPanel
            title="Add a Building to Staging"
            subtitle="Use this when a new building has no Welcome Letter yet and cannot be found in Master. CRM cases can link to this Staging record immediately."
            onClose={() => {
              if (!isCreatingStagingBuilding) {
                setIsStagingCreateOpen(false);
              }
            }}
          >
            <form className="space-y-4" onSubmit={handleCreateStagingBuilding}>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                The new record enters Staging, never Master directly. Business fields may remain blank until source documents arrive, then be completed and submitted for review.
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Building name</span>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={stagingCreateForm.building_name}
                  onChange={(event) =>
                    setStagingCreateForm((prev) => ({ ...prev, building_name: event.target.value }))
                  }
                  placeholder="For example, Example Heights or Test Tower"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Address</span>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={stagingCreateForm.address}
                  onChange={(event) =>
                    setStagingCreateForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                  placeholder="Optional, but recommended to distinguish buildings with similar names"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Aliases / Search terms</span>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={stagingCreateForm.aliases}
                  onChange={(event) =>
                    setStagingCreateForm((prev) => ({ ...prev, aliases: event.target.value }))
                  }
                  placeholder="For example, alternate names, common abbreviations, or staff terminology"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["insurance_required", "Insurance required"],
                  ["electricity_required", "Customer must set up electricity"],
                  ["internet_self_setup_required", "Customer must set up internet service"],
                ].map(([fieldKey, label]) => (
                  <label key={fieldKey} className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
                    <select
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={stagingCreateForm[fieldKey]}
                      onChange={(event) =>
                        setStagingCreateForm((prev) => ({ ...prev, [fieldKey]: event.target.value }))
                      }
                    >
                      <option value="">Needs confirmation</option>
                      <option value="true">Required</option>
                      <option value="false">Not required</option>
                      <option value="optional">Optional</option>
                    </select>
                  </label>
                ))}
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={stagingCreateForm.notes}
                  onChange={(event) =>
                    setStagingCreateForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  placeholder="For example: only the building name is available; add rules when the Welcome Letter arrives."
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isCreatingStagingBuilding}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingStagingBuilding ? "Creating…" : "Add building to Staging"}
                </button>
                <button
                  type="button"
                  disabled={isCreatingStagingBuilding}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => setIsStagingCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </DrawerPanel>
        ) : null}
        {activeIntakeJobs.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span>
              {activeIntakeJobs.length} Welcome Letter job(s) are processing in the background. You can continue using other features.
            </span>
            <button
              type="button"
              className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              onClick={() => {
                setActiveTab("intake");
                loadIntakeJobs().catch(() => null);
              }}
            >
              View jobs
            </button>
          </div>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain">
            <nav className="space-y-2">
              {availableNavGroups.map((group) => {
                const isOpen = openNavGroups[group.key];
                const groupActive = group.tabs.includes(activeTab);
                return (
                  <div key={group.key} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-1">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                        groupActive ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
                      }`}
                      onClick={() =>
                        setOpenNavGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                      }
                    >
                      <span>{group.label}</span>
                      <span className="text-xs text-slate-400">{isOpen ? "Collapse" : "Expand"}</span>
                    </button>
                    {isOpen ? (
                      <div className="mt-1 space-y-1">
                        {group.tabs.map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                              activeTab === tab
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-white hover:text-slate-900"
                            }`}
                            onClick={() => setActiveTab(tab)}
                          >
                            <span>{TAB_LABELS[tab]}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-500">
              Backend URL: {API_BASE}
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-700">Runtime status</span>
                <StatusPill tone={runtimeHealth?.status === "ok" ? "green" : "amber"}>
                  {runtimeHealth?.runtime_mode === "daemon" ? "Background service" : "Development"}
                </StatusPill>
              </div>
              <div className="mt-2">Backend health: {runtimeHealth?.status === "ok" ? "Healthy" : "Needs attention"}</div>
              <div>Frontend build: {runtimeHealth?.frontend_healthy === null ? "Development mode" : runtimeHealth?.frontend_healthy ? "Available" : "Missing"}</div>
              {runtimeHealth?.ocr_provider ? (
                <div>
                  OCR：{runtimeHealth.ocr_provider}
                  {runtimeHealth.ocr_provider_configured ? " (configured)" : " (not configured; fallback will be used)"}
                </div>
              ) : null}
              <div>Detailed diagnostics are available to administrators through the backend diagnostics endpoint.</div>
              {isCheckingRuntimeHealth ? (
                <div className="mt-2 text-blue-600">Checking service recovery status…</div>
              ) : null}
            </div>
          </aside>

          <main className="space-y-4">
            {internetWizardService ? (
              <CrmInternetSetupWizardModal
                service={internetWizardService}
                customers={selectedCrmCustomers}
                globalTasks={crmGlobalTasks}
                phase={internetSetupWizard.phase}
                disabled={isCrmBusy}
                onClose={() => setInternetSetupWizard(null)}
                onSubmitInfo={handleInternetWizardInfoSubmit}
                onSubmitAppointment={handleInternetWizardAppointmentSubmit}
                onDefer={handleInternetWizardDefer}
              />
            ) : null}
            {internetDeferService ? (
              <CrmInternetDeferDrawer
                service={internetDeferService}
                customers={selectedCrmCustomers}
                phase={internetDeferDrawer.phase}
                disabled={isCrmBusy}
                onClose={() => setInternetDeferDrawer(null)}
                onSave={handleSaveInternetDeferTask}
              />
            ) : null}
            {activeTab === "crm" ? (
              (() => {
                const customers = selectedCrmCaseDetail?.customers || selectedCrmCaseDetail?.guests || [];
                const currentCaseTasks = selectedCrmCaseDetail?.tasks || [];
                const currentCaseOpenTasks = crmOpenTasks(currentCaseTasks);
                const currentCaseTodayTasks = currentCaseOpenTasks.filter(
                  (task) => crmTaskDateKey(task) === crmDateKey()
                );
                const currentCaseOverdueTasks = currentCaseOpenTasks.filter((task) => task.is_overdue);
                const riskTasks = currentCaseOpenTasks.filter(
                  (task) => task.priority === "high" || task.priority === "urgent" || task.is_overdue
                );
                const workbenchService = selectedCrmTask ? null : selectedCrmService;
                const workbenchServiceClosed = workbenchService ? crmServiceClosed(workbenchService) : false;
                const taskActionHandlers = {
                  onComplete: (task) => handleCrmTaskStatus(task, "completed"),
                  onDelay: (task) => handleDelayCrmTask(task),
                  onFollowUp: (task) =>
                    handleCreateCrmFollowUpTask({
                      caseId: task.case_id,
                      serviceId: task.case_service_id,
                      customerId: task.target_customer_id || task.customer_id,
                      title: `Continue follow-up - ${task.service_name || task.title}`,
                    }),
                  onDraft: (task) =>
                    handleCreateCrmNotificationDraft({
                      caseId: task.case_id,
                      taskId: task.id,
                      serviceId: task.case_service_id,
                    }),
                  onResumeInternet: handleResumeInternetTask,
                  onViewCase: handleViewCrmTaskCase,
                };
                const openTaskFromCrmWorkbench = (task) => {
                  if (!task?.id) return;
                  setActiveTab("tasks");
                  if (crmTaskIsInternetDeferTask(task)) {
                    handleResumeInternetTask(task);
                    return;
                  }
                  setSelectedGlobalTask(task);
                  setSelectedCrmTaskId(task.id);
                  if (task.case_id) {
                    loadCrmCaseDetail(task.case_id).catch((error) =>
                      setPageError(error.message || "Could not load the case for this task.")
                    );
                  }
                };
                return (
                  <div className="space-y-4">
                    {isCrmCreateOpen ? (
                      <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 px-4 py-8">
                        <form
                          className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
                          onSubmit={handleCreateCrmCase}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="text-lg font-semibold text-slate-900">Create CRM Case</h2>
                              <p className="mt-1 text-sm text-slate-500">
                                Use the WeChat group name as the case name. Add only the people who are actual service customers.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              onClick={() => setIsCrmCreateOpen(false)}
                            >
                              Close
                            </button>
                          </div>
                          <div className="mt-5 grid gap-3 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">WeChat group name</span>
                              <input
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCaseForm.group_name}
                                onChange={(event) => setCrmCaseForm((prev) => ({ ...prev, group_name: event.target.value }))}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Unit</span>
                              <input
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCaseForm.unit}
                                onChange={(event) => setCrmCaseForm((prev) => ({ ...prev, unit: event.target.value }))}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Lease start date</span>
                              <input
                                type="date"
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCaseForm.lease_start_date}
                                onChange={(event) => setCrmCaseForm((prev) => ({ ...prev, lease_start_date: event.target.value }))}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Leasing Agent</span>
                              <input
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCaseForm.group_creator_name}
                                onChange={(event) => setCrmCaseForm((prev) => ({ ...prev, group_creator_name: event.target.value }))}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Leasing Agent contact</span>
                              <input
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCaseForm.group_creator_contact}
                                onChange={(event) => setCrmCaseForm((prev) => ({ ...prev, group_creator_contact: event.target.value }))}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Team</span>
                              <input
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCaseForm.agent_team_t}
                                onChange={(event) => setCrmCaseForm((prev) => ({ ...prev, agent_team_t: event.target.value }))}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Mentor</span>
                              <input
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCaseForm.agent_team_m}
                                onChange={(event) => setCrmCaseForm((prev) => ({ ...prev, agent_team_m: event.target.value }))}
                              />
                            </label>
                          </div>
                          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">Link a building (required)</div>
                                <div className="mt-1 text-xs leading-5 text-slate-500">
                                  Creating the case captures a building-rule snapshot. Its services and tasks are generated from that snapshot.
                                </div>
                              </div>
                              {crmCreateSelectedBuilding ? (
                                <StatusPill tone={crmCreateBuildingSource === "staging" ? "amber" : "green"}>
                                  {formatCrmSourceLabel(crmCreateBuildingSource)}
                                </StatusPill>
                              ) : (
                                <StatusPill tone="amber">Not linked</StatusPill>
                              )}
                            </div>
                            <div className="mt-3 grid gap-2 lg:grid-cols-[120px_minmax(0,1fr)_auto]">
                              <select
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCreateBuildingSource}
                                onChange={(event) => {
                                  setCrmCreateBuildingSource(event.target.value);
                                  setCrmCreateBuildingCandidates([]);
                                  setCrmCreateSelectedBuilding(null);
                                }}
                              >
                                <option value="master">Master</option>
                                <option value="staging">Staging</option>
                              </select>
                              <input
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmCreateBuildingSearch}
                                placeholder="Search by building name or address"
                                onChange={(event) => setCrmCreateBuildingSearch(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    loadCrmCreateBuildingCandidates().catch((error) => setPageError(error.message));
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                                onClick={() => loadCrmCreateBuildingCandidates().catch((error) => setPageError(error.message))}
                              >
                                Find building
                              </button>
                            </div>
                            {crmCreateSelectedBuilding ? (
                              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                      {crmCreateSelectedBuilding.building_name}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {crmCreateSelectedBuilding.address || "Address unknown"}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-blue-700"
                                    onClick={() => setCrmCreateSelectedBuilding(null)}
                                  >
                                    Choose another
                                  </button>
                                </div>
                                {crmCreateBuildingSource === "staging" ? (
                                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                                    This case is linked to a Staging building whose rules may not yet be in Master. The case header and service-rule source will show that status.
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {crmCreateBuildingCandidates.length ? (
                              <div className="mt-3 grid gap-2">
                                {crmCreateBuildingCandidates.slice(0, 6).map((candidate) => (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-slate-300 hover:bg-slate-50"
                                    onClick={() => {
                                      setCrmCreateSelectedBuilding(candidate);
                                      setCrmCreateBuildingCandidates([]);
                                      setCrmCreateBuildingSearch(candidate.building_name || "");
                                    }}
                                  >
                                    <div className="font-medium text-slate-900">{candidate.building_name}</div>
                                    <div className="mt-1 text-xs text-slate-500">{candidate.address || "Address unknown"}</div>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {!crmCreateSelectedBuilding && canCreateStagingBuilding ? (
                              <div className="mt-3 rounded-2xl border border-dashed border-blue-200 bg-white/70 px-4 py-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="text-xs leading-5 text-slate-500">
                                    Cannot find the building? Add it to Staging first, then link the case to those provisional rules.
                                  </div>
                                  <button
                                    type="button"
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                    onClick={() =>
                                      openStagingCreate("crm_create", {
                                        building_name: crmCreateBuildingSearch.trim(),
                                      })
                                    }
                                  >
                                    Add building to Staging
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">Customer</div>
                                <div className="mt-1 text-xs text-slate-500">Parents, observers, and Leasing Agents are group members, not Customers.</div>
                              </div>
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() => setCrmCaseGuests((prev) => [...prev, createEmptyCrmGuest()])}
                              >
                                Add customer
                              </button>
                            </div>
                            <div className="mt-3 space-y-3">
                              {crmCaseGuests.map((guest, guestIndex) => (
                                <div key={guestIndex} className="rounded-2xl border border-slate-200 bg-white p-3">
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="text-xs font-medium text-slate-500">Customer {guestIndex + 1}</div>
                                    {crmCaseGuests.length > 1 ? (
                                      <button
                                        type="button"
                                        className="text-xs font-medium text-rose-600"
                                        onClick={() => setCrmCaseGuests((prev) => prev.filter((_, index) => index !== guestIndex))}
                                      >
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                  <div className="grid gap-2 md:grid-cols-4">
                                    {[
                                      ["full_name", "Full name (required)"],
                                      ["wechat", "WeChat name"],
                                      ["phone", "Phone"],
                                      ["email", "Email"],
                                    ].map(([key, placeholder]) => (
                                      <input
                                        key={key}
                                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        value={guest[key]}
                                        placeholder={placeholder}
                                        onChange={(event) =>
                                          setCrmCaseGuests((prev) =>
                                            prev.map((item, index) =>
                                              index === guestIndex ? { ...item, [key]: event.target.value } : item
                                            )
                                          )
                                        }
                                      />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-5 flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              onClick={() => setIsCrmCreateOpen(false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={
                                isCrmBusy ||
                                !crmCaseForm.group_name.trim() ||
                                !crmCreateSelectedBuilding?.id ||
                                !normalizeCrmGuestDrafts(crmCaseGuests).length
                              }
                              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Create case
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : null}
                    {crmCaseDeleteDraft.open ? (
                      <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 px-4 py-10">
                        <form
                          className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
                          onSubmit={handleDeleteCrmCase}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="text-lg font-semibold text-slate-900">Delete / Archive Case</h2>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                This does not physically erase data. It hides the case from daily lists and the Task Center, and cancels incomplete tasks.
                              </p>
                            </div>
                            <StatusPill tone="rose">Destructive action</StatusPill>
                          </div>
                          <label className="mt-4 block">
                            <span className="mb-1 block text-xs font-medium text-slate-500">Reason for deletion</span>
                            <textarea
                              className="min-h-28 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                              value={crmCaseDeleteDraft.reason}
                              placeholder="For example: created by mistake, duplicate case, or wrong group"
                              onChange={(event) =>
                                setCrmCaseDeleteDraft((prev) => ({ ...prev, reason: event.target.value }))
                              }
                            />
                          </label>
                          <div className="mt-5 flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              onClick={() => setCrmCaseDeleteDraft({ open: false, reason: "" })}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isCrmBusy || !crmCaseDeleteDraft.reason.trim()}
                              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Confirm deletion
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : null}

                    <div className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                      <SectionCard
                        title="Case List"
                        subtitle="CRM manages cases, service cards, and tasks for the selected case."
                        className="xl:sticky xl:top-4"
                        bodyClassName="max-h-[76vh] overflow-y-auto overscroll-contain p-4"
                        action={
                          <button
                            type="button"
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                            onClick={() => setIsCrmCreateOpen(true)}
                          >
                            Create case
                          </button>
                        }
                      >
                        <div className="space-y-4">
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={crmSearch}
                            placeholder="Search group, building, or Leasing Agent"
                            onChange={(event) => setCrmSearch(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") loadCrmCases().catch((error) => setPageError(error.message));
                            }}
                          />
                          <div className="grid gap-2">
                            <select
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              value={crmStatusFilter}
                              onChange={(event) => {
                                setCrmStatusFilter(event.target.value);
                                loadCrmCases({ status: event.target.value }).catch((error) => setPageError(error.message));
                              }}
                            >
                              {(currentUser.role === "super_admin" || currentUser.role === "admin"
                                ? CRM_CASE_FILTER_STATUS_OPTIONS
                                : CRM_CASE_STATUS_OPTIONS
                              ).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            {currentUser.role === "super_admin" ? (
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  ["my", "Mine"],
                                  ["all", "All"],
                                ].map(([value, label]) => (
                                  <button
                                    key={value}
                                    type="button"
                                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                      crmScope === value
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                                    }`}
                                    onClick={() => {
                                      setCrmScope(value);
                                      loadCrmCases({ scope: value }).catch((error) => setPageError(error.message));
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-medium text-slate-600">
                                My cases
                              </div>
                            )}
                            {currentUser.role === "super_admin" && crmScope === "all" ? (
                              <select
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={crmOwnerFilter}
                                onChange={(event) => {
                                  setCrmOwnerFilter(event.target.value);
                                  loadCrmCases({ owner: event.target.value }).catch((error) => setPageError(error.message));
                                }}
                              >
                                <option value="">All support staff</option>
                                {crmOwners.map((owner) => (
                                  <option key={owner.id} value={owner.id}>
                                    {owner.display_name || owner.username}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              onClick={() => loadCrmCases().catch((error) => setPageError(error.message))}
                            >
                              Search / Refresh
                            </button>
                          </div>
                          <div className="space-y-2">
                            {crmCases.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                  selectedCrmCaseId === item.id
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                }`}
                                onClick={() => {
                                  setSelectedCrmCaseId(item.id);
                                  setSelectedCrmTaskId("");
                                  setCrmCaseTab("services");
                                  setIsCrmWorkbenchOpen(false);
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold">{item.group_name}</div>
                                    <div className={`mt-1 text-xs ${selectedCrmCaseId === item.id ? "text-slate-200" : "text-slate-500"}`}>
                                      {item.building_name || "No building linked"}
                                      {item.unit ? ` · Unit ${item.unit}` : ""} · {item.lease_start_date || "No lease start date"}
                                    </div>
                                    <div className={`mt-1 text-xs ${selectedCrmCaseId === item.id ? "text-slate-200" : "text-slate-500"}`}>
                                      Owner: {item.owner_display_name || "Unassigned"}
                                    </div>
                                  </div>
                                  <StatusPill tone={item.open_task_count ? "amber" : "slate"}>
                                    {item.open_task_count || 0}
                                  </StatusPill>
                                </div>
                              </button>
                            ))}
                            {crmCases.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                                No matching CRM cases.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard
                        title="Case Workflow"
                        subtitle="Focus on this case's services, next actions, and essential tasks. Open details only when needed."
                        bodyClassName="p-5"
                        action={
                          selectedCrmCase ? (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {selectedCrmCase.is_deleted ? (
                                <button
                                  type="button"
                                  className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                                  onClick={handleRestoreCrmCase}
                                >
                                  Restore case
                                </button>
                              ) : (
                                <>
                                  <select
                                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    value={selectedCrmCase.status}
                                    onChange={(event) => patchCrmCase({ status: event.target.value }, "Case status updated.")}
                                  >
                                    {CRM_CASE_STATUS_OPTIONS.filter(([value]) => value).map(([value, label]) => (
                                      <option key={value} value={value}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                                    onClick={() => setCrmCaseDeleteDraft({ open: true, reason: "" })}
                                  >
                                    Delete case
                                  </button>
                                </>
                              )}
                            </div>
                          ) : null
                        }
                      >
                        {selectedCrmCase ? (
                          <div className="space-y-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-xl font-semibold text-slate-900">{selectedCrmCase.group_name}</h2>
                                    <StatusPill tone={crmStatusTone(selectedCrmCase.status)}>
                                      {selectedCrmCase.is_deleted
                                        ? "Deleted"
                                        : CRM_CASE_STATUS_LABELS[selectedCrmCase.status] || selectedCrmCase.status}
                                    </StatusPill>
                                    {!selectedCrmCase.building_id ? <StatusPill tone="amber">No building linked</StatusPill> : null}
                                    {selectedCrmCase.building_source === "staging" ? <StatusPill tone="amber">Staging rules</StatusPill> : null}
                                  </div>
                                  <div className="mt-2 text-sm leading-6 text-slate-600">
                                    {selectedCrmCase.building_name || "No building linked"}
                                    {selectedCrmCase.unit ? ` · Unit ${selectedCrmCase.unit}` : ""}
                                    {selectedCrmCase.lease_start_date ? ` · Lease ${selectedCrmCase.lease_start_date}` : ""}
                                  </div>
                                  <div className="mt-1 text-sm leading-6 text-slate-600">
                                    Leasing Agent: {selectedCrmCase.group_creator_name || "Not provided"}
                                    {selectedCrmCase.agent_team_t ? ` / ${selectedCrmCase.agent_team_t}` : ""}
                                    {selectedCrmCase.agent_team_m ? ` / Mentor ${selectedCrmCase.agent_team_m}` : ""}
                                  </div>
                                  <div className="mt-1 text-sm leading-6 text-slate-600">
                                    Support owner: {selectedCrmCase.owner_display_name || currentUser.display_name || currentUser.username}
                                  </div>
                                  {selectedCrmCase.is_deleted ? (
                                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                                      Deleted and archived: {selectedCrmCase.delete_reason || "No reason provided"}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[260px]">
                                  <ReadOnlyMetaRow label="Customer" value={customers.map((item) => item.full_name).filter(Boolean).join(" / ")} />
                                  <ReadOnlyMetaRow label="Time to lease start" value={formatLeaseDays(selectedCrmCase.lease_days_from_today)} />
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                              {[
                                ["services", "Services"],
                                ["tasks", `Case tasks (${currentCaseTasks.length})`],
                                ["timeline", `Timeline (${(selectedCrmCaseDetail.timeline || []).length})`],
                                ["communications", "Communication records"],
                                ["building", "Building / Rules"],
                              ].map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                                    crmCaseTab === value
                                      ? "bg-slate-900 text-white"
                                      : "text-slate-600 hover:bg-slate-100"
                                  }`}
                                  onClick={() => setCrmCaseTab(value)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>

                            {crmCaseTab === "services" ? (
                              <div className="grid gap-3">
                                {(selectedCrmCaseDetail.services || []).map((service) => {
                                  const isSelected = selectedCrmServiceId === service.id && !selectedCrmTaskId;
                                  return (
                                    <CrmCompactServiceCard
                                      key={service.id}
                                      service={service}
                                      customers={customers}
                                      tasks={currentCaseTasks}
                                      isSelected={isSelected}
                                      disabled={isCrmBusy}
                                      onSelect={() => {
                                        setSelectedCrmServiceId(service.id);
                                        setSelectedCrmTaskId("");
                                      }}
                                      onOpenWorkbench={() => {
                                        setSelectedCrmServiceId(service.id);
                                        setSelectedCrmTaskId("");
                                        setIsCrmWorkbenchOpen(true);
                                      }}
                                      onPrimaryAction={() => {
                                        const internetAction = crmInternetActionForService(service, currentCaseTasks);
                                        if (internetAction?.type === "wizard") {
                                          openInternetWizardForService(service, internetAction.phase);
                                          return;
                                        }
                                        setSelectedCrmServiceId(service.id);
                                        setSelectedCrmTaskId("");
                                        setIsCrmWorkbenchOpen(true);
                                      }}
                                      onResponsibleChange={(customerId) =>
                                        handleCrmServicePatch(service, { responsible_customer_id: customerId }, "Service owner updated.")
                                      }
                                      onDraft={() => handleCreateCrmNotificationDraft({ serviceId: service.id })}
                                    />
                                  );
                                })}
                                {(selectedCrmCaseDetail.services || []).length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                                    Link a building or select Generate services / tasks to create service cards.
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {crmCaseTab === "tasks" ? (
                              <div className="space-y-3">
                                {currentCaseTasks.map((task) => (
                                  <button
                                    key={task.id}
                                    type="button"
                                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                      selectedCrmTaskId === task.id
                                        ? "border-slate-900 bg-slate-50"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                                    onClick={() => {
                                      if (crmTaskIsInternetDeferTask(task)) {
                                        handleResumeInternetTask(task);
                                        return;
                                      }
                                      setSelectedCrmTaskId(task.id);
                                      setSelectedCrmServiceId(task.case_service_id || "");
                                      setIsCrmWorkbenchOpen(true);
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                                        <div className="mt-1 text-xs text-slate-500">
                                          {formatDateTime(task.due_at)}
                                          {task.service_name ? ` · ${task.service_name}` : ""}
                                          {task.customer_name ? ` · ${task.customer_name}` : ""}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap justify-end gap-1">
                                        <StatusPill tone={crmStatusTone(task.status)}>
                                          {CRM_TASK_STATUS_LABELS[task.status] || task.status}
                                        </StatusPill>
                                        <StatusPill tone={crmTaskPriorityTone(task.priority)}>
                                          {CRM_TASK_PRIORITY_LABELS[task.priority] || task.priority}
                                        </StatusPill>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                                {currentCaseTasks.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                                    This case has no tasks. Open Task Center for the global daily queue.
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {crmCaseTab === "timeline" ? (
                              <CrmTimelinePanel timeline={selectedCrmCaseDetail.timeline || []} />
                            ) : null}

                            {crmCaseTab === "communications" ? (
                              <div className="space-y-4">
                                <form className="rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleCreateCrmCommunicationEvent}>
                                  <div className="text-sm font-semibold text-slate-900">Add communication record</div>
                                  <textarea
                                    className="mt-3 min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    value={crmCommunicationSummary}
                                    placeholder="Summarize a WeChat group exchange, phone call, or internal note"
                                    onChange={(event) => setCrmCommunicationSummary(event.target.value)}
                                  />
                                  <button
                                    type="submit"
                                    disabled={!crmCommunicationSummary.trim() || isCrmBusy}
                                    className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Save communication
                                  </button>
                                </form>
                                {(selectedCrmCaseDetail.communication_events || []).map((event) => (
                                  <div key={event.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                                    <div className="font-medium text-slate-900">{formatDateTime(event.created_at)} · {crmCommunicationChannelLabel(event.channel)}</div>
                                    <div className="mt-1">{event.summary}</div>
                                    <button
                                      type="button"
                                      disabled={isCrmBusy || !selectedCrmCaseDetail.building_id}
                                      className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                      onClick={() => handleExtractCrmCommunication(event)}
                                    >
                                      Extract as building knowledge
                                    </button>
                                  </div>
                                ))}
                                {(selectedCrmCaseDetail.notifications || []).length ? (
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="text-sm font-semibold text-slate-900">Notification drafts</div>
                                    <div className="mt-3 space-y-2">
                                      {(selectedCrmCaseDetail.notifications || []).map((notification) => (
                                        <div key={notification.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <StatusPill tone={notification.status === "sent" ? "green" : notification.status === "approved" ? "blue" : "amber"}>
                                              {CRM_NOTIFICATION_STATUS_LABELS[notification.status] || notification.status || "Unknown"}
                                            </StatusPill>
                                            <div className="text-xs text-slate-500">{formatDateTime(notification.created_at)}</div>
                                          </div>
                                          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{notification.content}</div>
                                          {notification.status !== "sent" ? (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                              {notification.status === "draft" ? (
                                                <button
                                                  type="button"
                                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                                  onClick={() => handleCrmNotificationAction(notification, "approve")}
                                                >
                                                  Approve
                                                </button>
                                              ) : null}
                                              <button
                                                type="button"
                                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                                onClick={() => handleCrmNotificationAction(notification, "send")}
                                              >
                                                Mark as sent
                                              </button>
                                            </div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {crmCaseTab === "building" ? (
                              <div className="space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-900">Linked Building</div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        Current source: {formatCrmSourceLabel(selectedCrmCase.building_source)}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                      {!selectedCrmCase.building_id ? <StatusPill tone="amber">No building linked</StatusPill> : null}
                                      {selectedCrmCase.building_source === "staging" ? <StatusPill tone="amber">Staging</StatusPill> : null}
                                    </div>
                                  </div>
                                  {!selectedCrmCase.building_id ? (
                                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                                      This older case has no linked building. Link a Master or Staging building, refresh its rules, and generate services / tasks.
                                    </div>
                                  ) : null}
                                  <div className="mt-3 grid gap-2 lg:grid-cols-[120px_minmax(0,1fr)_auto]">
                                    <select
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      value={crmBuildingSource}
                                      onChange={(event) => setCrmBuildingSource(event.target.value)}
                                    >
                                      <option value="master">Master</option>
                                      <option value="staging">Staging</option>
                                    </select>
                                    <input
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      value={crmBuildingSearch}
                                      placeholder="Search by building name or address"
                                      onChange={(event) => setCrmBuildingSearch(event.target.value)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") loadCrmBuildingCandidates().catch((error) => setPageError(error.message));
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                                      onClick={() => loadCrmBuildingCandidates().catch((error) => setPageError(error.message))}
                                    >
                                      Search
                                    </button>
                                  </div>
                                  {crmBuildingCandidates.length ? (
                                    <div className="mt-3 grid gap-2">
                                      {crmBuildingCandidates.slice(0, 6).map((candidate) => (
                                        <button
                                          key={candidate.id}
                                          type="button"
                                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-slate-300"
                                          onClick={() => handleBindCrmBuilding(candidate)}
                                        >
                                          <div className="font-medium text-slate-900">{candidate.building_name}</div>
                                          <div className="mt-1 text-xs text-slate-500">{candidate.address || "Address unknown"}</div>
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                  {selectedCrmCase.building_id ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                        onClick={handleOpenCrmBuildingDetail}
                                      >
                                        Open building details
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                        onClick={handleRefreshCrmSnapshot}
                                      >
                                        Refresh from building knowledge
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                        onClick={handleGenerateCrmServices}
                                      >
                                        Generate services / tasks
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-slate-900">Rule Snapshot</div>
                                    <button
                                      type="button"
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                      onClick={() => setIsCrmSnapshotOpen((prev) => !prev)}
                                    >
                                      {isCrmSnapshotOpen ? "Collapse" : "Expand"}
                                    </button>
                                  </div>
                                  {selectedCrmCase.building_snapshot?.building_name ? (
                                    isCrmSnapshotOpen ? (
                                      <div className="grid gap-3 md:grid-cols-2">
                                        <ReadOnlyMetaRow label="Building" value={selectedCrmCase.building_snapshot.building_name} />
                                        <ReadOnlyMetaRow label="Address" value={selectedCrmCase.building_snapshot.address} />
                                        <ReadOnlyMetaRow
                                          label="Insurance"
                                          value={`${CRM_APPLICABILITY_LABELS[selectedCrmCase.building_snapshot.insurance?.required] || "Needs confirmation"} ${selectedCrmCase.building_snapshot.insurance?.renters_minimum_coverage || ""}`}
                                        />
                                        <ReadOnlyMetaRow
                                          label="Electricity"
                                          value={`${CRM_APPLICABILITY_LABELS[selectedCrmCase.building_snapshot.electricity?.required] || "Needs confirmation"} ${crmProviderLabel(selectedCrmCase.building_snapshot.electricity?.provider)}`}
                                        />
                                        <ReadOnlyMetaRow
                                          label="Internet"
                                          value={`${CRM_APPLICABILITY_LABELS[selectedCrmCase.building_snapshot.internet?.required] || "Needs confirmation"} ${selectedCrmCase.building_snapshot.internet?.providers || ""}`}
                                        />
                                        <ReadOnlyMetaRow label="Move-in notes" value={selectedCrmCase.building_snapshot.move_in?.move_in_notes} />
                                      </div>
                                    ) : (
                                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                                        The current building-rule snapshot is fixed for this case. Expand it when you need to verify the basis.
                                      </div>
                                    )
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                                      Link a Master or Staging building to display its rule snapshot here.
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                            Select or create a case on the left.
                          </div>
                        )}
                      </SectionCard>

                      {isCrmWorkbenchOpen ? (
                        <DrawerPanel
                          title={selectedCrmTask ? "Task Details" : workbenchService ? workbenchService.service_name : "Current Case Context"}
                          subtitle={selectedCrmTask ? "Handle the current task without leaving the case workflow." : "Service status, owner, related tasks, and advanced actions."}
                          onClose={() => setIsCrmWorkbenchOpen(false)}
                        >
                        {selectedCrmTask ? (
                          <CrmTaskDetailPanel task={selectedCrmTask} caseDetail={selectedCrmCaseDetail} {...taskActionHandlers} />
                        ) : workbenchService ? (
                          <div className="space-y-4">
                            <div>
                              <div className="text-base font-semibold text-slate-900">{workbenchService.service_name}</div>
                              <div className="mt-1 text-sm leading-6 text-slate-500">
                                {workbenchService.template?.description || "Service instance details"}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <StatusPill tone={crmApplicabilityTone(workbenchService.applicability)}>
                                  {CRM_APPLICABILITY_LABELS[workbenchService.applicability] || workbenchService.applicability}
                                </StatusPill>
                                <StatusPill tone="slate">
                                  {CRM_SCOPE_LABELS[workbenchService.service_scope] || workbenchService.service_scope}
                                </StatusPill>
                              </div>
                            </div>
                            {crmIsInternetService(workbenchService) ? (
                              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                                <div className="mb-3">
                                  <div className="text-sm font-semibold text-slate-900">Workflow Status</div>
                                  <div className="mt-1 text-xs leading-5 text-slate-500">
                                    For internet setup, start here. Updating the staff workflow advances the customer workflow in one direction.
                                  </div>
                                </div>
                                <CrmServiceStatusGrid
                                  service={workbenchService}
                                  onPatch={handleCrmServicePatch}
                                  disabled={isCrmBusy || workbenchServiceClosed}
                                />
                              </div>
                            ) : null}
                            {crmIsInternetService(workbenchService) ? (
                              <CrmInternetNextActionPanel
                                service={workbenchService}
                                customers={customers}
                                tasks={currentCaseTasks}
                                disabled={isCrmBusy || workbenchServiceClosed}
                                onPrimaryAction={() => {
                                  const internetAction = crmInternetActionForService(workbenchService, currentCaseTasks);
                                  if (internetAction?.type === "wizard") {
                                    openInternetWizardForService(workbenchService, internetAction.phase);
                                  }
                                }}
                                onDefer={(phase) => handleOpenInternetDeferDrawer(workbenchService, phase)}
                                onResponsibleChange={(customerId) =>
                                  handleCrmServicePatch(workbenchService, { responsible_customer_id: customerId }, "Service owner updated.")
                                }
                              />
                            ) : null}
                            <div className={`${crmIsInternetService(workbenchService) ? "hidden " : ""}rounded-2xl border border-slate-200 bg-slate-50 p-4`}>
                              <div className="text-sm font-semibold text-slate-900">Rule Source</div>
                              <div className="mt-3 grid gap-2">
                                <ReadOnlyMetaRow label="Building source" value={formatCrmSourceLabel(selectedCrmCase?.building_source)} />
                                <ReadOnlyMetaRow label="Building" value={selectedCrmCase?.building_name || selectedCrmCase?.building_snapshot?.building_name} />
                                <ReadOnlyMetaRow label="Service template" value={workbenchService.template?.name || workbenchService.service_key} />
                                {crmServiceDeliveryModeLabel(workbenchService) ? (
                                  <ReadOnlyMetaRow label="Delivery model" value={crmServiceDeliveryModeLabel(workbenchService)} />
                                ) : null}
                              </div>
                            </div>
                            {crmIsInternetService(workbenchService) ? (
                              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Rule Source</summary>
                                <div className="mt-3 grid gap-2">
                                  <ReadOnlyMetaRow label="Building source" value={formatCrmSourceLabel(selectedCrmCase?.building_source)} />
                                  <ReadOnlyMetaRow label="Building" value={selectedCrmCase?.building_name || selectedCrmCase?.building_snapshot?.building_name} />
                                  <ReadOnlyMetaRow label="Service template" value={workbenchService.template?.name || workbenchService.service_key} />
                                  {crmServiceDeliveryModeLabel(workbenchService) ? (
                                    <ReadOnlyMetaRow label="Delivery model" value={crmServiceDeliveryModeLabel(workbenchService)} />
                                  ) : null}
                                </div>
                              </details>
                            ) : null}
                            {!crmIsInternetService(workbenchService) ? (
                              <CrmServiceStatusGrid service={workbenchService} onPatch={handleCrmServicePatch} disabled={isCrmBusy || workbenchServiceClosed} />
                            ) : null}
                            {workbenchServiceClosed ? (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                                <div>This service is closed. The details remain available for review.</div>
                                <button
                                  type="button"
                                  disabled={isCrmBusy}
                                  className="mt-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() =>
                                    handleCrmServicePatch(workbenchService, crmReopenServicePatch(workbenchService), "Service reopened and ready to continue.")
                                  }
                                >
                                  Reopen service
                                </button>
                              </div>
                            ) : null}
                            {!crmIsInternetService(workbenchService) && crmRequiredFieldsForServiceStep(workbenchService).length ? (
                              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                                <div className="font-semibold">Required information for this step</div>
                                <div className="mt-1 text-xs text-blue-800">
                                  {crmRequiredFieldsForServiceStep(workbenchService).join(" / ")}
                                </div>
                              </div>
                            ) : null}
                            {workbenchService.termination_reason ? (
                              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
                                <div className="font-semibold">Termination reason</div>
                                <div className="mt-1">{workbenchService.termination_reason}</div>
                              </div>
                            ) : null}
                            <CrmCustomerLevelProgressPanel
                              service={workbenchService}
                              customers={customers}
                              disabled={isCrmBusy || workbenchServiceClosed}
                              onPatch={handleCrmGuestServiceValuePatch}
                              onCreateFollowUp={(payload) =>
                                handleCreateCrmFollowUpTask({
                                  caseId: selectedCrmCaseId,
                                  ...payload,
                                })
                              }
                            />
                            {workbenchService.service_scope === "case_level" && !crmIsInternetService(workbenchService) ? (
                              <div className={`rounded-2xl border p-4 ${
                                crmServiceResponsibilityRequired(workbenchService) && !workbenchService.responsible_customer_id
                                  ? "border-amber-200 bg-amber-50"
                                  : "border-slate-200 bg-slate-50"
                              }`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">Case-wide Service Owner</div>
                                    <div className="mt-1 text-xs leading-5 text-slate-500">
                                      Covered customers: {crmCoveredCustomerLabels(customers, workbenchService).join(" / ") || "No customers"}
                                    </div>
                                  </div>
                                  <StatusPill tone={workbenchService.responsible_customer_id ? "green" : "amber"}>
                                    {CRM_RESPONSIBILITY_STATUS_LABELS[workbenchService.responsibility_status] || CRM_RESPONSIBILITY_STATUS_LABELS.unassigned}
                                  </StatusPill>
                                </div>
                                {crmServiceResponsibilityRequired(workbenchService) && !workbenchService.responsible_customer_id ? (
                                  <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-amber-800">
                                    Introducing the service to the group does not assign an owner. Select one customer owner before completing the workflow.
                                  </div>
                                ) : null}
                                <label className="mt-3 block">
                                  <span className="mb-1 block text-xs font-medium text-slate-500">
                                    {workbenchService.responsible_customer_id ? "Change owner" : "Assign owner"}
                                  </span>
                                  <select
                                    disabled={isCrmBusy || !crmServiceResponsibilityRequired(workbenchService)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    value={workbenchService.responsible_customer_id || ""}
                                    onChange={(event) =>
                                      handleCrmServicePatch(workbenchService, { responsible_customer_id: event.target.value }, "Service owner updated.")
                                    }
                                  >
                                    <option value="">Select owner</option>
                                    {customers.map((customer) => (
                                      <option key={customer.id} value={customer.id}>
                                        {customer.full_name || customer.wechat || customer.id}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            ) : null}
                            {crmIsInternetService(workbenchService) ? (
                              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Blocker Notes</summary>
                                <label className="mt-3 block">
                                  <span className="mb-1 block text-xs font-medium text-slate-500">Blocker notes</span>
                                  <input
                                    key={`${workbenchService.id}-blocked-reason`}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    disabled={isCrmBusy || workbenchServiceClosed}
                                    defaultValue={workbenchService.blocked_reason || ""}
                                    placeholder="Leave blank if there is no blocker"
                                    onBlur={(event) => {
                                      if (event.target.value !== (workbenchService.blocked_reason || "")) {
                                        handleCrmServicePatch(workbenchService, { blocked_reason: event.target.value });
                                      }
                                    }}
                                  />
                                </label>
                              </details>
                            ) : (
                              <label className="block">
                                <span className="mb-1 block text-xs font-medium text-slate-500">Blocker notes</span>
                                <input
                                  key={`${workbenchService.id}-blocked-reason`}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  disabled={isCrmBusy || workbenchServiceClosed}
                                  defaultValue={workbenchService.blocked_reason || ""}
                                  placeholder="Leave blank if there is no blocker"
                                  onBlur={(event) => {
                                    if (event.target.value !== (workbenchService.blocked_reason || "")) {
                                      handleCrmServicePatch(workbenchService, { blocked_reason: event.target.value });
                                    }
                                  }}
                                />
                              </label>
                            )}
                            <div className={crmIsInternetService(workbenchService) ? "hidden" : ""}>
                              <div className="mb-2 text-sm font-semibold text-slate-900">Related Tasks</div>
                              <div className="space-y-2">
                                {crmTasksForService(workbenchService, currentCaseTasks).slice(0, 5).map((task) => (
                                  <button
                                    key={task.id}
                                    type="button"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-slate-300"
                                    onClick={() => {
                                      setSelectedCrmTaskId(task.id);
                                      setSelectedCrmServiceId(task.case_service_id || "");
                                      setIsCrmWorkbenchOpen(true);
                                    }}
                                  >
                                    <div className="font-semibold text-slate-900">{task.title}</div>
                                    <div className="mt-1">{formatDateTime(task.due_at)} · {CRM_TASK_STATUS_LABELS[task.status] || task.status}</div>
                                  </button>
                                ))}
                                {crmTasksForService(workbenchService, currentCaseTasks).length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
                                    No related tasks.
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            {crmIsInternetService(workbenchService) ? (
                              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Related Tasks</summary>
                                <div className="mt-3 space-y-2">
                                  {crmTasksForService(workbenchService, currentCaseTasks).slice(0, 8).map((task) => (
                                    <button
                                      key={task.id}
                                      type="button"
                                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-slate-300"
                                      onClick={() => {
                                        setSelectedCrmTaskId(task.id);
                                        setSelectedCrmServiceId(task.case_service_id || "");
                                        setIsCrmWorkbenchOpen(true);
                                      }}
                                    >
                                      <div className="font-semibold text-slate-900">{task.title}</div>
                                      <div className="mt-1">{formatDateTime(task.due_at)} · {CRM_TASK_STATUS_LABELS[task.status] || task.status}</div>
                                    </button>
                                  ))}
                                  {crmTasksForService(workbenchService, currentCaseTasks).length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
                                      No related tasks.
                                    </div>
                                  ) : null}
                                </div>
                              </details>
                            ) : null}
                            {!workbenchServiceClosed ? (
                            <div className={`${crmIsInternetService(workbenchService) ? "hidden " : ""}flex flex-wrap gap-2`}>
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() =>
                                  handleCrmServicePatch(workbenchService, {
                                    active_flow_step_key: crmFlowStepKeyForStaffStatus(workbenchService, "introduced") || workbenchService.active_flow_step_key,
                                  })
                                }
                              >
                                Mark introduced
                              </button>
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() =>
                                  handleCrmServicePatch(workbenchService, {
                                    active_flow_step_key:
                                      crmFlowStepKeyForStaffStatus(workbenchService, "info_collected") || workbenchService.active_flow_step_key,
                                  })
                                }
                              >
                                Mark information collected
                              </button>
                              <button
                                type="button"
                                disabled={crmServiceResponsibilityRequired(workbenchService) && !workbenchService.responsible_customer_id}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() =>
                                  handleCrmServicePatch(workbenchService, {
                                    active_flow_step_key: crmFlowStepKeyForStaffStatus(workbenchService, "completed") || workbenchService.active_flow_step_key,
                                  })
                                }
                              >
                                Mark complete
                              </button>
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() => handleCreateCrmFollowUpTask({ serviceId: workbenchService.id, title: `Follow up: ${workbenchService.service_name}` })}
                              >
                                Create follow-up task
                              </button>
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() => handleCreateCrmNotificationDraft({ serviceId: workbenchService.id })}
                              >
                                Generate notification draft
                              </button>
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() =>
                                  handleCrmServicePatch(
                                    workbenchService,
                                    {
                                      applicability: "required",
                                      customer_flow_status: "waiting_intro",
                                      active_flow_step_key:
                                        crmFlowStepKeyForStaffStatus(workbenchService, "not_introduced") || workbenchService.active_flow_step_key,
                                      service_status: "pending",
                                    },
                                    "Manually overridden to Required."
                                  )
                                }
                              >
                                Override system decision
                              </button>
                            </div>
                            ) : null}
                            {crmIsInternetService(workbenchService) && !workbenchServiceClosed ? (
                              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Advanced Actions</summary>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                    onClick={() =>
                                      handleCrmServicePatch(workbenchService, {
                                        active_flow_step_key: crmFlowStepKeyForStaffStatus(workbenchService, "introduced") || workbenchService.active_flow_step_key,
                                      })
                                    }
                                  >
                                    Mark introduced
                                  </button>
                                  <button
                                    type="button"
                                    disabled={crmServiceResponsibilityRequired(workbenchService) && !workbenchService.responsible_customer_id}
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() =>
                                      handleCrmServicePatch(workbenchService, {
                                        active_flow_step_key: crmFlowStepKeyForStaffStatus(workbenchService, "completed") || workbenchService.active_flow_step_key,
                                      })
                                    }
                                  >
                                    Mark complete
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                    onClick={() => handleCreateCrmFollowUpTask({ serviceId: workbenchService.id, title: `Follow up: ${workbenchService.service_name}` })}
                                  >
                                    Create follow-up task
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                    onClick={() => handleCreateCrmNotificationDraft({ serviceId: workbenchService.id })}
                                  >
                                    Generate notification draft
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                    onClick={() =>
                                      handleCrmServicePatch(
                                        workbenchService,
                                        {
                                          applicability: "required",
                                          customer_flow_status: "waiting_intro",
                                          active_flow_step_key:
                                            crmFlowStepKeyForStaffStatus(workbenchService, "not_introduced") || workbenchService.active_flow_step_key,
                                          service_status: "pending",
                                        },
                                        "Manually overridden to Required."
                                      )
                                    }
                                  >
                                    Override system decision
                                  </button>
                                </div>
                              </details>
                            ) : null}
                          </div>
                        ) : selectedCrmCase ? (
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-sm font-semibold text-slate-900">Today's Tasks for This Case</div>
                              <div className="mt-3 space-y-2">
                                {currentCaseTodayTasks.slice(0, 4).map((task) => (
                                  <button
                                    key={task.id}
                                    type="button"
                                    className="w-full rounded-xl bg-white px-3 py-2 text-left text-xs text-slate-600"
                                    onClick={() => {
                                      setSelectedCrmTaskId(task.id);
                                      setSelectedCrmServiceId(task.case_service_id || "");
                                      setIsCrmWorkbenchOpen(true);
                                    }}
                                  >
                                    {task.title}
                                  </button>
                                ))}
                                {currentCaseTodayTasks.length === 0 ? <div className="text-sm text-slate-500">No tasks for this case today.</div> : null}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-sm font-semibold text-slate-900">Overdue / Risk Alerts</div>
                              <div className="mt-3 space-y-2">
                                {[...currentCaseOverdueTasks, ...riskTasks].slice(0, 5).map((task) => (
                                  <button
                                    key={`${task.id}-risk`}
                                    type="button"
                                    className="w-full rounded-xl bg-white px-3 py-2 text-left text-xs text-slate-600"
                                    onClick={() => {
                                      setSelectedCrmTaskId(task.id);
                                      setSelectedCrmServiceId(task.case_service_id || "");
                                      setIsCrmWorkbenchOpen(true);
                                    }}
                                  >
                                    {task.title} · {CRM_TASK_PRIORITY_LABELS[task.priority] || task.priority}
                                  </button>
                                ))}
                                {currentCaseOverdueTasks.length + riskTasks.length === 0 ? <div className="text-sm text-slate-500">No risk alerts.</div> : null}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                            Select a case to see contextual actions.
                          </div>
                        )}
                        </DrawerPanel>
                      ) : null}
                    </div>
                  </div>
                );
              })()
            ) : null}

            {activeTab === "tasks" ? (
              (() => {
                const selectedTaskCaseDetail =
                  selectedGlobalTask?.case_id && selectedCrmCaseDetail?.case?.id === selectedGlobalTask.case_id
                    ? selectedCrmCaseDetail
                    : null;
                const taskActionHandlers = {
                  onComplete: (task) => handleCrmTaskStatus(task, "completed"),
                  onDelay: (task) => handleDelayCrmTask(task),
                  onFollowUp: (task) =>
                    handleCreateCrmFollowUpTask({
                      caseId: task.case_id,
                      serviceId: task.case_service_id,
                      customerId: task.target_customer_id || task.customer_id,
                      title: `Continue follow-up - ${task.service_name || task.title}`,
                    }),
                  onDraft: (task) =>
                    handleCreateCrmNotificationDraft({
                      caseId: task.case_id,
                      taskId: task.id,
                      serviceId: task.case_service_id,
                    }),
                  onResumeInternet: handleResumeInternetTask,
                  onViewCase: handleViewCrmTaskCase,
                };
                const openGlobalTask = (task) => {
                  if (crmTaskIsInternetDeferTask(task)) {
                    handleResumeInternetTask(task);
                    return;
                  }
                  setSelectedGlobalTask(task);
                  setSelectedCrmTaskId(task.id);
                  if (task.case_id) {
                    setSelectedCrmCaseId(task.case_id);
                    loadCrmCaseDetail(task.case_id).catch((error) =>
                      setPageError(error.message || "Could not load the case for this task.")
                    );
                  }
                };
                const calendarTasks = crmCalendarTasksForScope(crmGlobalTasks, calendarTaskScope);
                const taskCalendarTasksByDate = crmTasksByDate(calendarTasks);
                const activeCalendarDate =
                  taskCenterTab === "calendar" && calendarMode === "month"
                    ? hoveredCalendarDate || selectedCalendarDate
                    : "";
                const activeCalendarTasks = activeCalendarDate
                  ? taskCalendarTasksByDate[activeCalendarDate] || []
                  : [];
                const showCalendarDayPanel = Boolean(activeCalendarDate && (!selectedGlobalTask || hoveredCalendarDate));
                const handleSelectCalendarDate = (dateKey) => {
                  setSelectedCalendarDate(dateKey);
                  setSelectedGlobalTask(null);
                  setSelectedCrmTaskId("");
                };
                const handleCalendarMonthChange = (offset) => {
                  setCalendarMonth((current) => {
                    const next = new Date(current);
                    next.setDate(1);
                    next.setMonth(next.getMonth() + offset);
                    return next;
                  });
                };
                const handleCalendarToday = () => {
                  const today = new Date();
                  setCalendarMonth(today);
                  setSelectedCalendarDate(crmDateKey(today));
                  setSelectedGlobalTask(null);
                  setSelectedCrmTaskId("");
                };
                const applyTaskFilterPatch = (patch) => {
                  const nextFilters = { ...taskFilters, ...patch };
                  setTaskFilters(nextFilters);
                  return nextFilters;
                };
                const resetTaskFilters = {
                  scope: "critical",
                  assigned_to: "",
                  status: "",
                  service_type: "",
                  priority: "",
                  date_from: "",
                  date_to: "",
                  case_status: "",
                  overdue: "",
                  mine: "",
                };
                return (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      {[
                        ["Due today", crmTaskStats.today || 0, "blue"],
                        ["Overdue", crmTaskStats.overdue || 0, "red"],
                        ["Next 7 days", crmTaskStats.next_7_days || 0, "amber"],
                        ["High priority", crmTaskStats.high_priority || 0, "amber"],
                        ["Waiting for customer", crmTaskStats.waiting_customer || 0, "slate"],
                        ["Waiting for third party", crmTaskStats.waiting_external || 0, "slate"],
                      ].map(([label, value, tone]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="text-xs font-medium text-slate-500">{label}</div>
                          <div className="mt-2 flex items-end justify-between gap-3">
                            <div className="text-2xl font-semibold text-slate-900">{value}</div>
                            <StatusPill tone={tone}>{label}</StatusPill>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                      <div className="space-y-4">
                        <SectionCard
                          title="Global Filters"
                          subtitle="Task List and Calendar use the same crm_tasks data."
                          action={
                            <button
                              type="button"
                              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                              onClick={() => loadCrmTasks(taskFilters).catch((error) => setPageError(error.message))}
                            >
                              Apply filters
                            </button>
                          }
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Task Center Scope</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Critical items include insurance deadlines, internet verification-code appointments, SIM-card dispatch records, and manual follow-ups. Routine introduction steps stay out of the daily queue.
                              </div>
                            </div>
                            <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 text-xs">
                              {[
                                ["critical", "Critical tasks / records"],
                                ["all", "All tasks"],
                              ].map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                                    taskFilters.scope === value
                                      ? "bg-slate-900 text-white"
                                      : "text-slate-600 hover:bg-slate-50"
                                  }`}
                                  onClick={() => {
                                    const nextFilters = applyTaskFilterPatch({ scope: value });
                                    setCalendarTaskScope(value === "all" ? "all" : "critical");
                                    loadCrmTasks(nextFilters).catch((error) => setPageError(error.message));
                                  }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Owner</span>
                              <select
                                disabled={currentUser.role !== "super_admin"}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
                                value={currentUser.role === "super_admin" ? taskFilters.assigned_to : ""}
                                onChange={(event) => applyTaskFilterPatch({ assigned_to: event.target.value })}
                              >
                                <option value="">{currentUser.role === "super_admin" ? "All owners" : "My tasks"}</option>
                                {currentUser.role === "super_admin"
                                  ? crmTaskOwners.map((owner) => (
                                      <option key={owner.id} value={owner.id}>
                                        {owner.display_name || owner.username}
                                      </option>
                                    ))
                                  : null}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Task status</span>
                              <select
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={taskFilters.status}
                                onChange={(event) => applyTaskFilterPatch({ status: event.target.value })}
                              >
                                <option value="">All statuses</option>
                                {Object.entries(CRM_TASK_STATUS_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Service type</span>
                              <select
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={taskFilters.service_type}
                                onChange={(event) => applyTaskFilterPatch({ service_type: event.target.value })}
                              >
                                <option value="">All services</option>
                                {crmTemplates.map((template) => (
                                  <option key={template.service_key || template.id} value={template.service_key}>
                                    {template.name || crmServiceLabel(template.service_key)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Priority</span>
                              <select
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={taskFilters.priority}
                                onChange={(event) => applyTaskFilterPatch({ priority: event.target.value })}
                              >
                                <option value="">All priorities</option>
                                {Object.entries(CRM_TASK_PRIORITY_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Start date</span>
                              <input
                                type="date"
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={taskFilters.date_from}
                                onChange={(event) => applyTaskFilterPatch({ date_from: event.target.value })}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">End date</span>
                              <input
                                type="date"
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={taskFilters.date_to}
                                onChange={(event) => applyTaskFilterPatch({ date_to: event.target.value })}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Case status</span>
                              <select
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={taskFilters.case_status}
                                onChange={(event) => applyTaskFilterPatch({ case_status: event.target.value })}
                              >
                                <option value="">All cases</option>
                                {CRM_CASE_STATUS_OPTIONS.filter(([value]) => value).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Overdue</span>
                              <select
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={taskFilters.overdue}
                                onChange={(event) => applyTaskFilterPatch({ overdue: event.target.value })}
                              >
                                <option value="">All</option>
                                <option value="1">Overdue only</option>
                                <option value="0">Exclude overdue</option>
                              </select>
                            </label>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            {currentUser.role === "super_admin" ? (
                              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={taskFilters.mine === "1"}
                                  onChange={(event) => applyTaskFilterPatch({ mine: event.target.checked ? "1" : "" })}
                                />
                                Assigned to me
                              </label>
                            ) : (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                Staff view shows only tasks assigned to the current user.
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() => {
                                  setTaskFilters(resetTaskFilters);
                                  loadCrmTasks(resetTaskFilters).catch((error) => setPageError(error.message));
                                }}
                              >
                                Clear filters
                              </button>
                              <button
                                type="button"
                                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                                onClick={() => loadCrmTasks(taskFilters).catch((error) => setPageError(error.message))}
                              >
                                Refresh tasks
                              </button>
                            </div>
                          </div>
                        </SectionCard>

                        <SectionCard
                          title="Task Center"
                          subtitle={`${crmGlobalTasks.length} tasks; Task List and Calendar are two views of the same data.`}
                          bodyClassName="p-0"
                          action={
                            <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 text-xs">
                              {[
                                ["list", "Task list"],
                                ["calendar", "Calendar"],
                                ["kanban", "Kanban"],
                              ].map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                                    taskCenterTab === value
                                      ? "bg-slate-900 text-white"
                                      : "text-slate-600 hover:bg-slate-50"
                                  }`}
                                  onClick={() => setTaskCenterTab(value)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          }
                        >
                          {taskCenterTab === "list" ? (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                                  <tr>
                                    <th className="px-4 py-3">Task</th>
                                    <th className="px-4 py-3">WeChat Group / Case</th>
                                    <th className="px-4 py-3">Service / Customer</th>
                                    <th className="px-4 py-3">Owner</th>
                                    <th className="px-4 py-3">Due</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                  {crmGlobalTasks.map((task) => (
                                    <tr
                                      key={task.id}
                                      className={`cursor-pointer transition hover:bg-slate-50 ${
                                        selectedGlobalTask?.id === task.id ? "bg-slate-50" : ""
                                      }`}
                                      onClick={() => openGlobalTask(task)}
                                    >
                                      <td className="max-w-[280px] px-4 py-3 align-top">
                                        <div className="font-semibold text-slate-900">{task.title}</div>
                                        {task.description ? <div className="mt-1 text-xs leading-5 text-slate-500">{task.description}</div> : null}
                                      </td>
                                      <td className="px-4 py-3 align-top">
                                        <div className="font-medium text-slate-800">{crmTaskCaseLabel(task)}</div>
                                        <div className="mt-1 text-xs text-slate-500">
                                          {task.case_building_name || "No building linked"}
                                          {task.case_unit ? ` · Unit ${task.case_unit}` : ""}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 align-top">
                                        <div className="font-medium text-slate-800">{task.service_name || crmServiceLabel(task.service_type)}</div>
                                        <div className="mt-1 text-xs text-slate-500">{crmTaskTargetLabel(task)}</div>
                                      </td>
                                      <td className="px-4 py-3 align-top text-slate-600">{crmTaskAssigneeLabel(task)}</td>
                                      <td className="px-4 py-3 align-top">
                                        <div className="text-slate-700">{formatDateTime(task.due_at)}</div>
                                        {task.is_overdue ? <div className="mt-1 text-xs font-medium text-rose-600">Overdue</div> : null}
                                      </td>
                                      <td className="px-4 py-3 align-top">
                                        <div className="flex flex-wrap gap-1">
                                          <StatusPill tone={crmTaskPriorityTone(task.priority)}>
                                            {CRM_TASK_PRIORITY_LABELS[task.priority] || task.priority}
                                          </StatusPill>
                                          <StatusPill tone={crmStatusTone(task.status)}>
                                            {CRM_TASK_STATUS_LABELS[task.status] || task.status}
                                          </StatusPill>
                                          <StatusPill tone={crmStatusTone(task.case_status)}>
                                            {CRM_CASE_STATUS_LABELS[task.case_status] || task.case_status}
                                          </StatusPill>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 align-top">
                                        <CrmTaskInlineActions task={task} {...taskActionHandlers} />
                                      </td>
                                    </tr>
                                  ))}
                                  {crmGlobalTasks.length === 0 ? (
                                    <tr>
                                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                                        No matching tasks.
                                      </td>
                                    </tr>
                                  ) : null}
                                </tbody>
                              </table>
                            </div>
                          ) : null}

                          {taskCenterTab === "calendar" ? (
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                                <div className="text-sm text-slate-500">
                                  <div>
                                    The calendar currently shows {calendarTasks.length} tasks; Task List retains all {crmGlobalTasks.length} tasks.
                                  </div>
                                  <div className="mt-1">
                                    {calendarTaskScope === "critical"
                                      ? "The default view includes insurance deadlines, internet verification-code appointments, SIM-card dispatch records, and manually created follow-up reminders."
                                      : "This view includes all tasks, including electricity, mobile service, and routine checks."}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 text-xs">
                                    {[
                                      ["critical", "Critical tasks / records"],
                                      ["all", "All tasks"],
                                    ].map(([value, label]) => (
                                      <button
                                        key={value}
                                        type="button"
                                        className={`rounded-lg px-3 py-1.5 font-medium transition ${
                                          calendarTaskScope === value
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-600 hover:bg-slate-50"
                                        }`}
                                        onClick={() => {
                                          setCalendarTaskScope(value);
                                          const nextFilters = applyTaskFilterPatch({ scope: value === "all" ? "all" : "critical" });
                                          loadCrmTasks(nextFilters).catch((error) => setPageError(error.message));
                                          setHoveredCalendarDate("");
                                          setSelectedCalendarDate("");
                                          setSelectedGlobalTask(null);
                                        }}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 text-xs">
                                    {[
                                      ["bucket", "Schedule list"],
                                      ["month", "Month view"],
                                    ].map(([value, label]) => (
                                      <button
                                        key={value}
                                        type="button"
                                        className={`rounded-lg px-3 py-1.5 font-medium transition ${
                                          calendarMode === value
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-600 hover:bg-slate-50"
                                        }`}
                                        onClick={() => setCalendarMode(value)}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              {calendarMode === "bucket" ? (
                                <div className="grid gap-4 p-5 lg:grid-cols-2">
                                  {crmCalendarBuckets(calendarTasks).map((bucket) => (
                                    <div key={bucket.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-slate-900">{bucket.title}</div>
                                        <StatusPill tone={bucket.key === "overdue" ? "red" : "slate"}>{bucket.tasks.length}</StatusPill>
                                      </div>
                                      <div className="space-y-2">
                                        {bucket.tasks.map((task) => (
                                          <button
                                            key={`${bucket.key}-${task.id}`}
                                            type="button"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300"
                                            onClick={() => openGlobalTask(task)}
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div>
                                                <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                  {crmTaskCaseLabel(task)} · {task.service_name || crmServiceLabel(task.service_type)}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                  {formatDateTime(task.due_at)} · {crmTaskAssigneeLabel(task)}
                                                </div>
                                              </div>
                                              <div className="flex flex-col items-end gap-1">
                                                <StatusPill tone={crmTaskPriorityTone(task.priority)}>
                                                  {CRM_TASK_PRIORITY_LABELS[task.priority] || task.priority}
                                                </StatusPill>
                                                <StatusPill tone={crmStatusTone(task.status)}>
                                                  {CRM_TASK_STATUS_LABELS[task.status] || task.status}
                                                </StatusPill>
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                        {bucket.tasks.length === 0 ? (
                                          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-sm text-slate-500">
                                            No tasks in this period.
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <CrmMonthCalendarView
                                  tasks={calendarTasks}
                                  calendarMonth={calendarMonth}
                                  selectedDate={selectedCalendarDate}
                                  hoveredDate={hoveredCalendarDate}
                                  onMonthChange={handleCalendarMonthChange}
                                  onToday={handleCalendarToday}
                                  onHoverDate={setHoveredCalendarDate}
                                  onLeaveDate={() => setHoveredCalendarDate("")}
                                  onSelectDate={handleSelectCalendarDate}
                                  onOpenTask={openGlobalTask}
                                />
                              )}
                            </div>
                          ) : null}

                          {taskCenterTab === "kanban" ? (
                            <div className="p-5">
                              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                                Kanban is reserved for a later release. The MVP uses one task dataset for both list and calendar views.
                              </div>
                            </div>
                          ) : null}
                        </SectionCard>
                      </div>

                      <SectionCard
                        title={showCalendarDayPanel ? "Tasks for This Day" : "Task Details"}
                        subtitle={
                          showCalendarDayPanel
                            ? "Task preview and fixed checklist for the selected calendar date."
                            : "Both list and calendar views open the same detail panel."
                        }
                        className="xl:sticky xl:top-4"
                        bodyClassName="max-h-[76vh] overflow-y-auto overscroll-contain p-5"
                      >
                        {showCalendarDayPanel ? (
                          <CrmCalendarDayTasksPanel
                            dateKey={activeCalendarDate}
                            tasks={activeCalendarTasks}
                            onOpenTask={openGlobalTask}
                            taskActionHandlers={taskActionHandlers}
                            preview={Boolean(hoveredCalendarDate)}
                            quickFollowUpInputs={quickFollowUpInputs}
                            onQuickFollowUpChange={(taskId, value) =>
                              setQuickFollowUpInputs((prev) => ({ ...prev, [taskId]: value }))
                            }
                            onQuickFollowUpSubmit={handleCreateCalendarQuickFollowUp}
                            disabled={isCrmBusy}
                          />
                        ) : selectedGlobalTask ? (
                          <CrmTaskDetailPanel task={selectedGlobalTask} caseDetail={selectedTaskCaseDetail} {...taskActionHandlers} />
                        ) : (
                          <CrmTaskDetailPanel task={null} caseDetail={selectedTaskCaseDetail} {...taskActionHandlers} />
                        )}
                      </SectionCard>
                    </div>
                  </div>
                );
              })()
            ) : null}

            {activeTab === "crm_data" && currentUser.role === "super_admin" ? (
              (() => {
                const stats = crmAnalytics?.stats || {};
                const owners = crmAnalytics?.owners || crmTaskOwners || [];
                const updateAnalyticsFilter = (patch) => {
                  const nextFilters = { ...crmAnalyticsFilters, ...patch };
                  setCrmAnalyticsFilters(nextFilters);
                  return nextFilters;
                };
                const resetAnalyticsFilters = {
                  owner_user_id: "",
                  case_status: "",
                  service_type: "",
                  building_source: "",
                  date_from: "",
                  date_to: "",
                };
                const taskMiniList = (items = [], emptyText = "No data") => (
                  <div className="space-y-2">
                    {items.slice(0, 8).map((task) => (
                      <div key={task.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {task.case_group_name || "No linked case"} · {task.service_name || crmServiceLabel(task.service_key)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDateTime(task.due_at)} · {task.assigned_to || "Unassigned"}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusPill tone={crmTaskPriorityTone(task.priority)}>{task.priority_label || CRM_TASK_PRIORITY_LABELS[task.priority]}</StatusPill>
                            <StatusPill tone={crmStatusTone(task.status)}>{task.status_label || CRM_TASK_STATUS_LABELS[task.status]}</StatusPill>
                          </div>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">{emptyText}</div>
                    ) : null}
                  </div>
                );
                return (
                  <div className="space-y-4">
                    <SectionCard
                      title="CRM Data Center"
                      subtitle="Visible only to Super Admins. Use it for operational review, lightweight reporting, and Excel export; bulk editing is not available here."
                      action={
                        <button
                          type="button"
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          onClick={handleCrmExcelDownload}
                        >
                          Download CRM Excel Report
                        </button>
                      }
                    >
                      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                          ["Total cases", stats.total_cases || 0, "slate"],
                          ["Active cases", stats.active_cases || 0, "blue"],
                          ["Completed cases", stats.completed_cases || 0, "green"],
                          ["Overdue tasks", stats.overdue_tasks || 0, "red"],
                          ["High-priority tasks", stats.high_priority_tasks || 0, "amber"],
                          ["At-risk services", stats.risk_services || 0, "red"],
                        ].map(([label, value, tone]) => (
                          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-xs font-medium text-slate-500">{label}</div>
                            <div className="mt-2 flex items-end justify-between gap-3">
                              <div className="text-2xl font-semibold text-slate-900">{value}</div>
                              <StatusPill tone={tone}>{label}</StatusPill>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    <SectionCard
                      title="Filters"
                      subtitle="Filters affect both on-screen metrics and the downloaded Excel report. Date ranges use case creation dates and task due dates."
                      action={
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            onClick={() => {
                              setCrmAnalyticsFilters(resetAnalyticsFilters);
                              loadCrmAnalytics(resetAnalyticsFilters).catch((error) => setPageError(error.message));
                            }}
                          >
                            Clear filters
                          </button>
                          <button
                            type="button"
                            disabled={isCrmAnalyticsLoading}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => loadCrmAnalytics(crmAnalyticsFilters).catch((error) => setPageError(error.message))}
                          >
                            {isCrmAnalyticsLoading ? "Loading" : "Apply filters"}
                          </button>
                        </div>
                      }
                    >
                      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Owner</span>
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={crmAnalyticsFilters.owner_user_id}
                            onChange={(event) => updateAnalyticsFilter({ owner_user_id: event.target.value })}
                          >
                            <option value="">All owners</option>
                            {owners.map((owner) => (
                              <option key={owner.id} value={owner.id}>
                                {owner.display_name || owner.username}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Case status</span>
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={crmAnalyticsFilters.case_status}
                            onChange={(event) => updateAnalyticsFilter({ case_status: event.target.value })}
                          >
                            <option value="">All cases</option>
                            {CRM_CASE_STATUS_OPTIONS.filter(([value]) => value).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Service type</span>
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={crmAnalyticsFilters.service_type}
                            onChange={(event) => updateAnalyticsFilter({ service_type: event.target.value })}
                          >
                            <option value="">All services</option>
                            {crmTemplates.map((template) => (
                              <option key={template.service_key || template.id} value={template.service_key}>
                                {template.name || crmServiceLabel(template.service_key)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Building source</span>
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={crmAnalyticsFilters.building_source}
                            onChange={(event) => updateAnalyticsFilter({ building_source: event.target.value })}
                          >
                            <option value="">All sources</option>
                            <option value="master">Master</option>
                            <option value="staging">Staging</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Start date</span>
                          <input
                            type="date"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={crmAnalyticsFilters.date_from}
                            onChange={(event) => updateAnalyticsFilter({ date_from: event.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">End date</span>
                          <input
                            type="date"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={crmAnalyticsFilters.date_to}
                            onChange={(event) => updateAnalyticsFilter({ date_to: event.target.value })}
                          />
                        </label>
                      </div>
                    </SectionCard>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <SectionCard title="Completion by Service Type" subtitle="Generated service instances within the current filter range.">
                        <div className="space-y-3">
                          {(crmAnalytics?.service_completion || []).map((item) => (
                            <div key={item.service_key || item.service_name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-900">{item.service_name || crmServiceLabel(item.service_key)}</div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.total} total · {item.completed} completed · {item.at_risk} at risk · {item.open} open
                                  </div>
                                </div>
                                <StatusPill tone={item.completion_rate >= 80 ? "green" : item.completion_rate >= 50 ? "amber" : "slate"}>
                                  {item.completion_rate}%
                                </StatusPill>
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                                <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(item.completion_rate || 0, 100)}%` }} />
                              </div>
                            </div>
                          ))}
                          {(crmAnalytics?.service_completion || []).length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">No service data.</div>
                          ) : null}
                        </div>
                      </SectionCard>

                      <SectionCard title="Staff Workload" subtitle="Includes incomplete tasks only when the related service is still open.">
                        <div className="space-y-2">
                          {(crmAnalytics?.staff_workload || []).map((item) => (
                            <div key={item.staff_id || item.staff_name} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-900">{item.staff_name || "Unassigned"}</div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.overdue_tasks || 0} overdue · {item.high_priority_tasks || 0} high priority
                                  </div>
                                </div>
                                <StatusPill tone={item.overdue_tasks ? "red" : item.high_priority_tasks ? "amber" : "blue"}>
                                  {item.open_tasks || 0} open tasks
                                </StatusPill>
                              </div>
                            </div>
                          ))}
                          {(crmAnalytics?.staff_workload || []).length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">No staff workload data.</div>
                          ) : null}
                        </div>
                      </SectionCard>

                      <SectionCard title="Tasks in the Next 7 Days" subtitle="Excludes historical open tasks attached to closed services.">
                        {taskMiniList(crmAnalytics?.upcoming_tasks || [], "No open tasks in the next 7 days.")}
                      </SectionCard>

                      <SectionCard title="Overdue Task Ranking" subtitle="Use this to assess support-workbench risk.">
                        {taskMiniList(crmAnalytics?.overdue_tasks || [], "There are no overdue tasks.")}
                      </SectionCard>
                    </div>

                    <SectionCard title="Cases Linked to Staging Buildings" subtitle="These building rules have not yet reached Master and need special attention during review.">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {(crmAnalytics?.staging_cases || []).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-slate-900">{item.group_name}</div>
                                <div className="mt-1 text-sm text-slate-600">
                                  {item.building_name || "No building linked"} · Unit {item.unit || "—"}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Lease start {formatDateOnly(item.lease_start_date)} · Owner {item.owner_name || "Unassigned"}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <StatusPill tone={item.risk_count ? "red" : "amber"}>{item.risk_count || 0} risks</StatusPill>
                                <StatusPill tone="blue">{item.open_task_count || 0} tasks</StatusPill>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(crmAnalytics?.staging_cases || []).length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">No cases are currently linked to Staging buildings.</div>
                        ) : null}
                      </div>
                    </SectionCard>
                  </div>
                );
              })()
            ) : null}

            {activeTab === "templates" ? (
              (() => {
                const canEditTemplates = ["super_admin", "admin"].includes(currentUser.role);
                const updateTemplateDraft = (patch) =>
                  setCrmTemplateDraft((prev) => ({ ...prev, ...patch }));
                const updateTemplateStep = (index, patch) =>
                  setCrmTemplateDraft((prev) => ({
                    ...prev,
                    steps: (prev.steps || []).map((step, stepIndex) =>
                      stepIndex === index ? { ...step, ...patch } : step
                    ),
                  }));
                const updateTemplateTaskRule = (index, patch) =>
                  setCrmTemplateDraft((prev) => ({
                    ...prev,
                    task_rules: (prev.task_rules || []).map((rule, ruleIndex) =>
                      ruleIndex === index ? { ...rule, ...patch } : rule
                    ),
                  }));
                const templateFlowProfile = crmNormalizeFlowProfile(crmTemplateDraft.flow_profile);
                const updateTemplateFlowProfile = (updater) =>
                  setCrmTemplateDraft((prev) => {
                    const currentProfile = crmNormalizeFlowProfile(prev.flow_profile);
                    return {
                      ...prev,
                      flow_profile: crmNormalizeFlowProfile(updater(currentProfile)),
                    };
                  });
                const updateTemplateFlowStep = (stepKey, patch) =>
                  updateTemplateFlowProfile((profile) => ({
                    ...profile,
                    flow_steps: (profile.flow_steps || []).map((step) =>
                      step.step_key === stepKey ? crmNormalizeFlowStep({ ...step, ...patch }, 0, profile) : step
                    ),
                  }));
                const addTemplateFlowStep = () =>
                  updateTemplateFlowProfile((profile) => ({
                    ...profile,
                    flow_steps: [
                      ...(profile.flow_steps || []),
                      {
                        ...createEmptyCrmFlowStep(),
                        display_order: ((profile.flow_steps || []).length + 1) * 10,
                      },
                    ],
                  }));
                const removeTemplateFlowStep = (stepKey) => {
                  updateTemplateFlowProfile((profile) => ({
                    ...profile,
                    flow_steps: (profile.flow_steps || []).filter((step) => step.step_key !== stepKey),
                  }));
                  setCrmTemplateDraft((prev) => ({
                    ...prev,
                    task_rules: (prev.task_rules || []).map((rule) =>
                      rule.flow_step_key === stepKey ? { ...rule, flow_step_key: "" } : rule
                    ),
                  }));
                };
                const updateTemplateFlowLabel = (groupKey, statusKey, value) =>
                  updateTemplateFlowProfile((profile) => {
                    const labelKey = groupKey === "staff" ? "staff_labels" : "customer_labels";
                    const nextProfile = {
                      ...profile,
                      [labelKey]: {
                        ...(profile[labelKey] || {}),
                        [statusKey]: value,
                      },
                    };
                    return nextProfile;
                  });
                const setTemplateFlowStageEnabled = (groupKey, statusKey, enabled) =>
                  updateTemplateFlowProfile((profile) => {
                    const skipKey = `${groupKey}:${statusKey}`;
                    const skipStages = new Set(profile.skip_stages || []);
                    skipStages.delete(statusKey);
                    if (enabled) {
                      skipStages.delete(skipKey);
                    } else {
                      skipStages.add(skipKey);
                    }
                    return { ...profile, skip_stages: [...skipStages] };
                  });
                const updateTemplateStaffCustomerMap = (statusKey, value) =>
                  updateTemplateFlowProfile((profile) => ({
                    ...profile,
                    staff_to_customer_map: {
                      ...CRM_DEFAULT_STAFF_TO_CUSTOMER_MAP,
                      ...(profile.staff_to_customer_map || {}),
                      [statusKey]: value,
                    },
                  }));
                const updateTemplateRequiredFields = (statusKey, value) =>
                  updateTemplateFlowProfile((profile) => ({
                    ...profile,
                    required_fields_by_stage: {
                      ...(profile.required_fields_by_stage || {}),
                      [statusKey]: crmParseFlowFieldList(value),
                    },
                  }));
                const templateFlowSteps = [...(templateFlowProfile.flow_steps || [])].sort(
                  (a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)
                );
                const enabledTemplateFlowSteps = templateFlowSteps.filter((row) => row.enabled !== false);
                const disabledTemplateFlowSteps = templateFlowSteps.filter((row) => row.enabled === false);
                const taskRuleCountByStep = (stepKey) =>
                  (crmTemplateDraft.task_rules || []).filter((rule) => rule.flow_step_key === stepKey).length;
                return (
                  <div className="grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                    <SectionCard
                      title="Service Templates"
                      subtitle="Add, deactivate, or revise the services generated for future cases."
                      bodyClassName="max-h-[76vh] overflow-y-auto overscroll-contain p-4"
                      action={
                        <button
                          type="button"
                          disabled={!canEditTemplates}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={handleNewCrmTemplate}
                        >
                          Add template
                        </button>
                      }
                    >
                      <div className="space-y-3">
                        {crmTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                              selectedCrmTemplateId === template.id && !isCrmTemplateNew
                                ? "border-slate-900 bg-slate-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                            onClick={() => handleSelectCrmTemplate(template)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-slate-900">{template.name}</div>
                                <div className="mt-1 text-xs text-slate-500">{template.service_key}</div>
                              </div>
                              <StatusPill tone={template.active ? "green" : "slate"}>
                                {template.active ? "Active" : "Inactive"}
                              </StatusPill>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <StatusPill tone="slate">
                                {CRM_SCOPE_LABELS[template.service_scope] || template.service_scope}
                              </StatusPill>
                              {template.service_delivery_mode ? (
                                <StatusPill tone="blue">
                                  {CRM_SERVICE_DELIVERY_MODE_LABELS[template.service_delivery_mode] || template.service_delivery_mode}
                                </StatusPill>
                              ) : null}
                            </div>
                          </button>
                        ))}
                        {crmTemplates.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                            No service templates.
                          </div>
                        ) : null}
                      </div>
                    </SectionCard>

                    <SectionCard
                      title={isCrmTemplateNew ? "Add Service Template" : crmTemplateDraft.name || "Template Details"}
                      subtitle="Changes apply to future cases. Existing cases keep the service records already generated for them."
                      bodyClassName="max-h-[76vh] overflow-y-auto overscroll-contain p-5"
                      action={
                        <div className="flex flex-wrap gap-2">
                          {!isCrmTemplateNew && crmTemplateDraft.active ? (
                            <button
                              type="button"
                              disabled={!canEditTemplates || isCrmBusy}
                              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={handleDisableCrmTemplate}
                            >
                              Deactivate
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={!canEditTemplates || isCrmBusy}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleSaveCrmTemplate()}
                          >
                            Save template
                          </button>
                        </div>
                      }
                    >
                      {!canEditTemplates ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          Only administrators can modify service templates.
                        </div>
                      ) : null}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Service name</span>
                          <input
                            disabled={!canEditTemplates}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            value={crmTemplateDraft.name}
                            onChange={(event) => updateTemplateDraft({ name: event.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Service key</span>
                          <input
                            disabled={!canEditTemplates || !isCrmTemplateNew}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            value={crmTemplateDraft.service_key}
                            placeholder="For example, furniture_setup"
                            onChange={(event) => updateTemplateDraft({ service_key: event.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Service scope</span>
                          <select
                            disabled={!canEditTemplates}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            value={crmTemplateDraft.service_scope}
                            onChange={(event) => updateTemplateDraft({ service_scope: event.target.value })}
                          >
                            {Object.entries(CRM_SCOPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Delivery model</span>
                          <select
                            disabled={!canEditTemplates}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            value={crmTemplateDraft.service_delivery_mode}
                            onChange={(event) => updateTemplateDraft({ service_delivery_mode: event.target.value })}
                          >
                            {Object.entries(CRM_SERVICE_DELIVERY_MODE_LABELS).filter(([value]) => value !== "unknown").map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Category</span>
                          <select
                            disabled={!canEditTemplates}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            value={crmTemplateDraft.category}
                            onChange={(event) => updateTemplateDraft({ category: event.target.value })}
                          >
                            {Object.entries(CRM_TEMPLATE_CATEGORY_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Display order</span>
                          <input
                            type="number"
                            disabled={!canEditTemplates}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            value={crmTemplateDraft.display_order}
                            onChange={(event) => updateTemplateDraft({ display_order: event.target.value })}
                          />
                        </label>
                      </div>

                      <label className="mt-4 block">
                        <span className="mb-1 block text-xs font-medium text-slate-500">Description</span>
                        <textarea
                          disabled={!canEditTemplates}
                          className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                          value={crmTemplateDraft.description}
                          onChange={(event) => updateTemplateDraft({ description: event.target.value })}
                        />
                      </label>

                      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            disabled={!canEditTemplates}
                            checked={crmTemplateDraft.active}
                            onChange={(event) => updateTemplateDraft({ active: event.target.checked })}
                          />
                          Enable this service
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            disabled={!canEditTemplates}
                            checked={crmTemplateDraft.building_driven}
                            onChange={(event) => updateTemplateDraft({ building_driven: event.target.checked })}
                          />
                          Determine applicability from building rules
                        </label>
                        <label className="block md:col-span-2">
                          <span className="mb-1 block text-xs font-medium text-slate-500">Building rule source</span>
                          <select
                            disabled={!canEditTemplates || !crmTemplateDraft.building_driven}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            value={crmTemplateDraft.auto_source}
                            onChange={(event) => updateTemplateDraft({ auto_source: event.target.value })}
                          >
                            {Object.entries(CRM_TEMPLATE_AUTO_SOURCE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Workflow Mapping</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Each row is a real step on the service card. When staff selects it, the mapped customer workflow is applied automatically.
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!canEditTemplates}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={addTemplateFlowStep}
                          >
                            Add custom step
                          </button>
                        </div>
                        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                          <div className="grid min-w-[1120px] grid-cols-[64px_72px_1.2fr_1.2fr_1fr_1.4fr_96px] gap-0 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
                            <div>Order</div>
                            <div>Enabled</div>
                            <div>Staff workflow stage</div>
                            <div>Mapped customer workflow</div>
                            <div>Required information</div>
                            <div>Description / Tasks</div>
                            <div>Actions</div>
                          </div>
                          <div className="divide-y divide-slate-200 bg-white">
                            {enabledTemplateFlowSteps.map((row, index) => (
                              <div key={row.step_key} className="grid min-w-[1120px] grid-cols-[64px_72px_1.2fr_1.2fr_1fr_1.4fr_96px] gap-3 px-4 py-3 text-sm">
                                <input
                                  type="number"
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-2 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={row.display_order || (index + 1) * 10}
                                  onChange={(event) => updateTemplateFlowStep(row.step_key, { display_order: event.target.value })}
                                />
                                <label className="pt-2">
                                  <input
                                    type="checkbox"
                                    disabled={!canEditTemplates}
                                    checked={row.enabled !== false}
                                    onChange={(event) => updateTemplateFlowStep(row.step_key, { enabled: event.target.checked })}
                                  />
                                  <span className="sr-only">Enable {row.staff_label}</span>
                                </label>
                                <input
                                  disabled={!canEditTemplates}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={row.staff_label}
                                  onChange={(event) => updateTemplateFlowStep(row.step_key, { staff_label: event.target.value })}
                                />
                                <input
                                  disabled={!canEditTemplates}
                                  className="min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={row.customer_label}
                                  onChange={(event) => updateTemplateFlowStep(row.step_key, { customer_label: event.target.value })}
                                  placeholder="For example, waiting for the customer to follow the SOP"
                                />
                                <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <summary className="cursor-pointer text-xs font-medium text-slate-700">
                                    {row.required_fields.length ? row.required_fields.join(" / ") : "No required fields"}
                                  </summary>
                                  <input
                                    disabled={!canEditTemplates}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                    value={crmFormatFlowFieldList(row.required_fields)}
                                    placeholder="For example: verification_window, account_holder, phone"
                                    onChange={(event) => updateTemplateFlowStep(row.step_key, { required_fields: crmParseFlowFieldList(event.target.value) })}
                                  />
                                </details>
                                <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <summary className="cursor-pointer text-xs font-medium text-slate-700">
                                    {row.description || "Description / Advanced rules"}
                                    {taskRuleCountByStep(row.step_key) ? ` · ${taskRuleCountByStep(row.step_key)} tasks` : ""}
                                  </summary>
                                  <textarea
                                    disabled={!canEditTemplates}
                                    className="mt-2 min-h-[64px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                    value={row.description}
                                    placeholder="Step instructions for support staff"
                                    onChange={(event) => updateTemplateFlowStep(row.step_key, { description: event.target.value })}
                                  />
                                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-medium text-slate-500">Underlying staff stage</span>
                                      <select
                                        disabled={!canEditTemplates}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                        value={row.staff_flow_status}
                                        onChange={(event) => updateTemplateFlowStep(row.step_key, { staff_flow_status: event.target.value })}
                                      >
                                        {CRM_STAFF_FLOW_OPTIONS.map(([value, label]) => (
                                          <option key={value} value={value}>{label}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-medium text-slate-500">Underlying customer category</span>
                                      <select
                                        disabled={!canEditTemplates}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                        value={row.customer_flow_status}
                                        onChange={(event) => updateTemplateFlowStep(row.step_key, { customer_flow_status: event.target.value })}
                                      >
                                        {CRM_CUSTOMER_FLOW_OPTIONS.map(([value, label]) => (
                                          <option key={value} value={value}>{label}</option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                                    <label className="inline-flex items-center gap-1">
                                      <input
                                        type="checkbox"
                                        disabled={!canEditTemplates}
                                        checked={Boolean(row.is_completion)}
                                        onChange={(event) =>
                                          updateTemplateFlowStep(row.step_key, {
                                            is_completion: event.target.checked,
                                            is_risk: event.target.checked ? false : row.is_risk,
                                            is_terminal: event.target.checked ? false : row.is_terminal,
                                          })
                                        }
                                      />
                                      Completion step
                                    </label>
                                    <label className="inline-flex items-center gap-1">
                                      <input
                                        type="checkbox"
                                        disabled={!canEditTemplates}
                                        checked={Boolean(row.is_risk)}
                                        onChange={(event) =>
                                          updateTemplateFlowStep(row.step_key, {
                                            is_risk: event.target.checked,
                                            is_completion: event.target.checked ? false : row.is_completion,
                                            is_terminal: event.target.checked ? false : row.is_terminal,
                                          })
                                        }
                                      />
                                      Risk step
                                    </label>
                                    <label className="inline-flex items-center gap-1">
                                      <input
                                        type="checkbox"
                                        disabled={!canEditTemplates}
                                        checked={Boolean(row.is_terminal)}
                                        onChange={(event) =>
                                          updateTemplateFlowStep(row.step_key, {
                                            is_terminal: event.target.checked,
                                            is_completion: event.target.checked ? false : row.is_completion,
                                            is_risk: event.target.checked ? false : row.is_risk,
                                          })
                                        }
                                      />
                                      Termination step
                                    </label>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!canEditTemplates}
                                    className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={() =>
                                      updateTemplateDraft({
                                        task_rules: [...(crmTemplateDraft.task_rules || []), createEmptyCrmTemplateTaskRule(row.step_key)],
                                      })
                                    }
                                  >
                                    Add task to this step
                                  </button>
                                </details>
                                <button
                                  type="button"
                                  disabled={!canEditTemplates}
                                  className="self-start rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() => removeTemplateFlowStep(row.step_key)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        {disabledTemplateFlowSteps.length ? (
                          <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                              Disabled steps ({disabledTemplateFlowSteps.length})
                            </summary>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {disabledTemplateFlowSteps.map((row) => (
                                <label key={row.step_key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                  <span>
                                    <span className="font-medium text-slate-900">{row.staff_label}</span>
                                    <span className="ml-2 text-xs text-slate-500">→ {row.customer_label}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-2 text-xs text-slate-600">
                                    <input
                                      type="checkbox"
                                      disabled={!canEditTemplates}
                                      checked={row.enabled !== false}
                                      onChange={(event) => updateTemplateFlowStep(row.step_key, { enabled: event.target.checked })}
                                    />
                                    Enable
                                  </span>
                                </label>
                              ))}
                            </div>
                          </details>
                        ) : null}
                        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                          Customer workflow can still be corrected manually on a case service card. Completing a task records the timeline event but does not advance the service automatically.
                        </div>
                      </div>

                      <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                          Advanced: Legacy Workflow Steps
                        </summary>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-sm font-semibold text-slate-900">Customer Workflow Labels</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Change these only when a service needs special wording. Staff can still correct customer workflow manually on the service card.
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {CRM_CUSTOMER_FLOW_OPTIONS.map(([statusKey, defaultLabel]) => (
                              <label key={`customer-label-${statusKey}`} className="block rounded-xl bg-white p-3">
                                <span className="mb-1 block text-xs font-medium text-slate-500">{defaultLabel}</span>
                                <input
                                  disabled={!canEditTemplates}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={templateFlowProfile.customer_labels?.[statusKey] || defaultLabel}
                                  onChange={(event) => updateTemplateFlowLabel("customer", statusKey, event.target.value)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Workflow Steps</div>
                            <div className="mt-1 text-xs text-slate-500">Steps control workflow records in service details. Removing a step affects only future template use.</div>
                          </div>
                          <button
                            type="button"
                            disabled={!canEditTemplates}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() =>
                              updateTemplateDraft({ steps: [...(crmTemplateDraft.steps || []), createEmptyCrmTemplateStep()] })
                            }
                          >
                            Add step
                          </button>
                        </div>
                        <div className="mt-3 space-y-3">
                          {(crmTemplateDraft.steps || []).map((step, index) => (
                            <div key={`${step.step_key}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_120px_90px_auto]">
                                <input
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={step.step_key}
                                  placeholder="step_key"
                                  onChange={(event) => updateTemplateStep(index, { step_key: event.target.value })}
                                />
                                <input
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={step.title}
                                  placeholder="Step title"
                                  onChange={(event) => updateTemplateStep(index, { title: event.target.value })}
                                />
                                <select
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={step.scope}
                                  onChange={(event) => updateTemplateStep(index, { scope: event.target.value })}
                                >
                                  <option value="group">Entire group</option>
                                  <option value="guest">Per customer</option>
                                </select>
                                <input
                                  type="number"
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={step.display_order}
                                  onChange={(event) => updateTemplateStep(index, { display_order: event.target.value })}
                                />
                                <button
                                  type="button"
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() =>
                                    updateTemplateDraft({
                                      steps: (crmTemplateDraft.steps || []).filter((_, stepIndex) => stepIndex !== index),
                                    })
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Automatic Task Rules</div>
                            <div className="mt-1 text-xs text-slate-500">Tasks generated here appear in Calendar and Task Center.</div>
                          </div>
                          <button
                            type="button"
                            disabled={!canEditTemplates}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() =>
                              updateTemplateDraft({
                                task_rules: [...(crmTemplateDraft.task_rules || []), createEmptyCrmTemplateTaskRule()],
                              })
                            }
                          >
                            Add task rule
                          </button>
                        </div>
                        <div className="mt-3 space-y-3">
                          {(crmTemplateDraft.task_rules || []).map((rule, index) => (
                            <div key={`${rule.key}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="grid gap-2 lg:grid-cols-[1fr_1.4fr_160px_120px_80px_80px_110px_110px_auto]">
                                <input
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={rule.key}
                                  placeholder="rule_key"
                                  onChange={(event) => updateTemplateTaskRule(index, { key: event.target.value })}
                                />
                                <input
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={rule.title}
                                  placeholder="Task title"
                                  onChange={(event) => updateTemplateTaskRule(index, { title: event.target.value })}
                                />
                                <select
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={rule.flow_step_key || ""}
                                  onChange={(event) => updateTemplateTaskRule(index, { flow_step_key: event.target.value })}
                                >
                                  <option value="">No linked step</option>
                                  {templateFlowSteps.map((step) => (
                                    <option key={step.step_key} value={step.step_key}>
                                      {step.staff_label}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={rule.timing}
                                  onChange={(event) => updateTemplateTaskRule(index, { timing: event.target.value })}
                                >
                                  <option value="immediate">Immediately</option>
                                  <option value="lease_start_minus_days">Before lease start</option>
                                </select>
                                <input
                                  type="number"
                                  disabled={!canEditTemplates || rule.timing === "immediate"}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={rule.days}
                                  onChange={(event) => updateTemplateTaskRule(index, { days: event.target.value })}
                                />
                                <input
                                  type="number"
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={rule.due_hour ?? 9}
                                  min="0"
                                  max="23"
                                  title="Task time (hour)"
                                  onChange={(event) => updateTemplateTaskRule(index, { due_hour: event.target.value })}
                                />
                                <select
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={rule.task_type}
                                  onChange={(event) => updateTemplateTaskRule(index, { task_type: event.target.value })}
                                >
                                  {Object.entries(CRM_TASK_TYPE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                                <select
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={rule.priority}
                                  onChange={(event) => updateTemplateTaskRule(index, { priority: event.target.value })}
                                >
                                  {Object.entries(CRM_TASK_PRIORITY_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={!canEditTemplates}
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() =>
                                    updateTemplateDraft({
                                      task_rules: (crmTemplateDraft.task_rules || []).filter((_, ruleIndex) => ruleIndex !== index),
                                    })
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                              <input
                                disabled={!canEditTemplates}
                                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                value={rule.description}
                                placeholder="Optional task description"
                                onChange={(event) => updateTemplateTaskRule(index, { description: event.target.value })}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                        To remove a service from future cases, deactivate it. Existing case services and tasks are never deleted automatically.
                      </div>
                    </SectionCard>
                  </div>
                );
              })()
            ) : null}

            {activeTab === "query" ? (
              <>
                <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
                  <SectionCard
                    title={querySourceMode === "staging" ? "Staging Buildings" : "Master Buildings"}
                    subtitle={
                      querySourceMode === "staging"
                        ? "This list shows currently readable Staging information, including facts that have not been approved."
                        : "This list contains buildings approved into Master."
                    }
                    action={
                      <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 text-xs">
                          <button
                            type="button"
                            className={`rounded-lg px-3 py-1.5 font-medium transition ${
                              querySourceMode === "master"
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                            onClick={() => setQuerySourceMode("master")}
                          >
                            Master
                          </button>
                          <button
                            type="button"
                            className={`rounded-lg px-3 py-1.5 font-medium transition ${
                              querySourceMode === "staging"
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                            onClick={() => setQuerySourceMode("staging")}
                          >
                            Staging
                          </button>
                        </div>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          onClick={() =>
                            querySourceMode === "staging"
                              ? loadStagingBuildings(getStagingReloadQuery())
                              : loadMasterBuildings(masterSearch.trim())
                          }
                        >
                          Refresh
                        </button>
                      </div>
                    }
                  >
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          ref={querySearchInputRef}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          value={masterSearch}
                          placeholder="Search by building name or address"
                          onChange={(event) => setMasterSearch(event.target.value)}
                        />
                        <button
                          type="button"
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                          onClick={() =>
                            querySourceMode === "staging"
                              ? loadStagingBuildings(getStagingReloadQuery())
                              : loadMasterBuildings(masterSearch.trim())
                          }
                        >
                          Search
                        </button>
                      </div>
                      {isPickingQueryBuilding ? (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                          Choose a different building. The current selection changes only after you select another record.
                        </div>
                      ) : null}
                      <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                        {(querySourceMode === "staging" ? stagingBuildings : masterBuildings).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                            {querySourceMode === "staging"
                              ? "Staging has no readable buildings. Import an Excel file or submit a Welcome Letter first."
                              : "Master has no buildings. Import historical sources, then approve them in the Review Queue."}
                          </div>
                        ) : (
                          (querySourceMode === "staging" ? stagingBuildings : masterBuildings).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                (querySourceMode === "staging"
                                  ? selectedStagingKey === item.id
                                  : selectedBuildingId === item.id)
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                              onClick={() => handleQueryBuildingSelect(item.id)}
                            >
                              <div className="text-sm font-semibold">{item.building_name}</div>
                              <div
                                className={`mt-1 text-xs ${
                                  (querySourceMode === "staging"
                                    ? selectedStagingKey === item.id
                                    : selectedBuildingId === item.id)
                                    ? "text-slate-200"
                                    : "text-slate-500"
                                }`}
                              >
                                {item.address || "Address unknown"}
                              </div>
                              {querySourceMode === "staging" ? (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                  <span
                                    className={
                                      selectedStagingKey === item.id ? "text-slate-200" : "text-slate-500"
                                    }
                                  >
                                    {item.pending_count || 0} current records
                                  </span>
                                  <StatusPill
                                    tone={
                                      item.library_status === "已入正式"
                                        ? "green"
                                        : item.library_status === "临时"
                                        ? "blue"
                                        : "amber"
                                    }
                                  >
                                    {formatStagingLibraryStatus(item.library_status)}
                                  </StatusPill>
                                </div>
                              ) : (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                  <StatusPill tone={item.completeness_status === "verified_complete" ? "green" : "amber"}>
                                    {item.completeness_status === "verified_complete" ? "Verified complete" : "Verified but incomplete"}
                                  </StatusPill>
                                  <span className={selectedBuildingId === item.id ? "text-slate-200" : "text-slate-500"}>
                                    Completeness {item.completeness_score ?? 0}/100
                                  </span>
                                </div>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title={`Conversational ${querySourceMode === "staging" ? "Staging" : "Master"} Search`}
                    subtitle={
                      selectedQueryBuildingSummary
                        ? `Current building: ${selectedQueryBuildingSummary.building_name}${selectedQueryBuildingSummary.address ? ` - ${selectedQueryBuildingSummary.address}` : ""}`
                        : `Ask using a building name and question. If a building is selected, the search prioritizes that ${querySourceMode === "staging" ? "Staging" : "Master"} record.`
                    }
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={selectedQueryBuildingSummary ? (isPickingQueryBuilding ? "amber" : "blue") : "slate"}>
                          {selectedQueryBuildingSummary
                            ? isPickingQueryBuilding
                              ? "Choosing another"
                              : "Building selected"
                            : "No building selected"}
                        </StatusPill>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          onClick={startPickingQueryBuilding}
                        >
                          Choose another building
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!selectedQueryBuildingSummary}
                          onClick={clearCurrentQueryBuilding}
                        >
                          Clear building
                        </button>
                      </div>
                    }
                  >
                    <div className="space-y-4">
                      <div className="max-h-[440px] space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        {messages.map((message) =>
                          message.role === "user" ? (
                            <div key={message.id} className="flex justify-end">
                              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white">
                                {message.content}
                              </div>
                            </div>
                          ) : (
                            <div key={message.id} className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-700">
                                {message.sourceMode === "staging" ? "Staging" : "Master"}
                              </div>
                              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                                <div className="prose prose-sm max-w-none prose-p:my-1">
                                  <ReactMarkdown>{message.content}</ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                      {queryAssist.selectionConflictMessage && queryAssist.buildingSwitchCandidate ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <div className="text-sm font-medium text-amber-900">
                            {queryAssist.selectionConflictMessage}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                              onClick={handleSwitchCandidateRetry}
                            >
                              Switch to {queryAssist.buildingSwitchCandidate.building_name} and ask again
                            </button>
                            <span className="text-xs text-amber-700">
                              The system never switches buildings silently; your confirmation is required.
                            </span>
                          </div>
                        </div>
                      ) : null}
                      {queryAssist.temporarySuggestions?.length ? (
                        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
                          <div className="text-sm font-semibold text-amber-900">No Master match, but Staging has similar records</div>
                          <div className="mt-1 text-xs leading-5 text-amber-800">
                            These are provisional facts. Selecting one switches to the amber Staging view; the information is never mixed into a Master answer.
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {queryAssist.temporarySuggestions.map((candidate) => (
                              <button
                                key={candidate.staging_key || candidate.id}
                                type="button"
                                className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                                onClick={() => handleOpenTemporarySuggestion(candidate)}
                              >
                                View Staging record: {candidate.building_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-3">
                        <div className="inline-flex w-fit rounded-xl border border-slate-300 bg-slate-50 p-1 text-xs">
                          <button
                            type="button"
                            className={`rounded-lg px-3 py-1.5 font-medium transition ${
                              querySourceMode === "master"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                            onClick={() => setQuerySourceMode("master")}
                          >
                            Master answers
                          </button>
                          <button
                            type="button"
                            className={`rounded-lg px-3 py-1.5 font-medium transition ${
                              querySourceMode === "staging"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                            onClick={() => setQuerySourceMode("staging")}
                          >
                            Staging answers
                          </button>
                        </div>
                        <textarea
                          className="h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          placeholder={
                            querySourceMode === "staging"
                              ? "For example: What does Staging currently say about this building? / Are there internet notes for JSQ?"
                              : "For example: Does JSQ require insurance? / Which utility serves The Journal? / What are this building's move-in notes?"
                          }
                          value={question}
                          onChange={(event) => setQuestion(event.target.value)}
                          onKeyDown={(event) => {
                            const isImeConfirming =
                              event.nativeEvent?.isComposing || event.keyCode === 229;
                            if (!isImeConfirming && event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              handleQuerySend();
                            }
                          }}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-slate-500">
                            {querySourceMode === "staging"
                              ? "Staging reads the current submission directly and says clearly when information is missing."
                              : "Master reads approved facts only. Pending information may be noted separately, but is never presented as approved fact."}
                          </p>
                          <button
                            type="button"
                            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSending || !question.trim()}
                            onClick={handleQuerySend}
                          >
                            {isSending ? "Searching…" : "Ask"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Search Assistance"
                    subtitle={
                      selectedQueryBuildingSummary
                        ? `Current assisted building: ${selectedQueryBuildingSummary.building_name}`
                        : "Selecting a building preloads internet information. After a question, any AI explanation appears here."
                    }
                  >
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">AI Explanation</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              This section improves wording only; it never changes structured records.
                            </div>
                          </div>
                          <StatusPill
                            tone={queryAssist.answerMode === "database-plus-ai" ? "blue" : "slate"}
                          >
                            {queryAssist.answerMode === "database-plus-ai" ? "Enabled" : "Disabled"}
                          </StatusPill>
                        </div>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                          {queryAssist.question ? (
                            queryAssist.selectionConflictMessage ? (
                              <div className="text-slate-500">
                                Another building was detected. Confirm the switch before generating an explanation.
                              </div>
                            ) : queryAssist.aiLoading ? (
                              <div className="text-slate-500">Database facts are displayed. The AI explanation is being generated in the background…</div>
                            ) : queryAssist.aiAnswer ? (
                              <div className="prose prose-sm max-w-none prose-p:my-1">
                                <ReactMarkdown>{queryAssist.aiAnswer}</ReactMarkdown>
                              </div>
                            ) : queryAssist.matched ? (
                              <div className="text-slate-500">
                                {queryAssist.aiMessage || (queryAssist.aiEnabled
                                  ? `The AI explanation was not generated this time. The answer still uses ${
                                      queryAssist.sourceMode === "staging" ? "the current Staging record" : "Master facts"
                                    }.`
                                  : `No external AI is configured. The answer still uses ${
                                      queryAssist.sourceMode === "staging" ? "the current Staging record" : "Master facts"
                                    }.`)}
                              </div>
                            ) : (
                              <div className="text-slate-500">
                                This search did not match a {queryAssist.sourceMode === "staging" ? "Staging" : "Master"} building, so no AI explanation was generated.
                              </div>
                            )
                          ) : (
                            <div className="text-slate-500">
                              Ask a question to display a more natural-language explanation here.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Internet Information</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              Information is prefetched after a building is selected and expands only when requested, without interrupting the conversation.
                            </div>
                          </div>
                          {queryAssist.networkPanelHint ? (
                            <StatusPill tone="amber">Current question concerns internet service</StatusPill>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={!networkPanel.matched || networkPanel.loading}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                              queryAssist.networkPanelHint
                                ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                            onClick={() =>
                              setNetworkPanel((prev) => ({
                                ...prev,
                                open: !prev.open,
                              }))
                            }
                          >
                            {networkPanel.loading
                              ? "Loading internet information…"
                              : networkPanel.matched
                              ? networkPanel.open
                                ? "Hide internet details"
                                : "View internet details"
                              : "No internet information"}
                          </button>
                          {selectedQueryBuildingSummary ? (
                            <span className="text-xs text-slate-500">
                              Current building: {selectedQueryBuildingSummary.building_name}
                            </span>
                          ) : null}
                        </div>

                        {!networkPanel.loading && !networkPanel.matched ? (
                          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                            {selectedQueryBuildingSummary
                              ? networkPanel.message || "This building has no structured internet information."
                              : "Select a building to preload its internet information."}
                          </div>
                        ) : null}

                        {networkPanel.matched ? (
                          <div className="mt-4 space-y-4">
                            {networkPanel.open ? (
                              <NetworkDetails network={networkPanel.matched} />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </>
            ) : null}

            {activeTab === "import" ? (
              <SectionCard
                title="Excel Import and Header Confirmation"
                subtitle="Excel rows enter the Review Queue first. Header mappings require confirmation; the system never imports them silently."
                action={
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={handleLegacyBootstrap}
                  >
                    Import Existing Demo Sources
                  </button>
                }
              >
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-900">Standard Workbook</div>
                        <div className="text-sm text-slate-600">
                          Excel is the source of truth for both Master and Staging. The system synchronizes each workbook to a SQLite mirror for search, review, and page reads.
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                          Master path: {masterExcelStatus?.path || "Loading…"}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                          Staging path: {masterExcelStatus?.staging_excel?.path || "Loading…"}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <StatusPill tone={masterExcelStatus?.ok ? "green" : "amber"}>
                            {masterExcelStatus?.ok ? "Structure valid" : "Needs attention"}
                          </StatusPill>
                          <span>Main sheet: {formatExcelSheetName(masterExcelStatus?.main_sheet)}</span>
                          <span>Record rows: {masterExcelStatus?.row_count ?? "-"}</span>
                          <span>
                            Last mirror refresh:{" "}
                            {masterExcelStatus?.last_reconciled_at
                              ? formatDateTime(masterExcelStatus.last_reconciled_at)
                              : "Not run yet"}
                          </span>
                        </div>
                        {masterExcelStatus?.error ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {masterExcelStatus.error}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          onClick={() => loadMasterExcelStatus().catch((error) => setPageError(error.message || "Could not load the standard-workbook status."))}
                        >
                          Refresh workbook status
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isMasterExcelBusy}
                          onClick={handleMasterExcelReconcile}
                        >
                          {isMasterExcelBusy ? "Refreshing…" : "Refresh Excel mirrors"}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                          onClick={handleMasterExcelDownload}
                        >
                          Download current workbook
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                      <input
                        type="file"
                        accept=".xlsx,.xlsm"
                        onChange={(event) => setMasterExcelFile(event.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-600"
                      />
                      <button
                        type="button"
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleMasterExcelPreview}
                        disabled={!masterExcelFile || isMasterExcelBusy}
                      >
                        {isMasterExcelBusy ? "Processing…" : "Preview standard-workbook changes"}
                      </button>
                    </div>
                  </div>

                  {masterExcelPreview ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        Current batch: {masterExcelPreview.file_name}. Confirmed changes enter the Review Queue first and never update Master directly.
                      </div>
                      {masterExcelPreview.validation ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          Validated sheets: {(masterExcelPreview.validation.sheet_names || []).map(formatExcelSheetName).join(" / ") || "-"}
                        </div>
                      ) : null}
                      {masterExcelPreview.sheets.map((sheet, sheetIndex) => (
                        <div key={sheet.sheet_name} className="rounded-2xl border border-slate-200">
                          <div className="border-b border-slate-200 px-4 py-3">
                            <div className="text-sm font-semibold text-slate-900">{sheet.sheet_name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Header row detected at row {sheet.header_row_index + 1}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-slate-50 text-left text-slate-500">
                                <tr>
                                  <th className="px-4 py-3 font-medium">Source header</th>
                                  <th className="px-4 py-3 font-medium">Mapping action</th>
                                  <th className="px-4 py-3 font-medium">Field / New name</th>
                                  <th className="px-4 py-3 font-medium">Sample</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sheet.headers.map((header, headerIndex) => (
                                  <tr key={header.original_header} className="border-t border-slate-200">
                                    <td className="px-4 py-3 align-top text-slate-700">
                                      <div className="font-medium">{header.original_header}</div>
                                      {header.suggested ? (
                                        <div className="mt-1 text-xs text-slate-500">
                                          Suggestion: {header.suggested.display_name} / {header.suggested.match_method} /{" "}
                                          {header.suggested.confidence}
                                        </div>
                                      ) : (
                                        <div className="mt-1 text-xs text-amber-600">Not recognized automatically</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      <select
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        value={header.action}
                                        onChange={(event) =>
                                          handleMasterExcelHeaderChange(sheetIndex, headerIndex, {
                                            action: event.target.value,
                                          })
                                        }
                                      >
                                        <option value="map">Map to field</option>
                                        <option value="ignore">Ignore</option>
                                        {currentUser.role === "super_admin" ? (
                                          <option value="create">Create field</option>
                                        ) : null}
                                      </select>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      {header.action === "map" ? (
                                        <select
                                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                          value={header.mapped_field_key}
                                          onChange={(event) =>
                                            handleMasterExcelHeaderChange(sheetIndex, headerIndex, {
                                              mapped_field_key: event.target.value,
                                            })
                                          }
                                        >
                                          <option value="">Select field</option>
                                          {masterExcelPreview.available_fields.map((field) => (
                                            <option key={field.field_key} value={field.field_key}>
                                              {field.display_name} ({field.field_key})
                                            </option>
                                          ))}
                                        </select>
                                      ) : header.action === "create" ? (
                                        <div className="space-y-2">
                                          <input
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            value={header.new_field_display_name}
                                            onChange={(event) =>
                                              handleMasterExcelHeaderChange(sheetIndex, headerIndex, {
                                                new_field_display_name: event.target.value,
                                              })
                                            }
                                            placeholder="New field display name"
                                          />
                                          <select
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            value={header.field_type}
                                            onChange={(event) =>
                                              handleMasterExcelHeaderChange(sheetIndex, headerIndex, {
                                                field_type: event.target.value,
                                              })
                                            }
                                          >
                                            <option value="text">text</option>
                                            <option value="boolean">boolean</option>
                                          </select>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-slate-400">Ignored</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 align-top text-xs text-slate-500">
                                      {(sheet.sample_rows || [])
                                        .map((row) => row[headerIndex] || "-")
                                        .filter(Boolean)
                                        .slice(0, 3)
                                        .join(" / ") || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isMasterExcelBusy}
                          onClick={handleMasterExcelConfirm}
                        >
                          {isMasterExcelBusy ? "Importing…" : "Confirm workbook changes into Review Queue"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-semibold text-slate-900">Standard Import File</div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.xlsm,.csv,.tsv"
                        onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-600"
                      />
                      <button
                        type="button"
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleImportPreview}
                        disabled={!importFile || isImporting}
                      >
                        {isImporting ? "Processing…" : "Generate preview"}
                      </button>
                    </div>
                  </div>

                  {importPreview ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        Current batch: {importPreview.file_name}. Confirm every header mapping before importing it into the Review Queue.
                      </div>
                      {importPreview.sheets.map((sheet, sheetIndex) => (
                        <div key={sheet.sheet_name} className="rounded-2xl border border-slate-200">
                          <div className="border-b border-slate-200 px-4 py-3">
                            <div className="text-sm font-semibold text-slate-900">{sheet.sheet_name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Header row detected at row {sheet.header_row_index + 1}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-slate-50 text-left text-slate-500">
                                <tr>
                                  <th className="px-4 py-3 font-medium">Source header</th>
                                  <th className="px-4 py-3 font-medium">Mapping action</th>
                                  <th className="px-4 py-3 font-medium">Field / New name</th>
                                  <th className="px-4 py-3 font-medium">Sample</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sheet.headers.map((header, headerIndex) => (
                                  <tr key={header.original_header} className="border-t border-slate-200">
                                    <td className="px-4 py-3 align-top text-slate-700">
                                      <div className="font-medium">{header.original_header}</div>
                                      {header.suggested ? (
                                        <div className="mt-1 text-xs text-slate-500">
                                          Suggestion: {header.suggested.display_name} / {header.suggested.match_method} /{" "}
                                          {header.suggested.confidence}
                                        </div>
                                      ) : (
                                        <div className="mt-1 text-xs text-amber-600">Not recognized automatically</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      <select
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        value={header.action}
                                        onChange={(event) =>
                                          handleImportHeaderChange(sheetIndex, headerIndex, {
                                            action: event.target.value,
                                          })
                                        }
                                      >
                                        <option value="map">Map to field</option>
                                        <option value="ignore">Ignore</option>
                                        {currentUser.role === "super_admin" ? (
                                          <option value="create">Create field</option>
                                        ) : null}
                                      </select>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      {header.action === "map" ? (
                                        <select
                                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                          value={header.mapped_field_key}
                                          onChange={(event) =>
                                            handleImportHeaderChange(sheetIndex, headerIndex, {
                                              mapped_field_key: event.target.value,
                                            })
                                          }
                                        >
                                          <option value="">Select field</option>
                                          {importPreview.available_fields.map((field) => (
                                            <option key={field.field_key} value={field.field_key}>
                                              {field.display_name} ({field.field_key})
                                            </option>
                                          ))}
                                        </select>
                                      ) : header.action === "create" ? (
                                        <div className="space-y-2">
                                          <input
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            value={header.new_field_display_name}
                                            onChange={(event) =>
                                              handleImportHeaderChange(sheetIndex, headerIndex, {
                                                new_field_display_name: event.target.value,
                                              })
                                            }
                                            placeholder="New field display name"
                                          />
                                          <select
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            value={header.field_type}
                                            onChange={(event) =>
                                              handleImportHeaderChange(sheetIndex, headerIndex, {
                                                field_type: event.target.value,
                                              })
                                            }
                                          >
                                            <option value="text">text</option>
                                            <option value="boolean">boolean</option>
                                          </select>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-slate-400">Ignored</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 align-top text-xs text-slate-500">
                                      {(sheet.sample_rows || [])
                                        .map((row) => row[headerIndex] || "-")
                                        .filter(Boolean)
                                        .slice(0, 3)
                                        .join(" / ") || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isImporting}
                          onClick={handleImportConfirm}
                        >
                          {isImporting ? "Importing…" : "Confirm import into Review Queue"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "intake" ? (
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="xl:col-span-3">
                  <SectionCard title="Document Purpose" subtitle="Welcome Letters, WeChat/chat materials, and historical files all enter review. Chat materials must be linked to a Staging building first.">
                    <div className="mb-4 grid gap-2 rounded-2xl bg-slate-100 p-1 md:grid-cols-3">
                      {[
                        ["welcome", "Welcome Letter"],
                        ["chat", "WeChat / Chat materials"],
                        ["history", "Historical PDFs and images"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            intakeSourceKind === value
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                          onClick={() => {
                            setIntakeSourceKind(value);
                            if (value === "chat") {
                              setIntakeMode("supplement");
                              setSupplementScope("all");
                              setIntakeSourceFileName("wechat_chat.txt");
                            }
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {intakeSourceKind === "chat" ? (
                      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                        Only insurance, electricity, internet, key pickup, service-elevator, move-in, and clearly public building-management contact information is extracted. Customer names, private phone numbers, verification codes, identity documents, and personal service status are never written to the building knowledge base.
                      </div>
                    ) : null}
                    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                      runtimeHealth?.ocr_provider === "baidu_unlimited_cloud"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : runtimeHealth?.ocr_provider === "unlimited_ocr_local_http"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}>
                      {runtimeHealth?.ocr_provider === "baidu_unlimited_cloud"
                        ? "Cloud-processing notice: images and PDFs that require OCR are sent to Baidu Unlimited OCR. Image-based field interpretation may also use the configured Xiaomi vision model. Upload only documents approved for cloud processing."
                        : runtimeHealth?.ocr_provider === "unlimited_ocr_local_http"
                          ? "Private-service notice: images and PDFs that require OCR are sent to the configured Unlimited-OCR GPU service. Image-based field interpretation may also use the configured Xiaomi vision model."
                          : `OCR is currently processed on this computer and is not uploaded to Baidu. ${runtimeHealth?.vision_enabled ? "Image-based field interpretation may still use the configured vision model." : "No external vision model is enabled."}`}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <div className="space-y-3">
                        {intakeSourceKind !== "chat" ? (
                        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                          {INTAKE_MODE_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                intakeMode === option.value
                                  ? "bg-white text-slate-900 shadow-sm"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                              onClick={() => {
                                setIntakeMode(option.value);
                                if (option.value === "full_package") {
                                  setIntakeTargetStaging(null);
                                  setIntakeStagingCandidates([]);
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        ) : null}
                        {intakeMode === "supplement" && intakeSourceKind !== "chat" ? (
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={supplementScope}
                            onChange={(event) => setSupplementScope(event.target.value)}
                          >
                            {SUPPLEMENT_SCOPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>

                      {intakeMode === "supplement" || intakeSourceKind === "chat" ? (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Target Staging Building</div>
                              <div className="mt-1 text-sm text-slate-600">
                                {intakeTargetStaging
                                  ? `${intakeTargetStaging.building_name} · ${
                                      intakeTargetStaging.address || "Address unknown"
                                    }`
                                  : "Not selected"}
                              </div>
                            </div>
                            <StatusPill tone={intakeTargetStaging ? "green" : "amber"}>
                              {intakeTargetStaging ? "Selected" : "Select a building"}
                            </StatusPill>
                          </div>
                          <div className="mt-3 space-y-3">
                            <div className="flex gap-2">
                              <input
                                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                placeholder="Search Staging by building name or address"
                                value={intakeStagingSearch}
                                onChange={(event) => setIntakeStagingSearch(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    loadIntakeStagingCandidates();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                                onClick={loadIntakeStagingCandidates}
                              >
                                Search
                              </button>
                              {canCreateStagingBuilding ? (
                                <button
                                  type="button"
                                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                                  onClick={() =>
                                    openStagingCreate("intake", {
                                      building_name: intakeStagingSearch.trim(),
                                    })
                                  }
                                >
                                  Add Staging building
                                </button>
                              ) : null}
                            </div>
                            {intakeStagingCandidates.length ? (
                              <div className="max-h-56 space-y-2 overflow-y-auto">
                                {intakeStagingCandidates.map((candidate) => (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                                      intakeTargetStaging?.id === candidate.id
                                        ? "border-blue-300 bg-white"
                                        : "border-slate-200 bg-white hover:border-blue-300"
                                    }`}
                                    onClick={() => setIntakeTargetStaging(candidate)}
                                  >
                                    <div className="font-semibold text-slate-900">{candidate.building_name}</div>
                                    <div className="mt-1 text-xs text-slate-500">{candidate.address || "Address unknown"}</div>
                                    <div className="mt-1 text-xs text-blue-700">{formatStagingLibraryStatus(candidate.library_status)}</div>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          The building is detected from document content. If one document package contains multiple PDFs, select them together in the PDF upload.
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>

                {intakeJobs.length ? (
                  <div className="xl:col-span-3">
                    <SectionCard
                      title="Background Processing Jobs"
                      subtitle="Processing continues after submission. You can keep working in CRM, Task Center, or another page."
                      action={
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          onClick={() => loadIntakeJobs().catch(() => null)}
                        >
                          Refresh jobs
                        </button>
                      }
                    >
                      <div className="grid gap-3 lg:grid-cols-2">
                        {intakeJobs.slice(0, 6).map((job) => {
                          const status = job.parse_status || "completed";
                          return (
                            <div key={job.source_document_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900">
                                    {job.source_file || job.source_document_id}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {job.created_at ? `Submitted: ${formatDateTime(job.created_at)}` : "Background job"}
                                  </div>
                                </div>
                                <StatusPill tone={INTAKE_PARSE_STATUS_TONES[status] || "slate"}>
                                  {INTAKE_PARSE_STATUS_LABELS[status] || status}
                                </StatusPill>
                              </div>
                              {job.parse_completed_at ? (
                                <div className="mt-2 text-xs text-slate-500">
                                  Completed: {formatDateTime(job.parse_completed_at)}
                                </div>
                              ) : null}
                              {job.submission_group_id ? (
                                <button
                                  type="button"
                                  className="mt-3 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-white"
                                  onClick={() => {
                                    setSelectedReviewGroupId(job.submission_group_id);
                                    setActiveTab("review");
                                    loadReviewGroups(reviewStatusFilter, reviewStageFilter).catch(() => null);
                                  }}
                                >
                                  Open in Review Queue
                                </button>
                              ) : null}
                              {job.parse_error ? (
                                <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                                  {job.parse_error}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>
                  </div>
                ) : null}

                <SectionCard
                  title={intakeSourceKind === "chat" ? "Chat Text" : "Text / Email Body"}
                  subtitle={intakeSourceKind === "chat" ? "Paste building rules from WeChat or another chat. Source text is access-controlled, and extracted results enter review only." : "Paste the text of a Welcome Letter or email body directly."}
                >
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={intakeSourceFileName}
                      onChange={(event) => setIntakeSourceFileName(event.target.value)}
                      placeholder="Source filename"
                    />
                    <textarea
                      className="h-64 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={intakeText}
                      onChange={(event) => setIntakeText(event.target.value)}
                      placeholder={intakeSourceKind === "chat" ? "Paste the original chat text that contains building rules" : "Paste the Welcome Letter or email body here"}
                    />
                    <button
                      type="button"
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        !intakeText.trim() ||
                        isSubmittingIntake ||
                        ((intakeMode === "supplement" || intakeSourceKind === "chat") && !intakeTargetStaging?.id)
                      }
                      onClick={() =>
                        submitIntake("Text processing", () => {
                          const formData = new FormData();
                          formData.append("source_text", intakeText);
                          formData.append("source_file_name", intakeSourceFileName || "email_text.txt");
                          appendIntakeMetadata(formData);
                          return {
                            path: intakeSourceKind === "chat" ? "/intake/chat/text" : "/intake/welcome-letter/text",
                            options: { method: "POST", body: formData },
                          };
                        })
                      }
                    >
                      {isSubmittingIntake ? "Submitting…" : "Submit text to Review Queue"}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="PDF Upload" subtitle="Text-based PDFs are extracted directly. If only a title, table of contents, or blank page is found, the system continues with OCR and vision processing.">
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={(event) => setPdfIntakeFiles(Array.from(event.target.files || []))}
                      className="block w-full text-sm text-slate-600"
                    />
                    {pdfIntakeFiles.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">
                        {pdfIntakeFiles.length} PDF(s) selected: {pdfIntakeFiles.map((file) => file.name).join(" / ")}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        !pdfIntakeFiles.length ||
                        isSubmittingIntake ||
                        ((intakeMode === "supplement" || intakeSourceKind === "chat") && !intakeTargetStaging?.id)
                      }
                      onClick={() =>
                        submitIntake("PDF processing", () => {
                          const formData = new FormData();
                          pdfIntakeFiles.forEach((pdfFile) => {
                            formData.append("files", pdfFile);
                          });
                          appendIntakeMetadata(formData);
                          return {
                            path: intakeSourceKind === "chat" ? "/intake/chat/pdf" : "/intake/welcome-letter/pdf",
                            options: { method: "POST", body: formData },
                          };
                        })
                      }
                    >
                      {isSubmittingIntake ? "Submitting…" : "Submit PDFs"}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Image Upload" subtitle={intakeSourceKind === "chat" ? "Upload multiple chat screenshots. The configured OCR provider reads text, while the Xiaomi vision model interprets business fields." : "Upload multiple images at once. OCR and vision results are merged in file order."}>
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => setImageIntakeFiles(Array.from(event.target.files || []))}
                      className="block w-full text-sm text-slate-600"
                    />
                    {imageIntakeFiles.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">
                        {imageIntakeFiles.length} image(s) selected: {imageIntakeFiles.map((file) => file.name).join(" / ")}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        !imageIntakeFiles.length ||
                        isSubmittingIntake ||
                        ((intakeMode === "supplement" || intakeSourceKind === "chat") && !intakeTargetStaging?.id)
                      }
                      onClick={() =>
                        submitIntake("Image processing", () => {
                          const formData = new FormData();
                          imageIntakeFiles.forEach((imageFile) => {
                            formData.append("files", imageFile);
                          });
                          appendIntakeMetadata(formData);
                          return {
                            path: intakeSourceKind === "chat" ? "/intake/chat/image" : "/intake/welcome-letter/image",
                            options: { method: "POST", body: formData },
                          };
                        })
                      }
                    >
                      {isSubmittingIntake ? "Submitting…" : "Submit images"}
                    </button>
                  </div>
                </SectionCard>

                {intakeResult ? (
                  <div className="xl:col-span-3">
                    <SectionCard title="Latest Submission" subtitle="This area shows the submission receipt. Completed processing results then enter the Review Queue.">
                      <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                        {JSON.stringify(intakeResult, null, 2)}
                      </pre>
                    </SectionCard>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "review" ? (
              <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                <SectionCard
                  title="Review Groups"
                  subtitle="Each Excel row or Welcome Letter is aggregated into one review group."
                  action={
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => loadReviewGroups(reviewStatusFilter, reviewStageFilter)}
                    >
                      Refresh
                    </button>
                  }
                >
                  <div className="space-y-3">
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={reviewStatusFilter}
                      onChange={(event) => {
                        setReviewStatusFilter(event.target.value);
                        loadReviewGroups(event.target.value, reviewStageFilter);
                      }}
                    >
                      <option value="actionable">Pending action (default)</option>
                      <option value="processed">Processed only</option>
                      <option value="all">View all</option>
                      <option value="pending">pending only</option>
                      <option value="ai_parsed">ai_parsed only</option>
                      <option value="needs_more_info">needs_more_info only</option>
                      <option value="conflict">conflict only</option>
                      <option value="rejected">rejected only</option>
                      <option value="migrated_to_staging">migrated_to_staging only</option>
                      <option value="migrated_to_master">migrated_to_master only</option>
                    </select>
                    <select
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={reviewStageFilter}
                      onChange={(event) => {
                        setReviewStageFilter(event.target.value);
                        loadReviewGroups(reviewStatusFilter, event.target.value);
                      }}
                    >
                      <option value="">All review types</option>
                      <option value="to_staging">Awaiting Staging approval</option>
                      <option value="to_master">Awaiting Master approval</option>
                    </select>
                    <div className="text-xs leading-6 text-slate-500">
                      The default list shows groups that still need action. After a group is written to Staging or Master, or rejected, it is hidden here; use Processed or View all to find it again.
                    </div>
                    <div className="max-h-[650px] space-y-2 overflow-y-auto pr-1">
                      {reviewGroups.map((group) => (
                        <button
                          key={group.submission_group_id}
                          type="button"
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            selectedReviewGroupId === group.submission_group_id
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                          onClick={() => {
                            setSelectedReviewGroupId(group.submission_group_id);
                            loadReviewGroupDetail(group.submission_group_id);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{group.building_name}</div>
                              <div
                                className={`mt-1 text-xs ${
                                  selectedReviewGroupId === group.submission_group_id
                                    ? "text-slate-200"
                                    : "text-slate-500"
                                }`}
                              >
                                {group.source_file || "-"}
                              </div>
                            </div>
                            <StatusPill
                              tone={
                                group.review_status === "migrated_to_master"
                                  ? "green"
                                  : group.review_status === "conflict"
                                  ? "amber"
                                  : group.review_status === "rejected"
                                  ? "red"
                                  : "blue"
                              }
                            >
                              {group.review_status}
                            </StatusPill>
                          </div>
                          <div className="mt-2">
                            <StatusPill tone={group.approval_stage === "to_master" ? "amber" : "blue"}>
                              {group.approval_stage === "to_master" ? "Awaiting Master approval" : "Awaiting Staging approval"}
                            </StatusPill>
                          </div>
                          <div
                            className={`mt-2 text-xs ${
                              selectedReviewGroupId === group.submission_group_id
                                ? "text-slate-200"
                                : "text-slate-500"
                            }`}
                          >
                            {group.item_count} fields
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Review Details"
                  subtitle={
                    selectedReviewGroup?.approval_stage === "to_staging"
                      ? "Approval writes this review group to Staging."
                      : "Approval writes this review group to Master; only a Super Admin can approve it."
                  }
                  action={
                    selectedReviewGroup && ["admin", "super_admin"].includes(currentUser.role) ? (
                      <div className="flex items-center gap-2">
                        {selectedReviewGroup.source_document ? (
                          <button
                            type="button"
                            className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isReparsingReviewGroup}
                            onClick={handleReparseReviewGroup}
                          >
                            {isReparsingReviewGroup ? "Reprocessing…" : "Reprocess current source"}
                          </button>
                        ) : null}
                        {selectedReviewGroup.records?.every(
                          (record) => record.review_status !== "migrated_to_master"
                        ) ? (
                          <button
                            type="button"
                            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isDeletingReviewGroup}
                            onClick={handleDeleteReviewGroup}
                          >
                            {isDeletingReviewGroup ? "Deleting…" : "Delete current review group"}
                          </button>
                        ) : null}
                      </div>
                    ) : null
                  }
                >
                  {selectedReviewGroup ? (
                    <div className="space-y-5">
                      {selectedReviewGroup.approval_stage === "to_staging" ? (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Confirm Building</div>
                              <div className="mt-1 text-sm text-slate-600">
                                Current target:{" "}
                                {selectedReviewGroup.matched_staging_building
                                  ? `${selectedReviewGroup.matched_staging_building.building_name} · ${
                                      selectedReviewGroup.matched_staging_building.address || "Address unknown"
                                    }`
                                  : "New building awaiting confirmation (not linked to an existing Staging building)"}
                              </div>
                            </div>
                            <StatusPill tone={selectedReviewGroup.matched_staging_building ? "green" : "amber"}>
                              {selectedReviewGroup.matched_staging_building ? "Matched to Staging" : "Not matched"}
                            </StatusPill>
                          </div>
                          {selectedReviewGroup.can_confirm_staging_building ? (
                            <div className="mt-3 space-y-3">
                              <div className="flex gap-2">
                                <input
                                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  placeholder="Search existing Staging buildings"
                                  value={reviewBuildingSearch}
                                  onChange={(event) => setReviewBuildingSearch(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      loadReviewBuildingCandidates();
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                                  onClick={loadReviewBuildingCandidates}
                                >
                                  Search
                                </button>
                              </div>
                              {reviewBuildingCandidates.length ? (
                                <div className="max-h-56 space-y-2 overflow-y-auto">
                                  {reviewBuildingCandidates.map((candidate) => (
                                    <button
                                      key={candidate.id}
                                      type="button"
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-blue-300 disabled:opacity-60"
                                      disabled={isConfirmingReviewBuilding}
                                      onClick={() => handleConfirmReviewBuilding(candidate.id)}
                                    >
                                      <div className="font-semibold text-slate-900">{candidate.building_name}</div>
                                      <div className="mt-1 text-xs text-slate-500">{candidate.address || "Address unknown"}</div>
                                      <div className="mt-1 text-xs text-blue-700">{formatStagingLibraryStatus(candidate.library_status)}</div>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedReviewGroup.approval_stage === "to_master" ? (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Select Master Building</div>
                              <div className="mt-1 text-sm text-slate-600">
                                Current target:{" "}
                                {selectedReviewGroup.matched_master_building
                                  ? `${selectedReviewGroup.matched_master_building.building_name} · ${
                                      selectedReviewGroup.matched_master_building.address || "Address unknown"
                                    }`
                                  : selectedReviewGroup.building
                                  ? `${selectedReviewGroup.building.building_name} · ${
                                      selectedReviewGroup.building.address || "Address unknown"
                                    }`
                                  : "Not selected; approval will match Master by exact building name and address"}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-emerald-700">
                                After selection, approval updates the chosen Master building and will not create a new building because of an address difference.
                              </div>
                            </div>
                            <StatusPill tone={selectedReviewGroup.matched_master_building ? "green" : "amber"}>
                              {selectedReviewGroup.matched_master_building ? "Master selected" : "Not selected"}
                            </StatusPill>
                          </div>
                          {selectedReviewGroup.can_confirm_master_building ? (
                            <div className="mt-3 space-y-3">
                              <div className="flex gap-2">
                                <input
                                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  placeholder="Search existing Master buildings"
                                  value={reviewMasterBuildingSearch}
                                  onChange={(event) => setReviewMasterBuildingSearch(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      loadReviewMasterBuildingCandidates();
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                                  onClick={loadReviewMasterBuildingCandidates}
                                >
                                  Search
                                </button>
                              </div>
                              {reviewMasterBuildingCandidates.length ? (
                                <div className="max-h-56 space-y-2 overflow-y-auto">
                                  {reviewMasterBuildingCandidates.map((candidate) => (
                                    <button
                                      key={candidate.id}
                                      type="button"
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-emerald-300 disabled:opacity-60"
                                      disabled={isConfirmingReviewMasterBuilding}
                                      onClick={() => handleConfirmReviewMasterBuilding(candidate.id)}
                                    >
                                      <div className="font-semibold text-slate-900">{candidate.building_name}</div>
                                      <div className="mt-1 text-xs text-slate-500">{candidate.address || "Address unknown"}</div>
                                      <div className="mt-1 text-xs text-emerald-700">Master ID: {candidate.id}</div>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedReviewGroup.source_document ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone="blue">
                              {selectedReviewGroup.source_document.raw_input_type}
                            </StatusPill>
                            <StatusPill tone="slate">
                              {selectedReviewGroup.source_document.parser_type}
                            </StatusPill>
                          </div>
                          <div className="mt-3 text-sm font-medium text-slate-800">
                            Source file: {selectedReviewGroup.source_document.source_file}
                          </div>
                          {selectedReviewGroup.source_document.file_archive?.archive_label ? (
                            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                              <div>
                                Archive status: {selectedReviewGroup.source_document.file_archive.archive_label}
                              </div>
                              {selectedReviewGroup.source_document.file_archive.archive_path ? (
                                <div className="mt-1 break-all">
                                  Path: {selectedReviewGroup.source_document.file_archive.archive_path}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {(selectedReviewGroup.source_document.source_urls?.length
                            ? selectedReviewGroup.source_document.source_urls
                            : selectedReviewGroup.source_document.source_url
                            ? [selectedReviewGroup.source_document.source_url]
                            : []
                          ).length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(selectedReviewGroup.source_document.source_urls?.length
                                ? selectedReviewGroup.source_document.source_urls
                                : [selectedReviewGroup.source_document.source_url]
                              ).map((sourceUrl, index) => (
                                <button
                                  key={`${sourceUrl}-${index}`}
                                  type="button"
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                                  onClick={() =>
                                    openProtectedFile(
                                      sourceUrl,
                                      selectedReviewGroup.source_document.source_file || "Source file"
                                    )
                                  }
                                >
                                  {index === 0 ? "Open source file" : `Open source file ${index + 1}`}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <BusinessSummaryPanel
                            artifacts={selectedReviewGroup.source_document.parse_artifacts || {}}
                            llmLogs={selectedReviewGroup.source_document.llm_call_logs || []}
                          />
                          <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
                            {selectedReviewGroup.source_document.extracted_text ||
                              selectedReviewGroup.source_document.source_content ||
                              "No source text is available."}
                          </div>
                        </div>
                      ) : null}

                      <SummaryTable
                        title="Database Field View"
                        columns={selectedReviewGroup.insurance_database_view?.columns || []}
                        rows={selectedReviewGroup.insurance_database_view?.rows || []}
                        footer={
                          selectedReviewGroup.insurance_database_view ? (
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                                <div className="font-medium text-slate-900">Reason for Manual Review</div>
                                <div className="mt-2">
                                  <CollapsibleText
                                    text={(selectedReviewGroup.insurance_database_view.manual_review_reasons || []).join("\n")}
                                    emptyText="No additional manual-review reason."
                                  />
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                                <div className="font-medium text-slate-900">Insurance Source Excerpts</div>
                                <div className="mt-2">
                                  <CollapsibleText
                                    text={(selectedReviewGroup.insurance_database_view.original_quotes || []).join("\n\n")}
                                    emptyText="No key source excerpts are available."
                                  />
                                </div>
                              </div>
                            </div>
                          ) : null
                        }
                      />

                      <SummaryTable
                        title="Insurance Page Mapping"
                        columns={selectedReviewGroup.insurance_mapping_view?.columns || []}
                        rows={selectedReviewGroup.insurance_mapping_view?.rows || []}
                      />

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Explanation for Support Staff</div>
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                          <div className="whitespace-pre-wrap break-words">
                            {selectedReviewGroup.insurance_staff_explanation || "No staff explanation has been generated."}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <StatusPill tone="slate">No conflict: {reviewDecisionStats.nonConflictCount}</StatusPill>
                          <StatusPill tone={reviewDecisionStats.unresolvedConflictCount ? "red" : "green"}>
                            Unresolved conflicts: {reviewDecisionStats.unresolvedConflictCount}
                          </StatusPill>
                          <StatusPill tone="green">Will write: {reviewDecisionStats.writeCount}</StatusPill>
                          <StatusPill tone="slate">Skip / Keep existing: {reviewDecisionStats.skipCount}</StatusPill>
                        </div>
                        {reviewHasUnresolvedConflicts ? (
                          <div className="mt-2 text-xs leading-5 text-rose-700">
                            Conflicting fields still need a decision before this review can be approved.
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-5">
                        {groupReviewRecords(selectedReviewGroup.records, fieldDefinitions).map((group) => (
                          <section
                            key={group.groupKey}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                              <div className="text-sm font-semibold text-slate-900">{group.label}</div>
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                                {group.records.length} fields
                              </span>
                            </div>
                            <div className="mt-3 space-y-3">
                              {group.records.map((record) => (
                                <ReviewRecordCard
                                  key={record.record_id}
                                  record={record}
                                  fieldDefinitions={fieldDefinitions}
                                  value={reviewEdits[record.record_id] ?? ""}
                                  onChange={(event) =>
                                    setReviewEdits((prev) => ({
                                      ...prev,
                                      [record.record_id]: event.target.value,
                                    }))
                                  }
                                  resolution={effectiveReviewResolution(record, reviewResolutions)}
                                  onResolutionChange={(nextResolution) => {
                                    setReviewResolutions((prev) => ({
                                      ...prev,
                                      [record.record_id]: nextResolution,
                                    }));
                                    setReviewEdits((prev) => {
                                      const currentValue = prev[record.record_id] ?? "";
                                      if (nextResolution === "use_old") {
                                        return {
                                          ...prev,
                                          [record.record_id]: record.old_value || "",
                                        };
                                      }
                                      if (
                                        nextResolution === "use_new" &&
                                        currentValue === (record.old_value || "")
                                      ) {
                                        return {
                                          ...prev,
                                          [record.record_id]: record.new_value || "",
                                        };
                                      }
                                      return prev;
                                    });
                                  }}
                                />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>

                      <textarea
                        className="h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Review notes"
                        value={reviewComment}
                        onChange={(event) => setReviewComment(event.target.value)}
                      />
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                        {reviewApproveHint}
                      </div>
                      {canDecideSelectedReview ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isReviewMutating || reviewHasUnresolvedConflicts}
                            onClick={() => handleReviewAction("approved")}
                          >
                            {reviewApproveLabel}
                          </button>
                          <button
                            type="button"
                            className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isReviewMutating}
                            onClick={() => handleReviewAction("needs_more_info")}
                          >
                            Request more information
                          </button>
                          <button
                            type="button"
                            className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isReviewMutating}
                            onClick={() => handleReviewAction("conflict")}
                          >
                            Mark conflict
                          </button>
                          <button
                            type="button"
                            className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isReviewMutating}
                            onClick={() => handleReviewAction("rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                          This account can view the review group but cannot approve or reject it.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                      Select a review group on the left to see its source, AI extraction, existing and proposed values, and review actions.
                    </div>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {activeTab === "master" ? (
              <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
                <SectionCard
                  title="Master Buildings"
                  subtitle="Buildings whose reviewed records are approved as authoritative facts."
                >
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={masterSearch}
                        placeholder="Search Master by building name or address"
                        onChange={(event) => setMasterSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            loadMasterBuildings(masterSearch.trim());
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                        onClick={() => loadMasterBuildings(masterSearch.trim())}
                      >
                        Search
                      </button>
                    </div>
                    <div className="max-h-[650px] space-y-2 overflow-y-auto pr-1">
                      {masterBuildings.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            selectedBuildingId === item.id
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                          onClick={() => setSelectedBuildingId(item.id)}
                        >
                          <div className="text-sm font-semibold">{item.building_name}</div>
                          <div
                            className={`mt-1 text-xs ${
                              selectedBuildingId === item.id ? "text-slate-200" : "text-slate-500"
                            }`}
                          >
                            {item.address || "Address unknown"}
                          </div>
                        </button>
                      ))}
                      {masterBuildings.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                          {masterSearch.trim()
                            ? "No matching Master building was found."
                            : "There are no buildings in Master yet."}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Master Details"
                  subtitle="A Super Admin can edit Master directly. Saving synchronizes the master workbook and refreshes the source date automatically."
                  bodyClassName="max-h-[70vh] overflow-y-auto overscroll-contain p-5"
                  action={
                    currentUser.role === "super_admin" ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!selectedBuildingDetail || isDeletingMaster}
                          onClick={handleDeleteMasterBuilding}
                        >
                          {isDeletingMaster ? "Deleting..." : "Delete Building"}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!selectedBuildingDetail || isSavingMaster}
                          onClick={handleMasterSave}
                        >
                          {isSavingMaster ? "Saving..." : "Save Master"}
                        </button>
                      </div>
                    ) : null
                  }
                >
                  {selectedBuildingDetail ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-800">Basic Information</div>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          {["building_name", "address"].map((fieldKey) => (
                            <label key={fieldKey} className="block">
                              <span className="mb-1 block text-sm font-medium text-slate-700">
                                {normalizeFieldDisplay(fieldKey, fieldDefinitions)}
                              </span>
                              <textarea
                                disabled={currentUser.role !== "super_admin"}
                                className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                value={masterDraft[fieldKey] ?? ""}
                                onChange={(event) =>
                                  setMasterDraft((prev) => ({
                                    ...prev,
                                    [fieldKey]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-800">Move-In Requirements</div>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          {[
                            "insurance_required",
                            "insurance_coverage_amount",
                            "insurance_coi_required",
                            "insurance_coi_trigger",
                            "electricity_required",
                            "electricity_provider",
                            "key_pickup_notes",
                            "service_elevator_booking_notes",
                            "move_in_notes",
                            "info_cutoff_date",
                            "source_type",
                            "source_file",
                          ].map((fieldKey) => (
                            <label key={fieldKey} className="block">
                              <span className="mb-1 block text-sm font-medium text-slate-700">
                                {normalizeFieldDisplay(fieldKey, fieldDefinitions)}
                              </span>
                              {isBooleanField(fieldKey, fieldDefinitions) ? (
                                <select
                                  disabled={currentUser.role !== "super_admin"}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={String(masterDraft[fieldKey] ?? "")}
                                  onChange={(event) =>
                                    setMasterDraft((prev) => ({
                                      ...prev,
                                      [fieldKey]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Unknown</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                  {supportsOptionalBoolean(fieldKey) ? (
                                    <option value="optional">Optional</option>
                                  ) : null}
                                </select>
                              ) : isInsuranceStatusField(fieldKey) ? (
                                <select
                                  disabled={currentUser.role !== "super_admin"}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={String(masterDraft[fieldKey] ?? "")}
                                  onChange={(event) =>
                                    setMasterDraft((prev) => ({
                                      ...prev,
                                      [fieldKey]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Not mentioned</option>
                                  <option value="yes">Yes</option>
                                  <option value="no">No</option>
                                  <option value="optional">Optional</option>
                                  <option value="manual_review">Needs human review</option>
                                </select>
                              ) : (
                                <textarea
                                  disabled={currentUser.role !== "super_admin"}
                                  className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={masterDraft[fieldKey] ?? ""}
                                  onChange={(event) =>
                                    setMasterDraft((prev) => ({
                                      ...prev,
                                      [fieldKey]: event.target.value,
                                    }))
                                  }
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">Internet Setup</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              Track the four standard providers with structured statuses. Record plans and contacts on each provider card, and put additional providers or unstructured details in Internet Notes.
                            </div>
                          </div>
                          <StatusPill tone="blue">Providers summarized on save</StatusPill>
                        </div>
                          <div className="mt-3 grid gap-4">
                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              {normalizeFieldDisplay("internet_self_setup_required", fieldDefinitions)}
                            </span>
                            <select
                              disabled={currentUser.role !== "super_admin"}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                              value={String(masterDraft.internet_self_setup_required ?? "")}
                              onChange={(event) =>
                                setMasterDraft((prev) => ({
                                  ...prev,
                                  internet_self_setup_required: event.target.value,
                                }))
                              }
                            >
                              <option value="">Unknown</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                              <option value="optional">Optional</option>
                            </select>
                          </label>

                          <div className="grid gap-4 md:grid-cols-2">
                            {NETWORK_PROVIDER_FIELDS.map((item) => (
                              <NetworkProviderEditorCard
                                key={item.fieldKey}
                                provider={item}
                                draft={masterDraft}
                                disabled={currentUser.role !== "super_admin"}
                                onStatusChange={(value) =>
                                  setMasterDraft((prev) => ({
                                    ...prev,
                                    [item.fieldKey]: value,
                                  }))
                                }
                                onPlanToggle={(planValue) =>
                                  setMasterDraft((prev) => ({
                                    ...prev,
                                    [item.planFieldKey]: togglePlanTierValue(prev[item.planFieldKey], planValue),
                                    [item.fieldKey]:
                                      prev[item.fieldKey] === "false" || !prev[item.fieldKey]
                                        ? "true"
                                        : prev[item.fieldKey],
                                  }))
                                }
                                onPlanTextChange={(value) =>
                                  setMasterDraft((prev) => ({
                                    ...prev,
                                    [item.planFieldKey]: value,
                                  }))
                                }
                                onNoteTextChange={(value) =>
                                  setMasterDraft((prev) => ({
                                    ...prev,
                                    [item.noteFieldKey]: value,
                                  }))
                                }
                              />
                            ))}
                          </div>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Additional Internet Providers
                            </span>
                            <textarea
                              disabled={currentUser.role !== "super_admin"}
                              className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                              placeholder="Example: Honest Networks"
                              value={masterDraft.internet_provider ?? ""}
                              onChange={(event) =>
                                setMasterDraft((prev) => ({
                                  ...prev,
                                  internet_provider: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Internet Notes
                            </span>
                            <textarea
                              disabled={currentUser.role !== "super_admin"}
                              className="min-h-[120px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                              placeholder="Add providers outside the standard four or other unstructured details. Put contacts for the four standard providers in their own notes."
                              value={masterDraft.internet_notes ?? ""}
                              onChange={(event) =>
                                setMasterDraft((prev) => ({
                                  ...prev,
                                  internet_notes: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>

                      {Object.entries(dynamicDetailFieldsByGroup(fieldDefinitions, "master")).length ? (
                        <div className="space-y-4">
                          {Object.entries(dynamicDetailFieldsByGroup(fieldDefinitions, "master")).map(
                            ([groupKey, fields]) => (
                              <div
                                key={groupKey}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <div className="text-sm font-semibold text-slate-800">
                                  {FIELD_GROUP_LABELS[groupKey] || groupKey}
                                </div>
                                <div className="mt-3 grid gap-4 md:grid-cols-2">
                                  {fields.map((field) => (
                                    <label key={field.field_key} className="block">
                                      <span className="mb-1 block text-sm font-medium text-slate-700">
                                        {field.display_name}
                                      </span>
                                      <DynamicFieldEditor
                                        field={field}
                                        value={masterDraft[field.field_key] ?? ""}
                                        disabled={currentUser.role !== "super_admin"}
                                        fieldDefinitions={fieldDefinitions}
                                        onChange={(nextValue) =>
                                          setMasterDraft((prev) => ({
                                            ...prev,
                                            [field.field_key]: nextValue,
                                          }))
                                        }
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                          There are no additional dynamic fields.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                      Select a Master building on the left to view its structured details.
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Staff-Friendly Summary"
                  subtitle="Shows only approved Master facts and structured internet information; unreviewed information is excluded."
                  bodyClassName="max-h-[70vh] overflow-y-auto overscroll-contain p-5"
                >
                  {selectedBuildingDetail ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Master Summary</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              Refreshes automatically when you select a building and uses only Master facts.
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <StatusPill tone={masterSummary?.ai_summary ? "blue" : "slate"}>
                              {masterSummary?.ai_summary ? "AI Enhanced" : "Structured Fallback"}
                            </StatusPill>
                            {masterSummary?.cache_status ? (
                              <StatusPill tone={masterSummary.cache_status === "hit" ? "green" : "amber"}>
                                {masterSummary.cache_status === "hit" ? "Cached Summary" : masterSummary.cache_status === "miss" ? "New AI Summary" : "Cache Disabled"}
                              </StatusPill>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                          {isMasterSummaryLoading ? (
                            <div className="text-slate-500">Generating the Master summary...</div>
                          ) : masterSummary?.ai_summary ? (
                            <div className="prose prose-sm max-w-none prose-p:my-1">
                              <ReactMarkdown>{masterSummary.ai_summary}</ReactMarkdown>
                            </div>
                          ) : masterSummary?.ai_enabled ? (
                            <div className="text-slate-500">No AI summary was generated this time; the approved fact summary remains below.</div>
                          ) : (
                            <div className="text-slate-500">
                              No external AI is configured. The AI summary is disabled, but the structured Master summary remains available below.
                            </div>
                          )}
                        </div>
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                            Approved Fact Summary
                          </div>
                          <div className="whitespace-pre-wrap break-words">
                            {masterSummary?.fact_summary || "No Master summary is currently available."}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Internet Summary</div>
                        <div className="mt-4">
                          <NetworkDetails
                            network={masterSummary?.network}
                            emptyMessage="No structured internet summary is currently available in Master."
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Master Record Metadata</div>
                        <div className="mt-3 grid gap-3">
                          <ReadOnlyMetaRow
                            label="Source Date (Automatic)"
                            value={formatDateTime(selectedBuildingDetail.source_date)}
                          />
                          <ReadOnlyMetaRow
                            label="Last Verified"
                            value={formatDateTime(selectedBuildingDetail.last_verified_at)}
                          />
                          <ReadOnlyMetaRow
                            label="Record Completeness"
                            value={`${
                              selectedBuildingDetail.completeness_status === "verified_complete"
                                ? "Verified Complete"
                                : "Verified but Incomplete"
                            } · ${selectedBuildingDetail.completeness_score ?? 0}/100`}
                          />
                          <ReadOnlyMetaRow
                            label="Human Verification Note"
                            value={selectedBuildingDetail.verification_note || "Not provided"}
                          />
                          <ReadOnlyMetaRow
                            label="Last Updated"
                            value={formatDateTime(selectedBuildingDetail.updated_at)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                      Select a Master building to view a staff-friendly summary and internet overview.
                    </div>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {activeTab === "staging" ? (
              <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
                <SectionCard
                  title="Staging Buildings"
                  subtitle="This list reads from the SQLite mirror of the Staging workbook. It preserves the building directory and holds supplemental information not yet approved for Master."
                  action={
                    canCreateStagingBuilding ? (
                      <button
                        type="button"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        onClick={() =>
                          openStagingCreate("staging", {
                            building_name: stagingSearch.trim(),
                          })
                        }
                      >
                        Add Building
                      </button>
                    ) : null
                  }
                >
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={stagingSearch}
                        placeholder="Search Staging by building name or address"
                        onChange={(event) => setStagingSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            loadStagingBuildings(stagingSearch.trim());
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                        onClick={() => loadStagingBuildings(stagingSearch.trim())}
                      >
                        Search
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {[
                        ["all", "All"],
                        ["临时", "Staging"],
                        ["待补充", "Needs More Information"],
                        ["已入正式", "Promoted to Master"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 font-medium transition ${
                            stagingStatusFilter === value
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                          }`}
                          onClick={() => setStagingStatusFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-[650px] space-y-2 overflow-y-auto pr-1">
                      {visibleStagingBuildings.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            selectedStagingKey === item.id
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                          onClick={() => setSelectedStagingKey(item.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{item.building_name}</div>
                              <div
                                className={`mt-1 text-xs ${
                                  selectedStagingKey === item.id ? "text-slate-200" : "text-slate-500"
                                }`}
                              >
                                {item.address || "Address unknown"}
                              </div>
                            </div>
                            <StatusPill
                              tone={
                                item.library_status === "已入正式"
                                  ? "green"
                                  : item.library_status === "临时"
                                  ? "blue"
                                  : "amber"
                              }
                            >
                              {item.library_status === "已入正式"
                                ? "Promoted to Master"
                                : item.library_status === "临时"
                                ? "Staging"
                                : item.library_status === "待补充"
                                ? "Needs More Information"
                                : item.library_status || "Needs More Information"}
                            </StatusPill>
                          </div>
                          <div
                            className={`mt-2 text-xs ${
                              selectedStagingKey === item.id ? "text-slate-200" : "text-slate-500"
                            }`}
                          >
                            {item.pending_count || 0} current fields
                          </div>
                        </button>
                      ))}
                      {visibleStagingBuildings.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                          {stagingSearch.trim() || stagingStatusFilter !== "all"
                            ? "No matching Staging building was found."
                            : "There are no readable Staging buildings. Synchronize the Staging workbook or import a new one first."}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Staging Details"
                  subtitle="Edits here update the Staging workbook and its mirror only. Promotion to Master requires a separate review submission."
                  bodyClassName="max-h-[70vh] overflow-y-auto overscroll-contain p-5"
                  action={
                    currentUser.role !== "viewer" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {["admin", "super_admin"].includes(currentUser.role) ? (
                          <button
                            type="button"
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={
                              !selectedStagingDetail ||
                              !selectedStagingCanPromote ||
                              isSubmittingStagingReview ||
                              isSavingStaging
                            }
                            onClick={handleSubmitStagingForReview}
                          >
                            {isSubmittingStagingReview ? "Submitting..." : "Submit for Master Review"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!selectedStagingDetail || isSavingStaging}
                          onClick={handleStagingSave}
                        >
                          {isSavingStaging
                            ? "Submitting..."
                            : currentUser.role === "employee"
                            ? "Submit Staging Update Request"
                            : "Save Staging"}
                        </button>
                      </div>
                    ) : null
                  }
                >
                  {selectedStagingDetail ? (
                    <div className="space-y-5">
                      {!selectedStagingCanPromote ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          This record contains only basic directory information and cannot be promoted to Master. Add business fields, save the record, and then submit it for review.
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-800">Basic Information</div>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          {["building_name", "address"].map((fieldKey) => (
                            <label key={fieldKey} className="block">
                              <span className="mb-1 block text-sm font-medium text-slate-700">
                                {normalizeFieldDisplay(fieldKey, fieldDefinitions)}
                              </span>
                              <textarea
                                disabled={currentUser.role === "viewer"}
                                className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                value={stagingDraft[fieldKey] ?? ""}
                                onChange={(event) =>
                                  setStagingDraft((prev) => ({
                                    ...prev,
                                    [fieldKey]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-800">Staging Business Information</div>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          {[
                            "insurance_required",
                            "insurance_coverage_amount",
                            "insurance_coi_required",
                            "insurance_coi_trigger",
                            "electricity_required",
                            "electricity_provider",
                            "key_pickup_notes",
                            "service_elevator_booking_notes",
                            "move_in_notes",
                          ].map((fieldKey) => (
                            <label key={fieldKey} className="block">
                              <span className="mb-1 block text-sm font-medium text-slate-700">
                                {normalizeFieldDisplay(fieldKey, fieldDefinitions)}
                              </span>
                              {isBooleanField(fieldKey, fieldDefinitions) ? (
                                <select
                                  disabled={currentUser.role === "viewer"}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={String(stagingDraft[fieldKey] ?? "")}
                                  onChange={(event) =>
                                    setStagingDraft((prev) => ({
                                      ...prev,
                                      [fieldKey]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Unknown</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                  {supportsOptionalBoolean(fieldKey) ? (
                                    <option value="optional">Optional</option>
                                  ) : null}
                                </select>
                              ) : isInsuranceStatusField(fieldKey) ? (
                                <select
                                  disabled={currentUser.role === "viewer"}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={String(stagingDraft[fieldKey] ?? "")}
                                  onChange={(event) =>
                                    setStagingDraft((prev) => ({
                                      ...prev,
                                      [fieldKey]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Not mentioned</option>
                                  <option value="yes">Yes</option>
                                  <option value="no">No</option>
                                  <option value="optional">Optional</option>
                                  <option value="manual_review">Needs human review</option>
                                </select>
                              ) : (
                                <textarea
                                  disabled={currentUser.role === "viewer"}
                                  className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                  value={stagingDraft[fieldKey] ?? ""}
                                  onChange={(event) =>
                                    setStagingDraft((prev) => ({
                                      ...prev,
                                      [fieldKey]: event.target.value,
                                    }))
                                  }
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">Internet Setup</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              This updates the Staging workbook. Track the four standard providers with structured statuses, and record plans and contacts on their respective cards.
                            </div>
                          </div>
                          <StatusPill tone="blue">Providers summarized on save</StatusPill>
                        </div>
                        <div className="mt-3 grid gap-4">
                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              {normalizeFieldDisplay("internet_self_setup_required", fieldDefinitions)}
                            </span>
                            <select
                              disabled={currentUser.role === "viewer"}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                              value={String(stagingDraft.internet_self_setup_required ?? "")}
                              onChange={(event) =>
                                setStagingDraft((prev) => ({
                                  ...prev,
                                  internet_self_setup_required: event.target.value,
                                }))
                              }
                            >
                              <option value="">Unknown</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                              <option value="optional">Optional</option>
                            </select>
                          </label>

                          <div className="grid gap-4 md:grid-cols-2">
                            {NETWORK_PROVIDER_FIELDS.map((item) => (
                              <NetworkProviderEditorCard
                                key={item.fieldKey}
                                provider={item}
                                draft={stagingDraft}
                                disabled={currentUser.role === "viewer"}
                                onStatusChange={(value) =>
                                  setStagingDraft((prev) => ({
                                    ...prev,
                                    [item.fieldKey]: value,
                                  }))
                                }
                                onPlanToggle={(planValue) =>
                                  setStagingDraft((prev) => ({
                                    ...prev,
                                    [item.planFieldKey]: togglePlanTierValue(prev[item.planFieldKey], planValue),
                                    [item.fieldKey]:
                                      prev[item.fieldKey] === "false" || !prev[item.fieldKey]
                                        ? "true"
                                        : prev[item.fieldKey],
                                  }))
                                }
                                onPlanTextChange={(value) =>
                                  setStagingDraft((prev) => ({
                                    ...prev,
                                    [item.planFieldKey]: value,
                                  }))
                                }
                                onNoteTextChange={(value) =>
                                  setStagingDraft((prev) => ({
                                    ...prev,
                                    [item.noteFieldKey]: value,
                                  }))
                                }
                              />
                            ))}
                          </div>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Additional Internet Providers
                            </span>
                            <textarea
                              disabled={currentUser.role === "viewer"}
                              className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                              placeholder="Example: Honest Networks"
                              value={stagingDraft.internet_provider ?? ""}
                              onChange={(event) =>
                                setStagingDraft((prev) => ({
                                  ...prev,
                                  internet_provider: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Internet Notes
                            </span>
                            <textarea
                              disabled={currentUser.role === "viewer"}
                              className="min-h-[120px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                              placeholder="Add providers outside the standard four or other unstructured details. Put contacts for the four standard providers in their own notes."
                              value={stagingDraft.internet_notes ?? ""}
                              onChange={(event) =>
                                setStagingDraft((prev) => ({
                                  ...prev,
                                  internet_notes: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>

                      {Object.entries(dynamicDetailFieldsByGroup(fieldDefinitions, "staging")).length ? (
                        <div className="space-y-4">
                          {Object.entries(dynamicDetailFieldsByGroup(fieldDefinitions, "staging")).map(
                            ([groupKey, fields]) => (
                              <div
                                key={groupKey}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <div className="text-sm font-semibold text-slate-800">
                                  {FIELD_GROUP_LABELS[groupKey] || groupKey}
                                </div>
                                <div className="mt-3 grid gap-4 md:grid-cols-2">
                                  {fields.map((field) => (
                                    <label key={field.field_key} className="block">
                                      <span className="mb-1 block text-sm font-medium text-slate-700">
                                        {field.display_name}
                                      </span>
                                      <DynamicFieldEditor
                                        field={field}
                                        value={stagingDraft[field.field_key] ?? ""}
                                        disabled={currentUser.role === "viewer"}
                                        fieldDefinitions={fieldDefinitions}
                                        onChange={(nextValue) =>
                                          setStagingDraft((prev) => ({
                                            ...prev,
                                            [field.field_key]: nextValue,
                                          }))
                                        }
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                      Select a Staging building on the left to view its structured workbook details.
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Staging Status"
                  subtitle="The Staging workbook is the editable source. SQLite is its mirror for Q&A, search, and manual Master-review submissions."
                  bodyClassName="max-h-[70vh] overflow-y-auto overscroll-contain p-5"
                >
                  {selectedStagingDetail ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Staging Summary</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              Generated only from the current Staging record; it is not yet approved for Master.
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <StatusPill tone={stagingSummary?.ai_summary ? "blue" : "slate"}>
                              {stagingSummary?.ai_summary ? "AI Enhanced" : "Structured Fallback"}
                            </StatusPill>
                            {stagingSummary?.cache_status ? (
                              <StatusPill tone={stagingSummary.cache_status === "hit" ? "green" : "amber"}>
                                {stagingSummary.cache_status === "hit" ? "Cached Summary" : stagingSummary.cache_status === "miss" ? "New AI Summary" : "Cache Disabled"}
                              </StatusPill>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                          {isStagingSummaryLoading ? (
                            <div className="text-slate-500">Generating the Staging summary...</div>
                          ) : stagingSummary?.ai_summary ? (
                            <div className="prose prose-sm max-w-none prose-p:my-1">
                              <ReactMarkdown>{stagingSummary.ai_summary}</ReactMarkdown>
                            </div>
                          ) : stagingSummary?.ai_enabled ? (
                            <div className="text-slate-500">
                              No AI summary was generated this time; the structured Staging summary remains below.
                            </div>
                          ) : (
                            <div className="text-slate-500">
                              No external AI is configured, but the structured Staging summary remains available below.
                            </div>
                          )}
                        </div>
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                            Structured Staging Summary
                          </div>
                          <div className="whitespace-pre-wrap break-words">
                            {stagingSummary?.fact_summary || "No Staging summary is currently available."}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Current Status</div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusPill
                            tone={
                              selectedStagingDetail.library_status === "已入正式"
                                ? "green"
                                : selectedStagingDetail.library_status === "临时"
                                ? "blue"
                                : "amber"
                            }
                          >
                            {selectedStagingDetail.library_status === "已入正式"
                              ? "Promoted to Master"
                              : selectedStagingDetail.library_status === "临时"
                              ? "Staging"
                              : selectedStagingDetail.library_status === "待补充"
                              ? "Needs More Information"
                              : selectedStagingDetail.library_status || "Needs More Information"}
                          </StatusPill>
                          <span className="text-xs text-slate-500">
                            Saving refreshes the Staging mirror automatically. Promotion to Master requires a manual review submission.
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Staging Source</div>
                        <div className="mt-3 grid gap-3">
                          <ReadOnlyMetaRow
                            label="Staging Workbook"
                            value={masterExcelStatus?.staging_excel?.path || overview?.staging_excel_path}
                          />
                          <ReadOnlyMetaRow
                            label="Source File"
                            value={selectedStagingDetail.source_file || "staging.xlsx"}
                          />
                          <ReadOnlyMetaRow
                            label="Mirror Source Date"
                            value={formatDateTime(selectedStagingDetail.source_date)}
                          />
                          <ReadOnlyMetaRow
                            label="Current Fields"
                            value={`${selectedStagingDetail.pending_count || 0}`}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">How to Use Staging</div>
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                          Use Staging to capture the building name, address, and partial information as it arrives. Employees submit update requests; administrators may save Staging directly and initiate Master review. Data reaches Master only after Super Admin approval. After promotion, the building remains in Staging and its status changes to “Promoted to Master.”
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                      Select a Staging building to view its current status and source information.
                    </div>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {activeTab === "system_update" && currentUser.role === "super_admin" ? (
              (() => {
                const status = systemUpdateStatus || {};
                const lastUpdate = status.last_update || {};
                const updateBlocked = status.dirty && !systemUpdateOptions.allow_dirty;
                const logLines = [
                  ...(lastUpdate.stdout_tail || []),
                  ...(lastUpdate.stderr_tail || []),
                ].slice(-80);
                return (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <SectionCard
                      title="System Update"
                      subtitle="For local-network deployments. Back up the database and uploaded files, then pull the new version from the configured Git repository and build the frontend."
                      action={
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isCheckingSystemUpdate || isRunningSystemUpdate}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() =>
                              loadSystemUpdateStatus({ checkRemote: true }).catch((error) =>
                                setPageError(error.message || "Failed to check for updates.")
                              )
                            }
                          >
                            {isCheckingSystemUpdate ? "Checking..." : "Check Remote Version"}
                          </button>
                          <button
                            type="button"
                            disabled={!status.enabled || isRunningSystemUpdate || updateBlocked}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={handleRunSystemUpdate}
                          >
                            {isRunningSystemUpdate ? "Updating..." : "Back Up and Update"}
                          </button>
                        </div>
                      }
                    >
                      {!status.enabled ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          {status.reason || "Remote updates are not currently available for this directory."}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-xs font-medium text-slate-500">Current Branch</div>
                              <div className="mt-2 font-semibold text-slate-900">{status.branch || "Unknown"}</div>
                              <div className="mt-1 text-xs text-slate-500">{status.upstream || "No upstream configured"}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-xs font-medium text-slate-500">Local Version</div>
                              <div className="mt-2 font-semibold text-slate-900">{status.current_short || "Unknown"}</div>
                              <div className="mt-1 truncate text-xs text-slate-500">{status.current_commit || "—"}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-xs font-medium text-slate-500">Remote Version</div>
                              <div className="mt-2 font-semibold text-slate-900">{status.remote_short || "Not checked"}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Behind {status.behind || 0} · Ahead {status.ahead || 0}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-xs font-medium text-slate-500">Update Status</div>
                              <div className="mt-2">
                                <StatusPill tone={status.update_available ? "amber" : "green"}>
                                  {status.update_available ? "Update Available" : "Up to Date"}
                                </StatusPill>
                              </div>
                              <div className="mt-2">
                                <StatusPill tone={status.dirty ? "red" : "slate"}>
                                  {status.dirty ? "Uncommitted Changes" : "Working Tree Clean"}
                                </StatusPill>
                              </div>
                            </div>
                          </div>

                          {status.fetch_error ? (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                              Remote check failed: {status.fetch_error}
                            </div>
                          ) : null}

                          {status.dirty ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                              <div className="font-semibold">Uncommitted local changes detected</div>
                              <div className="mt-1 text-amber-700">Commit local changes to the configured repository before updating to avoid overwrites or conflicts.</div>
                              <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-white/70 p-3 text-xs text-amber-900">
                                {(status.dirty_preview || []).join("\n") || "No preview available"}
                              </pre>
                            </div>
                          ) : null}

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="font-semibold text-slate-900">Update Options</div>
                            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={systemUpdateOptions.restart_after_update}
                                onChange={(event) =>
                                  setSystemUpdateOptions((prev) => ({
                                    ...prev,
                                    restart_after_update: event.target.checked,
                                  }))
                                }
                              />
                              <span>Restart the backend automatically after the update so the new version takes effect.</span>
                            </label>
                            <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={systemUpdateOptions.allow_dirty}
                                onChange={(event) =>
                                  setSystemUpdateOptions((prev) => ({
                                    ...prev,
                                    allow_dirty: event.target.checked,
                                  }))
                                }
                              />
                              <span>Allow updates with uncommitted changes. Use this only after confirming the changes are backed up or may safely be overwritten.</span>
                            </label>
                          </div>

                          {lastUpdate.started_at ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-900">Most Recent Update</div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {formatDateTime(lastUpdate.started_at)} - {formatDateTime(lastUpdate.completed_at)}
                                  </div>
                                </div>
                                <StatusPill tone={lastUpdate.ok ? "green" : "red"}>
                                  {lastUpdate.ok ? "Succeeded" : "Failed"}
                                </StatusPill>
                              </div>
                              {logLines.length ? (
                                <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 text-xs leading-5 text-slate-100">
                                  {logLines.join("\n")}
                                </pre>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Recommended Deployment" subtitle="A cost-effective approach for local execution and LAN access.">
                      <div className="space-y-3 text-sm leading-6 text-slate-600">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="font-semibold text-slate-900">Keep Code in a Versioned Git Repository</div>
                          <div className="mt-1">Develop and commit on the primary machine; the office machine pulls only stable versions.</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="font-semibold text-slate-900">Keep Business Data Local</div>
                          <div className="mt-1">The update script first backs up SQLite and uploaded files; it never pushes business data to Git.</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="font-semibold text-slate-900">Migrate to a Server Later</div>
                          <div className="mt-1">The same backend, frontend, and database-migration logic can move to a cloud host.</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                          Update script: {status.update_script || "Not loaded"}<br />
                          Git path: {status.git_root || "Not loaded"}<br />
                          Restart marker: {status.restart_marker || "Not loaded"}
                        </div>
                      </div>
                    </SectionCard>
                  </div>
                );
              })()
            ) : null}

            {activeTab === "accounts" && currentUser.role === "super_admin" ? (
              <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
                <SectionCard
                  title="Create Internal Account"
                  subtitle="Self-registration is disabled. A Super Admin creates support, administrator, and read-only accounts."
                >
                  <form className="space-y-4" onSubmit={handleCreateAdminUser}>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Example: amy.cs"
                        value={adminUserForm.username}
                        onChange={(event) =>
                          setAdminUserForm((prev) => ({ ...prev, username: event.target.value }))
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Display Name</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Support staff name"
                        value={adminUserForm.display_name}
                        onChange={(event) =>
                          setAdminUserForm((prev) => ({ ...prev, display_name: event.target.value }))
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
                      <select
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={adminUserForm.role}
                        onChange={(event) =>
                          setAdminUserForm((prev) => ({ ...prev, role: event.target.value }))
                        }
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Initial Password</span>
                      <input
                        type="password"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={adminUserForm.password}
                        onChange={(event) =>
                          setAdminUserForm((prev) => ({ ...prev, password: event.target.value }))
                        }
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isAccountBusy}
                      className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAccountBusy ? "Creating..." : "Create Account"}
                    </button>
                  </form>
                </SectionCard>

                <SectionCard
                  title="Accounts"
                  subtitle="Deactivate accounts, change roles, or reset passwords. Deactivation clears the account’s active sessions."
                  action={
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => loadAdminUsers().catch((error) => setPageError(error.message))}
                    >
                      Refresh
                    </button>
                  }
                >
                  <div className="space-y-3">
                    {adminUsers.map((userItem) => {
                      const draft = adminUserDrafts[userItem.id] || {
                        display_name: userItem.display_name || "",
                        role: userItem.role || "employee",
                        is_active: Boolean(userItem.is_active),
                      };
                      return (
                        <div key={userItem.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{userItem.username}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Created: {formatDateTime(userItem.created_at)} · Updated: {formatDateTime(userItem.updated_at)}
                              </div>
                            </div>
                            <StatusPill tone={userItem.is_active ? "green" : "slate"}>
                              {userItem.is_active ? "Active" : "Inactive"}
                            </StatusPill>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Display Name</span>
                              <input
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={draft.display_name}
                                onChange={(event) =>
                                  setAdminUserDrafts((prev) => ({
                                    ...prev,
                                    [userItem.id]: { ...draft, display_name: event.target.value },
                                  }))
                                }
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Role</span>
                              <select
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={draft.role}
                                onChange={(event) =>
                                  setAdminUserDrafts((prev) => ({
                                    ...prev,
                                    [userItem.id]: { ...draft, role: event.target.value },
                                  }))
                                }
                              >
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
                              <select
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={draft.is_active ? "1" : "0"}
                                onChange={(event) =>
                                  setAdminUserDrafts((prev) => ({
                                    ...prev,
                                    [userItem.id]: { ...draft, is_active: event.target.value === "1" },
                                  }))
                                }
                              >
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                              </select>
                            </label>
                          </div>
                          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end">
                            <label className="block flex-1">
                              <span className="mb-1 block text-xs font-medium text-slate-500">Reset Password</span>
                              <input
                                type="password"
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                placeholder="Enter a new password, then click Reset"
                                value={adminUserResetPasswords[userItem.id] || ""}
                                onChange={(event) =>
                                  setAdminUserResetPasswords((prev) => ({
                                    ...prev,
                                    [userItem.id]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            <button
                              type="button"
                              disabled={isAccountBusy}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => handleUpdateAdminUser(userItem)}
                            >
                              Save Account
                            </button>
                            <button
                              type="button"
                              disabled={isAccountBusy}
                              className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => handleResetAdminUserPassword(userItem)}
                            >
                              Reset Password
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {adminUsers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                        No account data is available.
                      </div>
                    ) : null}
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {activeTab === "logs" ? (
              <SectionCard
                title="Audit Log"
                subtitle="Every significant write operation should leave an auditable record here."
                action={
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={loadAuditLogs}
                  >
                    Refresh
                  </button>
                }
              >
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Action type"
                    value={auditFilters.action_type}
                    onChange={(event) => handleAuditFilterChange({ action_type: event.target.value })}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Building name"
                    value={auditFilters.building_name}
                    onChange={(event) => handleAuditFilterChange({ building_name: event.target.value })}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Field name"
                    value={auditFilters.field_name}
                    onChange={(event) => handleAuditFilterChange({ field_name: event.target.value })}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Role"
                    value={auditFilters.user_role}
                    onChange={(event) => handleAuditFilterChange({ user_role: event.target.value })}
                  />
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    onClick={() => loadAuditLogs(auditFilters)}
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={() => {
                      const nextFilters = {
                        action_type: "",
                        building_name: "",
                        field_name: "",
                        user_role: "",
                      };
                      setAuditFilters(nextFilters);
                      loadAuditLogs(nextFilters);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Building</th>
                        <th className="px-4 py-3 font-medium">Field</th>
                        <th className="px-4 py-3 font-medium">Change</th>
                        <th className="px-4 py-3 font-medium">Operation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 align-top text-slate-500">{log.created_at}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{log.action_type}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{log.user_role}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{log.building_name || "—"}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{log.field_name || "—"}</td>
                          <td className="px-4 py-3 align-top text-xs text-slate-500">
                            <div>old: {log.old_value || "—"}</div>
                            <div className="mt-1">new: {log.new_value || "—"}</div>
                            {log.note ? <div className="mt-1 text-slate-400">{log.note}</div> : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {currentUser.role === "super_admin" &&
                            log.target_record_id &&
                            log.field_name &&
                            ["master_direct_update", "staging_approved_to_master", "master_rollback"].includes(
                              log.action_type
                            ) ? (
                              <button
                                type="button"
                                disabled={isRollingBack}
                                className="rounded-xl border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleRollbackLog(log)}
                              >
                                {isRollingBack ? "Rolling Back..." : "Roll Back to Previous Version"}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "fields" ? (
              <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
                <SectionCard
                  title="Add a Field"
                  subtitle="Enter a field name and requirement. AI drafts the field definition; approval extends the master workbook, Staging workbook, and SQLite mirrors."
                  action={
                    currentUser.role === "super_admin" ? (
                      <button
                        type="button"
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                        onClick={handleResetStandardFields}
                      >
                        Reset to Standard Headers
                      </button>
                    ) : null
                  }
                >
                  <form className="space-y-4" onSubmit={handleDraftFieldRequest}>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Field Name</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Example: Move-In Deposit Instructions"
                        value={fieldRequestForm.display_name}
                        onChange={(event) =>
                          setFieldRequestForm((prev) => ({
                            ...prev,
                            display_name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Requirement Description</span>
                      <textarea
                        className="min-h-[120px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Describe what the field should record, where it should appear, and how staff might ask about it."
                        value={fieldRequestForm.requirement_text}
                        onChange={(event) =>
                          setFieldRequestForm((prev) => ({
                            ...prev,
                            requirement_text: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isDraftingField}
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDraftingField ? "Generating..." : "Generate Field Draft with AI"}
                    </button>
                  </form>

                  {fieldDraft ? (
                    <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Review Field Draft</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Edit the draft, then either activate it directly or submit it for approval.
                          </div>
                        </div>
                        <StatusPill tone="blue">AI Draft</StatusPill>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">Field Display Name</span>
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={fieldDraft.display_name || ""}
                            onChange={(event) => patchFieldDraft("display_name", event.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">System Field Key</span>
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={fieldDraft.field_key || ""}
                            onChange={(event) => patchFieldDraft("field_key", event.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">Field Type</span>
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={fieldDraft.field_type || "text"}
                            onChange={(event) => patchFieldDraft("field_type", event.target.value)}
                          >
                            <option value="text">Text</option>
                            <option value="boolean">Boolean</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">Group</span>
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={fieldDraft.group_key || "custom"}
                            onChange={(event) => patchFieldDraft("group_key", event.target.value)}
                          >
                            {Object.entries(FIELD_GROUP_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">Excel Column Name</span>
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={fieldDraft.excel_header_name || ""}
                            onChange={(event) => patchFieldDraft("excel_header_name", event.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">Write Scope</span>
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={fieldDraft.scope || "master_and_staging"}
                            onChange={(event) => patchFieldDraft("scope", event.target.value)}
                          >
                            {Object.entries(FIELD_SCOPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Field Description</span>
                        <textarea
                          className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          value={fieldDraft.description || ""}
                          onChange={(event) => patchFieldDraft("description", event.target.value)}
                        />
                      </label>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">Field Aliases</span>
                          <textarea
                            className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="One alias per line"
                            value={fieldDraft.aliases || ""}
                            onChange={(event) => patchFieldDraft("aliases", event.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-700">Q&A Keywords</span>
                          <textarea
                            className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="One keyword per line"
                            value={fieldDraft.query_keywords || ""}
                            onChange={(event) => patchFieldDraft("query_keywords", event.target.value)}
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Answer Template</span>
                        <input
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          value={fieldDraft.answer_template || ""}
                          onChange={(event) => patchFieldDraft("answer_template", event.target.value)}
                        />
                      </label>

                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          ["visible_in_master_detail", "Show in Master details"],
                          ["visible_in_staging_detail", "Show in Staging details"],
                          ["visible_in_query", "Include in Q&A"],
                        ].map(([key, label]) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(fieldDraft[key])}
                              onChange={(event) => patchFieldDraft(key, event.target.checked)}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {currentUser.role === "super_admin" ? (
                          <button
                            type="button"
                            disabled={isSubmittingFieldRequest}
                            className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleSubmitFieldRequest(true)}
                          >
                            {isSubmittingFieldRequest ? "Activating..." : "Confirm and Activate"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isSubmittingFieldRequest}
                            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleSubmitFieldRequest(false)}
                          >
                            {isSubmittingFieldRequest ? "Submitting..." : "Submit Field Request"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          onClick={() => setFieldDraft(null)}
                        >
                          Close Draft
                        </button>
                      </div>
                    </div>
                  ) : null}
                </SectionCard>

                <div className="space-y-4">
                  <SectionCard
                    title="Field Requests Awaiting Approval"
                    subtitle="Field requests from non-Super Admin users appear here. Both workbooks and their mirrors are extended only after Super Admin approval."
                  >
                    <div className="space-y-3">
                      {fieldRequests.length ? (
                        fieldRequests.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {item.display_name}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Requested: {item.created_at || "—"} / Requested by: {item.requested_by || "—"}
                                </div>
                              </div>
                              <StatusPill
                                tone={
                                  item.status === "approved"
                                    ? "green"
                                    : item.status === "rejected"
                                    ? "red"
                                    : "blue"
                                }
                              >
                                {FIELD_REQUEST_STATUS_LABELS[item.status] || item.status}
                              </StatusPill>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              <ReadOnlyMetaRow label="System Field Key" value={item.draft?.field_key} />
                              <ReadOnlyMetaRow
                                label="Field Type"
                                value={FIELD_TYPE_LABELS[item.draft?.field_type] || item.draft?.field_type}
                              />
                              <ReadOnlyMetaRow
                                label="Group"
                                value={FIELD_GROUP_LABELS[item.draft?.group_key] || item.draft?.group_key}
                              />
                              <ReadOnlyMetaRow
                                label="Excel Column Name"
                                value={item.draft?.excel_header_name}
                              />
                              <ReadOnlyMetaRow
                                label="Write Scope"
                                value={FIELD_SCOPE_LABELS[item.draft?.scope] || item.draft?.scope}
                              />
                              <ReadOnlyMetaRow
                                label="Included in Q&A"
                                value={item.draft?.visible_in_query ? "Yes" : "No"}
                              />
                            </div>

                            {item.requirement_text ? (
                              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700">
                                {item.requirement_text}
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-2">
                              {(item.draft?.aliases || []).map((alias) => (
                                <StatusPill key={`${item.id}-${alias}`} tone="blue">
                                  {alias}
                                </StatusPill>
                              ))}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() => loadFieldRequestIntoDraft(item)}
                              >
                                Load into Draft Editor
                              </button>
                              {currentUser.role === "super_admin" && item.status === "pending" ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isMutatingFieldRequest}
                                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={() => handleApproveFieldRequest(item.id)}
                                  >
                                    {isMutatingFieldRequest ? "Processing..." : "Approve and Activate"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isMutatingFieldRequest}
                                    className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={() => handleRejectFieldRequest(item.id)}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                          There are no field requests. New drafts and their approval status will appear here after submission.
                        </div>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard title="Field Catalog" subtitle="Once active, a field is added to both workbooks and becomes available in Master details, Staging details, and Q&A as configured.">
                    <div className="space-y-4">
                      {fieldDefinitions.map((field) => {
                        const draft = fieldEditDrafts[field.field_key] || seedFieldEditDraft(field);
                        return (
                          <div key={field.field_key} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {field.display_name}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {field.field_key}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {field.is_core ? <StatusPill tone="green">core</StatusPill> : null}
                                <StatusPill tone={field.active ? "blue" : "slate"}>
                                  {field.active ? "Active" : "Inactive"}
                                </StatusPill>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <ReadOnlyMetaRow
                                label="Field Type"
                                value={FIELD_TYPE_LABELS[field.field_type] || field.field_type}
                              />
                              <ReadOnlyMetaRow
                                label="Group"
                                value={FIELD_GROUP_LABELS[field.group_key] || field.group_key}
                              />
                              <ReadOnlyMetaRow
                                label="Write Scope"
                                value={FIELD_SCOPE_LABELS[field.scope] || field.scope}
                              />
                              <ReadOnlyMetaRow
                                label="Status"
                                value={field.status === "active" ? "active" : field.status || "draft"}
                              />
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">
                                  Field Display Name
                                </span>
                                <input
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  value={draft.display_name}
                                  onChange={(event) =>
                                    setFieldEditDrafts((prev) => ({
                                      ...prev,
                                      [field.field_key]: {
                                        ...draft,
                                        display_name: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">
                                  Excel Column Name
                                </span>
                                <input
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  value={draft.excel_header_name}
                                  onChange={(event) =>
                                    setFieldEditDrafts((prev) => ({
                                      ...prev,
                                      [field.field_key]: {
                                        ...draft,
                                        excel_header_name: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">
                                  Group
                                </span>
                                <select
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  value={draft.group_key}
                                  onChange={(event) =>
                                    setFieldEditDrafts((prev) => ({
                                      ...prev,
                                      [field.field_key]: {
                                        ...draft,
                                        group_key: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  {Object.entries(FIELD_GROUP_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">
                                  Write Scope
                                </span>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                  {FIELD_SCOPE_LABELS[draft.scope] || draft.scope}
                                </div>
                              </label>
                            </div>

                            <label className="mt-4 block">
                              <span className="mb-1 block text-sm font-medium text-slate-700">
                                Field Description
                              </span>
                              <textarea
                                className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={draft.description}
                                onChange={(event) =>
                                  setFieldEditDrafts((prev) => ({
                                    ...prev,
                                    [field.field_key]: {
                                      ...draft,
                                      description: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </label>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">
                                  Q&A Keywords
                                </span>
                                <textarea
                                  className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  value={draft.query_keywords}
                                  onChange={(event) =>
                                    setFieldEditDrafts((prev) => ({
                                      ...prev,
                                      [field.field_key]: {
                                        ...draft,
                                        query_keywords: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">
                                  Answer Template
                                </span>
                                <textarea
                                  className="min-h-[88px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  value={draft.answer_template}
                                  onChange={(event) =>
                                    setFieldEditDrafts((prev) => ({
                                      ...prev,
                                      [field.field_key]: {
                                        ...draft,
                                        answer_template: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {(field.aliases || []).map((alias) => (
                                <StatusPill key={`${field.field_key}-${alias}`} tone="blue">
                                  {alias}
                                </StatusPill>
                              ))}
                            </div>

                            <div className="mt-3 flex gap-2">
                              <input
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={aliasDrafts[field.field_key] || ""}
                                placeholder="Add a new alias"
                                onChange={(event) =>
                                  setAliasDrafts((prev) => ({
                                    ...prev,
                                    [field.field_key]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                onClick={() => handleCreateAlias(field.field_key)}
                              >
                                Add Alias
                              </button>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                              {[
                                ["visible_in_master_detail", "Master Details"],
                                ["visible_in_staging_detail", "Staging Details"],
                                ["visible_in_query", "Q&A"],
                                ["active", "Active Field"],
                              ].map(([key, label]) => (
                                <label
                                  key={key}
                                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(draft[key])}
                                    onChange={(event) =>
                                      setFieldEditDrafts((prev) => ({
                                        ...prev,
                                        [field.field_key]: {
                                          ...draft,
                                          [key]: event.target.checked,
                                        },
                                      }))
                                    }
                                  />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>

                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                disabled={isSavingFieldDefinition}
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleSaveFieldDefinition(field.field_key)}
                              >
                                {isSavingFieldDefinition ? "Saving..." : "Save Field Definition"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
