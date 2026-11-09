-- Cámara de comercio: antes era texto libre y "Requisitos" lo marcaba con /vigente/i,
-- que matchea tambien "No vigente". Pasa a ser un estado fijo.

update public.sponsors set legal_cc_status = 'Por validar'
  where legal_cc_status not in ('', 'Vigente', 'Vencida', 'Por validar');

alter table public.sponsors drop constraint if exists sponsors_legal_cc_status_ok;
alter table public.sponsors add constraint sponsors_legal_cc_status_ok
  check (legal_cc_status in ('', 'Vigente', 'Vencida', 'Por validar'));
