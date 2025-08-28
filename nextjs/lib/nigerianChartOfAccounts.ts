/**
 * Nigerian Chart of Accounts Templates
 * Implements standardized account structures for Nigerian businesses following FRS and CAMA requirements
 */

export interface ChartOfAccountsEntry {
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountCategory: string;
  accountSubcategory?: string;
  parentAccountCode?: string;
  level: number;
  isActive: boolean;
  description?: string;

  // Nigerian-specific fields
  vatApplicable?: boolean;
  whtApplicable?: boolean;
  whtCategory?:
    | 'dividends'
    | 'interest'
    | 'rent'
    | 'royalties'
    | 'professional_fees'
    | 'commissions';
  reportingCategory?: 'current' | 'non_current';
  frsDisclosureNote?: string;
  camaRequirement?: string;
}

export interface ChartOfAccountsTemplate {
  templateId: string;
  templateName: string;
  description: string;
  applicableEntityTypes: string[];
  complianceStandards: string[];
  accounts: ChartOfAccountsEntry[];
  lastUpdated: string;
}

/**
 * Standard Nigerian Chart of Accounts for Trading Companies
 */
export const NIGERIAN_TRADING_COMPANY_TEMPLATE: ChartOfAccountsTemplate = {
  templateId: 'NG_TRADING_001',
  templateName: 'Nigerian Trading Company - Standard',
  description:
    'Standard chart of accounts for Nigerian trading companies compliant with FRS and CAMA 2020',
  applicableEntityTypes: ['trading_company', 'wholesale', 'retail'],
  complianceStandards: ['FRS_102', 'CAMA_2020'],
  lastUpdated: '2025-01-25',
  accounts: [
    // ASSETS (1000-1999)

    // Current Assets (1000-1299)
    {
      accountCode: '1000',
      accountName: 'CURRENT ASSETS',
      accountType: 'asset',
      accountCategory: 'Current Assets',
      level: 1,
      isActive: true,
      reportingCategory: 'current',
      description: 'Assets expected to be converted to cash within one year',
    },

    // Cash and Cash Equivalents (1001-1099)
    {
      accountCode: '1001',
      accountName: 'Cash on Hand',
      accountType: 'asset',
      accountCategory: 'Cash and Cash Equivalents',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Physical cash in office and petty cash',
    },
    {
      accountCode: '1002',
      accountName: 'Cash at Bank - Current Account',
      accountType: 'asset',
      accountCategory: 'Cash and Cash Equivalents',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Bank current account balances',
    },
    {
      accountCode: '1003',
      accountName: 'Cash at Bank - Savings Account',
      accountType: 'asset',
      accountCategory: 'Cash and Cash Equivalents',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Bank savings account balances',
    },
    {
      accountCode: '1004',
      accountName: 'Short-term Investments',
      accountType: 'asset',
      accountCategory: 'Cash and Cash Equivalents',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Investments with maturity less than 3 months',
    },

    // Trade and Other Receivables (1100-1199)
    {
      accountCode: '1101',
      accountName: 'Trade Debtors',
      accountType: 'asset',
      accountCategory: 'Trade and Other Receivables',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Amounts owed by customers for goods sold',
    },
    {
      accountCode: '1102',
      accountName: 'Allowance for Doubtful Debts',
      accountType: 'asset',
      accountCategory: 'Trade and Other Receivables',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Provision for uncollectible receivables (contra asset)',
    },
    {
      accountCode: '1103',
      accountName: 'Other Receivables',
      accountType: 'asset',
      accountCategory: 'Trade and Other Receivables',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Non-trade receivables',
    },
    {
      accountCode: '1104',
      accountName: 'Prepaid Expenses',
      accountType: 'asset',
      accountCategory: 'Trade and Other Receivables',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Expenses paid in advance',
    },
    {
      accountCode: '1105',
      accountName: 'VAT Recoverable',
      accountType: 'asset',
      accountCategory: 'Trade and Other Receivables',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      vatApplicable: true,
      description: 'VAT paid on purchases to be recovered from FIRS',
    },
    {
      accountCode: '1106',
      accountName: 'WHT Recoverable',
      accountType: 'asset',
      accountCategory: 'Trade and Other Receivables',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      whtApplicable: true,
      description: 'Withholding tax paid to be offset against income tax',
    },

    // Inventory (1200-1299)
    {
      accountCode: '1201',
      accountName: 'Inventory - Raw Materials',
      accountType: 'asset',
      accountCategory: 'Inventory',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      vatApplicable: true,
      description: 'Raw materials for production',
    },
    {
      accountCode: '1202',
      accountName: 'Inventory - Work in Progress',
      accountType: 'asset',
      accountCategory: 'Inventory',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Partially completed goods',
    },
    {
      accountCode: '1203',
      accountName: 'Inventory - Finished Goods',
      accountType: 'asset',
      accountCategory: 'Inventory',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      vatApplicable: true,
      description: 'Completed goods ready for sale',
    },
    {
      accountCode: '1204',
      accountName: 'Inventory - Trading Stock',
      accountType: 'asset',
      accountCategory: 'Inventory',
      parentAccountCode: '1000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      vatApplicable: true,
      description: 'Goods purchased for resale',
    },

    // Non-Current Assets (1300-1999)
    {
      accountCode: '1300',
      accountName: 'NON-CURRENT ASSETS',
      accountType: 'asset',
      accountCategory: 'Non-Current Assets',
      level: 1,
      isActive: true,
      reportingCategory: 'non_current',
      description: 'Assets held for more than one year',
    },

    // Property, Plant and Equipment (1301-1499)
    {
      accountCode: '1301',
      accountName: 'Land and Buildings',
      accountType: 'asset',
      accountCategory: 'Property, Plant and Equipment',
      parentAccountCode: '1300',
      level: 2,
      isActive: true,
      reportingCategory: 'non_current',
      frsDisclosureNote: 'FRS 102 Section 17 - PPE',
      description: 'Land and building assets',
    },
    {
      accountCode: '1302',
      accountName: 'Plant and Machinery',
      accountType: 'asset',
      accountCategory: 'Property, Plant and Equipment',
      parentAccountCode: '1300',
      level: 2,
      isActive: true,
      reportingCategory: 'non_current',
      description: 'Manufacturing and operational equipment',
    },
    {
      accountCode: '1303',
      accountName: 'Motor Vehicles',
      accountType: 'asset',
      accountCategory: 'Property, Plant and Equipment',
      parentAccountCode: '1300',
      level: 2,
      isActive: true,
      reportingCategory: 'non_current',
      description: 'Company vehicles',
    },
    {
      accountCode: '1304',
      accountName: 'Furniture and Fittings',
      accountType: 'asset',
      accountCategory: 'Property, Plant and Equipment',
      parentAccountCode: '1300',
      level: 2,
      isActive: true,
      reportingCategory: 'non_current',
      description: 'Office furniture and fixtures',
    },
    {
      accountCode: '1305',
      accountName: 'Computer Equipment',
      accountType: 'asset',
      accountCategory: 'Property, Plant and Equipment',
      parentAccountCode: '1300',
      level: 2,
      isActive: true,
      reportingCategory: 'non_current',
      description: 'Computers and IT equipment',
    },
    {
      accountCode: '1306',
      accountName: 'Accumulated Depreciation - Buildings',
      accountType: 'asset',
      accountCategory: 'Property, Plant and Equipment',
      parentAccountCode: '1300',
      level: 2,
      isActive: true,
      reportingCategory: 'non_current',
      description: 'Accumulated depreciation on buildings (contra asset)',
    },
    {
      accountCode: '1307',
      accountName: 'Accumulated Depreciation - Plant & Machinery',
      accountType: 'asset',
      accountCategory: 'Property, Plant and Equipment',
      parentAccountCode: '1300',
      level: 2,
      isActive: true,
      reportingCategory: 'non_current',
      description: 'Accumulated depreciation on plant and machinery (contra asset)',
    },
    {
      accountCode: '1308',
      accountName: 'Accumulated Depreciation - Motor Vehicles',
      accountType: 'asset',
      accountCategory: 'Property, Plant and Equipment',
      parentAccountCode: '1300',
      level: 2,
      isActive: true,
      reportingCategory: 'non_current',
      description: 'Accumulated depreciation on vehicles (contra asset)',
    },

    // LIABILITIES (2000-2999)

    // Current Liabilities (2000-2299)
    {
      accountCode: '2000',
      accountName: 'CURRENT LIABILITIES',
      accountType: 'liability',
      accountCategory: 'Current Liabilities',
      level: 1,
      isActive: true,
      reportingCategory: 'current',
      description: 'Obligations due within one year',
    },

    // Trade and Other Payables (2001-2099)
    {
      accountCode: '2001',
      accountName: 'Trade Creditors',
      accountType: 'liability',
      accountCategory: 'Trade and Other Payables',
      parentAccountCode: '2000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Amounts owed to suppliers',
    },
    {
      accountCode: '2002',
      accountName: 'Other Payables',
      accountType: 'liability',
      accountCategory: 'Trade and Other Payables',
      parentAccountCode: '2000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Non-trade payables',
    },
    {
      accountCode: '2003',
      accountName: 'Accrued Expenses',
      accountType: 'liability',
      accountCategory: 'Trade and Other Payables',
      parentAccountCode: '2000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Expenses incurred but not yet paid',
    },

    // Tax Liabilities (2100-2199)
    {
      accountCode: '2101',
      accountName: 'VAT Payable',
      accountType: 'liability',
      accountCategory: 'Tax Liabilities',
      parentAccountCode: '2000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      vatApplicable: true,
      description: 'VAT collected on sales payable to FIRS',
    },
    {
      accountCode: '2102',
      accountName: 'WHT Payable',
      accountType: 'liability',
      accountCategory: 'Tax Liabilities',
      parentAccountCode: '2000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      whtApplicable: true,
      description: 'Withholding tax deducted from payments',
    },
    {
      accountCode: '2103',
      accountName: 'Company Income Tax Payable',
      accountType: 'liability',
      accountCategory: 'Tax Liabilities',
      parentAccountCode: '2000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'CIT liability for the year',
    },
    {
      accountCode: '2104',
      accountName: 'Education Tax Payable',
      accountType: 'liability',
      accountCategory: 'Tax Liabilities',
      parentAccountCode: '2000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: '2% education tax on assessable profit',
    },
    {
      accountCode: '2105',
      accountName: 'PAYE Tax Payable',
      accountType: 'liability',
      accountCategory: 'Tax Liabilities',
      parentAccountCode: '2000',
      level: 2,
      isActive: true,
      reportingCategory: 'current',
      description: 'Pay As You Earn tax on employee salaries',
    },

    // EQUITY (3000-3999)
    {
      accountCode: '3000',
      accountName: 'EQUITY',
      accountType: 'equity',
      accountCategory: 'Equity',
      level: 1,
      isActive: true,
      description: 'Owners equity in the business',
    },
    {
      accountCode: '3001',
      accountName: 'Share Capital',
      accountType: 'equity',
      accountCategory: 'Share Capital',
      parentAccountCode: '3000',
      level: 2,
      isActive: true,
      camaRequirement: 'CAMA Section 124 - Authorized and issued capital',
      description: 'Issued and paid-up share capital',
    },
    {
      accountCode: '3002',
      accountName: 'Share Premium',
      accountType: 'equity',
      accountCategory: 'Share Capital',
      parentAccountCode: '3000',
      level: 2,
      isActive: true,
      description: 'Premium on shares issued above par value',
    },
    {
      accountCode: '3003',
      accountName: 'Retained Earnings',
      accountType: 'equity',
      accountCategory: 'Reserves',
      parentAccountCode: '3000',
      level: 2,
      isActive: true,
      description: 'Accumulated profits retained in business',
    },
    {
      accountCode: '3004',
      accountName: 'General Reserve',
      accountType: 'equity',
      accountCategory: 'Reserves',
      parentAccountCode: '3000',
      level: 2,
      isActive: true,
      description: 'General reserves created from profits',
    },

    // REVENUE (4000-4999)
    {
      accountCode: '4000',
      accountName: 'REVENUE',
      accountType: 'revenue',
      accountCategory: 'Revenue',
      level: 1,
      isActive: true,
      description: 'Income from business operations',
    },
    {
      accountCode: '4001',
      accountName: 'Sales Revenue',
      accountType: 'revenue',
      accountCategory: 'Sales Revenue',
      parentAccountCode: '4000',
      level: 2,
      isActive: true,
      vatApplicable: true,
      description: 'Revenue from sale of goods',
    },
    {
      accountCode: '4002',
      accountName: 'Service Revenue',
      accountType: 'revenue',
      accountCategory: 'Sales Revenue',
      parentAccountCode: '4000',
      level: 2,
      isActive: true,
      vatApplicable: true,
      whtApplicable: true,
      description: 'Revenue from services rendered',
    },
    {
      accountCode: '4003',
      accountName: 'Interest Income',
      accountType: 'revenue',
      accountCategory: 'Other Income',
      parentAccountCode: '4000',
      level: 2,
      isActive: true,
      whtApplicable: true,
      whtCategory: 'interest',
      description: 'Interest earned on investments and deposits',
    },
    {
      accountCode: '4004',
      accountName: 'Dividend Income',
      accountType: 'revenue',
      accountCategory: 'Other Income',
      parentAccountCode: '4000',
      level: 2,
      isActive: true,
      whtApplicable: true,
      whtCategory: 'dividends',
      description: 'Dividends received from investments',
    },
    {
      accountCode: '4005',
      accountName: 'Rental Income',
      accountType: 'revenue',
      accountCategory: 'Other Income',
      parentAccountCode: '4000',
      level: 2,
      isActive: true,
      whtApplicable: true,
      whtCategory: 'rent',
      description: 'Income from property rentals',
    },

    // EXPENSES (5000-9999)

    // Cost of Sales (5000-5999)
    {
      accountCode: '5000',
      accountName: 'COST OF SALES',
      accountType: 'expense',
      accountCategory: 'Cost of Sales',
      level: 1,
      isActive: true,
      description: 'Direct costs of goods sold',
    },
    {
      accountCode: '5001',
      accountName: 'Opening Inventory',
      accountType: 'expense',
      accountCategory: 'Cost of Sales',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Value of inventory at beginning of period',
    },
    {
      accountCode: '5002',
      accountName: 'Purchases',
      accountType: 'expense',
      accountCategory: 'Cost of Sales',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      vatApplicable: true,
      description: 'Cost of goods purchased for resale',
    },
    {
      accountCode: '5003',
      accountName: 'Direct Labour',
      accountType: 'expense',
      accountCategory: 'Cost of Sales',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Labour directly involved in production',
    },
    {
      accountCode: '5004',
      accountName: 'Factory Overheads',
      accountType: 'expense',
      accountCategory: 'Cost of Sales',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Indirect manufacturing costs',
    },
    {
      accountCode: '5999',
      accountName: 'Closing Inventory',
      accountType: 'expense',
      accountCategory: 'Cost of Sales',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Value of inventory at end of period (contra expense)',
    },

    // Administrative Expenses (6000-6999)
    {
      accountCode: '6000',
      accountName: 'ADMINISTRATIVE EXPENSES',
      accountType: 'expense',
      accountCategory: 'Administrative Expenses',
      level: 1,
      isActive: true,
      description: 'General administrative and office expenses',
    },
    {
      accountCode: '6001',
      accountName: 'Salaries and Wages',
      accountType: 'expense',
      accountCategory: 'Personnel Costs',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      description: 'Staff salaries and wages',
    },
    {
      accountCode: '6002',
      accountName: 'Directors Fees',
      accountType: 'expense',
      accountCategory: 'Personnel Costs',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      whtApplicable: true,
      whtCategory: 'professional_fees',
      camaRequirement: 'CAMA Section 302 - Directors remuneration disclosure',
      description: 'Fees paid to directors',
    },
    {
      accountCode: '6003',
      accountName: 'Pension Contributions',
      accountType: 'expense',
      accountCategory: 'Personnel Costs',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      description: 'Employer pension contributions',
    },
    {
      accountCode: '6004',
      accountName: 'Staff Training and Development',
      accountType: 'expense',
      accountCategory: 'Personnel Costs',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      vatApplicable: true,
      description: 'Training and development costs',
    },
    {
      accountCode: '6101',
      accountName: 'Rent and Rates',
      accountType: 'expense',
      accountCategory: 'Occupancy Costs',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      whtApplicable: true,
      whtCategory: 'rent',
      description: 'Office rent and local government rates',
    },
    {
      accountCode: '6102',
      accountName: 'Electricity and Water',
      accountType: 'expense',
      accountCategory: 'Occupancy Costs',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      description: 'Utility costs',
    },
    {
      accountCode: '6103',
      accountName: 'Insurance',
      accountType: 'expense',
      accountCategory: 'Occupancy Costs',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      description: 'Insurance premiums',
    },
    {
      accountCode: '6201',
      accountName: 'Professional Fees',
      accountType: 'expense',
      accountCategory: 'Professional Services',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      whtApplicable: true,
      whtCategory: 'professional_fees',
      description: 'Legal, audit, and consultancy fees',
    },
    {
      accountCode: '6202',
      accountName: 'Audit Fees',
      accountType: 'expense',
      accountCategory: 'Professional Services',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      whtApplicable: true,
      whtCategory: 'professional_fees',
      camaRequirement: 'CAMA Section 404 - Mandatory audit for qualifying companies',
      description: 'External audit fees',
    },
    {
      accountCode: '6301',
      accountName: 'Depreciation Expense',
      accountType: 'expense',
      accountCategory: 'Depreciation and Amortisation',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      frsDisclosureNote: 'FRS 102 Section 17 - Depreciation methods and rates',
      description: 'Depreciation on fixed assets',
    },
    {
      accountCode: '6302',
      accountName: 'Impairment Loss',
      accountType: 'expense',
      accountCategory: 'Depreciation and Amortisation',
      parentAccountCode: '6000',
      level: 2,
      isActive: true,
      frsDisclosureNote: 'FRS 102 Section 27 - Impairment of assets',
      description: 'Impairment losses on assets',
    },

    // Finance Costs (8000-8999)
    {
      accountCode: '8000',
      accountName: 'FINANCE COSTS',
      accountType: 'expense',
      accountCategory: 'Finance Costs',
      level: 1,
      isActive: true,
      description: 'Interest and financing expenses',
    },
    {
      accountCode: '8001',
      accountName: 'Interest on Loans',
      accountType: 'expense',
      accountCategory: 'Interest Expense',
      parentAccountCode: '8000',
      level: 2,
      isActive: true,
      description: 'Interest paid on borrowings',
    },
    {
      accountCode: '8002',
      accountName: 'Bank Charges',
      accountType: 'expense',
      accountCategory: 'Finance Costs',
      parentAccountCode: '8000',
      level: 2,
      isActive: true,
      description: 'Bank fees and charges',
    },
  ],
};

/**
 * Manufacturing Company Chart of Accounts Template
 */
export const NIGERIAN_MANUFACTURING_TEMPLATE: ChartOfAccountsTemplate = {
  templateId: 'NG_MANUFACTURING_001',
  templateName: 'Nigerian Manufacturing Company - Standard',
  description:
    'Chart of accounts for Nigerian manufacturing companies with production cost accounting',
  applicableEntityTypes: ['manufacturing_company', 'production'],
  complianceStandards: ['FRS_102', 'CAMA_2020'],
  lastUpdated: '2025-01-25',
  accounts: [
    // Inherits from trading company template plus manufacturing-specific accounts
    ...NIGERIAN_TRADING_COMPANY_TEMPLATE.accounts,

    // Additional Manufacturing-specific accounts
    {
      accountCode: '5101',
      accountName: 'Raw Materials Consumed',
      accountType: 'expense',
      accountCategory: 'Manufacturing Costs',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Cost of raw materials used in production',
    },
    {
      accountCode: '5102',
      accountName: 'Direct Labour - Production',
      accountType: 'expense',
      accountCategory: 'Manufacturing Costs',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Direct labour costs in manufacturing',
    },
    {
      accountCode: '5103',
      accountName: 'Factory Rent',
      accountType: 'expense',
      accountCategory: 'Manufacturing Overheads',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Rent for manufacturing facilities',
    },
    {
      accountCode: '5104',
      accountName: 'Factory Power and Fuel',
      accountType: 'expense',
      accountCategory: 'Manufacturing Overheads',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Power and fuel costs for production',
    },
    {
      accountCode: '5105',
      accountName: 'Depreciation - Plant and Machinery',
      accountType: 'expense',
      accountCategory: 'Manufacturing Overheads',
      parentAccountCode: '5000',
      level: 2,
      isActive: true,
      description: 'Depreciation on production equipment',
    },
  ],
};

/**
 * Service Company Chart of Accounts Template
 */
export const NIGERIAN_SERVICE_COMPANY_TEMPLATE: ChartOfAccountsTemplate = {
  templateId: 'NG_SERVICE_001',
  templateName: 'Nigerian Service Company - Standard',
  description: 'Chart of accounts for Nigerian service companies and professional firms',
  applicableEntityTypes: ['service_company', 'professional_services', 'consulting'],
  complianceStandards: ['FRS_102', 'CAMA_2020'],
  lastUpdated: '2025-01-25',
  accounts: NIGERIAN_TRADING_COMPANY_TEMPLATE.accounts
    .filter(
      // Remove inventory accounts for service companies
      (account) =>
        !account.accountCategory.includes('Inventory') &&
        !account.accountCategory.includes('Cost of Sales')
    )
    .concat([
      // Service-specific accounts
      {
        accountCode: '4101',
        accountName: 'Consulting Revenue',
        accountType: 'revenue',
        accountCategory: 'Service Revenue',
        parentAccountCode: '4000',
        level: 2,
        isActive: true,
        vatApplicable: true,
        whtApplicable: true,
        whtCategory: 'professional_fees',
        description: 'Revenue from consulting services',
      },
      {
        accountCode: '4102',
        accountName: 'Training Revenue',
        accountType: 'revenue',
        accountCategory: 'Service Revenue',
        parentAccountCode: '4000',
        level: 2,
        isActive: true,
        vatApplicable: true,
        description: 'Revenue from training services',
      },
      {
        accountCode: '6401',
        accountName: 'Subcontractor Costs',
        accountType: 'expense',
        accountCategory: 'Direct Service Costs',
        parentAccountCode: '6000',
        level: 2,
        isActive: true,
        whtApplicable: true,
        whtCategory: 'professional_fees',
        description: 'Costs of subcontracted services',
      },
    ]),
};

/**
 * Get chart of accounts template by ID
 */
export function getChartOfAccountsTemplate(templateId: string): ChartOfAccountsTemplate | null {
  const templates = [
    NIGERIAN_TRADING_COMPANY_TEMPLATE,
    NIGERIAN_MANUFACTURING_TEMPLATE,
    NIGERIAN_SERVICE_COMPANY_TEMPLATE,
  ];

  return templates.find((template) => template.templateId === templateId) || null;
}

/**
 * Get all available templates
 */
export function getAllChartOfAccountsTemplates(): ChartOfAccountsTemplate[] {
  return [
    NIGERIAN_TRADING_COMPANY_TEMPLATE,
    NIGERIAN_MANUFACTURING_TEMPLATE,
    NIGERIAN_SERVICE_COMPANY_TEMPLATE,
  ];
}

/**
 * Filter accounts by category
 */
export function getAccountsByCategory(
  template: ChartOfAccountsTemplate,
  category: string
): ChartOfAccountsEntry[] {
  return template.accounts.filter((account) => account.accountCategory === category);
}

/**
 * Get accounts by type
 */
export function getAccountsByType(
  template: ChartOfAccountsTemplate,
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
): ChartOfAccountsEntry[] {
  return template.accounts.filter((account) => account.accountType === accountType);
}

/**
 * Get VAT applicable accounts
 */
export function getVATApplicableAccounts(
  template: ChartOfAccountsTemplate
): ChartOfAccountsEntry[] {
  return template.accounts.filter((account) => account.vatApplicable);
}

/**
 * Get WHT applicable accounts
 */
export function getWHTApplicableAccounts(
  template: ChartOfAccountsTemplate
): ChartOfAccountsEntry[] {
  return template.accounts.filter((account) => account.whtApplicable);
}

/**
 * Validate account code format
 */
export function validateAccountCode(accountCode: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!accountCode || accountCode.length === 0) {
    errors.push('Account code is required');
  }

  if (!/^\d{4}$/.test(accountCode)) {
    errors.push('Account code must be exactly 4 digits');
  }

  const firstDigit = parseInt(accountCode.charAt(0));
  if (firstDigit < 1 || firstDigit > 9) {
    errors.push('Account code must start with digit 1-9');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate account code suggestions based on account type and category
 */
export function suggestAccountCode(
  accountType: string,
  accountCategory: string,
  existingCodes: string[]
): string[] {
  const ranges = {
    asset: { start: 1000, end: 1999 },
    liability: { start: 2000, end: 2999 },
    equity: { start: 3000, end: 3999 },
    revenue: { start: 4000, end: 4999 },
    expense: { start: 5000, end: 9999 },
  };

  const range = ranges[accountType as keyof typeof ranges];
  if (!range) return [];

  const suggestions: string[] = [];

  for (let i = range.start; i <= range.end && suggestions.length < 10; i++) {
    const code = i.toString();
    if (!existingCodes.includes(code)) {
      suggestions.push(code);
    }
  }

  return suggestions;
}

/**
 * Export chart of accounts to Excel format
 */
export function exportChartOfAccountsToExcel(template: ChartOfAccountsTemplate) {
  return {
    templateName: template.templateName,
    headers: [
      'Account Code',
      'Account Name',
      'Account Type',
      'Category',
      'Subcategory',
      'Level',
      'Active',
      'VAT Applicable',
      'WHT Applicable',
      'WHT Category',
      'Description',
    ],
    data: template.accounts.map((account) => [
      account.accountCode,
      account.accountName,
      account.accountType,
      account.accountCategory,
      account.accountSubcategory || '',
      account.level,
      account.isActive ? 'Yes' : 'No',
      account.vatApplicable ? 'Yes' : 'No',
      account.whtApplicable ? 'Yes' : 'No',
      account.whtCategory || '',
      account.description || '',
    ]),
  };
}
