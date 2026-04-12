-- ============================================
-- KEY TRANSFORM - Supabase Database Schema
-- Safe to run multiple times (idempotent)
-- ============================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  age integer,
  height_ft integer,
  height_in integer,
  weight numeric,
  goal_weight numeric,
  waist numeric,
  timeline integer default 6,
  bp_sys integer,
  bp_dia integer,
  blood_sugar text default 'normal',
  sleep_apnea boolean default false,
  cpap boolean default false,
  prostate_symptoms boolean default false,
  fertility_goal boolean default false,
  sperm_analysis text default '',
  medications text default '',
  allergies text default '',
  health_history text default '',
  work_schedule text default '',
  sleep_hours numeric default 7,
  tobacco text default 'none',
  alcohol text default 'none',
  cannabis text default 'none',
  current_diet text default '',
  caffeine text default '',
  diet_style text default 'keto-carnivore',
  fasting_plan text default '48h-weekly',
  foods_love text default '',
  foods_wont_eat text default '',
  cooking_level text default 'medium',
  kitchen_gear text[] default '{}',
  budget numeric default 120,
  stores text[] default '{}',
  location text default '',
  lifting_experience text default 'some',
  injuries text default '',
  equipment text[] default '{}',
  gym_access boolean default false,
  goals text[] default '{}',
  top_goals text[] default '{}',
  goals_own_words text default '',
  specific_concerns text default '',
  additional_info text default '',
  profile_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. WEIGHT LOG
create table if not exists public.weight_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  value numeric not null,
  created_at timestamptz default now()
);

-- 3. WAIST LOG
create table if not exists public.waist_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  value numeric not null,
  created_at timestamptz default now()
);

-- 4. BLOOD PRESSURE LOG
create table if not exists public.bp_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  systolic integer not null,
  diastolic integer not null,
  created_at timestamptz default now()
);

-- 5. FASTING LOG
create table if not exists public.fast_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  hours numeric not null,
  created_at timestamptz default now()
);

-- 6. CURRENT FAST (active fasting state)
create table if not exists public.current_fast (
  user_id uuid references auth.users on delete cascade primary key,
  started_at timestamptz not null
);

-- 7. FOOD LOG
create table if not exists public.food_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  food text not null,
  protein numeric default 0,
  fat numeric default 0,
  carbs numeric default 0,
  calories numeric default 0,
  created_at timestamptz default now()
);

-- 8. WORKOUT LOG
create table if not exists public.workout_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  day_type text not null,
  exercises jsonb default '{}',
  created_at timestamptz default now()
);

-- 9. SUPPLEMENT CHECKS
create table if not exists public.supplement_checks (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  checked_indexes integer[] default '{}',
  unique (user_id, date)
);

-- 10. SEXUAL HEALTH LOG
create table if not exists public.sex_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  morning_wood text default '',
  erection_quality integer default 3,
  libido integer default 3,
  had_sex boolean default false,
  volume text default 'normal',
  stamina text default 'normal',
  notes text default '',
  created_at timestamptz default now()
);

-- 11. CYCLE TRACKING
create table if not exists public.cycle_tracking (
  user_id uuid references auth.users on delete cascade primary key,
  cycle_start date
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.weight_log enable row level security;
alter table public.waist_log enable row level security;
alter table public.bp_log enable row level security;
alter table public.fast_log enable row level security;
alter table public.current_fast enable row level security;
alter table public.food_log enable row level security;
alter table public.workout_log enable row level security;
alter table public.supplement_checks enable row level security;
alter table public.sex_log enable row level security;
alter table public.cycle_tracking enable row level security;

-- Drop existing policies before recreating (safe re-run)
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Policies for log tables
do $$
declare
  tbl text;
begin
  for tbl in select unnest(array[
    'weight_log', 'waist_log', 'bp_log', 'fast_log',
    'current_fast', 'food_log', 'workout_log',
    'supplement_checks', 'sex_log', 'cycle_tracking'
  ])
  loop
    execute format('drop policy if exists "Users can view own %1$s" on public.%1$s', tbl);
    execute format('drop policy if exists "Users can insert own %1$s" on public.%1$s', tbl);
    execute format('drop policy if exists "Users can update own %1$s" on public.%1$s', tbl);
    execute format('drop policy if exists "Users can delete own %1$s" on public.%1$s', tbl);
    execute format('create policy "Users can view own %1$s" on public.%1$s for select using (auth.uid() = user_id)', tbl);
    execute format('create policy "Users can insert own %1$s" on public.%1$s for insert with check (auth.uid() = user_id)', tbl);
    execute format('create policy "Users can update own %1$s" on public.%1$s for update using (auth.uid() = user_id)', tbl);
    execute format('create policy "Users can delete own %1$s" on public.%1$s for delete using (auth.uid() = user_id)', tbl);
  end loop;
end $$;

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

create index if not exists idx_weight_log_user_date on public.weight_log (user_id, date desc);
create index if not exists idx_waist_log_user_date on public.waist_log (user_id, date desc);
create index if not exists idx_bp_log_user_date on public.bp_log (user_id, date desc);
create index if not exists idx_fast_log_user_date on public.fast_log (user_id, created_at desc);
create index if not exists idx_food_log_user_date on public.food_log (user_id, date desc);
create index if not exists idx_workout_log_user_date on public.workout_log (user_id, date desc);
create index if not exists idx_sex_log_user_date on public.sex_log (user_id, date desc);
create index if not exists idx_supplement_checks_user_date on public.supplement_checks (user_id, date desc);
