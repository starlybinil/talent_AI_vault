-- Practice Lab now has four assessments: typing, cognitive ability (which absorbs the attention-to-detail
-- drill), hand tools and situational judgement. 'attention' stays valid for earlier attempts.
alter table public.practice_attempts drop constraint if exists practice_attempts_activity_check;
alter table public.practice_attempts add constraint practice_attempts_activity_check
  check (activity in ('typing', 'attention', 'cognitive', 'tools', 'judgement'));
