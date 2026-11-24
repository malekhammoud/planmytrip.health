module.exports=[74186,t=>t.a(async(n,i)=>{try{var r=t.i(66680),e=t.i(69399),a=t.i(24646),d=t.i(19152),u=n([d]);function o(t){return"object"==typeof t&&null!==t&&!Array.isArray(t)}function s(t){return t instanceof Date?t.toISOString():"string"==typeof t?t:null}function l(t){if(null==t)return null;if("string"!=typeof t)return t;try{return JSON.parse(t)}catch{return null}}function p(t){if(!o(t))return null;let n=s(t.updated_at);return"string"==typeof t.id&&"string"==typeof t.destination&&"number"==typeof t.days&&(0,a.Z)(t.condition)&&null!==n?{id:t.id,destination:t.destination,days:t.days,condition:t.condition,savedAt:n}:null}async function c(t,n){await (0,d.T)();let i=(await (0,d.F)().query(`INSERT INTO saved_trips (
      id, clerk_user_id, run_id, created_at, updated_at,
      destination, days, condition, trip_json, plan_json
    ) VALUES ($1, $2, $3, $4::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9)
    ON CONFLICT (clerk_user_id, run_id) DO UPDATE SET
      updated_at = EXCLUDED.updated_at,
      destination = EXCLUDED.destination,
      days = EXCLUDED.days,
      condition = EXCLUDED.condition,
      trip_json = EXCLUDED.trip_json,
      plan_json = EXCLUDED.plan_json
    RETURNING id`,[(0,r.randomUUID)(),t,n.runId,n.savedAt,n.trip.destination,n.trip.days,n.trip.condition,JSON.stringify(n.trip),JSON.stringify(n.plan)])).rows[0];if(!o(i)||"string"!=typeof i.id)throw Error("The saved trip could not be stored.");return{id:i.id}}async function y(t){await (0,d.T)();let n=(await (0,d.F)().query("SELECT COUNT(*)::int AS count FROM saved_trips WHERE clerk_user_id = $1",[t])).rows[0];return o(n)&&"number"==typeof n.count?n.count:0}async function _(t,n){await (0,d.T)();let i=(await (0,d.F)().query("SELECT id FROM saved_trips WHERE clerk_user_id = $1 AND run_id = $2",[t,n])).rows[0];return o(i)&&"string"==typeof i.id?i.id:null}async function E(t,n=30){return await (0,d.T)(),(await (0,d.F)().query(`SELECT id, destination, days, condition, updated_at
     FROM saved_trips
     WHERE clerk_user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,[t,!Number.isFinite(n)?30:Math.max(1,Math.min(100,Math.trunc(n)))])).rows.map(p).filter(t=>null!==t)}async function f(t,n){await (0,d.T)();let i=(await (0,d.F)().query(`SELECT id, run_id, destination, days, condition, updated_at, trip_json, plan_json
     FROM saved_trips
     WHERE id = $1 AND clerk_user_id = $2`,[n,t])).rows[0];if(!o(i))return null;let r=s(i.updated_at),a="string"==typeof i.id?i.id:null,u="string"==typeof i.run_id?i.run_id:null;if(null===r||null===a||null===u)return null;let p=(0,e.K)({runId:u,trip:l(i.trip_json),plan:l(i.plan_json)},r);return null===p?null:{id:a,destination:p.trip.destination,days:p.trip.days,condition:p.trip.condition,savedAt:r,runId:p.runId,trip:p.trip,plan:p.plan}}async function D(t,n){return await (0,d.T)(),((await (0,d.F)().query("DELETE FROM saved_trips WHERE id = $1 AND clerk_user_id = $2",[n,t])).rowCount??0)>0}[d]=u.then?(await u)():u,t.s(["$",0,y,"Q",0,D,"k",0,_,"U",0,f,"W",0,E,"i",0,c]),i()}catch(t){i(t)}},!1),69399,t=>{"use strict";var n=t.i(91932),i=t.i(23170),r=t.i(29321);t.s(["K",0,function(t,e){if(!("object"==typeof t&&null!==t&&!Array.isArray(t)))return null;let a=(0,r.m)(t.runId);if(null===a)return null;let d=(0,i.f)(t.trip);if(null===d)return null;let u=(0,n.v)(t.plan);return null===u||!0===u.mock?null:{runId:a,trip:{destination:d.destination,origin:d.origin,days:d.days,condition:d.condition,medication:d.medication,interests:d.interests,budget:d.budget,transport:d.transport,checkIn:d.checkIn,travelers:d.travelers,hasSunLifeTravelCoverage:!0===d.hasSunLifeTravelCoverage,captureConsent:!1},plan:u,savedAt:e}},"t",0,function(t){return(0,r.m)(t)}])}];

//# sourceMappingURL=lib_179dvd4on55y5._.js.map