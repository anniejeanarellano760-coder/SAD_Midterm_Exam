-- =====================================================================
-- SEED: six synthetic scholars A01-A06, AY 2026-2027, Semester 1
-- Run AFTER schema.sql and AFTER you created the 2 test accounts and ran:
--   update public.profiles set role = 'staff', full_name = 'Test Staff' where id = '<STAFF-UUID>';
--   update public.profiles set student_id = 'A06', full_name = 'Synthetic Scholar A06' where id = '<SCHOLAR-UUID>';
-- A06 is your real test-scholar login (Pending verification, used for TC07, TC08, TC09).
-- A01-A05 are seeded without passwords; staff view them. Synthetic data only.
-- Run once. Seeded summaries are test inputs, not official grades.
-- =====================================================================

do $$
declare
  r     record;
  uid   uuid;
  prog  uuid;
begin
  for r in
    select * from (values
      -- sid,  program,             gwa,  units, failed, inc, drop, submitted_at (Asia/Manila),   verification
      ('A01', 'Merit Scholar',     1.75, 18,    0,      0,   0,    '2026-10-30 17:00:00+08',        'Verified'),
      ('A02', 'Merit Scholar',     1.76, 18,    0,      0,   0,    '2026-10-29 17:00:00+08',        'Verified'),
      ('A03', 'Community Scholar', 2.25, 15,    0,      0,   1,    '2026-10-29 17:00:00+08',        'Verified'),
      ('A04', 'Community Scholar', 2.25, 14,    0,      1,   0,    '2026-10-29 17:00:00+08',        'Verified'),
      ('A05', 'Merit Scholar',     1.50, 18,    1,      0,   0,    '2026-10-30 17:01:00+08',        'Verified'),
      ('A06', 'Community Scholar', 2.00, 15,    0,      0,   0,    '2026-10-29 17:00:00+08',        'Pending')
    ) as t(sid, program, gwa, units, failed, inc, drp, submitted, vstatus)
  loop
    if r.sid = 'A06' then
      select id into uid from public.profiles where student_id = 'A06';
      if uid is null then
        raise exception 'Test scholar not found. Create the scholar account and set student_id = A06 first.';
      end if;
    else
      uid := ('a0000000-0000-0000-0000-0000000000' || substr(r.sid, 2, 2))::uuid;

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        lower(r.sid) || '@scholarship-exam.test', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Synthetic Scholar ' || r.sid),
        now(), now(), '', '', '', ''
      ) on conflict (id) do nothing;

      update public.profiles
         set student_id = r.sid, full_name = 'Synthetic Scholar ' || r.sid
       where id = uid;
    end if;

    select id into prog from public.programs where name = r.program;

    insert into public.scholar_assignments (scholar_id, program_id)
    values (uid, prog)
    on conflict (scholar_id) do nothing;

    insert into public.submissions (
      scholar_id, academic_year, semester, gwa, enrolled_units,
      failed_count, incomplete_count, dropped_count,
      evidence_ref, submitted_at, verification_status
    ) values (
      uid, '2026-2027', 1, r.gwa, r.units,
      r.failed, r.inc, r.drp,
      'SYN-GRADES-' || r.sid || '.pdf', r.submitted::timestamptz, r.vstatus
    );
  end loop;
end $$;

-- ---------- CHECK: expected results to compare with your app ----------
-- A01 Compliant          (GWA 1.75 and deadline exactly at limit)
-- A02 With Deficiency    (GWA 1.76 above 1.75)
-- A03 Compliant          (1 dropped allowed for Community)
-- A04 With Deficiency    (units 14 below 15; 1 incomplete)
-- A05 With Deficiency    (1 failed subject; submitted 1 minute late)
-- A06 Not evaluable      (Pending verification; blocks evaluation and approval)

select p.student_id, g.name as program, s.gwa, s.enrolled_units, s.failed_count,
       s.incomplete_count, s.dropped_count, s.submitted_at, s.verification_status
from public.submissions s
join public.profiles p on p.id = s.scholar_id
join public.scholar_assignments a on a.scholar_id = s.scholar_id
join public.programs g on g.id = a.program_id
order by p.student_id;
