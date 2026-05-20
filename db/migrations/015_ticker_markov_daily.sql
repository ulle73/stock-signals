create table if not exists ticker_markov_daily (
  ticker text not null,
  date date not null,
  markov_state text,
  twenty_day_return numeric,
  bull_probability numeric,
  sideways_probability numeric,
  bear_probability numeric,
  markov_total numeric,
  markov_stickiness numeric,
  sample_size integer not null default 0,
  signal text not null default 'neutral',
  rank_bull integer,
  rank_sell integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ticker, date)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ticker_markov_daily_state_check'
      and conrelid = 'public.ticker_markov_daily'::regclass
  ) then
    alter table ticker_markov_daily
      add constraint ticker_markov_daily_state_check
      check (markov_state in ('bull', 'sideways', 'bear'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ticker_markov_daily_signal_check'
      and conrelid = 'public.ticker_markov_daily'::regclass
  ) then
    alter table ticker_markov_daily
      add constraint ticker_markov_daily_signal_check
      check (signal in ('bull', 'sell', 'neutral'));
  end if;
end
$$;

create index if not exists idx_ticker_markov_daily_date_bull_rank
  on ticker_markov_daily (date desc, rank_bull asc);

create index if not exists idx_ticker_markov_daily_date_sell_rank
  on ticker_markov_daily (date desc, rank_sell asc);

create index if not exists idx_ticker_markov_daily_signal_date
  on ticker_markov_daily (signal, date desc);
