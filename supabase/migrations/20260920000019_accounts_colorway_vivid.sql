-- The card palette stops being pastel, and the colour names change with it.
--
-- The first set was seven hues handed to a fill whose lightness and chroma the
-- theme fixed, so the names described positions on a wheel (slate, ocean, lime).
-- The fills are now saturated and hand-picked, and each carries the ink that
-- survives on it, so the names are simply the colours: red, orange, amber,
-- green, teal, blue, violet, pink.
--
-- Existing values are carried across to their nearest new colour rather than
-- cleared. The set is small and barely used, but a colour someone chose is a
-- choice, and dropping it to null would silently repaint their card.
-- The old constraint comes off first. It still names the old colours, so a row
-- rewritten to a new one is refused while it stands — the rename cannot happen
-- underneath it.
alter table public.accounts drop constraint accounts_colorway_check;

update public.accounts set colorway = case colorway
  when 'slate' then 'blue'
  when 'ocean' then 'blue'
  when 'rose' then 'pink'
  when 'lime' then 'green'
  else colorway            -- amber, teal and violet keep their names
end
where colorway is not null;

alter table public.accounts add constraint accounts_colorway_check
  check (colorway in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'));
