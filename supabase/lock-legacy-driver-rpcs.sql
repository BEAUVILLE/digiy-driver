-- DIGIY DRIVER
-- Ferme l'exécution des RPC legacy non utilisés par le parcours DRIVER CLIENT / DRIVER MASTER actif.

revoke execute on function public.digiy_driver_approve_application(uuid) from public, anon, authenticated;
revoke execute on function public.digiy_driver_pending_rides() from public, anon, authenticated;
revoke execute on function public.digiy_driver_take_ride(uuid) from public, anon, authenticated;
revoke execute on function public.digiy_driver_accept_ride(uuid,text) from public, anon, authenticated;
revoke execute on function public.digiy_driver_start_ride(uuid,text) from public, anon, authenticated;
revoke execute on function public.digiy_driver_complete_ride(uuid,text) from public, anon, authenticated;
revoke execute on function public.digiy_driver_get_assigned_ride(uuid,text) from public, anon, authenticated;
revoke execute on function public.digiy_driver_submit_payment_proof(integer,text,text,text,text) from public, anon, authenticated;
