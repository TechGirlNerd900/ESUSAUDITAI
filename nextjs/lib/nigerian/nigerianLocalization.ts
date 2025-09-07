/**
 * Nigerian Localization Library
 * Implements Naira currency formatting, Nigerian date/time formatting, and local conventions
 */

export interface NairaFormatOptions {
  showSymbol?: boolean;
  showCurrency?: boolean;
  precision?: number;
  useGrouping?: boolean;
  showKobo?: boolean;
  format?: 'standard' | 'accounting' | 'words';
}

export interface NigerianDateOptions {
  format?: 'dd/mm/yyyy' | 'dd-mm-yyyy' | 'dd MMM yyyy' | 'dd MMMM yyyy';
  includeTime?: boolean;
  use12Hour?: boolean;
}

export interface TaxRateConfig {
  vat: number;
  wht: {
    dividends: number;
    interest: number;
    rent: number;
    royalties: number;
    professionalFees: number;
    commissions: number;
    technicalServices: number;
    managementServices: number;
  };
  cit: {
    large_companies: number;
    medium_companies: number;
    small_companies: number;
    manufacturing: number;
    agriculture: number;
    solid_minerals: number;
  };
  pit: {
    bands: Array<{
      min: number;
      max: number;
      rate: number;
    }>;
  };
}

/**
 * Current Nigerian tax rates (as of 2024)
 */
export const NIGERIAN_TAX_RATES: TaxRateConfig = {
  vat: 7.5, // VAT rate increased to 7.5% in 2020
  wht: {
    dividends: 10,
    interest: 10,
    rent: 10,
    royalties: 10,
    professionalFees: 5,
    commissions: 5,
    technicalServices: 10,
    managementServices: 10,
  },
  cit: {
    large_companies: 30,
    medium_companies: 20,
    small_companies: 20,
    manufacturing: 20, // Pioneer status or manufacturing in bond
    agriculture: 15,
    solid_minerals: 30,
  },
  pit: {
    bands: [
      { min: 0, max: 300000, rate: 7 },
      { min: 300001, max: 600000, rate: 11 },
      { min: 600001, max: 1100000, rate: 15 },
      { min: 1100001, max: 1600000, rate: 19 },
      { min: 1600001, max: 3200000, rate: 21 },
      { min: 3200001, max: Infinity, rate: 24 },
    ],
  },
};

/**
 * Nigerian state and local government data
 */
export const NIGERIAN_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
  'FCT',
];

/**
 * Format amount in Naira with proper Nigerian conventions
 */
export function formatNaira(amount: number, options: NairaFormatOptions = {}): string {
  const {
    showSymbol = true,
    showCurrency = false,
    precision = 2,
    useGrouping = true,
    showKobo = true,
    format = 'standard',
  } = options;

  if (format === 'words') {
    return formatNairaInWords(amount);
  }

  // Handle negative amounts
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  // Format the number
  const formatter = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: showKobo ? precision : 0,
    maximumFractionDigits: showKobo ? precision : 0,
    useGrouping,
  });

  let formatted = formatter.format(absAmount);

  // Add currency symbol/text
  if (showSymbol) {
    formatted = `₦${formatted}`;
  } else if (showCurrency) {
    formatted = `NGN ${formatted}`;
  }

  // Handle accounting format
  if (format === 'accounting') {
    if (isNegative) {
      formatted = `(${formatted})`;
    } else {
      formatted = ` ${formatted} `;
    }
  } else if (isNegative) {
    formatted = `-${formatted}`;
  }

  return formatted;
}

/**
 * Convert number to Naira in words (Nigerian English)
 */
export function formatNairaInWords(amount: number): string {
  if (amount === 0) return 'Zero Naira';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const naira = Math.floor(absAmount);
  const kobo = Math.round((absAmount - naira) * 100);

  let result = '';

  if (isNegative) {
    result += 'Negative ';
  }

  if (naira > 0) {
    result += numberToWords(naira) + ' Naira';
  }

  if (kobo > 0) {
    if (naira > 0) {
      result += ' and ';
    }
    result += numberToWords(kobo) + ' Kobo';
  }

  if (naira === 0 && kobo > 0) {
    result = result.replace(' and ', '');
  }

  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Helper function to convert numbers to words
 */
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  function convertHundreds(n: number): string {
    let result = '';

    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred';
      n %= 100;
      if (n > 0) result += ' and ';
    }

    if (n >= 20) {
      result += tens[Math.floor(n / 10)];
      n %= 10;
      if (n > 0) result += '-' + ones[n];
    } else if (n > 0) {
      result += ones[n];
    }

    return result;
  }

  if (num === 0) return '';

  let result = '';
  let scaleIndex = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk !== 0) {
      let chunkWords = convertHundreds(chunk);
      if (scaleIndex > 0) {
        chunkWords += ' ' + scales[scaleIndex];
      }
      result = chunkWords + (result ? ' ' + result : '');
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  return result;
}

/**
 * Format date in Nigerian conventions
 */
export function formatNigerianDate(date: Date | string, options: NigerianDateOptions = {}): string {
  const { format = 'dd/mm/yyyy', includeTime = false, use12Hour = true } = options;

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear().toString();

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const monthNamesShort = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  let formattedDate = '';

  switch (format) {
    case 'dd/mm/yyyy':
      formattedDate = `${day}/${month}/${year}`;
      break;
    case 'dd-mm-yyyy':
      formattedDate = `${day}-${month}-${year}`;
      break;
    case 'dd MMM yyyy':
      formattedDate = `${day} ${monthNamesShort[dateObj.getMonth()]} ${year}`;
      break;
    case 'dd MMMM yyyy':
      formattedDate = `${day} ${monthNames[dateObj.getMonth()]} ${year}`;
      break;
  }

  if (includeTime) {
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    let ampm = '';

    if (use12Hour) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
    }

    const timeStr = use12Hour
      ? `${hours}:${minutes} ${ampm}`
      : `${hours.toString().padStart(2, '0')}:${minutes}`;

    formattedDate += ` ${timeStr}`;
  }

  return formattedDate;
}

/**
 * Calculate WHT (Withholding Tax) based on transaction type
 */
export function calculateWHT(
  amount: number,
  transactionType: keyof typeof NIGERIAN_TAX_RATES.wht
): {
  grossAmount: number;
  whtRate: number;
  whtAmount: number;
  netAmount: number;
} {
  const whtRate = NIGERIAN_TAX_RATES.wht[transactionType];
  const whtAmount = (amount * whtRate) / 100;

  return {
    grossAmount: amount,
    whtRate,
    whtAmount,
    netAmount: amount - whtAmount,
  };
}

/**
 * Calculate VAT on goods and services
 */
export function calculateVAT(
  amount: number,
  isVATInclusive: boolean = false
): {
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
} {
  const vatRate = NIGERIAN_TAX_RATES.vat;

  if (isVATInclusive) {
    // VAT is included in the amount
    const netAmount = amount / (1 + vatRate / 100);
    const vatAmount = amount - netAmount;

    return {
      netAmount,
      vatRate,
      vatAmount,
      totalAmount: amount,
    };
  } else {
    // VAT to be added to the amount
    const vatAmount = (amount * vatRate) / 100;

    return {
      netAmount: amount,
      vatRate,
      vatAmount,
      totalAmount: amount + vatAmount,
    };
  }
}

/**
 * Calculate CIT (Company Income Tax) based on company type and turnover
 */
export function calculateCIT(
  taxableProfit: number,
  companyType: keyof typeof NIGERIAN_TAX_RATES.cit,
  hasEducationTax: boolean = true
): {
  taxableProfit: number;
  citRate: number;
  citAmount: number;
  educationTaxRate: number;
  educationTaxAmount: number;
  totalTax: number;
} {
  const citRate = NIGERIAN_TAX_RATES.cit[companyType];
  const citAmount = (taxableProfit * citRate) / 100;

  // Education tax is 2% of assessable profit for companies with turnover > ₦20M
  const educationTaxRate = hasEducationTax ? 2 : 0;
  const educationTaxAmount = hasEducationTax ? (taxableProfit * educationTaxRate) / 100 : 0;

  return {
    taxableProfit,
    citRate,
    citAmount,
    educationTaxRate,
    educationTaxAmount,
    totalTax: citAmount + educationTaxAmount,
  };
}

/**
 * Calculate PIT (Personal Income Tax) using Nigerian tax bands
 */
export function calculatePIT(grossIncome: number): {
  grossIncome: number;
  consolidatedRelief: number;
  taxableIncome: number;
  taxBreakdown: Array<{
    band: string;
    taxableAmount: number;
    rate: number;
    tax: number;
  }>;
  totalTax: number;
  netIncome: number;
} {
  // Consolidated relief allowance (higher of ₦200,000 + 20% of gross income or ₦200,000)
  const consolidatedRelief = Math.max(200000, 200000 + grossIncome * 0.01);
  const taxableIncome = Math.max(0, grossIncome - consolidatedRelief);

  const taxBreakdown: Array<{
    band: string;
    taxableAmount: number;
    rate: number;
    tax: number;
  }> = [];

  let remainingIncome = taxableIncome;
  let totalTax = 0;

  NIGERIAN_TAX_RATES.pit.bands.forEach((band, index) => {
    if (remainingIncome <= 0) return;

    const bandWidth =
      band.max === Infinity ? remainingIncome : Math.min(remainingIncome, band.max - band.min + 1);
    const bandTax = (bandWidth * band.rate) / 100;

    if (bandWidth > 0) {
      taxBreakdown.push({
        band: `₦${formatNaira(band.min, { showSymbol: false })} - ${band.max === Infinity ? 'above' : `₦${formatNaira(band.max, { showSymbol: false })}`}`,
        taxableAmount: bandWidth,
        rate: band.rate,
        tax: bandTax,
      });

      totalTax += bandTax;
      remainingIncome -= bandWidth;
    }
  });

  return {
    grossIncome,
    consolidatedRelief,
    taxableIncome,
    taxBreakdown,
    totalTax,
    netIncome: grossIncome - totalTax,
  };
}

/**
 * Format Nigerian business registration number
 */
export function formatRCNumber(rcNumber: string): string {
  // Remove any existing formatting
  const cleaned = rcNumber.replace(/[^\dA-Z]/g, '');

  // Format as RC-XXXXXX for companies
  if (cleaned.startsWith('RC')) {
    return cleaned.replace(/^RC(\d+)$/, 'RC-$1');
  }

  // Add RC prefix if missing
  if (/^\d+$/.test(cleaned)) {
    return `RC-${cleaned}`;
  }

  return cleaned;
}

/**
 * Format Nigerian Tax Identification Number (TIN)
 */
export function formatTIN(tin: string): string {
  // Remove any existing formatting
  const cleaned = tin.replace(/[^\d]/g, '');

  // Format as XXXX-XXXX-XX
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{4})(\d{4})(\d{2})/, '$1-$2-$3');
  }

  return cleaned;
}

/**
 * Validate Nigerian phone number
 */
export function validateNigerianPhone(phone: string): {
  isValid: boolean;
  formatted?: string;
  carrier?: string;
} {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Check for valid length and format
  const validFormats: RegExp[] = [
    /^234[789]\d{9}$/, // +234 format
    /^0[789]\d{9}$/, // 0 prefix format
    /^[789]\d{9}$/, // No prefix format
  ];

  let formatted = '';
  let carrier = '';

  if (/^234[789]\d{9}$/.test(cleaned)) {
    // International format
    formatted = `+${cleaned}`;
  } else if (/^0[789]\d{9}$/.test(cleaned)) {
    // Local format with 0 prefix
    formatted = cleaned.replace(/^0/, '+234');
  } else if (/^[789]\d{9}$/.test(cleaned)) {
    // No prefix format
    formatted = `+234${cleaned}`;
  } else {
    return { isValid: false };
  }

  // Determine carrier based on prefix
  const prefix = formatted.substring(4, 7);
  if (['803', '806', '813', '816', '903', '906'].includes(prefix)) {
    carrier = 'MTN';
  } else if (['805', '807', '815', '905', '915'].includes(prefix)) {
    carrier = 'Globacom';
  } else if (['802', '808', '812', '701', '708', '902', '904', '912'].includes(prefix)) {
    carrier = 'Airtel';
  } else if (['809', '817', '818', '909'].includes(prefix)) {
    carrier = '9mobile';
  }

  return {
    isValid: true,
    formatted,
    carrier,
  };
}

/**
 * Get Nigerian bank holidays for a given year
 */
export function getNigerianHolidays(year: number): Array<{
  date: string;
  name: string;
  type: 'public' | 'religious' | 'cultural';
}> {
  return [
    { date: `${year}-01-01`, name: "New Year's Day", type: 'public' },
    { date: `${year}-10-01`, name: 'Independence Day', type: 'public' },
    { date: `${year}-12-25`, name: 'Christmas Day', type: 'religious' },
    { date: `${year}-12-26`, name: 'Boxing Day', type: 'public' },
    // Note: Islamic holidays are lunar-based and would need calculation
    // Cultural holidays vary by region
  ];
}

/**
 * Format Nigerian address components
 */
export function formatNigerianAddress(address: {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string {
  const parts: string[] = [];

  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.state && NIGERIAN_STATES.includes(address.state)) {
    parts.push(`${address.state} State`);
  }
  if (address.postalCode) parts.push(address.postalCode);

  parts.push(address.country || 'Nigeria');

  return parts.join(', ');
}

/**
 * Check if a date falls within Nigerian business hours
 */
export function isNigerianBusinessHours(date: Date): boolean {
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday

  // Monday to Friday, 8 AM to 5 PM (Nigerian business hours)
  return day >= 1 && day <= 5 && hour >= 8 && hour < 17;
}

/**
 * Convert to Nigerian timezone (WAT - West Africa Time, UTC+1)
 */
export function toNigerianTime(date: Date): Date {
  // Nigeria is UTC+1 (no daylight saving)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 1 * 3600000); // UTC+1
}

/**
 * Export all localization utilities
 */
export const NigerianLocalization = {
  formatNaira,
  formatNairaInWords,
  formatNigerianDate,
  calculateWHT,
  calculateVAT,
  calculateCIT,
  calculatePIT,
  formatRCNumber,
  formatTIN,
  validateNigerianPhone,
  getNigerianHolidays,
  formatNigerianAddress,
  isNigerianBusinessHours,
  toNigerianTime,
  NIGERIAN_TAX_RATES,
  NIGERIAN_STATES,
};
