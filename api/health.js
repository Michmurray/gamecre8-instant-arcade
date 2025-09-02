const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BUCKET = process.env.SUPABASE_BUCKET || 'game-assets';

module.exports = async (req, res) => {
  try {
    const s = await supabase.storage.from(BUCKET).list(process.env.SPRITES_PREFIX||'sprite/');
    const b = await supabase.storage.from(BUCKET).list(process.env.BACKGROUNDS_PREFIX||'Backgrounds/');
    const { error } = await supabase.from('scores').select('count').limit(1);
    res.json({ ok:true,
      assets:{ sprites:(s.data||[]).length, backgrounds:(b.data||[]).length },
      db: error ? 'fail' : 'ok'
    });
  } catch (e) { res.json({ ok:false, error:String(e.message||e) }); }
};
