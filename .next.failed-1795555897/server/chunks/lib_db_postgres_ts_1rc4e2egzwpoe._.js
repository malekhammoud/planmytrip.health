module.exports=[19152,T=>T.a(async(e,N)=>{try{var t=T.i(23862),i=e([t]);[t]=i.then?(await i)():i;let n=null,a=null,_=`
CREATE TABLE IF NOT EXISTS trip_captures (
  run_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  consent_version INTEGER NOT NULL,
  request_json JSONB NOT NULL,
  engine_json JSONB NOT NULL,
  plan_json JSONB,
  dose_json JSONB NOT NULL,
  features_json JSONB NOT NULL,
  research_json JSONB NOT NULL,
  swarm_json JSONB NOT NULL,
  outcome_json JSONB,
  label_flare BOOLEAN,
  label_severity TEXT,
  label_care TEXT,
  label_flare_day INTEGER,
  outcome_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trip_captures_install
  ON trip_captures(install_id);
CREATE INDEX IF NOT EXISTS idx_trip_captures_created
  ON trip_captures(created_at);

CREATE TABLE IF NOT EXISTS model_runs (
  model_version TEXT PRIMARY KEY,
  trained_at TIMESTAMPTZ NOT NULL,
  schema_version INTEGER NOT NULL,
  source TEXT NOT NULL,
  n INTEGER NOT NULL,
  events INTEGER NOT NULL,
  metrics_json JSONB NOT NULL,
  artifact_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_trips (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  destination TEXT NOT NULL,
  days INTEGER NOT NULL,
  condition TEXT NOT NULL,
  trip_json JSONB NOT NULL,
  plan_json JSONB NOT NULL,
  UNIQUE (clerk_user_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_trips_user
  ON saved_trips(clerk_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS trip_cache (
  cache_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  destination_norm TEXT NOT NULL,
  days INTEGER,
  condition TEXT,
  medication_norm TEXT,
  interest_norm TEXT,
  budget TEXT,
  transport TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trip_cache_lookup
  ON trip_cache(kind, destination_norm, days, condition, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_cache_expiry
  ON trip_cache(expires_at);

CREATE TABLE IF NOT EXISTS billing_usage (
  event_id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  period_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_user
  ON billing_usage(clerk_user_id, metric, period_start);
`;function E(){if(null!==n)return n;let T="true"===process.env.DATABASE_SSL?{rejectUnauthorized:!0}:void 0;return(n=new t.Pool({connectionString:function(){let T=process.env.DATABASE_URL?.trim();if(void 0===T||0===T.length)throw Error("DATABASE_URL is not configured.");return T}(),max:10,connectionTimeoutMillis:5e3,idleTimeoutMillis:1e4,application_name:"planmytrip.health",...void 0===T?{}:{ssl:T}})).on("error",()=>{console.warn("[db] an idle database client failed and was replaced")}),n}async function r(){null===a&&(a=E().query(_).then(()=>void 0).catch(T=>{throw a=null,T})),await a}T.s(["T",0,r,"F",0,E]),N()}catch(T){N(T)}},!1)];

//# sourceMappingURL=lib_db_postgres_ts_1rc4e2egzwpoe._.js.map