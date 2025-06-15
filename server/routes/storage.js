import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { protectRoute } from '../middleware/auth.js';
import { applicationInsights } from '../shared/logging.js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Define allowed file types for audit documents
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'image/jpeg',
        'image/png',
        'image/gif',
        'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 10 // Maximum 10 files per upload
    }
});

// Upload audit documents
router.post('/upload/audit-documents/:projectId', protectRoute, upload.array('files', 10), async (req, res) => {
    try {
        const { projectId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Verify user has access to the project
        const { data: project, error: projectError } = await req.supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }

        const uploadResults = [];
        const errors = [];

        for (const file of files) {
            try {
                // Generate unique filename
                const fileExtension = path.extname(file.originalname);
                const fileName = `${uuidv4()}${fileExtension}`;
                const filePath = `${projectId}/${fileName}`;

                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await req.supabase.storage
                    .from('audit-documents')
                    .upload(filePath, file.buffer, {
                        contentType: file.mimetype,
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    errors.push({
                        filename: file.originalname,
                        error: uploadError.message
                    });
                    continue;
                }

                // Get public URL (for private buckets, this returns a signed URL)
                const { data: urlData } = req.supabase.storage
                    .from('audit-documents')
                    .getPublicUrl(filePath);

                // Save document metadata to database
                const { data: documentData, error: documentError } = await req.supabase
                    .from('documents')
                    .insert({
                        project_id: projectId,
                        uploaded_by: req.user.id,
                        original_name: file.originalname,
                        file_path: filePath,
                        file_size: file.size,
                        file_type: file.mimetype,
                        blob_url: urlData.publicUrl,
                        status: 'uploaded'
                    })
                    .select()
                    .single();

                if (documentError) {
                    // If database insert fails, clean up the uploaded file
                    await req.supabase.storage
                        .from('audit-documents')
                        .remove([filePath]);
                    
                    errors.push({
                        filename: file.originalname,
                        error: 'Failed to save document metadata'
                    });
                    continue;
                }

                uploadResults.push({
                    filename: file.originalname,
                    documentId: documentData.id,
                    fileSize: file.size,
                    uploadPath: filePath,
                    url: urlData.publicUrl
                });

                // Track successful upload
                applicationInsights.trackEvent({
                    name: 'DocumentUploaded',
                    properties: {
                        userId: req.user.id,
                        projectId: projectId,
                        filename: file.originalname,
                        fileSize: file.size,
                        fileType: file.mimetype
                    }
                });

            } catch (error) {
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
            }
        }

        res.json({
            message: 'Upload process completed',
            successful: uploadResults,
            errors: errors,
            totalFiles: files.length,
            successCount: uploadResults.length,
            errorCount: errors.length
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during file upload' });
    }
});

// Upload evidence files
router.post('/upload/evidence/:projectId', protectRoute, upload.array('files', 10), async (req, res) => {
    try {
        const { projectId } = req.params;
        const { description } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Verify user has access to the project
        const { data: project, error: projectError } = await req.supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }

        const uploadResults = [];
        const errors = [];

        for (const file of files) {
            try {
                // Generate unique filename
                const fileExtension = path.extname(file.originalname);
                const fileName = `${uuidv4()}${fileExtension}`;
                const filePath = `${projectId}/evidence/${fileName}`;

                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await req.supabase.storage
                    .from('evidence-files')
                    .upload(filePath, file.buffer, {
                        contentType: file.mimetype,
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    errors.push({
                        filename: file.originalname,
                        error: uploadError.message
                    });
                    continue;
                }

                // Get public URL
                const { data: urlData } = req.supabase.storage
                    .from('evidence-files')
                    .getPublicUrl(filePath);

                // Save document metadata to database with evidence flag
                const { data: documentData, error: documentError } = await req.supabase
                    .from('documents')
                    .insert({
                        project_id: projectId,
                        uploaded_by: req.user.id,
                        original_name: file.originalname,
                        file_path: filePath,
                        file_size: file.size,
                        file_type: file.mimetype,
                        blob_url: urlData.publicUrl,
                        status: 'uploaded',
                        // Add evidence-specific metadata
                        description: description || null
                    })
                    .select()
                    .single();

                if (documentError) {
                    // Clean up uploaded file on database error
                    await req.supabase.storage
                        .from('evidence-files')
                        .remove([filePath]);
                    
                    errors.push({
                        filename: file.originalname,
                        error: 'Failed to save evidence metadata'
                    });
                    continue;
                }

                uploadResults.push({
                    filename: file.originalname,
                    documentId: documentData.id,
                    fileSize: file.size,
                    uploadPath: filePath,
                    url: urlData.publicUrl,
                    type: 'evidence'
                });

                // Track successful evidence upload
                applicationInsights.trackEvent({
                    name: 'EvidenceUploaded',
                    properties: {
                        userId: req.user.id,
                        projectId: projectId,
                        filename: file.originalname,
                        fileSize: file.size,
                        fileType: file.mimetype
                    }
                });

            } catch (error) {
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
            }
        }

        res.json({
            message: 'Evidence upload process completed',
            successful: uploadResults,
            errors: errors,
            totalFiles: files.length,
            successCount: uploadResults.length,
            errorCount: errors.length
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during evidence upload' });
    }
});

// Upload avatar
router.post('/upload/avatar', protectRoute, upload.single('avatar'), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No avatar file uploaded' });
        }

        // Validate image type
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedImageTypes.includes(file.mimetype)) {
            return res.status(400).json({ error: 'Only JPEG, PNG, and GIF images are allowed for avatars' });
        }

        // Generate filename with user ID
        const fileExtension = path.extname(file.originalname);
        const fileName = `avatar${fileExtension}`;
        const filePath = `${req.user.auth.id}/${fileName}`;

        // Upload to Supabase Storage (will overwrite existing avatar)
        const { data: uploadData, error: uploadError } = await req.supabase.storage
            .from('avatars')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: true // Allow overwriting existing avatar
            });

        if (uploadError) {
            return res.status(500).json({ error: uploadError.message });
        }

        // Get public URL
        const { data: urlData } = req.supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update user profile with avatar URL
        const { data: userData, error: userError } = await req.supabase
            .from('users')
            .update({ avatar_url: urlData.publicUrl })
            .eq('id', req.user.id)
            .select()
            .single();

        if (userError) {
            return res.status(500).json({ error: 'Failed to update user profile with avatar URL' });
        }

        // Track avatar upload
        applicationInsights.trackEvent({
            name: 'AvatarUploaded',
            properties: {
                userId: req.user.id,
                fileSize: file.size,
                fileType: file.mimetype
            }
        });

        res.json({
            message: 'Avatar uploaded successfully',
            avatarUrl: urlData.publicUrl,
            fileSize: file.size
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during avatar upload' });
    }
});

// Download file
router.get('/download/:bucket/:projectId/*', protectRoute, async (req, res) => {
    try {
        const { bucket, projectId } = req.params;
        const filePath = req.params[0]; // Get the rest of the path

        // Verify bucket is allowed
        const allowedBuckets = ['audit-documents', 'evidence-files'];
        if (!allowedBuckets.includes(bucket)) {
            return res.status(400).json({ error: 'Invalid bucket' });
        }

        // Verify user has access to the project
        const { data: project, error: projectError } = await req.supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }

        // Create signed URL for download
        const { data: signedUrlData, error: urlError } = await req.supabase.storage
            .from(bucket)
            .createSignedUrl(`${projectId}/${filePath}`, 3600); // 1 hour expiry

        if (urlError) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Track download
        applicationInsights.trackEvent({
            name: 'FileDownloaded',
            properties: {
                userId: req.user.id,
                projectId: projectId,
                bucket: bucket,
                filePath: filePath
            }
        });

        res.json({
            downloadUrl: signedUrlData.signedUrl,
            expiresIn: 3600
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during file download' });
    }
});

// Delete file
router.delete('/files/:bucket/:projectId/*', protectRoute, async (req, res) => {
    try {
        const { bucket, projectId } = req.params;
        const filePath = req.params[0];

        // Verify bucket is allowed
        const allowedBuckets = ['audit-documents', 'evidence-files'];
        if (!allowedBuckets.includes(bucket)) {
            return res.status(400).json({ error: 'Invalid bucket' });
        }

        // Verify user has access to the project and is owner or admin
        const { data: project, error: projectError } = await req.supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }

        // Check if user is project owner or admin
        if (project.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only project owners and admins can delete files' });
        }

        // Delete from storage
        const { error: deleteError } = await req.supabase.storage
            .from(bucket)
            .remove([`${projectId}/${filePath}`]);

        if (deleteError) {
            return res.status(500).json({ error: deleteError.message });
        }

        // Remove from documents table
        const { error: dbError } = await req.supabase
            .from('documents')
            .delete()
            .eq('file_path', `${projectId}/${filePath}`);

        if (dbError) {
            console.error('Failed to remove document from database:', dbError);
        }

        // Track deletion
        applicationInsights.trackEvent({
            name: 'FileDeleted',
            properties: {
                userId: req.user.id,
                projectId: projectId,
                bucket: bucket,
                filePath: filePath
            }
        });

        res.json({ message: 'File deleted successfully' });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during file deletion' });
    }
});

// Get file list for project
router.get('/files/:projectId', protectRoute, async (req, res) => {
    try {
        const { projectId } = req.params;

        // Verify user has access to the project
        const { data: project, error: projectError } = await req.supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }

        // Get documents from database
        const { data: documents, error: documentsError } = await req.supabase
            .from('documents')
            .select(`
                id,
                original_name,
                file_size,
                file_type,
                blob_url,
                status,
                created_at,
                uploaded_by,
                users!documents_uploaded_by_fkey(first_name, last_name)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (documentsError) {
            return res.status(500).json({ error: documentsError.message });
        }

        res.json({
            projectId: projectId,
            files: documents.map(doc => ({
                id: doc.id,
                name: doc.original_name,
                size: doc.file_size,
                type: doc.file_type,
                status: doc.status,
                uploadedAt: doc.created_at,
                uploadedBy: doc.users ? `${doc.users.first_name} ${doc.users.last_name}` : 'Unknown'
            }))
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error fetching file list' });
    }
});

export default router;