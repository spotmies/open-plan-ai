import type ExcelJS from 'exceljs';

// Dynamic import to avoid bundling issues
async function getExcelJS(): Promise<typeof ExcelJS> {
  const module = await import('exceljs');
  return module.default;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const COLORS = {
  headerBg: 'D3D3FF',
  approved: 'C6EFCE',
  pending: 'FFEB9C',
  rejected: 'FFC7CE',
};

const CATEGORY_COLORS: Record<string, string> = {
  power: 'FFE699',
  control: 'B4C7E7',
  connector: 'C5E0B4',
  enclosure: 'F8CBAD',
  hmi: 'BFBFBF',
  safety: 'FF8080',
  assembly: 'E2EFDA',
};

// ─── Header formatting ────────────────────────────────────────────────────────

function formatHeader(sheet: ExcelJS.Worksheet, rowNum: number = 1): void {
  const row = sheet.getRow(rowNum);
  if (!row) return;

  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.headerBg },
    };
    cell.font = {
      bold: true,
      color: { argb: 'FF000000' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'center',
      wrapText: true,
    };
  });

  row.height = 25;
}

// ─── Cell formatting ──────────────────────────────────────────────────────────

function formatCurrencyCell(cell: ExcelJS.Cell, value: number | null | undefined): void {
  if (value !== null && value !== undefined && !isNaN(value)) {
    cell.value = value;
    cell.numFmt = '$#,##0.00';
  }
}

function formatStatusCell(cell: ExcelJS.Cell, status: string): void {
  cell.value = status;
  const bgColor = status === 'approved' ? COLORS.approved : status === 'pending' ? COLORS.pending : COLORS.rejected;
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bgColor },
  };
}

function formatCategoryCell(cell: ExcelJS.Cell, category: string): void {
  cell.value = category;
  const bgColor = CATEGORY_COLORS[category.toLowerCase()] || 'FFFFFF';
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bgColor },
  };
}

// ─── Auto-fit columns ─────────────────────────────────────────────────────────

function autoFitColumns(sheet: ExcelJS.Worksheet): void {
  const columnWidths: Map<number, number> = new Map();

  sheet.eachRow((row) => {
    row.eachCell((cell, colNum) => {
      const cellLength = String(cell.value ?? '').length;
      const currentWidth = columnWidths.get(colNum) || 0;
      columnWidths.set(colNum, Math.max(currentWidth, cellLength + 2));
    });
  });

  columnWidths.forEach((width, colNum) => {
    const col = sheet.getColumn(colNum);
    col.width = Math.min(width, 50);
  });
}

// ─── Freeze header ────────────────────────────────────────────────────────────

function freezeHeader(sheet: ExcelJS.Worksheet): void {
  sheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
      activeCell: 'A2',
    },
  ];
}

// ─── BOM Excel generation ─────────────────────────────────────────────────────

interface BomRow {
  partNumber: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  status: string;
  manufacturer: string | null;
  distributor: string | null;
  mpn: string | null;
  price: number | null;
  leadTime: number | null;
  revision: string;
  owner: string;
  level: string;
  requirements: string;
}

export async function createBomWorkbook(bomData: BomRow[]): Promise<ExcelJS.Workbook> {
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BOM', {
    pageSetup: {
      paperSize: ExcelJS.Workbook.PAPERSIZE.A4,
      orientation: 'landscape',
    },
  });

  // Add header row
  const headers = [
    'Part Number',
    'Description',
    'Category',
    'Quantity',
    'Unit',
    'Status',
    'Manufacturer',
    'Distributor',
    'MPN',
    'Price',
    'Lead Time (Days)',
    'Revision',
    'Owner',
    'Level',
    'Requirements',
  ];

  sheet.addRow(headers);
  formatHeader(sheet, 1);

  // Add data rows
  for (const row of bomData) {
    const excelRow = sheet.addRow([
      row.partNumber,
      row.description,
      row.category,
      row.quantity,
      row.unit,
      row.status,
      row.manufacturer,
      row.distributor,
      row.mpn,
      row.price,
      row.leadTime,
      row.revision,
      row.owner,
      row.level,
      row.requirements,
    ]);

    // Format specific columns
    const statusCell = excelRow.getCell(6);
    formatStatusCell(statusCell, row.status);

    const categoryCell = excelRow.getCell(3);
    formatCategoryCell(categoryCell, row.category);

    const priceCell = excelRow.getCell(10);
    formatCurrencyCell(priceCell, row.price);
  }

  // Auto-fit and freeze
  autoFitColumns(sheet);
  freezeHeader(sheet);

  return workbook;
}

// ─── ECO Excel generation ─────────────────────────────────────────────────────

interface EcoData {
  number: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  reason?: string;
  owner?: string;
  originator?: string;
  createdDate?: string;
  targetDate?: string;
  revisionFrom?: string;
  revisionTo?: string;
  parts?: Array<{
    partNumber: string;
    description: string;
    impactLevel: string;
    disposition: string;
    quantity: string;
  }>;
  pipeline?: Array<{
    stage: string;
    decision: string;
    decisionDate: string;
  }>;
  changes?: Array<{
    parameter: string;
    fromValue: string;
    toValue: string;
    changeLabel: string;
    unit: string;
  }>;
  impact?: {
    scheduleImpact?: string;
    unitCostDelta?: string;
    oneTimeCost?: string;
    requiresRecertification?: boolean;
    firmwareCoupling?: boolean;
    inventoryImpact?: string;
  };
  activity?: Array<{
    action: string;
    timestamp: string;
    description: string;
  }>;
}

export async function createEcoWorkbook(ecoData: EcoData): Promise<ExcelJS.Workbook> {
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet('Summary');
  const summaryHeaders = ['Field', 'Value'];
  summarySheet.addRow(summaryHeaders);
  formatHeader(summarySheet, 1);

  const summaryData = [
    ['ECO Number', ecoData.number],
    ['Title', ecoData.title],
    ['Status', ecoData.status],
    ['Priority', ecoData.priority],
    ['Type', ecoData.type],
    ['Reason', ecoData.reason || ''],
    ['Owner', ecoData.owner || ''],
    ['Originator', ecoData.originator || ''],
    ['Created Date', ecoData.createdDate || ''],
    ['Target Date', ecoData.targetDate || ''],
    ['Revision From → To', `${ecoData.revisionFrom} → ${ecoData.revisionTo}`],
  ];

  summaryData.forEach((row) => summarySheet.addRow(row));
  autoFitColumns(summarySheet);
  freezeHeader(summarySheet);

  // Sheet 2: Affected Parts
  if (ecoData.parts && ecoData.parts.length > 0) {
    const partsSheet = workbook.addWorksheet('Affected Parts');
    const partsHeaders = ['Part Number', 'Description', 'Impact Level', 'Disposition', 'Quantity'];
    partsSheet.addRow(partsHeaders);
    formatHeader(partsSheet, 1);

    for (const part of ecoData.parts) {
      partsSheet.addRow([
        part.partNumber,
        part.description,
        part.impactLevel,
        part.disposition,
        part.quantity,
      ]);
    }

    autoFitColumns(partsSheet);
    freezeHeader(partsSheet);
  }

  // Sheet 3: Approval Pipeline
  if (ecoData.pipeline && ecoData.pipeline.length > 0) {
    const pipelineSheet = workbook.addWorksheet('Approval Pipeline');
    const pipelineHeaders = ['Stage', 'Decision', 'Decision Date'];
    pipelineSheet.addRow(pipelineHeaders);
    formatHeader(pipelineSheet, 1);

    for (const step of ecoData.pipeline) {
      pipelineSheet.addRow([step.stage, step.decision, step.decisionDate]);
    }

    autoFitColumns(pipelineSheet);
    freezeHeader(pipelineSheet);
  }

  // Sheet 4: Changes
  if (ecoData.changes && ecoData.changes.length > 0) {
    const changesSheet = workbook.addWorksheet('Changes');
    const changesHeaders = ['Parameter', 'From Value', 'To Value', 'Change Label', 'Unit'];
    changesSheet.addRow(changesHeaders);
    formatHeader(changesSheet, 1);

    for (const change of ecoData.changes) {
      changesSheet.addRow([
        change.parameter,
        change.fromValue,
        change.toValue,
        change.changeLabel,
        change.unit,
      ]);
    }

    autoFitColumns(changesSheet);
    freezeHeader(changesSheet);
  }

  // Sheet 5: Impact
  if (ecoData.impact) {
    const impactSheet = workbook.addWorksheet('Impact');
    const impactHeaders = ['Field', 'Value'];
    impactSheet.addRow(impactHeaders);
    formatHeader(impactSheet, 1);

    const impactData = [
      ['Schedule Impact', ecoData.impact.scheduleImpact || ''],
      ['Unit Cost Delta', ecoData.impact.unitCostDelta || ''],
      ['One-Time Cost', ecoData.impact.oneTimeCost || ''],
      ['Requires Recertification', ecoData.impact.requiresRecertification ? 'Yes' : 'No'],
      ['Firmware Coupling', ecoData.impact.firmwareCoupling ? 'Yes' : 'No'],
      ['Inventory Impact', ecoData.impact.inventoryImpact || ''],
    ];

    impactData.forEach((row) => impactSheet.addRow(row));
    autoFitColumns(impactSheet);
    freezeHeader(impactSheet);
  }

  // Sheet 6: Activity
  if (ecoData.activity && ecoData.activity.length > 0) {
    const activitySheet = workbook.addWorksheet('Activity');
    const activityHeaders = ['Action', 'Timestamp', 'Description'];
    activitySheet.addRow(activityHeaders);
    formatHeader(activitySheet, 1);

    for (const act of ecoData.activity) {
      activitySheet.addRow([act.action, act.timestamp, act.description]);
    }

    autoFitColumns(activitySheet);
    freezeHeader(activitySheet);
  }

  return workbook;
}

// ─── Download trigger ─────────────────────────────────────────────────────────

export async function downloadExcelFile(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
