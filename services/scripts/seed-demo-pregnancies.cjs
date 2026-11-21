// Explicit, additive DEMO fixtures; never replaces an existing pregnancy episode.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const envFile = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const weeks = { thanhhang:12, ngocmai:28, quynhchi:34, thuyduong:16, kimngan:10, thutrang:20, phuonglinh:8, honghanh:31, bichthuy:25, yennhi:14, baochau:18 };
async function main() {
  const clients = [new Client({connectionString:process.env.AUTH_DATABASE_URL || 'postgresql://auth:authpass@localhost:5433/auth'}),new Client({connectionString:process.env.PATIENT_DATABASE_URL || 'postgresql://patient:patientpass@localhost:5434/patient'}),new Client({connectionString:process.env.MEDICAL_RECORD_DATABASE_URL || 'postgresql://medical_record:medical_recordpass@localhost:5440/medical_record'})];
  try {
    await Promise.all(clients.map(c=>c.connect()));
    let created=0;
    for (const [name, age] of Object.entries(weeks)) {
      const account=(await clients[0].query('SELECT id FROM accounts WHERE email=$1',[`patient.${name}@gmail.com`])).rows[0];
      if (!account) continue;
      const patient=(await clients[1].query('SELECT id FROM patients WHERE auth_account_id=$1',[account.id])).rows[0];
      if (!patient) continue;
      await clients[2].query('BEGIN');
      try {
        await clients[2].query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[patient.id]);
        const existing=await clients[2].query("SELECT id FROM pregnancy_episodes WHERE patient_id=$1 LIMIT 1",[patient.id]);
        if (!existing.rowCount) {
          // Relative dates are synthetic demo values, not medical history.
          await clients[2].query("INSERT INTO pregnancy_episodes(id,patient_id,status,last_menstrual_period,estimated_due_date,risk_level,version,created_at,updated_at) VALUES(gen_random_uuid(),$1,'ACTIVE',(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-($2::int*7),(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+(280-$2::int*7),'UNKNOWN',1,NOW(),NOW())",[patient.id,age]);
          created++;
        }
        await clients[2].query('COMMIT');
      } catch(error) { await clients[2].query('ROLLBACK'); throw error; }
    }
    console.log(`DEMO only: created ${created} pregnancy fixtures; existing episodes unchanged.`);
  } finally { await Promise.allSettled(clients.map(c=>c.end())); }
}
if(require.main===module)main().catch(()=>{console.error('Demo pregnancy seed failed; check database connectivity.');process.exitCode=1});
module.exports={main};
