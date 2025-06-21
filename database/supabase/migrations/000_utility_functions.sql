-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Utility function to check if string is valid UUID
create or replace function is_valid_uuid(str text) returns boolean as $$
begin
  return str::uuid is not null;
exception
  when invalid_text_representation then
    return false;
end;
$$ language plpgsql;

-- Utility function to get current timestamp with timezone
create or replace function current_timestamp_utc() returns timestamp with time zone as $$
begin
  return (now() at time zone 'utc');
end;
$$ language plpgsql;

-- Add migration verification
do $$
begin

  assert is_valid_uuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') = true, 'UUID validation function failed';
end $$;
