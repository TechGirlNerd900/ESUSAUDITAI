const express = require('express');
const router = express.Router();
const { supabase } = require('../shared/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const { applicationInsights } = require('../shared/logging');
const OpenAIClient = require('../shared/openaiClient');
const jsPDF = require('jspdf');
const { v4: uuidv4 } = require('uuid');

// Generate report
router.post('/generate', authenticateToken, async (req, res) => {
    try {
        const { projectId, reportName, includeCharts = false } = req.body;
        const userId = req.user.id;
        const openai = new OpenAIClient();

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // Verify user can access project
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const canAccess = project.created_by === userId || 
                         project.assigned_to.includes(userId) ||
                         req.user.role === 'admin';

        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to this project' });
        }

        // Get all analysis results for the project
        const { data: analysisResults, error: analysisError } = await supabase
            .from('analysis_results')
            .select('*, documents!inner(original_name, file_type, file_size, created_at, status)')
            .eq('documents.project_id', projectId);

        if (analysisError) throw analysisError;

        if (!analysisResults || analysisResults.length === 0) {
            return res.status(400).json({ error: 'No analyzed documents found for this project' });
        }

        // Get project documents
        const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId);

        if (docsError) throw docsError;

        // Track report generation start
        applicationInsights.trackEvent({
            name: 'ReportGenerationStarted',
            properties: {
                userId,
                projectId,
                documentCount: documents.length
            }
        });

        // Generate AI summary for the entire project
        const projectSummary = await openai.generateReportSummary(project, analysisResults);

        // Create report data structure
        const reportData = {
            project: {
                name: project.name,
                clientName: project.client_name,
                description: project.description,
                startDate: project.start_date,
                endDate: project.end_date,
                status: project.status
            },
            summary: projectSummary,
            documents: documents.map(doc => ({
                id: doc.id,
                name: doc.original_name,
                type: doc.file_type,
                size: doc.file_size,
                uploadedAt: doc.created_at,
                status: doc.status
            })),
            analysis: analysisResults.map(result => ({
                documentName: result.documents.original_name,
                summary: result.ai_summary,
                redFlags: result.red_flags,
                highlights: result.highlights,
                confidenceScore: result.confidence_score,
                extractedData: result.extracted_data
            })),
            statistics: generateStatistics(analysisResults),
            generatedAt: new Date().toISOString(),
            generatedBy: {
                id: userId,
                name: `${req.user.firstName} ${req.user.lastName}`,
                email: req.user.email
            }
        };

        // Generate PDF report
        const pdfBuffer = await generatePDFReport(reportData, includeCharts);

        // Upload PDF to Supabase Storage
        const reportFileName = `${projectId}/${uuidv4()}_${reportName || 'audit_report'}.pdf`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reports')
            .upload(reportFileName, pdfBuffer, {
                contentType: 'application/pdf',
                cacheControl: '3600'
            });

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
            .from('reports')
            .getPublicUrl(reportFileName);

        // Save report record to database
        const { data: auditReport, error: reportError } = await supabase
            .from('audit_reports')
            .insert([{
                project_id: projectId,
                generated_by: userId,
                report_name: reportName || 'Audit Report',
                report_data: reportData,
                pdf_url: publicUrl,
                status: 'final'
            }])
            .select()
            .single();

        if (reportError) throw reportError;

        // Track successful report generation
        applicationInsights.trackEvent({
            name: 'ReportGenerationCompleted',
            properties: {
                userId,
                projectId,
                reportId: auditReport.id,
                reportSize: pdfBuffer.length
            }
        });

        res.json({
            message: 'Report generated successfully',
            report: {
                id: auditReport.id,
                name: auditReport.report_name,
                pdfUrl: auditReport.pdf_url,
                generatedAt: auditReport.created_at,
                summary: projectSummary.substring(0, 200) + '...'
            }
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all reports for a project
router.get('/:projectId', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;

        // Verify user can access project
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const canAccess = project.created_by === userId || 
                         project.assigned_to.includes(userId) ||
                         req.user.role === 'admin';

        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to this project' });
        }

        // Get all reports for the project
        const { data: reports, error: reportsError } = await supabase
            .from('audit_reports')
            .select('*, users(first_name, last_name)')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (reportsError) throw reportsError;

        res.json({
            reports: reports.map(report => ({
                id: report.id,
                name: report.report_name,
                pdfUrl: report.pdf_url,
                status: report.status,
                generatedAt: report.created_at,
                generatedBy: {
                    id: report.generated_by,
                    name: `${report.users.first_name} ${report.users.last_name}`
                }
            }))
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific report
router.get('/detail/:reportId', authenticateToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const userId = req.user.id;

        // Get report
        const { data: report, error: reportError } = await supabase
            .from('audit_reports')
            .select('*, projects!inner(*)')
            .eq('id', reportId)
            .single();

        if (reportError || !report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Verify user can access project
        const canAccess = report.projects.created_by === userId || 
                         report.projects.assigned_to.includes(userId) ||
                         req.user.role === 'admin';

        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to this report' });
        }

        res.json({
            report: {
                id: report.id,
                name: report.report_name,
                pdfUrl: report.pdf_url,
                status: report.status,
                data: report.report_data,
                generatedAt: report.created_at,
                generatedBy: report.generated_by,
                project: {
                    id: report.projects.id,
                    name: report.projects.name,
                    clientName: report.projects.client_name
                }
            }
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to generate statistics from analysis results
function generateStatistics(analysisResults) {
    const stats = {
        totalDocuments: analysisResults.length,
        averageConfidenceScore: 0,
        totalRedFlags: 0,
        totalHighlights: 0,
        documentTypes: {},
        processingTime: 0
    };

    let totalConfidence = 0;
    let totalProcessingTime = 0;

    analysisResults.forEach(result => {
        // Calculate confidence score
        if (result.confidence_score) {
            totalConfidence += parseFloat(result.confidence_score);
        }

        // Count red flags and highlights
        stats.totalRedFlags += (result.red_flags || []).length;
        stats.totalHighlights += (result.highlights || []).length;

        // Count document types
        const fileType = result.documents.file_type || 'unknown';
        stats.documentTypes[fileType] = (stats.documentTypes[fileType] || 0) + 1;

        // Sum processing time
        if (result.processing_time_ms) {
            totalProcessingTime += result.processing_time_ms;
        }
    });

    stats.averageConfidenceScore = analysisResults.length > 0 ?
        (totalConfidence / analysisResults.length).toFixed(2) : 0;
    stats.processingTime = totalProcessingTime;

    return stats;
}

// Helper function to generate PDF report
async function generatePDFReport(reportData, includeCharts) {
    const doc = new jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.text('Audit Report', 20, yPosition);
    yPosition += 15;

    // Project Information
    doc.setFontSize(16);
    doc.text('Project Information', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.text(`Project: ${reportData.project.name}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Client: ${reportData.project.clientName}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Status: ${reportData.project.status}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Generated: ${new Date(reportData.generatedAt).toLocaleDateString()}`, 20, yPosition);
    yPosition += 15;

    // Executive Summary
    doc.setFontSize(16);
    doc.text('Executive Summary', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(reportData.summary, 170);
    doc.text(summaryLines, 20, yPosition);
    yPosition += summaryLines.length * 5 + 10;

    // Statistics
    if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
    }

    doc.setFontSize(16);
    doc.text('Statistics', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.text(`Total Documents: ${reportData.statistics.totalDocuments}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Average Confidence Score: ${reportData.statistics.averageConfidenceScore}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total Red Flags: ${reportData.statistics.totalRedFlags}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total Highlights: ${reportData.statistics.totalHighlights}`, 20, yPosition);
    yPosition += 15;

    // Document Analysis
    doc.setFontSize(16);
    doc.text('Document Analysis', 20, yPosition);
    yPosition += 10;

    reportData.analysis.forEach((analysis, index) => {
        if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text(`${index + 1}. ${analysis.documentName}`, 20, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        const summaryLines = doc.splitTextToSize(analysis.summary, 170);
        doc.text(summaryLines, 25, yPosition);
        yPosition += summaryLines.length * 4 + 5;

        if (analysis.redFlags && analysis.redFlags.length > 0) {
            doc.setFontSize(10);
            doc.text('Red Flags:', 25, yPosition);
            yPosition += 5;
            analysis.redFlags.forEach(flag => {
                const flagLines = doc.splitTextToSize(`• ${flag}`, 165);
                doc.text(flagLines, 30, yPosition);
                yPosition += flagLines.length * 4;
            });
            yPosition += 3;
        }

        if (analysis.highlights && analysis.highlights.length > 0) {
            doc.setFontSize(10);
            doc.text('Highlights:', 25, yPosition);
            yPosition += 5;
            analysis.highlights.forEach(highlight => {
                const highlightLines = doc.splitTextToSize(`• ${highlight}`, 165);
                doc.text(highlightLines, 30, yPosition);
                yPosition += highlightLines.length * 4;
            });
            yPosition += 5;
        }

        yPosition += 5;
    });

    return Buffer.from(doc.output('arraybuffer'));
}

module.exports = router;
