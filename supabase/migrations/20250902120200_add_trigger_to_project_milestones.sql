-- Migration to add a trigger to the project_milestones table

-- First, create a trigger function that calls the calculation function
CREATE OR REPLACE FUNCTION public.handle_project_completion_update()
RETURNS TRIGGER AS $$
BEGIN
    -- On DELETE, use the OLD project_id
    IF (TG_OP = 'DELETE') THEN
        PERFORM calculate_project_completion(OLD.project_id);
        RETURN OLD;
    -- On INSERT or UPDATE, use the NEW project_id
    ELSE
        PERFORM calculate_project_completion(NEW.project_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Now, create the trigger to execute this new function
CREATE TRIGGER update_project_completion_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.project_milestones
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_project_completion_update();
