/* ============================================================ */
/* Adronis - an email to us for every beta application, contact */
/* request and message (including beta testers' feedback).      */
/*                                                               */
/* Run once in: Supabase Dashboard -> SQL Editor, after          */
/* schema.sql. Safe to re-run.                                   */
/*                                                               */
/* How it works: a trigger on each form table queues one POST to */
/* Resend's API through pg_net. pg_net sends it after the insert */
/* commits, so a slow or failing Resend never holds up or breaks */
/* the visitor's form - the worst case is a missing email, and   */
/* the row is still in the portal's inbox.                       */
/*                                                               */
/* The Resend API key and the address to notify live in Supabase */
/* Vault, never in this file or in the browser. Before the       */
/* domain is verified in Resend, Resend only delivers to the     */
/* email the Resend account was opened with, so notify_to must   */
/* be that address and the sender stays onboarding@resend.dev.   */
/* Once adronis.app is verified there, change NOTIFY_FROM below  */
/* to an address on it and re-run this file.                     */
/* ============================================================ */

create extension if not exists pg_net with schema extensions;

/* ------------------------------------------------------------ */
/* One-time setup, run by hand with the real values - NOT saved  */
/* in this file:                                                 */
/*                                                               */
/*   select vault.create_secret('re_...', 'resend_api_key');     */
/*   select vault.create_secret('you@example.com', 'notify_to'); */
/*                                                               */
/* To change one later:                                          */
/*   select vault.update_secret(                                 */
/*     (select id from vault.secrets where name = 'notify_to'),  */
/*     'new@example.com');                                       */
/* ------------------------------------------------------------ */

create or replace function public.notify_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  NOTIFY_FROM constant text := 'Adronis <onboarding@resend.dev>';
  api_key   text;
  notify_to text;
  subject   text;
  body      text;
begin
  select decrypted_secret into api_key   from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into notify_to from vault.decrypted_secrets where name = 'notify_to';
  if api_key is null or notify_to is null then
    return new;   -- not set up yet: the row is saved, nobody is emailed
  end if;

  -- The forms are public, so a bot could post hundreds of rows. Past 30 in
  -- an hour the emails stop (Resend's free plan allows 100 a day); the rows
  -- are still saved and still show in the portal.
  if (select count(*) from public.contact_requests where created_at > now() - interval '1 hour')
   + (select count(*) from public.messages         where created_at > now() - interval '1 hour') > 30 then
    return new;
  end if;

  if tg_table_name = 'contact_requests' then
    subject := case when new.plan_interest = 'beta'
                    then 'Nova prijava za betu: '
                    else 'Novi upit sa kontakt forme: ' end
               || coalesce(nullif(new.business_name, ''), new.email);
    body := concat_ws(E'\n',
      'Biznis: '  || coalesce(nullif(new.business_name, ''), '—'),
      'Ime: '     || coalesce(nullif(new.full_name, ''), '—'),
      'Email: '   || new.email,
      case when coalesce(new.plan_interest, '') not in ('', 'beta') then 'Plan: ' || new.plan_interest end,
      '',
      coalesce(new.message, ''),
      '',
      'Odgovori direktno na ovaj mejl, ili otvori Inbox u portalu.');
  else
    subject := case when new.message like 'Beta feedback%'
                    then 'Utisak beta testera: '
                    else 'Nova poruka: ' end
               || coalesce(nullif(new.full_name, ''), new.email);
    body := concat_ws(E'\n',
      'Od: '    || coalesce(nullif(new.full_name, ''), '—'),
      'Email: ' || new.email,
      '',
      new.message,
      '',
      'Odgovori direktno na ovaj mejl, ili otvori Inbox u portalu.');
  end if;

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type',  'application/json'),
    body    := jsonb_build_object(
      'from',     NOTIFY_FROM,
      'to',       jsonb_build_array(notify_to),
      'reply_to', new.email,
      'subject',  left(subject, 200),
      'text',     body)
  );
  return new;
exception when others then
  -- Never let the email lose the visitor's form.
  raise warning 'notify_new_lead: %', sqlerrm;
  return new;
end;
$$;

/* Only the triggers call it. */
revoke execute on function public.notify_new_lead() from public, anon, authenticated;

drop trigger if exists contact_requests_notify on public.contact_requests;
create trigger contact_requests_notify
  after insert on public.contact_requests
  for each row execute function public.notify_new_lead();

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_new_lead();

/* To check what was sent, and what Resend answered:
     select id, status_code, content, created
       from net._http_response order by created desc limit 10; */
