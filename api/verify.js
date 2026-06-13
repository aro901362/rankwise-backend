// Check if email has active Pro subscription
const cors = require('../lib/cors');
const checkPro = require('../lib/checkPro');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const isPro = await checkPro(email);
    return res.status(200).json({ isPro });
  } catch (e) {
    return res.status(500).json({ error: 'Verification failed' });
  }
};
