-- Migration: Storage Buckets Setup
-- Version: 1.9.0
-- Date: 2025-06-14
-- Description: Create storage buckets for audit documents and evidence

BEGIN;

-- Create storage buckets for audit documents
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('audit-documents', 'audit-documents', false),
    ('evidence-files', 'evidence-files', false),
    ('avatars', 'avatars', true),
    ('temp-uploads', 'temp-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audit-documents bucket
CREATE POLICY "Authenticated users can view audit documents they have access to"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'audit-documents' AND
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
            projects.created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(projects.assigned_to) OR
            EXISTS (
                SELECT 1 FROM users
                WHERE auth_user_id = auth.uid() AND role = 'admin'
            )
        )
    )
);

CREATE POLICY "Users can upload audit documents to their projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'audit-documents' AND
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
            projects.created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(projects.assigned_to)
        )
    )
);

CREATE POLICY "Users can update audit documents in their projects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'audit-documents' AND
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
            projects.created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(projects.assigned_to) OR
            EXISTS (
                SELECT 1 FROM users
                WHERE auth_user_id = auth.uid() AND role = 'admin'
            )
        )
    )
);

CREATE POLICY "Users can delete audit documents in their projects"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'audit-documents' AND
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
            projects.created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            EXISTS (
                SELECT 1 FROM users
                WHERE auth_user_id = auth.uid() AND role = 'admin'
            )
        )
    )
);

-- Storage policies for evidence-files bucket
CREATE POLICY "Authenticated users can view evidence files they have access to"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'evidence-files' AND
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
            projects.created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(projects.assigned_to) OR
            EXISTS (
                SELECT 1 FROM users
                WHERE auth_user_id = auth.uid() AND role = 'admin'
            )
        )
    )
);

CREATE POLICY "Users can upload evidence files to their projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'evidence-files' AND
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
            projects.created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(projects.assigned_to)
        )
    )
);

CREATE POLICY "Users can update evidence files in their projects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'evidence-files' AND
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
            projects.created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(projects.assigned_to) OR
            EXISTS (
                SELECT 1 FROM users
                WHERE auth_user_id = auth.uid() AND role = 'admin'
            )
        )
    )
);

CREATE POLICY "Users can delete evidence files in their projects"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'evidence-files' AND
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND (
            projects.created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            EXISTS (
                SELECT 1 FROM users
                WHERE auth_user_id = auth.uid() AND role = 'admin'
            )
        )
    )
);

-- Storage policies for avatars bucket (public read, user-specific write)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policies for temp-uploads bucket (user-specific temporary storage)
CREATE POLICY "Users can access their temp uploads"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Create audit log entry for this migration
INSERT INTO audit_logs (
    action,
    resource_type,
    details,
    success
) VALUES (
    'database_migration',
    'storage',
    '{"migration": "009_storage_buckets", "version": "1.9.0", "description": "Create storage buckets for audit documents and evidence"}'::jsonb,
    true
);

COMMIT;