-- What a goal and an asset are marked with, so a list of them reads at a
-- glance: one emoji and one colour, drawn as a disc beside the name — the
-- profile disc's language (20260923000023_profiles_avatar.sql), used for things.
--
-- Both are optional and start null, which is the look every row had before the
-- choice existed — the first letter of the name on the surface colour — so no
-- existing row needs anything written to it.
--
-- The emoji is checked for length only, as the avatar's is: "exactly one
-- emoji" is a grapheme rule the database cannot express, and the API holds it
-- (`isMarkEmoji` in packages/domain). Sixteen code points is the same bound.
--
-- The colour names are the card palette's (`MARK_COLORS` = `ACCOUNT_COLORWAYS`),
-- mirrored the way `accounts_colorway_check` and `profiles.avatar_color` mirror
-- them: append-only, widened in one statement when a colour is added.

alter table public.goals
  add column color text
    check (color in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'));

-- `goals.icon` existed before this rule, and the API used to accept up to 80
-- characters of anything. No screen ever wrote it, but a row written straight
-- through the API could hold a longer string, and a validating constraint
-- would refuse the whole migration over it. `not valid` holds every new write
-- to the bound and leaves an old value readable; the client draws the initial
-- in place of anything that is not one emoji.
alter table public.goals
  add constraint goals_icon_check check (char_length(icon) between 1 and 16) not valid;

alter table public.assets
  add column icon text
    check (char_length(icon) between 1 and 16),
  add column color text
    check (color in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'));
