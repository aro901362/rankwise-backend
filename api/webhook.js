// Stripe webhook — syncs payment status to Supabase
// This is the ONLY place subscriber records are written
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Vercel needs raw body for Stripe signature verification
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature failed:', e.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const getEmail = (obj) => obj?.customer_email || obj?.metadata?.email || null;
  const getPeriodEnd = (obj) => obj?.current_period_end
    ? new Date(obj.current_period_end * 1000).toISOString()
    : null;

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = getEmail(session);
        if (!email) break;

        // Fetch the subscription to get period end
        const sub = await stripe.subscriptions.retrieve(session.subscription);

        await supabase.from('subscribers').upsert({
          email: email.toLowerCase(),
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: 'active',
          current_period_end: getPeriodEnd(sub),
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });

        console.log('New subscriber:', email);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const email = getEmail(invoice) || getEmail(sub);
        if (!email) break;

        await supabase.from('subscribers').upsert({
          email: email.toLowerCase(),
          status: 'active',
          current_period_end: getPeriodEnd(sub),
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
        break;
      }

      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj = event.data.object;
        const customerId = obj.customer;

        // Look up email from customer
        const customer = await stripe.customers.retrieve(customerId);
        const email = customer.email;
        if (!email) break;

        await supabase.from('subscribers')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('email', email.toLowerCase());

        console.log('Subscription ended:', email);
        break;
      }
    }

    return res.status(200).json({ received: true });

  } catch (e) {
    console.error('Webhook processing error:', e);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
