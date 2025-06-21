-- Initial app settings
INSERT INTO app_settings (key, value, description, category, is_sensitive) VALUES
('app_version', '1.0.0', 'Current application version', 'system', false),
('max_file_size_mb', '50', 'Maximum file upload size in MB', 'upload', false),
('supported_file_types', 'pdf,xlsx,xls,docx,doc,csv', 'Supported file extensions', 'upload', false),
('ai_confidence_threshold', '0.7', 'Minimum confidence score for AI analysis', 'ai', false)
ON CONFLICT (key) DO NOTHING;

-- Create initial admin user (password should be changed on first login)
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role
) VALUES (
    'admin@esusaudit.ai',
    '$2a$12$LQv3c1yqBwEHFqHALGMJ4.VQVn5UVUFMHDsLaeEay7NCWDyDq7/1e',
    'System',
    'Administrator',
    'admin'
) ON CONFLICT (email) DO NOTHING;