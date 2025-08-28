/**
 * Excel Processing Utilities using ExcelJS (secure replacement for xlsx)
 * Provides functionality for reading and writing Excel files safely
 */

import ExcelJS from 'exceljs';

export interface ExcelData {
  sheets: {
    name: string;
    data: (string | number | null)[][];
  }[];
}

/**
 * Read Excel file and extract data securely
 * @param buffer File buffer
 * @returns Parsed Excel data
 */
export async function readExcelFile(buffer: Buffer): Promise<ExcelData> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheets: ExcelData['sheets'] = [];

    workbook.eachSheet((worksheet, sheetId) => {
      const data: (string | number | null)[][] = [];

      worksheet.eachRow((row, rowNumber) => {
        const rowData: (string | number | null)[] = [];

        row.eachCell((cell, cellNumber) => {
          // Safely extract cell value
          let value: string | number | null = null;

          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'string' || typeof cell.value === 'number') {
              value = cell.value;
            } else if (typeof cell.value === 'object' && 'text' in cell.value) {
              // Handle rich text
              value = (cell.value as any).text;
            } else {
              value = String(cell.value);
            }
          }

          rowData[cellNumber - 1] = value;
        });

        data[rowNumber - 1] = rowData;
      });

      sheets.push({
        name: worksheet.name,
        data,
      });
    });

    return { sheets };
  } catch (error) {
    console.error('Error reading Excel file:', error);
    throw new Error('Failed to process Excel file');
  }
}

/**
 * Create Excel file with provided data
 * @param data Excel data structure
 * @returns Excel file buffer
 */
export async function createExcelFile(data: ExcelData): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook();

    for (const sheet of data.sheets) {
      const worksheet = workbook.addWorksheet(sheet.name);

      sheet.data.forEach((row, rowIndex) => {
        const excelRow = worksheet.getRow(rowIndex + 1);
        row.forEach((cellValue, cellIndex) => {
          if (cellValue !== null) {
            excelRow.getCell(cellIndex + 1).value = cellValue;
          }
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('Error creating Excel file:', error);
    throw new Error('Failed to create Excel file');
  }
}

/**
 * Convert Excel data to JSON format
 * @param excelData Excel data structure
 * @returns JSON representation
 */
export function excelToJson(excelData: ExcelData): Record<string, any[]> {
  const result: Record<string, any[]> = {};

  excelData.sheets.forEach((sheet) => {
    const [headers, ...rows] = sheet.data;

    if (headers) {
      result[sheet.name] = rows.map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (header && typeof header === 'string') {
            obj[header] = row[index] || null;
          }
        });
        return obj;
      });
    }
  });

  return result;
}

/**
 * Validate Excel file structure for security
 * @param buffer File buffer
 * @returns Validation result
 */
export async function validateExcelFile(buffer: Buffer): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check file size (limit to 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      errors.push('File size exceeds 10MB limit');
    }

    // Try to parse the file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Check number of sheets (limit to 20)
    if (workbook.worksheets.length > 20) {
      warnings.push('File contains more than 20 sheets, some may be ignored');
    }

    // Check for potential security issues
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.formula) {
            warnings.push('File contains formulas which will be ignored for security');
          }

          // Check for potentially dangerous content
          const cellValue = String(cell.value || '');
          if (cellValue.includes('javascript:') || cellValue.includes('<script')) {
            errors.push('File contains potentially malicious content');
          }
        });
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push('File is not a valid Excel file');
    return {
      isValid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Process Excel file and extract data safely
 * Combines reading, validation, and JSON conversion
 * @param buffer File buffer
 * @returns Processed data and validation results
 */
export async function processExcelFile(buffer: Buffer): Promise<{
  success: boolean;
  data?: Record<string, any[]>;
  errors: string[];
  warnings: string[];
}> {
  try {
    // First validate the file
    const validation = await validateExcelFile(buffer);

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // Read the Excel file
    const excelData = await readExcelFile(buffer);

    // Convert to JSON
    const jsonData = excelToJson(excelData);

    return {
      success: true,
      data: jsonData,
      errors: [],
      warnings: validation.warnings,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      warnings: [],
    };
  }
}
