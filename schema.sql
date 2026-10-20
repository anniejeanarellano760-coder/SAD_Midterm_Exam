-- =====================================================================
-- Student Scholarship Monitoring and Academic Compliance System
-- Paste this whole file into Supabase > SQL Editor > New query > Run
-- Synthetic data only. No keys or passwords in this file.
-- =====================================================================

-- ---------- 1. TABLES ------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  student_id  text unique,
  full_name   text not null,
  role        text not null default 'scholar' check (role in ('scholar','staff'))
);

create table public.programs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  max_gwa         numeric(3,2) not null check (max_gwa between 1.00 and 5.00),
  min_units       integer not null check (min_units >= 0),
  max_failed      integer not null check (max_failed >= 0),
  max_incomplete  integer not null check (max_incomplete >= 0),
  max_dropped     integer not null check (max_dropped >= 0),
  deadline        timestamptz not null
);

create table public.scholar_assignments (
  id            uuid primary key default gen_random_uuid(),
  scholar_id    uuid not null unique references public.profiles(id) on delete cascade,
  program_id    uuid not null references public.programs(id),
  award_status  text not null default 'Active' check (award_status in ('Active','Inactive'))
);

create table public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  scholar_id          uuid not null references public.profiles(id) on delete cascade,
  academic_year       text not null,
  semester            smallint not null check (semester in (1,2)),
  gwa                 numeric(3,2) not null check (gwa between 1.00 and 5.00),
  enrolled_units      integer not null check (enrolled_units >= 0),
  failed_count        integer not null check (failed_count >= 0),
  incomplete_count    integer not null check (incomplete_count >= 0),
  dropped_count       integer not null check (dropped_count >= 0),
  evidence_ref        text not null check (length(trim(evidence_ref)) > 0),
  submitted_at        timestamptz not null default now(),
  verification_status text not null default 'Pending'
                      check (verification_status in ('Pending','Verified','Returned')),
  verification_reason text,
  compliance_result   text check (compliance_result in ('Compliant','With Deficiency')),
  deficiency_reasons  text[],
  renewal_decision    text check (renewal_decision in ('Approved','Held')),
  decision_note       text,
  constraint uq_scholar_year_semester unique (scholar_id, academic_year, semester),
  constraint chk_returned_has_reason
    check (verification_status <> 'Returned' or length(trim(coalesce(verification_reason,''))) > 0),
  constraint chk_compliance_requires_verified
    check (compliance_result is null or verification_status = 'Verified'),
  constraint chk_renewal_requires_evaluation
    check (renewal_decision is null or compliance_result is not null),
  constraint chk_approval_requires_compliant
    check (renewal_decision is distinct from 'Approved' or compliance_result = 'Compliant')
);

create table public.decision_history (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions(id) on delete cascade,
  action_type    text not null check (action_type in ('verification','evaluation','renewal')),
  old_value      text,
  new_value      text,
  notes          text,
  actor_id       uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

-- ---------- 2. POLICY RECORDS (thresholds live in the database) ------

insert into public.programs
  (name, max_gwa, min_units, max_failed, max_incomplete, max_dropped, deadline)
values
  ('Merit Scholar',     1.75, 18, 0, 0, 0, timestamptz '2026-10-30 17:00:00+08'),
  ('Community Scholar', 2.25, 15, 0, 0, 1, timestamptz '2026-10-30 17:00:00+08');

-- ---------- 3. HELPERS AND TRIGGERS ----------------------------------

-- Is the current user staff?
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff');
$$;

-- Create a profile automatically for every new auth user (role = scholar)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'scholar');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Server-side timestamp for scholar inserts
create or replace function public.set_submission_defaults()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_submission_defaults
  before insert on public.submissions
  for each row execute function public.set_submission_defaults();

-- Guard updates: scholars may only correct their own Returned submission,
-- which always goes back to Pending verification.
create or replace function public.guard_submission_update()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;                       -- SQL editor / seed scripts
  end if;

  if public.is_staff() then
    new.scholar_id    := old.scholar_id;
    new.academic_year := old.academic_year;
    new.semester      := old.semester;
    new.submitted_at  := old.submitted_at;
    return new;
  end if;

  if old.scholar_id <> auth.uid() or old.verification_status <> 'Returned' then
    raise exception 'Scholars may only correct their own Returned submissions';
  end if;

  new.scholar_id          := old.scholar_id;
  new.academic_year       := old.academic_year;
  new.semester            := old.semester;
  new.verification_status := 'Pending';
  new.verification_reason := null;
  new.compliance_result   := null;
  new.deficiency_reasons  := null;
  new.renewal_decision    := null;
  new.decision_note       := null;
  new.submitted_at        := now();
  return new;
end;
$$;

create trigger trg_guard_submission_update
  before update on public.submissions
  for each row execute function public.guard_submission_update();

-- Automatic history log: verification, evaluation, renewal (actor + timestamp)
create or replace function public.log_submission_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status is distinct from old.verification_status then
    insert into public.decision_history (submission_id, action_type, old_value, new_value, notes, actor_id)
    values (new.id, 'verification', old.verification_status, new.verification_status,
            case when old.verification_status = 'Returned' and new.verification_status = 'Pending'
                 then 'Corrected and resubmitted by scholar'
                 else new.verification_reason end,
            auth.uid());
  end if;

  if new.compliance_result is distinct from old.compliance_result
     or new.deficiency_reasons is distinct from old.deficiency_reasons then
    if new.compliance_result is not null then
      insert into public.decision_history (submission_id, action_type, old_value, new_value, notes, actor_id)
      values (new.id, 'evaluation', old.compliance_result, new.compliance_result,
              array_to_string(new.deficiency_reasons, '; '), auth.uid());
    end if;
  end if;

  if new.renewal_decision is distinct from old.renewal_decision
     or new.decision_note is distinct from old.decision_note then
    if new.renewal_decision is not null then
      insert into public.decision_history (submission_id, action_type, old_value, new_value, notes, actor_id)
      values (new.id, 'renewal', old.renewal_decision, new.renewal_decision, new.decision_note, auth.uid());
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_log_submission_changes
  after update on public.submissions
  for each row execute function public.log_submission_changes();

-- ---------- 4. ROW LEVEL SECURITY ------------------------------------

alter table public.profiles            enable row level security;
alter table public.programs            enable row level security;
alter table public.scholar_assignments enable row level security;
alter table public.submissions         enable row level security;
alter table public.decision_history    enable row level security;

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_staff_update on public.profiles
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- programs (policy records): everyone signed in can read, staff can change
create policy programs_select on public.programs
  for select to authenticated using (true);
create policy programs_staff_write on public.programs
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- scholar_assignments
create policy assignments_select on public.scholar_assignments
  for select to authenticated
  using (scholar_id = auth.uid() or public.is_staff());
create policy assignments_staff_write on public.scholar_assignments
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- submissions
create policy submissions_select on public.submissions
  for select to authenticated
  using (scholar_id = auth.uid() or public.is_staff());

create policy submissions_scholar_insert on public.submissions
  for insert to authenticated
  with check (
    scholar_id = auth.uid()
    and verification_status = 'Pending'
    and compliance_result is null
    and renewal_decision is null
    and exists (select 1 from public.scholar_assignments a where a.scholar_id = auth.uid())
  );

create policy submissions_scholar_correct on public.submissions
  for update to authenticated
  using (scholar_id = auth.uid() and verification_status = 'Returned')
  with check (scholar_id = auth.uid());

create policy submissions_staff_update on public.submissions
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- decision_history: read only (rows are written by the trigger)
create policy history_select on public.decision_history
  for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.submissions s
               where s.id = submission_id and s.scholar_id = auth.uid())
  );

-- ---------- 5. AFTER YOU CREATE THE 2 TEST ACCOUNTS ------------------
-- Create them in Authentication > Users (synthetic emails), then run:
--
-- update public.profiles set role = 'staff', full_name = 'Test Staff'
--   where id = '<STAFF-USER-UUID>';
-- update public.profiles set student_id = 'S-001', full_name = 'Test Scholar'
--   where id = '<SCHOLAR-USER-UUID>';
