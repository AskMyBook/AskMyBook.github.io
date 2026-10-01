-- ===== إعداد الحسابات والمزامنة (Supabase) — شغّله مرة واحدة في SQL Editor =====
-- كل مستخدم بيشوف بياناته هو بس: Row Level Security على الجدول، وسياسات على التخزين بتقفل كل مستخدم على فولدره.
-- المفتاح العام (anon key) آمن يتحط في الموقع لأن الحماية هنا في قاعدة البيانات. متحطش service_role key في الموقع أبدًا.

-- 1) بيانات المذاكرة: المكتبة، الكتابة على الكتب، الملاحظات، التقدّم، نقط الضعف، الخطط، الامتحانات
create table if not exists public.user_kv (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  k          text        not null check (char_length(k) between 1 and 200),
  v          jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);
alter table public.user_kv enable row level security;

drop policy if exists "own rows: select" on public.user_kv;
drop policy if exists "own rows: insert" on public.user_kv;
drop policy if exists "own rows: update" on public.user_kv;
drop policy if exists "own rows: delete" on public.user_kv;
create policy "own rows: select" on public.user_kv for select to authenticated using (user_id = auth.uid());
create policy "own rows: insert" on public.user_kv for insert to authenticated with check (user_id = auth.uid());
create policy "own rows: update" on public.user_kv for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows: delete" on public.user_kv for delete to authenticated using (user_id = auth.uid());

-- 2) ملفات الكتب (PDF): bucket خاص (مش public)، وكل مستخدم في فولدر باسم الـ id بتاعه: <user_id>/<book_id>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

drop policy if exists "books: read own" on storage.objects;
drop policy if exists "books: add own" on storage.objects;
drop policy if exists "books: update own" on storage.objects;
drop policy if exists "books: delete own" on storage.objects;
create policy "books: read own" on storage.objects for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books: update own" on storage.objects for update to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "books: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) (اختياري) فهرس بحث بالمعنى على السيرفر — للمزامنة بين الأجهزة وللكتب الكبيرة (pgvector)
--    الموقع بيستخدمه لما تختار «فهرس الحساب» (AI.vectors.use("supabase"))؛ المحلي (IndexedDB) هو الافتراضي.
create extension if not exists vector;
create table if not exists public.chunks (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  book_id    text        not null,
  chunk_id   text        not null,
  page       int         not null check (page > 0),
  section    text,
  body       text        not null,
  model      text        not null,
  embedding  vector      not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id, chunk_id)
);
alter table public.chunks enable row level security;
drop policy if exists "own chunks" on public.chunks;
create policy "own chunks" on public.chunks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- البحث: بيرجّع مقاطع المستخدم الحالي بس (security invoker + auth.uid())، ومن الكتب المطلوبة بس، وبنفس موديل الـ embeddings
create or replace function public.match_chunks(query vector, books text[], emb_model text, k int default 8)
returns table (book_id text, chunk_id text, page int, section text, body text, score double precision)
language sql stable security invoker as $$
  select c.book_id, c.chunk_id, c.page, c.section, c.body, 1 - (c.embedding <=> query) as score
  from public.chunks c
  where c.user_id = auth.uid() and c.model = emb_model and (books is null or c.book_id = any(books))
    and vector_dims(c.embedding) = vector_dims(query)
  order by c.embedding <=> query
  limit least(greatest(k, 1), 50)
$$;
