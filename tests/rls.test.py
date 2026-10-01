# اختبار قواعد الأمان (RLS) الحقيقية في server/supabase.sql على Postgres حقيقي + pgvector (من غير mocks لقاعدة البيانات).
# بيعمل نسخة صغيرة من الأجزاء اللي Supabase بيوفرها (auth.uid() / الأدوار / storage.objects) وبعدين يشغّل supabase.sql زي ما هو،
# ويتأكد إن كل مستخدم مايقدرش يقرا أو يكتب بيانات أو كتب أو فهرس مستخدم تاني.
# التشغيل: pip install pgserver && python3 tests/rls.test.py
import sys, os, tempfile, uuid
try:
    import pgserver
except Exception as e:
    print("❌ FAILED: pgserver مش متسطّب (pip install pgserver) —", e); sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0
def ok(name, cond, info=""):
    global passed, failed
    if cond: passed += 1; print("✅", name)
    else: failed += 1; print("❌", name, " →", str(info)[:300])

srv = pgserver.get_server(tempfile.mkdtemp(), cleanup_mode="stop")
import subprocess
PSQL = os.path.join(os.path.dirname(pgserver.__file__), "pginstall", "bin", "psql")
def q(sql):   # stdout + stderr عشان رسايل الأخطاء (RLS) تبان في النتيجة
    r = subprocess.run([PSQL, srv.get_uri(), "-X", "-c", sql], capture_output=True, text=True)
    return r.stdout + r.stderr
SHIM = """
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
grant usage on schema public, auth, storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
"""
print(q(SHIM)[-60:].strip())
sql = open(os.path.join(ROOT, "server", "supabase.sql"), encoding="utf-8").read()
out = q(sql)
ok("supabase.sql runs cleanly on real Postgres + pgvector", "ERROR" not in out, out[-400:])

A, B = str(uuid.uuid4()), str(uuid.uuid4())
q(f"insert into auth.users values ('{A}','a@x'),('{B}','b@x');")
def as_user(uid, body):
    return q(f"begin; set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body} commit;")
def as_anon(body):
    return q(f"begin; set local role anon; {body} commit;")

r = as_user(A, "insert into public.user_kv(user_id,k,v) values ('%s','notes','[\"A note\"]');" % A)
ok("user A can write own row", "ERROR" not in r, r)
r = as_user(A, "insert into public.user_kv(user_id,k,v) values ('%s','notes','[\"forged\"]');" % B)
ok("user A cannot write a row for user B", "row-level security" in r, r)
as_user(B, "insert into public.user_kv(user_id,k,v) values ('%s','notes','[\"B secret\"]');" % B)
r = as_user(A, "select count(*) from public.user_kv;")
ok("user A sees only own rows (1, not 2)", " 1\n" in r, r)
r = as_user(A, "select v::text from public.user_kv where user_id='%s';" % B)
ok("user A can't read B's notes even filtering by B's id", "B secret" not in r and "(0 rows)" in r, r)
r = as_user(A, "update public.user_kv set v='[]' where user_id='%s';" % B)
ok("user A can't modify B's rows (UPDATE 0)", "UPDATE 0" in r, r)
r = as_user(A, "delete from public.user_kv where user_id='%s';" % B)
ok("user A can't delete B's rows (DELETE 0)", "DELETE 0" in r, r)
r = as_anon("select count(*) from public.user_kv;")
ok("anonymous (not signed in) sees nothing", " 0\n" in r or "permission denied" in r, r)

# التخزين: كل مستخدم في فولدر باسم الـ id بتاعه
r = as_user(A, f"insert into storage.objects(bucket_id,name) values ('books','{A}/book1.pdf');")
ok("user A can upload into own folder", "ERROR" not in r, r)
r = as_user(A, f"insert into storage.objects(bucket_id,name) values ('books','{B}/evil.pdf');")
ok("user A can't upload into B's folder", "row-level security" in r, r)
as_user(B, f"insert into storage.objects(bucket_id,name) values ('books','{B}/private.pdf');")
r = as_user(A, "select name from storage.objects;")
ok("user A lists only own PDFs", f"{A}/book1.pdf" in r and "private.pdf" not in r, r)
r = as_user(A, f"delete from storage.objects where name='{B}/private.pdf';")
ok("user A can't delete B's PDF", "DELETE 0" in r, r)
r = q("select public, allowed_mime_types::text, file_size_limit from storage.buckets where id='books';")
ok("books bucket is private, PDF-only, 50 MB limit", " f " in r and "application/pdf" in r and "52428800" in r, r)

# الفهرس بالمعنى (pgvector) + match_chunks
as_user(A, f"insert into public.chunks(user_id,book_id,chunk_id,page,section,body,model,embedding) values ('{A}','b1','c1',2,'Lesson 2','Newton second law F = m a','m1','[1,0,0]'),('{A}','b1','c2',3,'Lesson 3','photosynthesis','m1','[0,1,0]');")
as_user(B, f"insert into public.chunks(user_id,book_id,chunk_id,page,section,body,model,embedding) values ('{B}','b9','x1',1,'Secret','B private text','m1','[1,0,0]');")
r = as_user(A, "select book_id, chunk_id, page from public.match_chunks('[1,0,0]', null, 'm1', 5);")
ok("match_chunks returns A's best chunk first and never B's chunks", r.find("c1") > -1 and "x1" not in r and r.find("c1") < r.find("c2"), r)
r = as_user(A, "select count(*) from public.match_chunks('[1,0,0]', array['b2'], 'm1', 5);")
ok("match_chunks respects the selected book filter", " 0\n" in r, r)
r = as_user(A, "select count(*) from public.match_chunks('[1,0,0,0]', null, 'm1', 5);")
ok("different embedding size is ignored safely (no crash)", "ERROR" not in r and " 0\n" in r, r)
r = as_user(A, f"insert into public.chunks(user_id,book_id,chunk_id,page,body,model,embedding) values ('{B}','b9','x2',1,'forged','m1','[1,0,0]');")
ok("user A can't insert chunks into B's index", "row-level security" in r, r)
srv.cleanup()
print(f"\n{passed} passed, {failed} failed  (real Postgres + pgvector; Supabase auth/storage internals emulated)")
sys.exit(1 if failed else 0)
