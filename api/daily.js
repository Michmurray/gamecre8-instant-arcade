module.exports = async (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  const prompt = `Daily Seed ${today} neon canyon shmup`;
  res.writeHead(302, { Location: `/api/one-shot?prompt=${encodeURIComponent(prompt)}` });
  res.end();
};
