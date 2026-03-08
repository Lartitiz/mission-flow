ALTER TABLE public.files DROP CONSTRAINT files_category_check;
ALTER TABLE public.files ADD CONSTRAINT files_category_check CHECK (category IS NULL OR length(category) > 0);