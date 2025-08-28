/**
 * PDF Generation Utilities using Puppeteer (secure replacement for html-pdf)
 * Provides functionality for generating PDFs from HTML with security controls
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface PdfOptions {
  format?: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
}

export interface PdfGenerationResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
}

/**
 * Generate PDF from HTML content with security controls
 * @param html HTML content to convert
 * @param options PDF generation options
 * @returns PDF buffer or error
 */
export async function generatePdfFromHtml(
  html: string,
  options: PdfOptions = {}
): Promise<PdfGenerationResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Sanitize HTML to prevent XSS
    const sanitizedHtml = sanitizeHtml(html);

    // Launch browser with security settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
      timeout: 30000,
    });

    page = await browser.newPage();

    // Set security headers and disable potentially dangerous features
    await page.setExtraHTTPHeaders({
      'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';",
    });

    // Disable JavaScript execution for security
    await page.setJavaScriptEnabled(false);

    // Set viewport
    await page.setViewport({ width: 1200, height: 800 });

    // Set content
    await page.setContent(sanitizedHtml, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    // Generate PDF with options
    const pdfOptions = {
      format: options.format || 'A4',
      landscape: options.orientation === 'landscape',
      margin: options.margin || {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm',
      },
      printBackground: options.printBackground ?? true,
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || '',
      timeout: 30000,
    };

    const buffer = await page.pdf(pdfOptions);

    return {
      success: true,
      buffer: Buffer.from(buffer),
    };
  } catch (error) {
    console.error('PDF generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  } finally {
    // Cleanup resources
    if (page) {
      try {
        await page.close();
      } catch (error) {
        console.error('Error closing page:', error);
      }
    }

    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}

/**
 * Generate PDF from a URL with security controls
 * @param url URL to convert to PDF
 * @param options PDF generation options
 * @returns PDF buffer or error
 */
export async function generatePdfFromUrl(
  url: string,
  options: PdfOptions = {}
): Promise<PdfGenerationResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Validate URL to prevent SSRF attacks
    if (!isValidUrl(url)) {
      return {
        success: false,
        error: 'Invalid URL provided',
      };
    }

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
      timeout: 30000,
    });

    page = await browser.newPage();

    // Set security headers
    await page.setExtraHTTPHeaders({
      'User-Agent': 'ESUS-Audit-AI-PDF-Generator/1.0',
    });

    // Set viewport
    await page.setViewport({ width: 1200, height: 800 });

    // Navigate to URL with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Generate PDF
    const pdfOptions = {
      format: options.format || 'A4',
      landscape: options.orientation === 'landscape',
      margin: options.margin || {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm',
      },
      printBackground: options.printBackground ?? true,
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || '',
      timeout: 30000,
    };

    const buffer = await page.pdf(pdfOptions);

    return {
      success: true,
      buffer: Buffer.from(buffer),
    };
  } catch (error) {
    console.error('PDF generation from URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  } finally {
    // Cleanup resources
    if (page) {
      try {
        await page.close();
      } catch (error) {
        console.error('Error closing page:', error);
      }
    }

    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param html HTML content to sanitize
 * @returns Sanitized HTML
 */
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event attributes (onclick, onload, etc.)
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocol
  html = html.replace(/javascript:/gi, '');

  // Remove data: protocol for images (potential security risk)
  html = html.replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""');

  // Remove potentially dangerous elements
  html = html.replace(/<(object|embed|applet|iframe|frame|frameset)[^>]*>.*?<\/\1>/gi, '');

  return html;
}

/**
 * Validate URL to prevent SSRF attacks
 * @param url URL to validate
 * @returns Whether URL is safe
 */
function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Prevent localhost/internal network access
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create a report template for audit reports
 * @param data Report data
 * @returns HTML template
 */
export function createAuditReportTemplate(data: {
  title: string;
  date: string;
  organization: string;
  content: string;
  footer?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.title}</title>
      <style>
        body {
          font-family: 'Times New Roman', serif;
          line-height: 1.6;
          margin: 0;
          padding: 2cm;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 2cm;
          border-bottom: 2px solid #333;
          padding-bottom: 1cm;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 0.5cm;
        }
        .subtitle {
          font-size: 16px;
          color: #666;
        }
        .content {
          margin: 2cm 0;
        }
        .footer {
          margin-top: 2cm;
          padding-top: 1cm;
          border-top: 1px solid #ccc;
          font-size: 12px;
          color: #666;
        }
        h1, h2, h3 {
          color: #2c3e50;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${data.title}</div>
        <div class="subtitle">
          ${data.organization}<br>
          Date: ${data.date}
        </div>
      </div>
      
      <div class="content">
        ${data.content}
      </div>
      
      ${data.footer ? `<div class="footer">${data.footer}</div>` : ''}
    </body>
    </html>
  `;
}
