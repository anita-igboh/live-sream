/* Replace with your SQL commands */
CREATE TABLE IF NOT EXISTS users (
id serial unique,
first_name VARCHAR,
last_name VARCHAR,
email VARCHAR,
password VARCHAR,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW() 
);