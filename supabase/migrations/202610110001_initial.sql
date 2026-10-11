-- Every personal row is owned; composite references prevent cross-account links.
create function public.valid_nutrition(n jsonb) returns boolean language sql immutable as $$
 select jsonb_typeof(n)='object' and n ?& array['calories','protein','carbs','fat','fibre'] and not exists (
 select 1 from unnest(array['calories','protein','carbs','fat','fibre']) k where n->k <> 'null'::jsonb and (jsonb_typeof(n->k)<>'number' or (n->>k)::numeric < 0 or (n->>k)::numeric > 10000000));
$$;
create table public.profiles(id uuid primary key, user_id uuid not null references auth.users on delete cascade, theme text not null default 'system' check(theme in ('light','dark','system')), last_meal text not null default 'Breakfast' check(last_meal in ('Breakfast','Lunch','Dinner','Snacks')), last_portions jsonb not null default '{}', updated_at timestamptz not null default now(), unique(user_id), unique(id,user_id));
create table public.nutrition_targets(id uuid primary key, user_id uuid not null references auth.users on delete cascade, effective_date date not null, nutrition jsonb not null check(public.valid_nutrition(nutrition)), updated_at timestamptz not null default now(), unique(user_id,effective_date), unique(id,user_id));
create table public.recipes(id uuid primary key, user_id uuid not null references auth.users on delete cascade, name text not null check(length(trim(name)) between 1 and 200), servings numeric not null check(servings>0 and servings<=10000000), cooked_weight numeric check(cooked_weight>0 and cooked_weight<=10000000), notes text not null default '', updated_at timestamptz not null default now(), unique(id,user_id));
create table public.foods(id uuid primary key,user_id uuid not null references auth.users on delete cascade,name text not null check(length(trim(name)) between 1 and 200),brand text not null default '',barcode text check(barcode ~ '^([0-9]{8}|[0-9]{13}|[0-9]{14})$'),basis text not null check(basis in ('g','ml','serving')),basis_amount numeric not null check(basis_amount>0 and basis_amount<=10000000),serving_size numeric check(serving_size>0 and serving_size<=10000000),serving_unit text check(serving_unit in ('g','ml')),nutrition jsonb not null check(public.valid_nutrition(nutrition)),notes text not null default '',source text not null check(source in ('manual','openfoodfacts','recipe')),source_id text,source_url text,source_data jsonb,recipe_id uuid,state text not null default 'packaged' check(state in ('raw','cooked','packaged')),updated_at timestamptz not null default now(),unique(id,user_id),unique(user_id,barcode),foreign key(recipe_id,user_id) references public.recipes(id,user_id) on delete restrict);
create table public.food_portions(id uuid primary key,user_id uuid not null references auth.users on delete cascade,food_id uuid not null,name text not null check(length(trim(name)) between 1 and 100),quantity numeric not null check(quantity>0 and quantity<=10000000),unit text not null check(unit in ('g','ml','serving')),updated_at timestamptz not null default now(),unique(id,user_id),foreign key(food_id,user_id) references public.foods(id,user_id) on delete cascade);
create table public.recipe_ingredients(id uuid primary key,user_id uuid not null references auth.users on delete cascade,recipe_id uuid not null,food_id uuid not null,quantity numeric not null check(quantity>0 and quantity<=10000000),unit text not null,name text not null,nutrition jsonb not null check(public.valid_nutrition(nutrition)),updated_at timestamptz not null default now(),unique(id,user_id),foreign key(recipe_id,user_id) references public.recipes(id,user_id) on delete cascade,foreign key(food_id,user_id) references public.foods(id,user_id) on delete restrict);
-- Diary food_id is an informational stable ID, not a destructive foreign key.
create table public.diary_entries(id uuid primary key,user_id uuid not null references auth.users on delete cascade,date date not null,meal text not null check(meal in ('Breakfast','Lunch','Dinner','Snacks')),food_id uuid,name text not null check(length(trim(name)) between 1 and 200),quantity numeric not null check(quantity>0 and quantity<=10000000),unit text not null,nutrition jsonb not null check(public.valid_nutrition(nutrition)),portion_snapshot jsonb not null,updated_at timestamptz not null default now(),unique(id,user_id));
create table public.diary_days(id uuid primary key,user_id uuid not null references auth.users on delete cascade,date date not null,zero_intake boolean not null default false,updated_at timestamptz not null default now(),unique(user_id,date),unique(id,user_id));
create table public.favourites(id uuid primary key,user_id uuid not null references auth.users on delete cascade,food_id uuid not null,updated_at timestamptz not null default now(),unique(user_id,food_id),unique(id,user_id),foreign key(food_id,user_id) references public.foods(id,user_id) on delete cascade);
create table public.saved_meals(id uuid primary key,user_id uuid not null references auth.users on delete cascade,name text not null check(length(trim(name)) between 1 and 200),updated_at timestamptz not null default now(),unique(id,user_id));
create table public.saved_meal_items(id uuid primary key,user_id uuid not null references auth.users on delete cascade,saved_meal_id uuid not null,name text not null,quantity numeric not null check(quantity>0 and quantity<=10000000),unit text not null,nutrition jsonb not null check(public.valid_nutrition(nutrition)),portion_snapshot jsonb not null,food_id uuid,updated_at timestamptz not null default now(),unique(id,user_id),foreign key(saved_meal_id,user_id) references public.saved_meals(id,user_id) on delete cascade);
create table public.applied_operations(id uuid not null,user_id uuid not null references auth.users on delete cascade,created_at timestamptz not null default now(),primary key(user_id,id));
create table public.lookup_requests(user_id uuid not null references auth.users on delete cascade,requested_at timestamptz not null default now());
create index diary_user_date on public.diary_entries(user_id,date);
create index foods_user_name on public.foods(user_id,lower(name));
create index ingredient_recipe on public.recipe_ingredients(user_id,recipe_id);
create index portion_food on public.food_portions(user_id,food_id);
create index saved_item_meal on public.saved_meal_items(user_id,saved_meal_id);
create index lookup_time on public.lookup_requests(requested_at);
create index targets_user_date on public.nutrition_targets(user_id,effective_date desc);
do $$ declare t text; begin foreach t in array array['profiles','nutrition_targets','foods','food_portions','recipes','recipe_ingredients','diary_entries','diary_days','favourites','saved_meals','saved_meal_items','applied_operations','lookup_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_rows on public.%I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop; end $$;
-- Server order is the conflict policy; all writes get server timestamps.
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text;begin foreach t in array array['profiles','nutrition_targets','foods','food_portions','recipes','recipe_ingredients','diary_entries','diary_days','favourites','saved_meals','saved_meal_items'] loop execute format('create trigger touch before insert or update on public.%I for each row execute function public.touch_updated_at()',t);end loop;end $$;
-- Invoker rights: RLS remains in effect. Restricted table/column identifiers prevent injection.
create function public.apply_operations(ops jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare op jsonb;t text;r jsonb;cols text;updates text;uid uuid:=auth.uid();claimed uuid;
begin
 if uid is null then raise exception 'Authentication required';end if;
 if jsonb_typeof(ops)<>'array' or jsonb_array_length(ops)>500 then raise exception 'Invalid operation batch';end if;
 for op in select value from jsonb_array_elements(ops) loop
 t:=op->>'table';if not (t=any(array['profiles','nutrition_targets','foods','food_portions','recipes','recipe_ingredients','diary_entries','diary_days','favourites','saved_meals','saved_meal_items'])) then raise exception 'Invalid table';end if;
 claimed:=null;insert into public.applied_operations(id,user_id) values((op->>'id')::uuid,uid) on conflict do nothing returning id into claimed;
 if claimed is null then continue;end if;
 if op->'row'->>'user_id' is distinct from uid::text then raise exception 'Operation account mismatch';end if;
 r:=(op->'row')||jsonb_build_object('user_id',uid,'updated_at',now());
 if op->>'action'='delete' then execute format('delete from public.%I where id=$1 and user_id=$2',t) using (r->>'id')::uuid,uid;
 elsif op->>'action'='upsert' then
 select string_agg(quote_ident(column_name),','),string_agg(format('%I=excluded.%I',column_name,column_name),',') into cols,updates from information_schema.columns where table_schema='public' and table_name=t;
 execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).* on conflict(id) do update set %s where %I.user_id=$2',t,t,updates,t) using r,uid;
 else raise exception 'Invalid action';end if;
 end loop;
end $$;
grant execute on function public.apply_operations(jsonb) to authenticated;
revoke execute on function public.apply_operations(jsonb) from public,anon;
-- Whole-account replacement is a single database transaction. Constraints validate all rows.
create function public.restore_backup(payload jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare t text;r jsonb;uid uuid:=auth.uid();count_rows int:=0;
begin
 if payload->>'expected_owner' is distinct from uid::text then raise exception 'Restore account mismatch';end if;
 if uid is null or payload->>'version' is distinct from '1' or jsonb_typeof(payload->'data')<>'object' then raise exception 'Invalid backup';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 foreach t in array array['saved_meal_items','saved_meals','favourites','diary_entries','diary_days','recipe_ingredients','food_portions','foods','recipes','nutrition_targets','profiles'] loop
 if jsonb_typeof(payload->'data'->t) is distinct from 'array' then raise exception 'Missing table %',t;end if;
 execute format('delete from public.%I where user_id=$1',t) using uid;
 end loop;
 foreach t in array array['profiles','nutrition_targets','recipes','foods','food_portions','recipe_ingredients','diary_entries','diary_days','favourites','saved_meals','saved_meal_items'] loop
 for r in select value from jsonb_array_elements(payload->'data'->t) loop
 count_rows:=count_rows+1;if count_rows>100000 then raise exception 'Backup too large';end if;
 r:=r||jsonb_build_object('user_id',uid,'updated_at',now());
 execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).*',t,t) using r;
 end loop;end loop;
end $$;
grant execute on function public.restore_backup(jsonb) to authenticated;
revoke execute on function public.restore_backup(jsonb) from public,anon;
-- Throttle across callers sharing this project. Edge function authenticates before invocation.
create function public.claim_food_lookup() returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(9150811);
 delete from public.lookup_requests where requested_at < now()-interval '1 minute';
 if (select count(*) from public.lookup_requests)>=12 then return false;end if;
 insert into public.lookup_requests(user_id) values(auth.uid());return true;
end $$;
grant execute on function public.claim_food_lookup() to authenticated;
revoke execute on function public.claim_food_lookup() from public,anon;

-- Single SQL statement snapshot for coherent, complete backups.
create function public.export_backup() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('version',1,'data',jsonb_build_object(
 'profiles',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.profiles p where user_id=auth.uid()),
 'nutrition_targets',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.nutrition_targets p where user_id=auth.uid()),
 'foods',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.foods p where user_id=auth.uid()),
 'food_portions',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.food_portions p where user_id=auth.uid()),
 'recipes',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.recipes p where user_id=auth.uid()),
 'recipe_ingredients',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.recipe_ingredients p where user_id=auth.uid()),
 'diary_entries',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.diary_entries p where user_id=auth.uid()),
 'diary_days',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.diary_days p where user_id=auth.uid()),
 'favourites',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.favourites p where user_id=auth.uid()),
 'saved_meals',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.saved_meals p where user_id=auth.uid()),
 'saved_meal_items',(select coalesce(jsonb_agg(p),'[]'::jsonb) from public.saved_meal_items p where user_id=auth.uid())
 ));
$$;
grant execute on function public.export_backup() to authenticated;
revoke execute on function public.export_backup() from public,anon;
