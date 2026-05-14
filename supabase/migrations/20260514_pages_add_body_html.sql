-- Add body_html to the pages table for internal-link generation.
-- The crawler strips script/style/nav/header/footer/aside before storing,
-- so this is content-only HTML (~20-80 KB per page), TOAST'd by Postgres.
-- Pages without body_html (old rows, or pages exceeding the 500 KB cap) will
-- produce a proposal failure rather than a live HTTP fetch.
alter table pages add column if not exists body_html text;
