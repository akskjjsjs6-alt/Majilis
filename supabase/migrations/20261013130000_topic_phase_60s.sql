-- Topic phase goes from 30 seconds to 1 minute (matches TOPIC_MS in app.js and rivalTurn in secure-actions).
-- Only the timing lines change; everything else is the live definition as of 2026-10-13.
CREATE OR REPLACE FUNCTION public.check_debate_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.debates%rowtype;
begin
  if auth.uid() is null then return new; end if;
  if char_length(coalesce(new.text, '')) not between 1 and 4000 then
    raise exception 'Messages must be between 1 and 4000 characters.';
  end if;
  select * into d from public.debates where id = new.debate_id;
  if not found or d.status <> 'active' or auth.uid() not in (d.participant1_id, d.participant2_id) then
    raise exception 'You are not in this debate, or it has already ended.';
  end if;
  if coalesce((d.end_request ->> 'accepted')::boolean, false) then
    raise exception 'The AI judge is already reviewing this debate.';
  end if;
  if not d.topic_locked and now() < d.created_at + interval '60 seconds' then
    raise exception 'Pick a topic first — the chat opens when the topic is set.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.srv_finalize_topic(p_debate_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.debates%rowtype;
  v1 text; v2 text; pick text;
begin
  select * into d from public.debates where id::text = p_debate_id for update;
  if not found then raise exception 'That debate no longer exists.'; end if;
  if d.topic_locked or d.status <> 'active' then
    return jsonb_build_object('topic', d.topic, 'votes', d.topic_votes, 'locked', true);
  end if;
  if now() < d.created_at + interval '58 seconds' then
    return jsonb_build_object('topic', d.topic, 'votes', d.topic_votes, 'locked', false);
  end if;
  v1 := d.topic_votes ->> d.participant1_id::text;
  v2 := d.topic_votes ->> d.participant2_id::text;
  pick := case
    when v1 is not null and v2 is not null then (case when random() < 0.5 then v1 else v2 end)
    else coalesce(v1, v2, nullif(btrim(coalesce(d.topic, '')), ''))
  end;
  update public.debates set topic = pick, topic_locked = true where id = d.id;
  return jsonb_build_object('topic', pick, 'votes', d.topic_votes, 'locked', true);
end $function$;
