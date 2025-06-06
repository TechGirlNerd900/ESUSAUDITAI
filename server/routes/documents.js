const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../shared/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const { applicationInsights } = require('../shared/logging');
const { v4: uuidv4 } = require('uuid');
const { createError, asyncHandler } = require('../utils/errorHandler');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf', 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword', 
            'text/csv'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, Excel, Word, and CSV files are allowed.'), false);
        }
    }
});


// Upload document
router.post('/:projectId', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
        throw createError('VALIDATION', 'No file uploaded');
    }

    // Check project access
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        throw createError('NOT_FOUND', 'Project not found');
    }

    // Check access permission
    const canAccess = project.created_by === userId || 
                     project.assigned_to.includes(userId) ||
                     req.user.role === 'admin';
    
    if (!canAccess) {
        throw createError('AUTHORIZATION', 'Access denied to this project');
    }

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${projectId}/${fileName}`;

    // For large files, use chunked upload
    let uploadResult;
    if (file.size > 5 * 1024 * 1024) { // 5MB threshold for chunked upload
        uploadResult = await uploadLargeFile(filePath, file);
    } else {
        // Standard upload for smaller files
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600'
            });
            
        if (error) {
            throw createError('INTERNAL', 'File upload failed', { originalError: error.message }, error);
        }
        
        uploadResult = data;
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

    // Create document record in database
    const { data: document, error: docError } = await supabase
        .from('documents')
        .insert([{
            project_id: projectId,
            uploaded_by: userId,
            original_name: file.originalname,
            file_path: filePath,
            file_size: file.size,
            file_type: file.mimetype,
            blob_url: publicUrl,
            status: 'uploaded'
        }])
        .select()
        .single();

    if (docError) {
        throw createError('INTERNAL', 'Failed to create document record', { originalError: docError.message }, docError);
    }

    // Track successful upload
    applicationInsights.trackEvent({
        name: 'DocumentUploaded',
        properties: {
            projectId,
            documentId: document.id,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadMethod: file.size > 5 * 1024 * 1024 ? 'chunked' : 'standard'
        }
    });

    res.status(201).json({
        message: 'Document uploaded successfully',
        document: {
            id: document.id,
            originalName: document.original_name,
            fileType: document.file_type,
            fileSize: document.file_size,
            status: document.status,
            uploadedAt: document.created_at
        }
    });
}));

// Download document
router.get('/:documentId/download', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;

        // Get document details
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('*, projects!inner(*)')
            .eq('id', documentId)
            .single();

        if (docError || !document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check access
        const canAccess = document.projects.created_by === userId || 
                         document.projects.assigned_to.includes(userId) ||
                         req.user.role === 'admin';

        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to this document' });
        }

        // Generate signed URL for secure download
        const { data: { signedUrl }, error: signedUrlError } = await supabase.storage
            .from('documents')
            .createSignedUrl(document.file_path, 60); // URL expires in 60 seconds

        if (signedUrlError) throw signedUrlError;

        // Track download
        applicationInsights.trackEvent({
            name: 'DocumentDownloaded',
            properties: {
                documentId,
                userId,
                projectId: document.project_id
            }
        });

        res.json({ downloadUrl: signedUrl });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete document
router.delete('/:documentId', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;

        // Get document details
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('*, projects!inner(*)')
            .eq('id', documentId)
            .single();

        if (docError || !document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check delete permission
        const canDelete = document.projects.created_by === userId || 
                         req.user.role === 'admin';

        if (!canDelete) {
            return res.status(403).json({ error: 'Only project creator or admin can delete documents' });
        }

        // Delete from storage
        const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([document.file_path]);

        if (storageError) throw storageError;

        // Delete from database
        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId);

        if (deleteError) throw deleteError;

        // Track deletion
        applicationInsights.trackEvent({
            name: 'DocumentDeleted',
            properties: {
                documentId,
                userId,
                projectId: document.project_id
            }
        });

        res.json({ message: 'Document deleted successfully' });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Uploads a large file using chunked upload
 * @param {string} filePath - Path to store the file
 * @param {Object} file - File object from multer
 * @returns {Promise<Object>} Upload result
 */
async function uploadLargeFile(filePath, file) {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    try {
        // Initialize chunked upload
        applicationInsights.trackEvent({
            name: 'ChunkedUploadStarted',
            properties: {
                filePath,
                fileSize: file.size,
                totalChunks
            }
        });

        // Upload each chunk
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(file.size, start + CHUNK_SIZE);
            const chunk = file.buffer.slice(start, end);
            
            const { error } = await supabase.storage
                .from('documents')
                .upload(`${filePath}_part${i}`, chunk, {
                    contentType: file.mimetype,
                    cacheControl: '3600',
                    upsert: true
                });
                
            if (error) {
                throw new Error(`Chunk upload failed at part ${i}: ${error.message}`);
            }
        }
        
        // Combine chunks (in a real implementation, you might need a server-side function to combine chunks)
        // For Supabase, we would typically use a server-side function or a background job
        // This is a simplified example
        const combinedBuffer = file.buffer;
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(filePath, combinedBuffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: true
            });
            
        if (error) {
            throw new Error(`Failed to finalize chunked upload: ${error.message}`);
        }
        
        // Clean up chunk parts
        for (let i = 0; i < totalChunks; i++) {
            await supabase.storage
                .from('documents')
                .remove([`${filePath}_part${i}`]);
        }
        
        applicationInsights.trackEvent({
            name: 'ChunkedUploadCompleted',
            properties: {
                filePath,
                fileSize: file.size,
                totalChunks
            }
        });
        
        return data;
    } catch (error) {
        applicationInsights.trackException({
            exception: error,
            properties: {
                filePath,
                fileSize: file.size,
                operation: 'chunkedUpload'
            }
        });
        throw error;
    }
}

module.exports = router;
