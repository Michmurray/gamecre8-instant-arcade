const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const SCORE_SECRET = process.env.SCORE_SECRET || 'dev-secret';

function hmac(s){ return crypto.createHmac('sha256', SCORE_SECRET).update(s).digest('hex'); }

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { slug, score, run_ms, seed, issued_at, play_sig } = req.body||{};
    if (!slug || !Number.isInteger(score) || !Number.isInteger(run_ms) || !seed || !issued_at || !play_sig) {
      return res.status(400).json({ ok:false, error:'bad_params' });
    }

    const check = hmac(`${slug}|${seed}|${issued_at}`);
    if (check !== play_sig) return res.status(403).json({ ok:false, error:'bad_sig' });

    const age = Date.now() - Date.parse(issued_at);
    if (isNaN(age) || age > 2*60*60*1000) return res.status(400).json({ ok:false, error:'expired' });

    if (run_ms < 3000 || run_ms > 30*60*1000) return res.status(400).json({ ok:false, error:'run_ms_out_of_range' });
    if (score < 0 || score > 1e9) return res.status(400).json({ ok:false, error:'score_out_of_range' });

    const ip = (req.headers['x-forwarded-for']||'').split(',')[0]||req.socket.remoteAddress||'';
    const ip_hash = crypto.createHash('sha256').update(ip||'').digest('hex').slice(0,32);

    const { error } = await supabase.from('scores').insert({ slug, score, run_ms, seed, issued_at, ip_hash });
    if (error) throw error;
    res.json({ ok:true });
  } catch (e) { res.status(200).json({ ok:false, error:String(e.message||e) }); }
};
