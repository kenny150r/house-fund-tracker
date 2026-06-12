alter table public.assumptions
  add column if not exists zoox_fmv_forecast jsonb,
  add column if not exists zoox_forecast_band text not null default 'mid';
comment on column public.assumptions.zoox_fmv_forecast is 'Optional Zoox ZAR price forecast: array of {year:int years-from-now, low:number, high:number} FMV per share. When present, overrides flat growth_zoox_pct.';
