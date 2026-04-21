-- Supabase server-side integration notes
-- --------------------------------------
-- 1. The application uses SUPABASE_SERVICE_ROLE_KEY on the server.
--    Service role bypasses RLS, so no mandatory RLS changes are required
--    for current webhook / API writes.
-- 2. If you later need browser-side direct reads, enable RLS and add
--    explicit SELECT policies based on Supabase Auth claims.

BEGIN;

ALTER TABLE public.chat_groups
  ADD COLUMN IF NOT EXISTS picture_url TEXT;

CREATE OR REPLACE FUNCTION public.create_event_with_attendees(
  p_line_group_id TEXT,
  p_created_by_line_user_id TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_starts_at TIMESTAMPTZ DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_timezone TEXT DEFAULT 'Asia/Taipei',
  p_attendee_user_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[]
)
RETURNS TABLE (
  event_id BIGINT,
  line_group_id TEXT,
  title TEXT,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  timezone TEXT,
  attendee_display_names TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_id BIGINT;
  v_creator_user_id BIGINT;
  v_event_id BIGINT;
  v_attendee_count INTEGER;
  v_attendee_display_names TEXT[];
BEGIN
  IF p_line_group_id IS NULL OR btrim(p_line_group_id) = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 缺少 groupId。';
  END IF;

  IF p_created_by_line_user_id IS NULL OR btrim(p_created_by_line_user_id) = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 缺少 createdByLineUserId。';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 會議主題不可為空。';
  END IF;

  IF p_starts_at IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 缺少 startsAt。';
  END IF;

  IF p_ends_at IS NOT NULL AND p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'INVALID_INPUT: 結束時間必須晚於開始時間。';
  END IF;

  IF COALESCE(array_length(p_attendee_user_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 請至少選擇一位參與者。';
  END IF;

  SELECT cg.id
  INTO v_group_id
  FROM public.chat_groups cg
  WHERE cg.line_group_id = p_line_group_id
  LIMIT 1;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND: 群組資料不存在。';
  END IF;

  SELECT lu.id
  INTO v_creator_user_id
  FROM public.line_users lu
  WHERE lu.line_user_id = p_created_by_line_user_id
  LIMIT 1;

  IF v_creator_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: 建立者尚未同步到資料庫。';
  END IF;

  PERFORM 1
  FROM public.group_memberships gm
  WHERE gm.group_id = v_group_id
    AND gm.user_id = v_creator_user_id
    AND gm.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: 建立者不在群組名單內。';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(lu.display_name ORDER BY lu.display_name, lu.id)
  INTO
    v_attendee_count,
    v_attendee_display_names
  FROM public.group_memberships gm
  INNER JOIN public.line_users lu ON lu.id = gm.user_id
  WHERE gm.group_id = v_group_id
    AND gm.is_active = TRUE
    AND gm.user_id = ANY (p_attendee_user_ids);

  IF v_attendee_count <> COALESCE(array_length(p_attendee_user_ids, 1), 0) THEN
    RAISE EXCEPTION 'INVALID_ATTENDEES: 部分參與者不在群組有效名單內。';
  END IF;

  INSERT INTO public.events (
    group_id,
    created_by_user_id,
    title,
    description,
    location,
    starts_at,
    ends_at,
    timezone
  )
  VALUES (
    v_group_id,
    v_creator_user_id,
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    NULLIF(btrim(COALESCE(p_location, '')), ''),
    p_starts_at,
    p_ends_at,
    COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), 'Asia/Taipei')
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.event_attendees (event_id, user_id)
  SELECT v_event_id, attendee_user_id
  FROM UNNEST(p_attendee_user_ids) AS attendee_user_id;

  RETURN QUERY
  SELECT
    v_event_id,
    p_line_group_id,
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    NULLIF(btrim(COALESCE(p_location, '')), ''),
    p_starts_at,
    p_ends_at,
    COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), 'Asia/Taipei'),
    COALESCE(v_attendee_display_names, ARRAY[]::TEXT[]);
END;
$$;

-- Optional future templates for browser-side direct reads:
-- ALTER TABLE public.line_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
--
-- Example policy template (do NOT enable until you map LINE identity to Supabase Auth):
-- CREATE POLICY "authenticated users can read own profile"
--   ON public.line_users
--   FOR SELECT
--   TO authenticated
--   USING (false);

COMMIT;
