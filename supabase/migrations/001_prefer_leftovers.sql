-- Migration: add the household-level "prefer leftovers" preference.
-- Safe to run on an existing FamilyTable database.

alter table households
  add column if not exists prefer_leftovers boolean not null default false;
