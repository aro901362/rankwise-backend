// PRO endpoint — Claude rewrites. Only fires after Stripe confirms payment.
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('../lib/cors');
const checkPro = require('../lib/checkPro');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resume, jobDescription, userEmail } = req.body || {};

  // 1. GATE — verify Pro subscription BEFORE any Claude call
  const isPro = await checkPro(userEmail);
  if (!isPro) {
    return res.status(403).json({
      error: 'pro_required',
      message: 'Upgrade to Rankwise Pro to unlock AI rewrites.',
      upgradeUrl: process.env.STRIPE_PAYMENT_LINK
    });
  }

  // 2. Only paying users reach this line
  if (!resume || !jobDescription) {
    return res.status(400).json({ error: 'resume and jobDescription required' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are an expert resume writer and ATS specialist. A job seeker needs their resume rewritten to better match a specific job.

JOB DESCRIPTION:
${jobDescription.substring(0, 4000)}

CURRENT RESUME:
${resume.substring(0, 4000)}

Your job:
1. Identify the weakest or least relevant bullet point in their resume
2. Rewrite it to naturally incorporate the most critical missing keywords
3. Keep it truthful — enhance framing, don't fabricate experience
4. Explain in 2 sentences why this specific change will improve their ATS score

Respond ONLY with valid JSON, no markdown fences:
{
  "original_bullet": "<the bullet you're improving>",
  "rewritten_bullet": "<the improved version>",
  "keywords_added": ["keyword1", "keyword2", "keyword3"],
  "why_it_matters": "<2 sentences on why this improves their chances>"
}`
      }]
    });

    const text = message.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);

  } catch (e) {
    console.error('Claude error:', e.message);
    return res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
};
