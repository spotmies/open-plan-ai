// Which form fields an ECO proposal's review card shows, in what order, and
// under what label. Kept out of AssistantProposalEcoFields.tsx so that file
// exports components only (react-refresh/only-export-components) — same split
// as bomProposalFields.ts.

/**
 * Every field key the ECO review form owns its own control for. Anything not
 * listed here (title, description) falls through to AssistantProposalForm's
 * shared editors.
 */
export const ECO_FIELD_KEYS = new Set([
  'type',
  'typeOther',
  'reason',
  'reasonOther',
  'priority',
  'changeClass',
  'effectivityType',
  'effectivityValue',
  'originatingEcr',
  'revFrom',
  'revTo',
  // targetDate + ownerId fall through to AssistantProposalForm's shared editors.
  'scheduleImpact',
  'unitCostDelta',
  'oneTimeCost',
  'requiresRecertification',
  'certNotes',
  'impactArea',
  'firmwareCoupling',
  'affectedModules',
  'parts',
  'diffRows',
  'attachments',
  'pipelineSteps',
]);

/** Follows the ECO wizard's own tab order: Basics → Items → Details → Impact → Approval. */
export const ECO_FIELD_ORDER = [
  // Basics
  'title', 'description', 'type', 'typeOther', 'reason', 'reasonOther', 'priority', 'changeClass',
  'originatingEcr', 'effectivityType', 'effectivityValue', 'revFrom', 'revTo', 'targetDate', 'ownerId',
  // Items
  'parts', 'affectedModules',
  // Details
  'diffRows', 'attachments',
  // Impact
  'scheduleImpact', 'unitCostDelta', 'oneTimeCost', 'requiresRecertification', 'certNotes', 'impactArea', 'firmwareCoupling',
  // Approval
  'pipelineSteps',
];

export const ECO_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  type: 'Change type',
  typeOther: 'Change type — describe',
  reason: 'Reason code',
  reasonOther: 'Reason — describe',
  priority: 'Priority',
  changeClass: 'Change classification',
  originatingEcr: 'Originating ECR',
  effectivityType: 'Effectivity (cut-in)',
  effectivityValue: 'Effectivity value',
  revFrom: 'Rev from',
  revTo: 'Rev to',
  targetDate: 'Target date',
  ownerId: 'Owner',
  parts: 'Affected parts',
  affectedModules: 'Affected modules',
  diffRows: 'Field-level diff',
  attachments: 'Attachments (by URL)',
  scheduleImpact: 'Impact level',
  unitCostDelta: 'Unit cost Δ ($/unit)',
  oneTimeCost: 'One-time cost ($)',
  requiresRecertification: 'Requires recertification',
  certNotes: 'Certification / firmware notes',
  impactArea: 'Impact area',
  firmwareCoupling: 'Firmware coupling',
  pipelineSteps: 'Approval pipeline',
};
