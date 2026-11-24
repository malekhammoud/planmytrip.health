module.exports=[50751,a=>{"use strict";var b=a.i(5072),c=a.i(46386);async function d(){let{userId:a,has:d}=await (0,b.f)();return{userId:a,entitlements:(0,c.g)(d)}}a.s(["f",0,d])},59379,a=>a.a(async(b,c)=>{try{var d=a.i(23862),e=b([d]);[d]=e.then?(await e)():e;let h=null,i=null,j=`
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
`;function f(){if(null!==h)return h;let a="true"===process.env.DATABASE_SSL?{rejectUnauthorized:!0}:void 0;return(h=new d.Pool({connectionString:function(){let a=process.env.DATABASE_URL?.trim();if(void 0===a||0===a.length)throw Error("DATABASE_URL is not configured.");return a}(),max:10,connectionTimeoutMillis:5e3,idleTimeoutMillis:1e4,application_name:"planmytrip.health",...void 0===a?{}:{ssl:a}})).on("error",()=>{console.warn("[db] an idle database client failed and was replaced")}),h}async function g(){null===i&&(i=f().query(j).then(()=>void 0).catch(a=>{throw i=null,a})),await i}a.s(["T",0,g,"F",0,f]),c()}catch(a){c(a)}},!1),15741,a=>a.a(async(b,c)=>{try{a.i(66680);var d=a.i(39030),e=a.i(99968),f=a.i(59379),g=b([f]);function h(a){return"object"==typeof a&&null!==a&&!Array.isArray(a)}function i(a){return a instanceof Date?a.toISOString():"string"==typeof a?a:null}function j(a){if(null==a)return null;if("string"!=typeof a)return a;try{return JSON.parse(a)}catch{return null}}function k(a){if(!h(a))return null;let b=i(a.updated_at);return"string"==typeof a.id&&"string"==typeof a.destination&&"number"==typeof a.days&&(0,e.Z)(a.condition)&&null!==b?{id:a.id,destination:a.destination,days:a.days,condition:a.condition,savedAt:b}:null}async function l(a,b=30){return await (0,f.T)(),(await (0,f.F)().query(`SELECT id, destination, days, condition, updated_at
     FROM saved_trips
     WHERE clerk_user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,[a,!Number.isFinite(b)?30:Math.max(1,Math.min(100,Math.trunc(b)))])).rows.map(k).filter(a=>null!==a)}async function m(a,b){await (0,f.T)();let c=(await (0,f.F)().query(`SELECT id, run_id, destination, days, condition, updated_at, trip_json, plan_json
     FROM saved_trips
     WHERE id = $1 AND clerk_user_id = $2`,[b,a])).rows[0];if(!h(c))return null;let e=i(c.updated_at),g="string"==typeof c.id?c.id:null,k="string"==typeof c.run_id?c.run_id:null;if(null===e||null===g||null===k)return null;let l=(0,d.K)({runId:k,trip:j(c.trip_json),plan:j(c.plan_json)},e);return null===l?null:{id:g,destination:l.trip.destination,days:l.trip.days,condition:l.trip.condition,savedAt:e,runId:l.runId,trip:l.trip,plan:l.plan}}[f]=g.then?(await g)():g,a.s(["U",0,m,"W",0,l]),c()}catch(a){c(a)}},!1),39030,a=>{"use strict";["stay","table","trail","culture","transit","care","concierge"].filter(a=>"concierge"!==a);let b=["value","balanced","premium"];function c(a){return"object"==typeof a&&null!==a&&!Array.isArray(a)}function d(a,b=600){if("string"!=typeof a)return null;let c=a.trim().replace(/\s+/g," ");if(0===c.length)return null;if(c.length<=b)return c;let e=c.slice(0,b),f=e.lastIndexOf(" "),g=f>.6*b?f:b;return`${e.slice(0,g).trimEnd()}…`}function e(a){return"number"==typeof a&&Number.isFinite(a)?a:null}function f(a,b=8){if(!Array.isArray(a))return[];let c=new Set;for(let b of a){let a=d(b,600);null!==a&&c.add(a)}return[...c].slice(0,b)}function g(a){let b=d(a,500);if(null===b)return null;try{let a=new URL(b);return"http:"===a.protocol||"https:"===a.protocol?b:null}catch{return null}}let h={1:6,2:26,3:55},i=new Set(["transit","visit","hike","care"]),j={transit:2,stay:1,meal:1,visit:1,hike:2,rest:1,care:1};var k=a.i(87947);let l=["transit","stay","meal","visit","hike","rest","care"],m=["stay","eat","hike","visit","care"];function n(a){return a.toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}let o=/^[A-Za-z0-9._:-]+$/;function p(a){if("string"!=typeof a)return null;let b=a.trim();return b.length<8||b.length>80?null:o.test(b)?b:null}var q=a.i(99968);function r(a,b){if("string"!=typeof a)return null;let c=a.trim().replace(/\s+/g," ");return c.length<=b?c:null}a.s(["K",0,function(a,o){if(!("object"==typeof a&&null!==a&&!Array.isArray(a)))return null;let s=p(a.runId);if(null===s)return null;let t=function(a){if("object"!=typeof a||null===a||Array.isArray(a))return null;let c=r(a.destination,120);if(null===c||0===c.length)return null;let d=r(a.origin??"",120);if(null===d||"number"!=typeof a.days||!Number.isInteger(a.days)||a.days<k.n||a.days>k.w||!(0,q.Z)(a.condition))return null;let e=r(a.medication,120);if(null===e)return null;let f=r(a.interests??"",240);if(null===f)return null;let g=void 0===a.budget?"balanced":a.budget;if(!("string"==typeof g&&b.includes(g)))return null;let h=void 0===a.transport?"mixed":a.transport;if(!(0,q.y)(h))return null;let i=void 0===a.checkIn?"":a.checkIn;if("string"!=typeof i)return null;let j=i.trim();if(j.length>0&&!function(a){let b=/^(\d{4})-(\d{2})-(\d{2})$/.exec(a.trim());if(null===b)return!1;let c=Number(b[1]),d=Number(b[2]),e=Number(b[3]);if(d<1||d>12||e<1||e>31)return!1;let f=new Date(Date.UTC(c,d-1,e));return f.getUTCFullYear()===c&&f.getUTCMonth()===d-1&&f.getUTCDate()===e}(j))return null;let l=void 0===a.travelers?1:a.travelers;if("number"!=typeof l||!Number.isInteger(l)||l<1||l>8||void 0!==a.captureConsent&&"boolean"!=typeof a.captureConsent||void 0!==a.hasSunLifeTravelCoverage&&"boolean"!=typeof a.hasSunLifeTravelCoverage)return null;let m=void 0===a.runId?void 0:p(a.runId);if(null===m)return null;let n=void 0===a.installId?void 0:p(a.installId);return null===n?null:{destination:c,origin:d,days:a.days,condition:a.condition,medication:e,interests:f,budget:g,transport:h,checkIn:j,travelers:l,...void 0===m?{}:{runId:m},...void 0===n?{}:{installId:n},captureConsent:!0===a.captureConsent,hasSunLifeTravelCoverage:!0===a.hasSunLifeTravelCoverage}}(a.trip);if(null===t)return null;let u=function(a){var o,p;let q,r,s;if(!c(a))return null;let t=Array.isArray(a.places)?a.places.map((a,b)=>(function(a,b){var f,h;if(!c(a))return null;let i="string"==typeof(f=a.category)&&m.includes(f)?f:null;if(null===i)return null;let j=d(a.name,160);if(null===j)return null;let k=e(a.lat),l=e(a.lng),n=g(a.bookingUrl),o=g(a.menuUrl);return{id:d(a.id,80)??`place-${b+1}`,name:j,category:i,area:d(a.area,120)??"",lat:null!==k&&k>=-90&&k<=90?k:null,lng:null!==l&&l>=-180&&l<=180?l:null,why:d(a.why,1200)??"",notes:d(a.notes,1200),priceBand:d(a.priceBand,60),durationMin:e(a.durationMin),nights:e(a.nights),distanceKm:e(a.distanceKm),elevationM:e(a.elevationM),difficulty:d(a.difficulty,60),booking:d(a.booking,600),...null===n?{}:{bookingUrl:n},...null===o?{}:{menuUrl:o},sourceUrl:g(a.sourceUrl),address:d(a.address,240),phone:d(a.phone,80),careType:"hospital"===(h=a.careType)||"pharmacy"===h?h:null,day:e(a.day),...!0===a.geocoded?{geocoded:!0}:{}}})(a,b)).filter(a=>null!==a).slice(0,32):[],u=new Map(t.map(a=>[a.id,a])),v={byName:new Map(t.map(a=>[n(a.name),a])),byId:u},w=Array.isArray(a.days)?a.days.map((a,b)=>{let f=c(a)?a:{};return{day:b+1,stepCap:Math.max(0,e(f.stepCeiling)??0),walkingCapKm:Math.max(0,e(f.walkingCapKm)??0),checkpoint:d(f.checkpoint,800)??""}}):[],x=Array.isArray(a.days)?(o=a.days.map((a,b)=>{var f;let g,h,i,j,k,m,o;return g=c(a)?a:{},f=b+1,h=Math.max(1,Math.round(e((c(g)?g:{}).day)??f)),i=w.find(a=>a.day===h)??w[b]??w[0],j=Array.isArray(g.blocks)?g.blocks.map(a=>{var b;let f,g,h,i;return g=d((f=c(a)?a:{}).placeName,160),h=d(f.placeId,80),i=(null===g?null:v.byName.get(n(g))??null)??(null===h?null:v.byId.get(h)??null),{time:d(f.time,40)??"",kind:"string"==typeof(b=f.kind)&&l.includes(b)?b:"visit",title:d(f.title,200)??"Planned block",detail:d(f.detail,900)??"",durationMin:Math.max(0,Math.min(720,e(f.durationMin)??0)),placeId:i?.id??null}}).slice(0,16):[],k=Math.max(0,Math.round(e(g.stepEstimate)??0)),m=Math.max(0,e(g.walkingKm)??0),o=(0===k||k<=(i?.stepCap??0))&&(0===m||m<=(i?.walkingCapKm??0)),{day:h,title:d(g.title,200)??`Day ${h}`,area:d(g.area,120)??"",restDay:!0===g.restDay,stepEstimate:k,walkingKm:m,recoveryMinutes:Math.max(0,Math.round(e(g.recoveryMinutes)??0)),blocks:j,stepCeiling:i?.stepCap??0,walkingCapKm:i?.walkingCapKm??0,withinCaps:o,checkpoint:i?.checkpoint??""}}).slice(0,k.w),q=new Map(t.map(a=>[a.id,a])),r=o.map(a=>{let b=0,c=0,d=0,e=0;for(let k of a.blocks){var f,g;let a=(f=k.kind,g=null===k.placeId?null:q.get(k.placeId)??null,"hike"===f?function(a){if(null===a)return 2;let b=a.distanceKm??0,c=a.elevationM??0,d=(a.difficulty??"").toLowerCase();return b>=8||c>=350||d.includes("hard")||d.includes("strenuous")?3:2}(g):j[f]);c+=k.durationMin,d+=k.durationMin*a,i.has(k.kind)&&(b+=k.durationMin*h[a]),"rest"===k.kind&&(e+=k.durationMin)}let k=Math.round(5e-4*b*1e3)/1e3,l=0===a.blocks.length,m=!l&&b<=a.stepCeiling&&k<=a.walkingCapKm;return{day:a.day,steps:b,walkingKm:k,activeMinutes:c,exertionWeightedMinutes:d,recoveryMinutes:e,stepCeiling:a.stepCeiling,walkingCapKm:a.walkingCapKm,withinCaps:m,empty:l,source:"concierge"}}),o.map((a,b)=>{let c=r[b],d=c.steps<=a.stepCeiling&&c.walkingKm<=a.walkingCapKm;return{...a,withinCaps:a.withinCaps&&d}})):[],y=d(a.summary,1200);return null===y||0===x.length?null:{summary:y,baseArea:d(a.baseArea,300)??"",routeTheme:d(a.routeTheme,300)??"",days:x,places:t,safetyNotes:f(a.safetyNotes,10),bookingChecklist:f(a.bookingChecklist,12),budget:{level:"string"==typeof(s=c(p=a.budget)?p:{}).level&&b.includes(s.level)?s.level:"balanced",estimatedTotal:e(s.estimatedTotal),currency:d(s.currency,12)??"CAD",notes:d(s.notes,600)??""},sources:function(a){if(!Array.isArray(a))return[];let b=new Set,e=[];for(let f of a){if(!c(f))continue;let a=g(f.url);null===a||b.has(a)||(b.add(a),e.push({title:d(f.title,160)??"Source",url:a}))}return e}(a.sources),generatedAt:d(a.generatedAt,40)??new Date(0).toISOString(),degraded:!0===a.degraded||void 0,mock:!0===a.mock||void 0}}(a.plan);return null===u||!0===u.mock?null:{runId:s,trip:{destination:t.destination,origin:t.origin,days:t.days,condition:t.condition,medication:t.medication,interests:t.interests,budget:t.budget,transport:t.transport,checkIn:t.checkIn,travelers:t.travelers,hasSunLifeTravelCoverage:!0===t.hasSunLifeTravelCoverage,captureConsent:!1},plan:u,savedAt:o}},"t",0,function(a){return p(a)}],39030)}];

//# sourceMappingURL=lib_18sy6jlo9w_l9._.js.map