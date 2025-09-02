const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
  try {
    const slug = (req.query.slug||'').toString();
    const n = Math.min(100, parseInt(req.query.n||'25',10));
    if (!slug) return res.status(400).json({ ok:false, error:'missing_slug' });
    const { data, error } = await supabase
      .from('scores').select('score,run_ms,created_at')
      .eq('slug', slug).order('score', { ascending:false }).limit(n);
    if (error) throw error;
    res.json({ ok:true, slug, top: data || [] });
  } catch (e) { res.status(200).json({ ok:false, error:String(e.message||e) }); }
};
