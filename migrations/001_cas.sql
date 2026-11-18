create table if not exists cas_credentials (
  profile_id text primary key,
  netid_ciphertext text not null,
  netid_iv text not null,
  netid_tag text not null,
  password_ciphertext text not null,
  password_iv text not null,
  password_tag text not null,
  terms_accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
