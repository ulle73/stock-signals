create table if not exists position_facts_daily (
  date date primary key,
  sp500 numeric,
  sp500_200dma numeric,
  sp500_pct_from_200dma numeric,
  vix numeric,
  high_yield_spread numeric,
  yield_curve_spread numeric,
  fed_funds numeric,
  fed_funds_change numeric,
  unemployment_rate numeric,
  unemployment_rate_change numeric,
  cpi_index numeric,
  cpi_yoy numeric,
  cpi_yoy_change numeric,
  consumer_sentiment numeric,
  consumer_sentiment_change numeric,
  sp500_observation_date date,
  vix_observation_date date,
  high_yield_observation_date date,
  yield_curve_observation_date date,
  fed_funds_observation_date date,
  unemployment_observation_date date,
  cpi_observation_date date,
  consumer_sentiment_observation_date date,
  sp500_trend_regime text not null default 'no_data',
  vix_regime text not null default 'no_data',
  credit_regime text not null default 'no_data',
  yield_curve_regime text not null default 'no_data',
  fed_policy_trend text not null default 'no_data',
  labor_trend text not null default 'no_data',
  inflation_trend text not null default 'no_data',
  sentiment_trend text not null default 'no_data',
  yield_curve_inverted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_position_facts_daily_date
  on position_facts_daily (date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_facts_daily_sp500_trend_regime_check'
      and conrelid = 'public.position_facts_daily'::regclass
  ) then
    alter table position_facts_daily
      add constraint position_facts_daily_sp500_trend_regime_check
      check (sp500_trend_regime in ('no_data', 'above_200dma', 'below_200dma'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_facts_daily_vix_regime_check'
      and conrelid = 'public.position_facts_daily'::regclass
  ) then
    alter table position_facts_daily
      add constraint position_facts_daily_vix_regime_check
      check (vix_regime in ('no_data', 'calm', 'elevated', 'stress'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_facts_daily_credit_regime_check'
      and conrelid = 'public.position_facts_daily'::regclass
  ) then
    alter table position_facts_daily
      add constraint position_facts_daily_credit_regime_check
      check (credit_regime in ('no_data', 'calm', 'elevated', 'stress'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_facts_daily_yield_curve_regime_check'
      and conrelid = 'public.position_facts_daily'::regclass
  ) then
    alter table position_facts_daily
      add constraint position_facts_daily_yield_curve_regime_check
      check (yield_curve_regime in ('no_data', 'normal', 'flat', 'inverted'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_facts_daily_fed_policy_trend_check'
      and conrelid = 'public.position_facts_daily'::regclass
  ) then
    alter table position_facts_daily
      add constraint position_facts_daily_fed_policy_trend_check
      check (fed_policy_trend in ('no_data', 'tightening', 'stable', 'easing'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_facts_daily_labor_trend_check'
      and conrelid = 'public.position_facts_daily'::regclass
  ) then
    alter table position_facts_daily
      add constraint position_facts_daily_labor_trend_check
      check (labor_trend in ('no_data', 'improving', 'stable', 'deteriorating'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_facts_daily_inflation_trend_check'
      and conrelid = 'public.position_facts_daily'::regclass
  ) then
    alter table position_facts_daily
      add constraint position_facts_daily_inflation_trend_check
      check (inflation_trend in ('no_data', 'cooling', 'stable', 'heating_up'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_facts_daily_sentiment_trend_check'
      and conrelid = 'public.position_facts_daily'::regclass
  ) then
    alter table position_facts_daily
      add constraint position_facts_daily_sentiment_trend_check
      check (sentiment_trend in ('no_data', 'improving', 'stable', 'deteriorating'));
  end if;
end
$$;
