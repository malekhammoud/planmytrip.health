module.exports=[19876,e=>{"use strict";e.s(["F",0,1,"b",0,1,"t",0,"1"])},95529,e=>e.a(async(n,r)=>{try{var t=e.i(24646),a=e.i(90778),s=e.i(19876),i=e.i(19152),o=n([i]);function _(e){return"object"==typeof e&&null!==e&&!Array.isArray(e)}function l(e){if(null==e)return null;if("string"!=typeof e)return e;try{return JSON.parse(e)}catch{return null}}function u(e){return e instanceof Date?e.toISOString():"string"==typeof e?e:null}function E(e){if(!_(e))return null;let n=u(e.created_at);return null===n?null:{run_id:String(e.run_id),install_id:String(e.install_id),created_at:n,request_json:e.request_json,engine_json:e.engine_json,plan_json:e.plan_json,dose_json:e.dose_json,features_json:e.features_json,swarm_json:e.swarm_json,outcome_json:e.outcome_json,label_flare:null===e.label_flare||void 0===e.label_flare?null:!0===e.label_flare,label_severity:"string"==typeof e.label_severity?e.label_severity:null,label_care:"string"==typeof e.label_care?e.label_care:null,label_flare_day:"number"==typeof e.label_flare_day?e.label_flare_day:null,outcome_at:u(e.outcome_at)}}async function c(e){!0===e.consent.capture&&(await (0,i.T)(),await (0,i.F)().query(`INSERT INTO trip_captures (
      run_id, install_id, schema_version, engine_version, created_at,
      consent_version, request_json, engine_json, plan_json, dose_json,
      features_json, research_json, swarm_json
    ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (run_id) DO UPDATE SET
      install_id = EXCLUDED.install_id,
      schema_version = EXCLUDED.schema_version,
      engine_version = EXCLUDED.engine_version,
      created_at = EXCLUDED.created_at,
      consent_version = EXCLUDED.consent_version,
      request_json = EXCLUDED.request_json,
      engine_json = EXCLUDED.engine_json,
      plan_json = EXCLUDED.plan_json,
      dose_json = EXCLUDED.dose_json,
      features_json = CASE
        WHEN trip_captures.features_json->>'adherence' IS NOT NULL
          AND EXCLUDED.features_json->>'adherence' IS NULL
        THEN jsonb_set(
          EXCLUDED.features_json,
          '{adherence}',
          trip_captures.features_json->'adherence',
          true
        )
        ELSE EXCLUDED.features_json
      END,
      research_json = EXCLUDED.research_json,
      swarm_json = CASE
        WHEN trip_captures.swarm_json = '[]'::jsonb THEN EXCLUDED.swarm_json
        ELSE trip_captures.swarm_json
      END
    WHERE trip_captures.install_id = EXCLUDED.install_id`,[e.runId,e.installId,e.schemaVersion,s.t,e.createdAt,e.consent.version,JSON.stringify(e.request),JSON.stringify(e.engine),JSON.stringify(e.plan),JSON.stringify(e.plan.days),JSON.stringify(e.features),JSON.stringify(e.verification.research),JSON.stringify(e.verification.swarm)]))}async function d(e,n,r,t){await (0,i.T)(),await (0,i.F)().query(`INSERT INTO trip_captures (
      run_id, install_id, schema_version, engine_version, created_at,
      consent_version, request_json, engine_json, plan_json, dose_json,
      features_json, research_json, swarm_json
    ) VALUES ($1, $2, 1, $3, $4::timestamptz, 1, '{}'::jsonb, '{}'::jsonb, NULL,
      '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, $5)
    ON CONFLICT (run_id) DO UPDATE SET swarm_json = (
      SELECT COALESCE(jsonb_agg(merged.value ORDER BY merged.worker), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (candidate.value->>'worker')
          candidate.value,
          candidate.value->>'worker' AS worker
        FROM (
          SELECT entry.value, 0 AS priority
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(trip_captures.swarm_json) = 'array'
              THEN trip_captures.swarm_json ELSE '[]'::jsonb END
          ) AS entry
          UNION ALL
          SELECT entry.value, 1 AS priority
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(EXCLUDED.swarm_json) = 'array'
              THEN EXCLUDED.swarm_json ELSE '[]'::jsonb END
          ) AS entry
        ) AS candidate
        ORDER BY candidate.value->>'worker', candidate.priority DESC
      ) AS merged
    )
    WHERE trip_captures.install_id = EXCLUDED.install_id`,[e,n,s.t,t,JSON.stringify(r)])}async function j(e,n,r){var t;await (0,i.T)();let s=(0,i.F)(),o=(await s.query("SELECT features_json FROM trip_captures WHERE run_id = $1 AND install_id = $2",[e,n])).rows[0];if(!_(o))return!1;let u=_(t=l(o.features_json))&&"number"==typeof t.peakExposure&&"number"==typeof t.recoveryCoverage&&"number"==typeof t.tripLength?t:null,E=(0,a.Z)(r.adherence),c=null===u?null:{...u,adherence:E??u.adherence};return((await s.query(`UPDATE trip_captures SET
      outcome_json = $1,
      label_flare = $2,
      label_severity = $3,
      label_care = $4,
      label_flare_day = $5,
      outcome_at = $6::timestamptz,
      features_json = $7
    WHERE run_id = $8 AND install_id = $9
    RETURNING run_id`,[JSON.stringify(r),r.flare,r.severity,r.care,r.flareDay,r.reportedAt,JSON.stringify(c??u??{}),e,n])).rowCount??0)>0}async function f(e,n=20){return await (0,i.T)(),(await (0,i.F)().query(`SELECT run_id, created_at, request_json, label_flare, outcome_at
     FROM trip_captures
     WHERE install_id = $1 AND request_json <> '{}'::jsonb
     ORDER BY created_at DESC
     LIMIT $2`,[e,!Number.isFinite(n)?20:Math.max(1,Math.min(100,Math.trunc(n)))])).rows.map(E).filter(e=>null!==e).flatMap(e=>{var n;let r=_(n=l(e.request_json))&&"string"==typeof n.destination&&(0,t.Z)(n.condition)?n:null;return null===r?[]:[{runId:e.run_id,createdAt:e.created_at,destination:r.destination,days:r.days,condition:r.condition,flare:e.label_flare,reportedAt:e.outcome_at}]})}[i]=o.then?(await o)():o,e.s(["h",0,f,"b",0,c,"y",0,j,"Q",0,d]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=lib_1yc2y5nkiqows._.js.map