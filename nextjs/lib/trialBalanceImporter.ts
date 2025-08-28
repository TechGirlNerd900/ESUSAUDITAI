/**
 * Trial Balance Import Utility
 * Processes Excel files to extract trial balance data with intelligent column mapping
 */

import { processExcelFile, ExcelData } from './excelProcessor';

export interface TrialBalanceImportResult {
  success: boolean;
  data: TrialBalanceEntry[];
  errors: string[];
  warnings: string[];
  summary: {
    totalRows: number;
    validRows: number;
    skippedRows: number;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
    balanceDifference: number;
  };
}

export interface TrialBalanceEntry {
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountCategory?: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

interface ColumnMapping {
  accountCode: string | null;
  accountName: string | null;
  debitBalance: string | null;
  creditBalance: string | null;
  netBalance: string | null;
  accountType: string | null;
  accountCategory: string | null;
}

/**
 * Import trial balance from Excel file
 */
export async function importTrialBalanceFromExcel(
  fileBuffer: ArrayBuffer,
  options: {
    worksheetName?: string;
    headerRow?: number;
    startRow?: number;
    endRow?: number;
    columnMapping?: Partial<ColumnMapping>;
    autoDetectAccountTypes?: boolean;
  } = {}
): Promise<TrialBalanceImportResult> {
  const {
    worksheetName,
    headerRow = 1,
    startRow = 2,
    endRow,
    columnMapping = {},
    autoDetectAccountTypes = true,
  } = options;

  try {
    // Process Excel file
    const excelData = await processExcelFile(fileBuffer, {
      worksheetName,
      convertToJson: true,
    });

    if (!excelData.success || !excelData.data) {
      return {
        success: false,
        data: [],
        errors: ['Failed to process Excel file'],
        warnings: [],
        summary: createEmptySummary(),
      };
    }

    // Get worksheet data
    const worksheetData = Array.isArray(excelData.data)
      ? excelData.data
      : excelData.data[worksheetName || Object.keys(excelData.data)[0]];

    if (!worksheetData || !Array.isArray(worksheetData)) {
      return {
        success: false,
        data: [],
        errors: ['No valid worksheet data found'],
        warnings: [],
        summary: createEmptySummary(),
      };
    }

    // Detect column mapping
    const detectedMapping = columnMapping.accountCode
      ? (columnMapping as ColumnMapping)
      : detectColumnMapping(worksheetData, headerRow - 1);

    if (!detectedMapping.accountCode || !detectedMapping.accountName) {
      return {
        success: false,
        data: [],
        errors: ['Could not detect required columns: Account Code and Account Name'],
        warnings: [],
        summary: createEmptySummary(),
      };
    }

    // Process data rows
    const result = processTrialBalanceRows(
      worksheetData,
      detectedMapping,
      startRow - 1,
      endRow ? endRow - 1 : undefined,
      autoDetectAccountTypes
    );

    return result;
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`Import error: ${error.message}`],
      warnings: [],
      summary: createEmptySummary(),
    };
  }
}

/**
 * Detect column mapping from header row
 */
function detectColumnMapping(data: any[][], headerRowIndex: number): ColumnMapping {
  const mapping: ColumnMapping = {
    accountCode: null,
    accountName: null,
    debitBalance: null,
    creditBalance: null,
    netBalance: null,
    accountType: null,
    accountCategory: null,
  };

  if (!data[headerRowIndex]) {
    return mapping;
  }

  const headerRow = data[headerRowIndex];

  // Column detection patterns (case-insensitive)
  const patterns = {
    accountCode: [
      'account code',
      'acc code',
      'code',
      'account no',
      'account number',
      'acc no',
      'gl code',
      'gl account',
      'account id',
    ],
    accountName: [
      'account name',
      'account title',
      'description',
      'account description',
      'acc name',
      'name',
      'title',
      'particulars',
    ],
    debitBalance: [
      'debit',
      'debit balance',
      'dr',
      'dr balance',
      'debit amount',
      'debit bal',
      'debits',
    ],
    creditBalance: [
      'credit',
      'credit balance',
      'cr',
      'cr balance',
      'credit amount',
      'credit bal',
      'credits',
    ],
    netBalance: [
      'balance',
      'net balance',
      'amount',
      'net amount',
      'closing balance',
      'net',
      'bal',
      'closing bal',
    ],
    accountType: ['type', 'account type', 'category', 'class', 'classification'],
    accountCategory: ['category', 'subcategory', 'sub category', 'group', 'account group'],
  };

  // Find matching columns
  for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
    const cellValue = String(headerRow[colIndex] || '')
      .toLowerCase()
      .trim();

    if (!cellValue) continue;

    // Check each pattern type
    for (const [mappingKey, patternList] of Object.entries(patterns)) {
      if (mapping[mappingKey as keyof ColumnMapping]) continue; // Already found

      for (const pattern of patternList) {
        if (cellValue.includes(pattern)) {
          mapping[mappingKey as keyof ColumnMapping] = getColumnLetter(colIndex);
          break;
        }
      }
    }
  }

  return mapping;
}

/**
 * Process trial balance rows
 */
function processTrialBalanceRows(
  data: any[][],
  mapping: ColumnMapping,
  startRowIndex: number,
  endRowIndex?: number,
  autoDetectAccountTypes: boolean = true
): TrialBalanceImportResult {
  const result: TrialBalanceImportResult = {
    success: true,
    data: [],
    errors: [],
    warnings: [],
    summary: {
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
      totalDebits: 0,
      totalCredits: 0,
      isBalanced: false,
      balanceDifference: 0,
    },
  };

  const endIndex = endRowIndex || data.length;

  for (let rowIndex = startRowIndex; rowIndex < endIndex; rowIndex++) {
    const row = data[rowIndex];
    if (!row) continue;

    result.summary.totalRows++;

    try {
      const entry = processRow(row, mapping, rowIndex + 1);

      if (!entry) {
        result.summary.skippedRows++;
        continue;
      }

      // Auto-detect account type if not provided
      if (autoDetectAccountTypes && !entry.accountType) {
        entry.accountType = detectAccountType(entry.accountCode, entry.accountName);
      }

      // Validate entry
      const validation = validateTrialBalanceEntry(entry, rowIndex + 1);
      if (!validation.isValid) {
        result.errors.push(...validation.errors);
        result.summary.skippedRows++;
        continue;
      }

      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings);
      }

      result.data.push(entry);
      result.summary.validRows++;
      result.summary.totalDebits += entry.debitBalance;
      result.summary.totalCredits += entry.creditBalance;
    } catch (error) {
      result.errors.push(`Row ${rowIndex + 1}: ${error.message}`);
      result.summary.skippedRows++;
    }
  }

  // Calculate balance
  result.summary.balanceDifference = result.summary.totalDebits - result.summary.totalCredits;
  result.summary.isBalanced = Math.abs(result.summary.balanceDifference) < 0.01;

  if (!result.summary.isBalanced) {
    result.warnings.push(
      `Trial balance is not balanced. Difference: ${result.summary.balanceDifference.toFixed(2)}`
    );
  }

  result.success = result.data.length > 0;

  return result;
}

/**
 * Process individual row
 */
function processRow(
  row: any[],
  mapping: ColumnMapping,
  rowNumber: number
): TrialBalanceEntry | null {
  const getValue = (columnLetter: string | null): any => {
    if (!columnLetter) return null;
    const index = getColumnIndex(columnLetter);
    return row[index];
  };

  const accountCode = String(getValue(mapping.accountCode) || '').trim();
  const accountName = String(getValue(mapping.accountName) || '').trim();

  // Skip empty rows
  if (!accountCode && !accountName) {
    return null;
  }

  if (!accountCode || !accountName) {
    throw new Error(`Missing account code or name`);
  }

  // Parse balance amounts
  const debitBalance = parseAmount(getValue(mapping.debitBalance));
  const creditBalance = parseAmount(getValue(mapping.creditBalance));
  let netBalance = parseAmount(getValue(mapping.netBalance));

  // If net balance is not provided, calculate it
  if (netBalance === null) {
    netBalance = debitBalance - creditBalance;
  }

  const accountType = String(getValue(mapping.accountType) || '')
    .toLowerCase()
    .trim();
  const accountCategory = String(getValue(mapping.accountCategory) || '').trim();

  return {
    accountCode,
    accountName,
    accountType: mapAccountType(accountType),
    accountCategory: accountCategory || undefined,
    debitBalance,
    creditBalance,
    netBalance,
  };
}

/**
 * Parse amount from cell value
 */
function parseAmount(value: any): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  // Handle different number formats
  let numStr = String(value).trim();

  // Remove common formatting
  numStr = numStr.replace(/[,$\s]/g, '');

  // Handle parentheses as negative (accounting format)
  const isNegative = numStr.startsWith('(') && numStr.endsWith(')');
  if (isNegative) {
    numStr = numStr.slice(1, -1);
  }

  const parsed = parseFloat(numStr);

  if (isNaN(parsed)) {
    throw new Error(`Invalid amount: "${value}"`);
  }

  return isNegative ? -parsed : parsed;
}

/**
 * Map account type string to standard types
 */
function mapAccountType(typeStr: string): 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' {
  const type = typeStr.toLowerCase();

  if (type.includes('asset')) return 'asset';
  if (type.includes('liability') || type.includes('payable')) return 'liability';
  if (type.includes('equity') || type.includes('capital')) return 'equity';
  if (type.includes('revenue') || type.includes('income') || type.includes('sales'))
    return 'revenue';
  if (type.includes('expense') || type.includes('cost')) return 'expense';

  return 'asset'; // Default
}

/**
 * Auto-detect account type based on account code and name
 */
function detectAccountType(
  accountCode: string,
  accountName: string
): 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' {
  const code = accountCode.toLowerCase();
  const name = accountName.toLowerCase();

  // Asset patterns
  if (
    code.startsWith('1') ||
    name.includes('cash') ||
    name.includes('bank') ||
    name.includes('receivable') ||
    name.includes('inventory') ||
    name.includes('asset')
  ) {
    return 'asset';
  }

  // Liability patterns
  if (
    code.startsWith('2') ||
    name.includes('payable') ||
    name.includes('loan') ||
    name.includes('liability') ||
    name.includes('accrued')
  ) {
    return 'liability';
  }

  // Equity patterns
  if (
    code.startsWith('3') ||
    name.includes('capital') ||
    name.includes('equity') ||
    name.includes('retained') ||
    name.includes('owner')
  ) {
    return 'equity';
  }

  // Revenue patterns
  if (
    code.startsWith('4') ||
    name.includes('revenue') ||
    name.includes('sales') ||
    name.includes('income') ||
    name.includes('fees')
  ) {
    return 'revenue';
  }

  // Expense patterns
  if (
    code.startsWith('5') ||
    code.startsWith('6') ||
    name.includes('expense') ||
    name.includes('cost') ||
    name.includes('salary') ||
    name.includes('rent')
  ) {
    return 'expense';
  }

  return 'asset'; // Default
}

/**
 * Validate trial balance entry
 */
function validateTrialBalanceEntry(entry: TrialBalanceEntry, rowNumber: number) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!entry.accountCode) {
    errors.push(`Row ${rowNumber}: Account code is required`);
  }

  if (!entry.accountName) {
    errors.push(`Row ${rowNumber}: Account name is required`);
  }

  // Balance validation
  if (typeof entry.debitBalance !== 'number' || isNaN(entry.debitBalance)) {
    errors.push(`Row ${rowNumber}: Invalid debit balance`);
  }

  if (typeof entry.creditBalance !== 'number' || isNaN(entry.creditBalance)) {
    errors.push(`Row ${rowNumber}: Invalid credit balance`);
  }

  if (typeof entry.netBalance !== 'number' || isNaN(entry.netBalance)) {
    errors.push(`Row ${rowNumber}: Invalid net balance`);
  }

  // Negative balances warning
  if (entry.debitBalance < 0 || entry.creditBalance < 0) {
    warnings.push(`Row ${rowNumber}: Negative balance amounts detected`);
  }

  // Net balance calculation check
  const calculatedNet = entry.debitBalance - entry.creditBalance;
  if (Math.abs(calculatedNet - entry.netBalance) > 0.01) {
    warnings.push(`Row ${rowNumber}: Net balance calculation mismatch`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Helper functions
 */
function getColumnLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode(65 + (index % 26)) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

function getColumnIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

function createEmptySummary() {
  return {
    totalRows: 0,
    validRows: 0,
    skippedRows: 0,
    totalDebits: 0,
    totalCredits: 0,
    isBalanced: false,
    balanceDifference: 0,
  };
}

/**
 * Generate sample trial balance template
 */
export function generateTrialBalanceTemplate(): any[][] {
  return [
    // Header row
    [
      'Account Code',
      'Account Name',
      'Account Type',
      'Account Category',
      'Debit Balance',
      'Credit Balance',
      'Net Balance',
    ],

    // Sample data
    ['1000', 'Cash at Bank', 'Asset', 'Current Assets', 50000, 0, 50000],
    ['1100', 'Accounts Receivable', 'Asset', 'Current Assets', 25000, 0, 25000],
    ['1200', 'Inventory', 'Asset', 'Current Assets', 30000, 0, 30000],
    ['1500', 'Equipment', 'Asset', 'Fixed Assets', 75000, 0, 75000],
    ['2000', 'Accounts Payable', 'Liability', 'Current Liabilities', 0, 15000, -15000],
    ['2100', 'Bank Loan', 'Liability', 'Long-term Liabilities', 0, 50000, -50000],
    ['3000', 'Share Capital', 'Equity', 'Equity', 0, 80000, -80000],
    ['3100', 'Retained Earnings', 'Equity', 'Equity', 0, 20000, -20000],
    ['4000', 'Sales Revenue', 'Revenue', 'Revenue', 0, 100000, -100000],
    ['5000', 'Cost of Goods Sold', 'Expense', 'Operating Expenses', 60000, 0, 60000],
    ['6000', 'Operating Expenses', 'Expense', 'Operating Expenses', 25000, 0, 25000],
  ];
}
