alter table swing_watchlist_daily
  add column if not exists playbook text,
  add column if not exists is_actionable boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'swing_watchlist_daily_playbook_check'
      and conrelid = 'public.swing_watchlist_daily'::regclass
  ) then
    alter table swing_watchlist_daily
      add constraint swing_watchlist_daily_playbook_check
      check (
        playbook is null or playbook in (
          'deploy_long',
          'manage_existing_longs',
          'build_long_watchlist',
          'defensive_watch',
          'cash_only',
          'standby_long',
          'hedge_watch',
          'build_short_watchlist',
          'crisis_watch',
          'standby_short'
        )
      );
  end if;
end
$$;
