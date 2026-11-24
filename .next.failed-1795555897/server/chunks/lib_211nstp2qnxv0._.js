module.exports=[66888,e=>e.a(async(t,n)=>{try{var a=e.i(19152),i=t([a]);[a]=i.then?(await i)():i;let y=new Map;function r(){return"0"!==process.env.PLANMYTRIP_CACHE_MEMORY&&("1"===process.env.PLANMYTRIP_CACHE_MEMORY||o()&&!0)}function o(){let e=process.env.DATABASE_URL?.trim();return void 0!==e&&e.length>0}function s(e){return e instanceof Date?e.toISOString():"string"==typeof e?e:null}function c(e){if(!("object"==typeof e&&null!==e&&!Array.isArray(e)))return null;let t="string"==typeof e.cache_key?e.cache_key:null,n="plan"===e.kind||"swarm"===e.kind||"venue"===e.kind?e.kind:null,a=s(e.created_at),i=s(e.expires_at);return null===t||null===n||null===a||null===i?null:{key:t,kind:n,payload:e.payload,createdAt:a,expiresAt:i}}function d(e){if(!r())return;let t=Date.parse(e.expiresAt);if(!(!Number.isFinite(t)||t<=Date.now())){if(y.size>=40&&!y.has(e.key)){let e=y.keys().next().value;void 0!==e&&y.delete(e)}y.set(e.key,{row:e,expiresAtMs:t})}}async function l(e){let t=function(e){if(!r())return null;let t=y.get(e);return void 0===t?null:t.expiresAtMs<=Date.now()?(y.delete(e),null):t.row}(e);if(null!==t)return t;if(!o())return null;try{await (0,a.T)();let t=await (0,a.F)().query(`SELECT cache_key, kind, payload, created_at, expires_at
       FROM trip_cache
       WHERE cache_key = $1 AND expires_at > now()`,[e]),n=c(t.rows[0]);return null!==n&&d(n),n}catch{return console.warn("[cache] a database read failed"),null}}async function u(e){if(!o())return null;try{await (0,a.T)();let t=await (0,a.F)().query(`SELECT cache_key, kind, payload, created_at, expires_at
       FROM trip_cache
       WHERE kind = 'plan'
         AND destination_norm = $1
         AND days = $2
         AND condition = $3
         AND medication_norm = $4
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1`,[e.destination,e.days,e.condition,e.medication]),n=c(t.rows[0]);return null!==n&&d(n),n}catch{return console.warn("[cache] a database lookup failed"),null}}async function p(e){if(d({key:e.key,kind:e.kind,payload:e.payload,createdAt:e.createdAt,expiresAt:e.expiresAt}),o())try{await (0,a.T)(),await (0,a.F)().query(`INSERT INTO trip_cache (
        cache_key, kind, destination_norm, days, condition, medication_norm,
        interest_norm, budget, transport, payload, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
      ON CONFLICT (cache_key) DO UPDATE SET
        destination_norm = EXCLUDED.destination_norm,
        days = EXCLUDED.days,
        condition = EXCLUDED.condition,
        medication_norm = EXCLUDED.medication_norm,
        interest_norm = EXCLUDED.interest_norm,
        budget = EXCLUDED.budget,
        transport = EXCLUDED.transport,
        payload = CASE
          WHEN EXCLUDED.kind = 'swarm'
            AND jsonb_typeof(trip_cache.payload->'workers') = 'object'
            AND jsonb_typeof(EXCLUDED.payload->'workers') = 'object'
          THEN jsonb_set(
            EXCLUDED.payload,
            '{workers}',
            (trip_cache.payload->'workers') || (EXCLUDED.payload->'workers'),
            true
          )
          ELSE EXCLUDED.payload
        END,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at`,[e.key,e.kind,e.columns.destination,e.columns.days,e.columns.condition,e.columns.medication,e.columns.interests,e.columns.budget,e.columns.transport,JSON.stringify(e.payload),e.createdAt,e.expiresAt])}catch{console.warn("[cache] a database write failed")}}e.s(["v",0,function(){return"0"!==process.env.PLANMYTRIP_CACHE&&(o()||r())},"m",0,l,"_",0,u,"B",0,function(e){o()&&(0,a.T)().then(()=>(0,a.F)().query("UPDATE trip_cache SET hits = hits + 1, last_hit_at = now() WHERE cache_key = $1",[e])).catch(()=>{})},"n",0,p]),n()}catch(e){n(e)}},!1),65339,e=>{"use strict";var t=e.i(67052);let n={tripDayCap:60,preAuthorization:{provider:"Allianz Global Assistance",availability:"24/7",required:!0,note:"Pre-authorization is required before non-emergency care."},stabilityWindow:{days:null,isPlaceholder:!0,note:"The pre-existing-condition stability window is not confirmed."},administratorNotice:"Verify with your plan administrator"};e.s(["X",0,n,"j",0,function(e,a){if(!Number.isInteger(e)||e<1)throw new t.n("invalid_days","days","Trip length must be a positive whole number of days.");let i=n.tripDayCap,{provider:r,availability:o}=n.preAuthorization,s=n.stabilityWindow.note,c=n.administratorNotice;return e>i?{severity:"blocking",title:`Trip length exceeds the modeled ${i}-day Sun Life cap`,messages:[`This trip runs ${e} days, beyond the modeled ${i}-day trip cap.`,a?"Coverage may not extend beyond the cap.":"No Sun Life travel coverage is recorded for this trip.","Confirm an extension or split the trip before booking.",s,c]}:a?{severity:"ok",title:"Within the modeled Sun Life trip cap",messages:[`This trip runs ${e} days, within the modeled ${i}-day trip cap.`,`${r} pre-authorization is required ${o} before non-emergency care.`,s,c]}:{severity:"caution",title:"Sun Life coverage is not confirmed",messages:["No Sun Life travel coverage is recorded for this trip.","Confirm coverage or arrange alternate medical travel insurance before booking.",`${r} pre-authorization is required ${o} before non-emergency care.`,s,c]}}])}];

//# sourceMappingURL=lib_211nstp2qnxv0._.js.map