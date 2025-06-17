-- ===================================================
-- ESUS AUDIT AI - MOCK DATA CLEANUP SCRIPT
-- ===================================================
-- This script removes all test/mock data from the database
-- Run this script to prepare the database for production use
-- IMPORTANT: Backup your database before running this script!

-- Step 1: Remove default admin user (change password before running)
-- The default admin password is: EsusAdmin2024!
-- RECOMMENDED: Create a new admin user with a secure password before running this

-- Display current admin user for verification
SELECT 'Current admin users:' as info;
SELECT id, email, first_name, last_name, role, created_at 
FROM users 
WHERE role = 'admin' AND email = 'admin@esusaudit.ai';

-- Step 2: Remove audit template data (if you want fresh templates)
-- Comment out the sections below if you want to keep the standard templates

-- Remove sample risk assessments
DELETE FROM risk_assessments WHERE project_id IS NULL;

-- Remove sample audit samples 
DELETE FROM audit_samples 
WHERE workpaper_id IN (
    SELECT id FROM workpapers WHERE reference_number IN ('FS-1.0', 'REV-1.0')
);

-- Remove sample workpapers
DELETE FROM workpapers 
WHERE reference_number IN ('FS-1.0', 'REV-1.0');

-- Remove sample audit programs (WARNING: This removes standard templates)
-- DELETE FROM audit_programs 
-- WHERE name IN (
--     'Financial Statement Audit Program',
--     'Revenue Recognition Audit Program', 
--     'Inventory Audit Program'
-- );

-- Step 3: Remove template initialization logs
DELETE FROM audit_logs 
WHERE action = 'template_initialization' 
AND resource_type = 'audit_programs';

-- Step 4: Reset app settings to production defaults
-- Update settings that should be different in production
UPDATE app_settings 
SET value = 'false' 
WHERE key = 'enable_demo_mode';

UPDATE app_settings 
SET value = 'false' 
WHERE key = 'maintenance_mode';

-- Step 5: Clean up any test data (if exists)
-- Remove any projects with test names
DELETE FROM projects 
WHERE name ILIKE '%test%' 
   OR name ILIKE '%demo%' 
   OR name ILIKE '%sample%'
   OR client_name ILIKE '%test%'
   OR client_name ILIKE '%demo%'
   OR client_name ILIKE '%sample%';

-- Remove any test users (excluding the admin)
DELETE FROM users 
WHERE email ILIKE '%test%'
   OR email ILIKE '%demo%'
   OR email ILIKE '%sample%'
   OR first_name ILIKE '%test%'
   OR last_name ILIKE '%test%';

-- Step 6: Reset sequences and clean up orphaned data
-- Remove orphaned documents (documents without projects)
DELETE FROM documents 
WHERE project_id NOT IN (SELECT id FROM projects);

-- Remove orphaned analysis results
DELETE FROM analysis_results 
WHERE document_id NOT IN (SELECT id FROM documents);

-- Remove orphaned chat history
DELETE FROM chat_history 
WHERE project_id NOT IN (SELECT id FROM projects);

-- Remove orphaned audit reports
DELETE FROM audit_reports 
WHERE project_id NOT IN (SELECT id FROM projects);

-- Step 7: Verification queries
-- Run these to verify cleanup was successful
SELECT 'Verification Results:' as info;

SELECT 
    'Users' as table_name,
    COUNT(*) as remaining_records,
    COUNT(*) FILTER (WHERE role = 'admin') as admin_count
FROM users
UNION ALL
SELECT 
    'Projects' as table_name,
    COUNT(*) as remaining_records,
    0 as admin_count
FROM projects
UNION ALL
SELECT 
    'Documents' as table_name,
    COUNT(*) as remaining_records,
    0 as admin_count
FROM documents
UNION ALL
SELECT 
    'Analysis Results' as table_name,
    COUNT(*) as remaining_records,
    0 as admin_count
FROM analysis_results
UNION ALL
SELECT 
    'Chat History' as table_name,
    COUNT(*) as remaining_records,
    0 as admin_count
FROM chat_history
UNION ALL
SELECT 
    'Audit Reports' as table_name,
    COUNT(*) as remaining_records,
    0 as admin_count
FROM audit_reports
UNION ALL
SELECT 
    'Audit Programs' as table_name,
    COUNT(*) as remaining_records,
    0 as admin_count
FROM audit_programs;

-- ===================================================
-- POST-CLEANUP RECOMMENDATIONS:
-- ===================================================
-- 1. Create a new admin user with a secure password
-- 2. Update environment variables for production
-- 3. Review and update app_settings for your organization
-- 4. Test the application with the cleaned database
-- 5. Create new audit templates specific to your needs
-- ===================================================