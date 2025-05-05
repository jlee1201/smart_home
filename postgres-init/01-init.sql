-- Grant all privileges to postgres user
ALTER USER postgres WITH SUPERUSER;

-- Ensure postgres user owns the database
ALTER DATABASE smart_home OWNER TO postgres;

-- Connect to the smart_home database
\c smart_home;

-- Grant all privileges on all tables to postgres user
GRANT ALL PRIVILEGES ON DATABASE smart_home TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO postgres; 