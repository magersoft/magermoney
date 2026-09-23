-- What the profile disc shows, and in what colour. No photo is stored: an
-- emoji and a colour say who is signed in without a file store behind them.
--
-- Both are optional and both start null, which is the disc every profile had
-- before the choice existed — the initial of the name on the surface colour —
-- so existing rows need nothing written to them.
--
-- The emoji is checked for length only. "Exactly one emoji" is a grapheme rule
-- the database cannot express; the API holds it (`isAvatarEmoji` in
-- packages/domain), and the bound here is what keeps a longer string out of
-- the column if something ever writes around the API. Sixteen code points is
-- `AVATAR_EMOJI_MAX_CODEPOINTS`.
--
-- The colour names are the card palette's (`ACCOUNT_COLORWAYS`), mirrored the
-- same way `accounts_colorway_check` mirrors them: append-only, widened here
-- in one statement when a colour is added.
alter table public.profiles
  add column avatar_emoji text
    check (char_length(avatar_emoji) between 1 and 16),
  add column avatar_color text
    check (avatar_color in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'));
