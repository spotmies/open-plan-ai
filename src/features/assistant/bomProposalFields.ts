// Which form fields a BOM proposal's review card shows, in what order, and
// under what label. Kept out of AssistantProposalBomFields.tsx so that file
// exports components only (react-refresh/only-export-components) — and so
// AssistantProposalForm can read the order/labels without importing the
// editors themselves.

/**
 * Every field key the BOM review form owns its own control for. Anything not
 * listed here (name, description, ownerId) falls through to
 * AssistantProposalForm's shared editors, which already render exactly the
 * right control for it.
 */
export const BOM_FIELD_KEYS = new Set([
  'partNumber',
  'category',
  'manufacturer',
  'mpn',
  'distributor',
  'revision',
  'changeNotes',
  'quantity',
  'unit',
  'price',
  'leadTimeDays',
  'designators',
  'notes',
  'status',
  'parentId',
  'requirements',
  'suppliers',
  'customFields',
  'documents',
]);

/** Follows the "Add New Part" form's own tab order: details → sourcing → traceability → documents. */
export const BOM_FIELD_ORDER = [
  // Details
  'partNumber', 'name', 'description', 'category', 'status', 'ownerId', 'revision',
  // Sourcing
  'manufacturer', 'mpn', 'quantity', 'unit', 'leadTimeDays', 'distributor', 'price', 'suppliers', 'customFields',
  // Traceability + Documents
  'requirements', 'documents',
  // The line's own position and notes
  'parentId', 'designators', 'notes', 'changeNotes',
];

export const BOM_FIELD_LABELS: Record<string, string> = {
  partNumber: 'Part number',
  name: 'Part name',
  description: 'Description',
  category: 'Category',
  status: 'Status',
  ownerId: 'Owner / handled by',
  revision: 'Revision',
  manufacturer: 'Manufacturer',
  mpn: 'Manufacturer PN (MPN)',
  quantity: 'Quantity',
  unit: 'Unit of measure',
  leadTimeDays: 'Lead time (days)',
  distributor: 'Supplier / distributor',
  price: 'Unit price',
  suppliers: 'Suppliers',
  customFields: 'Additional fields',
  requirements: 'Requirement links',
  documents: 'Documents (by URL)',
  parentId: 'Parent assembly',
  designators: 'Designators',
  notes: 'Line note',
  changeNotes: 'Change notes',
};
