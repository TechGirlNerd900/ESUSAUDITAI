-- Migration to standardize chat_history table
-- This ensures consistency between code references and database schema

-- First check if the old chat_messages table exists and migrate data if needed
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
        -- Create chat_history table if it doesn't exist
        CREATE TABLE IF NOT EXISTS public.chat_history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            project_id UUID REFERENCES public.projects(id) NOT NULL,
            user_id UUID REFERENCES public.users(id),
            organization_id UUID REFERENCES public.organizations(id) NOT NULL,
            question TEXT,
            answer TEXT,
            context_documents JSONB DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Migrate data from chat_messages to chat_history if needed
        INSERT INTO public.chat_history (
            project_id, 
            user_id, 
            organization_id, 
            question, 
            answer, 
            created_at
        )
        SELECT 
            project_id,
            user_id,
            organization_id,
            CASE WHEN role = 'user' THEN content ELSE '' END as question,
            CASE WHEN role = 'assistant' THEN content ELSE '' END as answer,
            created_at
        FROM 
            public.chat_messages
        ON CONFLICT DO NOTHING;

        -- Drop the old table after migration
        DROP TABLE IF EXISTS public.chat_messages;
    ELSE
        -- If chat_messages doesn't exist but chat_history doesn't either, create chat_history
        IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_history') THEN
            CREATE TABLE public.chat_history (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                project_id UUID REFERENCES public.projects(id) NOT NULL,
                user_id UUID REFERENCES public.users(id),
                organization_id UUID REFERENCES public.organizations(id) NOT NULL,
                question TEXT,
                answer TEXT,
                context_documents JSONB DEFAULT '[]',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        END IF;
    END IF;
END
$$;

-- Add appropriate indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON public.chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_organization_id ON public.chat_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);

-- Enable Row Level Security
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multi-tenant isolation
CREATE POLICY "Users can view their organization's chat history"
ON public.chat_history
FOR SELECT
USING (organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert chat history in their organization"
ON public.chat_history
FOR INSERT
WITH CHECK (organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_chat_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_chat_history_updated_at ON public.chat_history;
CREATE TRIGGER set_chat_history_updated_at
BEFORE UPDATE ON public.chat_history
FOR EACH ROW
EXECUTE FUNCTION update_chat_history_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.chat_history IS 'Stores chat history for projects with questions, answers and context documents';