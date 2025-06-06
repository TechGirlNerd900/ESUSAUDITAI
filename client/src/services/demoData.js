// Demo data service for testing UI without Azure services
export const demoData = {
  // Demo user
  user: {
    id: 'demo-user-1',
    email: 'demo@esusaudit.ai',
    firstName: 'Demo',
    lastName: 'User',
    role: 'auditor',
    company: 'Demo Audit Firm'
  },

  // Demo projects
  projects: [
    {
      id: 'demo-project-1',
      name: 'ABC Corp Annual Audit 2024',
      description: 'Annual financial audit for ABC Corporation',
      clientName: 'ABC Corporation',
      clientEmail: 'finance@abccorp.com',
      status: 'active',
      createdBy: 'demo-user-1',
      assignedTo: ['demo-user-1'],
      startDate: '2024-01-15',
      endDate: '2024-03-15',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-20T14:30:00Z'
    },
    {
      id: 'demo-project-2',
      name: 'XYZ Ltd Quarterly Review Q4 2023',
      description: 'Quarterly financial review for Q4 2023',
      clientName: 'XYZ Limited',
      clientEmail: 'accounting@xyzltd.com',
      status: 'completed',
      createdBy: 'demo-user-1',
      assignedTo: ['demo-user-1'],
      startDate: '2023-12-01',
      endDate: '2024-01-10',
      createdAt: '2023-12-01T09:00:00Z',
      updatedAt: '2024-01-10T16:45:00Z'
    }
  ],

  // Demo documents
  documents: [
    {
      id: 'demo-doc-1',
      projectId: 'demo-project-1',
      uploadedBy: 'demo-user-1',
      originalName: 'Financial_Statements_2023.pdf',
      filePath: 'demo-user-1/1705123456_Financial_Statements_2023.pdf',
      fileSize: 2457600, // 2.4MB
      fileType: 'application/pdf',
      blobUrl: 'https://demo.blob.core.windows.net/documents/demo-file.pdf',
      status: 'analyzed',
      createdAt: '2024-01-15T11:30:00Z',
      updatedAt: '2024-01-15T11:45:00Z'
    },
    {
      id: 'demo-doc-2',
      projectId: 'demo-project-1',
      uploadedBy: 'demo-user-1',
      originalName: 'Bank_Reconciliation_Dec2023.xlsx',
      filePath: 'demo-user-1/1705123789_Bank_Reconciliation_Dec2023.xlsx',
      fileSize: 1048576, // 1MB
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      blobUrl: 'https://demo.blob.core.windows.net/documents/demo-file2.xlsx',
      status: 'processing',
      createdAt: '2024-01-16T09:15:00Z',
      updatedAt: '2024-01-16T09:15:00Z'
    },
    {
      id: 'demo-doc-3',
      projectId: 'demo-project-1',
      uploadedBy: 'demo-user-1',
      originalName: 'Invoice_Summary_Q4.pdf',
      filePath: 'demo-user-1/1705124000_Invoice_Summary_Q4.pdf',
      fileSize: 3145728, // 3MB
      fileType: 'application/pdf',
      blobUrl: 'https://demo.blob.core.windows.net/documents/demo-file3.pdf',
      status: 'analyzed',
      createdAt: '2024-01-17T14:20:00Z',
      updatedAt: '2024-01-17T14:35:00Z'
    }
  ],

  // Demo analysis results
  analysisResults: [
    {
      id: 'demo-analysis-1',
      documentId: 'demo-doc-1',
      extractedData: {
        content: 'ABC Corporation Financial Statements for the year ended December 31, 2023...',
        pages: 45,
        tables: [
          {
            rowCount: 12,
            columnCount: 4,
            cells: []
          },
          {
            rowCount: 8,
            columnCount: 3,
            cells: []
          }
        ],
        keyValuePairs: {
          'Company Name': 'ABC Corporation',
          'Report Period': 'Year ended December 31, 2023',
          'Total Revenue': '$12,450,000',
          'Net Income': '$1,890,000',
          'Total Assets': '$45,600,000',
          'Total Liabilities': '$23,100,000',
          'Shareholders Equity': '$22,500,000'
        },
        entities: [
          {
            category: 'Organization',
            content: 'ABC Corporation',
            confidence: 0.95
          },
          {
            category: 'Money',
            content: '$12,450,000',
            confidence: 0.98
          }
        ]
      },
      aiSummary: 'This financial statement shows ABC Corporation had a strong year with revenue of $12.45M and net income of $1.89M. The company maintains a healthy balance sheet with total assets of $45.6M. Key financial ratios appear within industry standards.',
      redFlags: [
        'Unusual increase in accounts receivable (45% YoY) without corresponding revenue growth',
        'Significant related party transactions not fully disclosed in notes',
        'Inventory turnover ratio decreased from 8.2 to 5.1, indicating potential obsolete inventory'
      ],
      highlights: [
        'Strong cash position with $3.2M in liquid assets',
        'Debt-to-equity ratio improved from 1.8 to 1.0',
        'Consistent revenue growth over the past 3 years',
        'All required financial disclosures appear complete'
      ],
      confidenceScore: 0.87,
      processingTimeMs: 45000,
      createdAt: '2024-01-15T11:45:00Z'
    },
    {
      id: 'demo-analysis-3',
      documentId: 'demo-doc-3',
      extractedData: {
        content: 'Invoice Summary for Q4 2023...',
        pages: 12,
        tables: [
          {
            rowCount: 156,
            columnCount: 6,
            cells: []
          }
        ],
        keyValuePairs: {
          'Total Invoices': '156',
          'Total Amount': '$2,340,567.89',
          'Average Invoice': '$15,003.64',
          'Largest Invoice': '$89,450.00',
          'Period': 'Q4 2023'
        }
      },
      aiSummary: 'Q4 invoice summary shows 156 invoices totaling $2.34M. Invoice amounts and patterns appear consistent with business operations. No significant anomalies detected in invoice sequencing or amounts.',
      redFlags: [
        'Invoice #INV-2023-0892 has unusual payment terms (180 days vs standard 30 days)',
        'Three invoices show round number amounts ($50,000, $75,000, $100,000) which may require verification'
      ],
      highlights: [
        'All invoices properly numbered in sequence',
        'Payment terms consistently applied across 95% of invoices',
        'Invoice amounts align with contract values',
        'Proper approval signatures on all reviewed invoices'
      ],
      confidenceScore: 0.92,
      processingTimeMs: 28000,
      createdAt: '2024-01-17T14:35:00Z'
    }
  ],

  // Demo chat history
  chatHistory: [
    {
      id: 'demo-chat-1',
      projectId: 'demo-project-1',
      userId: 'demo-user-1',
      question: 'What are the main red flags in the financial statements?',
      answer: 'Based on my analysis of the financial statements, I identified three main red flags:\n\n1. **Accounts Receivable Anomaly**: There\'s an unusual 45% year-over-year increase in accounts receivable without corresponding revenue growth, which could indicate collection issues or revenue recognition problems.\n\n2. **Related Party Transactions**: Significant related party transactions are not fully disclosed in the notes, which raises transparency concerns.\n\n3. **Inventory Issues**: The inventory turnover ratio decreased significantly from 8.2 to 5.1, suggesting potential obsolete inventory that may need write-downs.\n\nI recommend investigating these areas further and requesting additional documentation from the client.',
      contextDocuments: ['demo-doc-1'],
      createdAt: '2024-01-18T10:30:00Z'
    },
    {
      id: 'demo-chat-2',
      projectId: 'demo-project-1',
      userId: 'demo-user-1',
      question: 'How does the company\'s debt-to-equity ratio compare to industry standards?',
      answer: 'The company\'s debt-to-equity ratio has improved significantly from 1.8 to 1.0, which is a positive trend. For the industry (manufacturing/retail), typical debt-to-equity ratios range from 0.8 to 1.5, so the current ratio of 1.0 is well within acceptable limits and actually quite healthy.\n\nThis improvement suggests:\n- Better financial management\n- Reduced financial risk\n- Improved creditworthiness\n- More balanced capital structure\n\nThe company appears to be moving in the right direction regarding leverage management.',
      contextDocuments: ['demo-doc-1'],
      createdAt: '2024-01-18T14:15:00Z'
    }
  ],

  // Demo reports
  reports: [
    {
      id: 'demo-report-1',
      projectId: 'demo-project-1',
      generatedBy: 'demo-user-1',
      reportName: 'ABC Corp Audit Report - Preliminary Findings',
      reportData: {
        executiveSummary: 'Our preliminary audit of ABC Corporation for the year ended December 31, 2023, has identified several areas requiring attention. While the overall financial position appears stable, we have noted some concerns regarding accounts receivable management and inventory valuation that require further investigation.',
        statistics: {
          documentsAnalyzed: 3,
          totalPages: 57,
          redFlagsIdentified: 5,
          highlightsFound: 7,
          confidenceScore: 89
        },
        redFlags: [
          {
            description: 'Unusual increase in accounts receivable (45% YoY) without corresponding revenue growth',
            severity: 'high',
            documentSource: 'Financial_Statements_2023.pdf'
          },
          {
            description: 'Significant related party transactions not fully disclosed in notes',
            severity: 'medium',
            documentSource: 'Financial_Statements_2023.pdf'
          },
          {
            description: 'Inventory turnover ratio decreased from 8.2 to 5.1',
            severity: 'medium',
            documentSource: 'Financial_Statements_2023.pdf'
          }
        ],
        recommendations: [
          {
            description: 'Implement enhanced accounts receivable aging analysis and collection procedures',
            priority: 'high'
          },
          {
            description: 'Improve disclosure of related party transactions in financial statement notes',
            priority: 'medium'
          },
          {
            description: 'Conduct detailed inventory review to identify obsolete items',
            priority: 'medium'
          }
        ],
        documentsSummary: {
          totalDocuments: 3,
          analyzedDocuments: 3,
          flaggedDocuments: 2
        }
      },
      pdfUrl: 'https://demo.blob.core.windows.net/reports/demo-report-1.pdf',
      status: 'draft',
      createdAt: '2024-01-19T16:00:00Z',
      updatedAt: '2024-01-19T16:00:00Z'
    }
  ],

  // Demo suggested questions
  suggestedQuestions: [
    'What are the main compliance issues identified?',
    'How does the cash flow look compared to last year?',
    'Are there any unusual transactions that need investigation?',
    'What is the overall risk assessment for this client?',
    'Are all required disclosures present in the financial statements?'
  ]
};

// Demo mode flag
export const isDemoMode = () => {
  return import.meta.env.VITE_DEMO_MODE === 'true' || !import.meta.env.VITE_API_BASE_URL;
};

// Demo service functions
export const demoService = {
  // Simulate API delay
  delay: (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms)),

  // Get demo data with simulated loading
  async getDemoData(type, id = null) {
    await this.delay(500 + Math.random() * 1000); // Random delay 0.5-1.5s
    
    if (id) {
      return demoData[type].find(item => item.id === id) || null;
    }
    
    return demoData[type] || [];
  },

  // Simulate upload progress
  simulateUploadProgress(onProgress) {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          onProgress(100);
          setTimeout(() => resolve({ success: true }), 500);
        } else {
          onProgress(Math.floor(progress));
        }
      }, 200);
    });
  },

  // Simulate analysis progress
  simulateAnalysisProgress() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(demoData.analysisResults[0]);
      }, 2000 + Math.random() * 3000); // 2-5 seconds
    });
  }
};
