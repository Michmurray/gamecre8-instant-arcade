const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SBURL = process.env.SUPABASE_URL;
const SBKEY = process.env.SUPABASE_ANON_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'game-assets';
const SPRITES_PREFIX = process.env.SPRITES_PREFIX || 'sprite/';
const BGS_PREFIX = process.env.BACKGROUNDS_PREFIX || 'Backgrounds/';
const SCORE_SECRET = process.env.SCORE_SECRET || 'dev-secret';

const supabase = createClient(SBURL, SBKEY);

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const isImg = (n) => /\.(png|jpe?g|webp|gif)$/i.test(n);
const tagsFromName = (name) => name.toLowerCase().replace(/\.[a-z0-9]+$/,'').split(/[^a-z0-9]+/).filter(Boolean);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function rulesPlan(prompt) {
  const t = (prompt||'').toLowerCase();
  const genre = /platform|jump/.test(t) ? 'platformer' : /runner/.test(t) ? 'runner' : 'shmup';
  const palette = /neon/.test(t) ? 'neon' : /night/.test(t) ? 'night' : /dusk/.test(t) ? 'dusk' : /pastel/.test(t) ? 'pastel' : 'day';
  const sprite = /knight/.test(t) ? 'knight' : /ship|space/.test(t) ? 'ship' : /unicorn/.test(t) ? 'unicorn' : /runner|run/.test(t) ? 'runner' : 'runner';
  const bg = /dungeon/.test(t) ? 'dungeon' : /city|roof/.test(t) ? 'city' : /cloud|island/.test(t) ? 'clouds' : /canyon|desert/.test(t) ? 'canyon' : 'clouds';
  return {
    genre, palette, vibe: prompt?.slice(0, 40) || '',
    mechanics: { speed: 1.0, spawn_rate: 1.0, gravity: genre === 'platformer' ? 1.2 : 0.0 },
    asset_tags: { sprite: [sprite], background: [bg] }
  };
}

const TAG_ALIASES = {
  sprite: {
    ship: ['ship','spaceship','fighter'],
    knight: ['knight','sword','hero'],
    runner: ['runner','kid','athlete'],
    unicorn: ['unicorn','horse','pony','animal']
  },
  background: {
    canyon: ['canyon','desert','mesa'],
    dungeon: ['dungeon','moss','stone'],
    city: ['city','rooftop','neon'],
    clouds: ['clouds','sky','islands']
  }
};
const expand = (kind, wants=[]) => wants.flatMap(t => [t, ...(TAG_ALIASES[kind]?.[t]||[])].map(s=>s.toLowerCase()));

async function listImages(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, sortBy: { column: 'name', order:'asc' }});
  if (error) return [];
  return (data||[]).filter(f => isImg(f.name)).map(f => ({
    path: prefix + f.name,
    name: f.name,
    url: `${SBURL}/storage/v1/object/public/${BUCKET}/${prefix}${f.name}`
  }));
}

function pick(plan, sprites, backgrounds) {
  const wantS = expand('sprite', plan.asset_tags?.sprite);
  const wantB = expand('background', plan.asset_tags?.background);
  const s = sprites.find(i => tagsFromName(i.name).some(t => wantS.includes(t))) || sprites[0];
  const b = backgrounds.find(i => tagsFromName(i.name).some(t => wantB.includes(t))) || backgrounds[0];
  return { sprite_url: s?.url || null, background_url: b?.url || null };
}

function hmac(payload) { return crypto.createHmac('sha256', SCORE_SECRET).update(payload).digest('hex'); }

module.exports = async (req, res) => {
  try {
    const prompt = (req.query.prompt||'').toString().trim();
    if (!prompt) return res.status(400).json({ ok:false, error:'Missing prompt' });

    const plan = rulesPlan(prompt);

    const [sprites, backgrounds] = await Promise.all([listImages(SPRITES_PREFIX), listImages(BGS_PREFIX)]);
    const counts = { sprites: sprites.length, backgrounds: backgrounds.length };

    const picks = pick(plan, sprites, backgrounds);

    const issued_at = new Date().toISOString();
    const seed = crypto.randomBytes(8).toString('hex');
    const slug = `${plan.genre}-${plan.asset_tags.background[0]}-${issued_at.slice(0,10)}-${crypto.randomBytes(2).toString('hex')}`;
    const play_sig = hmac(`${slug}|${seed}|${issued_at}`);

    const config = {
      slug, prompt, seed, issued_at, play_sig,
      genre: plan.genre, palette: plan.palette,
      mechanics: {
        speed: clamp(plan.mechanics.speed, 0.5, 1.5),
        spawn_rate: clamp(plan.mechanics.spawn_rate, 0.5, 1.5),
        gravity: clamp(plan.mechanics.gravity, 0.0, 1.5)
      },
      assets: { sprite_url: picks.sprite_url, background_url: picks.background_url },
      juice: { shake: 0.6, hitstop_ms: 60, trail: true, particles: 'heavy', bloom: true }
    };

    if (req.query.redirect === '0') {
      return res.status(200).json({ ok:true, counts, plan, picks, next: `/play.html?data=${b64url(config)}` });
    }
    res.writeHead(302, { Location: `/play.html?data=${b64url(config)}` });
    res.end();
  } catch (e) {
    res.status(200).json({ ok:false, error:String(e.message||e) });
  }
};
