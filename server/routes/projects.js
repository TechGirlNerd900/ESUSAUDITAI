const express = require('express');
const router = express.Router();
const { supabase } = require('../shared/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const { applicationInsights } = require('../shared/logging');

// Get all projects for authenticated user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .or(`created_by.eq.${userId},assigned_to.cs.{${userId}}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            projects: projects.map(project => ({
                id: project.id,
                name: project.name,
                description: project.description,
                clientName: project.client_name,
                clientEmail: project.client_email,
                status: project.status,
                startDate: project.start_date,
                endDate: project.end_date,
                createdAt: project.created_at,
                updatedAt: project.updated_at
            }))
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new project
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, clientName, clientEmail, assignedTo, startDate, endDate } = req.body;

        if (!name || !clientName) {
            return res.status(400).json({ error: 'Project name and client name are required' });
        }

        const { data: project, error } = await supabase
            .from('projects')
            .insert([{
                name,
                description,
                client_name: clientName,
                client_email: clientEmail,
                created_by: userId,
                assigned_to: assignedTo || [userId],
                start_date: startDate,
                end_date: endDate
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            message: 'Project created successfully',
            project: {
                id: project.id,
                name: project.name,
                description: project.description,
                clientName: project.client_name,
                clientEmail: project.client_email,
                status: project.status,
                startDate: project.start_date,
                endDate: project.end_date,
                createdAt: project.created_at
            }
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get specific project with documents and analysis results
router.get('/:projectId', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;

        // Get project
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError) throw projectError;
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check access
        const canAccess = project.created_by === userId || 
                         project.assigned_to.includes(userId) ||
                         req.user.role === 'admin';
        
        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to this project' });
        }

        // Get documents
        const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (docsError) throw docsError;

        // Get analysis results
        const { data: analysisResults, error: analysisError } = await supabase
            .from('analysis_results')
            .select('*, documents(original_name)')
            .eq('documents.project_id', projectId);

        if (analysisError) throw analysisError;

        res.json({
            project: {
                id: project.id,
                name: project.name,
                description: project.description,
                clientName: project.client_name,
                clientEmail: project.client_email,
                status: project.status,
                startDate: project.start_date,
                endDate: project.end_date,
                createdAt: project.created_at,
                updatedAt: project.updated_at
            },
            documents: documents.map(doc => ({
                id: doc.id,
                originalName: doc.original_name,
                fileType: doc.file_type,
                fileSize: doc.file_size,
                status: doc.status,
                uploadedAt: doc.created_at
            })),
            analysisResults: analysisResults.map(result => ({
                id: result.id,
                documentName: result.documents.original_name,
                summary: result.ai_summary,
                redFlags: result.red_flags,
                highlights: result.highlights,
                confidenceScore: result.confidence_score,
                createdAt: result.created_at
            }))
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update project
router.put('/:projectId', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;

        // Get project
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError) throw projectError;
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check modification rights
        if (project.created_by !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only project creator or admin can modify project' });
        }

        const { name, description, clientName, clientEmail, status, assignedTo, startDate, endDate } = req.body;

        const updates = {};
        if (name) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (clientName) updates.client_name = clientName;
        if (clientEmail !== undefined) updates.client_email = clientEmail;
        if (status) updates.status = status;
        if (assignedTo) updates.assigned_to = assignedTo;
        if (startDate !== undefined) updates.start_date = startDate;
        if (endDate !== undefined) updates.end_date = endDate;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const { data: updatedProject, error: updateError } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', projectId)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            message: 'Project updated successfully',
            project: {
                id: updatedProject.id,
                name: updatedProject.name,
                description: updatedProject.description,
                clientName: updatedProject.client_name,
                clientEmail: updatedProject.client_email,
                status: updatedProject.status,
                startDate: updatedProject.start_date,
                endDate: updatedProject.end_date,
                updatedAt: updatedProject.updated_at
            }
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
