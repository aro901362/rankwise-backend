// Redirect to Stripe payment link with email pre-filled
const cors = require('../lib/cors');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const email = req.query.email || '';
  const baseLink = process.env.STRIPE_PAYMENT_LINK;

  if (!baseLink) return res.status(500).json({ error: 'Payment not configured' });

  // Stripe payment links accept ?prefilled_email=
  const url = `${baseLink}?prefilled_email=${encodeURIComponent(email)}`;
  return res.redirect(302, url);
};
