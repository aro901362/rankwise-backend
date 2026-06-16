const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
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
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // fallback: 30 days

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = getEmail(session);
        if (!email) { console.log('No email in session'); break; }

        let periodEnd = getPeriodEnd(null); // default 30 days
        if (session.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            periodEnd = getPeriodEnd(sub);
          } catch (e) {
            console.log('Could not retrieve subscription, using default period end');
          }
        }

        await supabase.from('subscribers').upsert({
          email: email.toLowerCase(),
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription || null,
          status: 'active',
          current_period_end: periodEnd,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
        console.log('New subscriber:', email);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        let periodEnd = getPeriodEnd(null);
        if (invoice.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription);
            periodEnd = getPeriodEnd(sub);
          } catch (e) {}
        }
        const email = getEmail(invoice);
        if (!email) break;
        await supabase.from('subscribers').upsert({
          email: email.toLowerCase(),
          status: 'active',
          current_period_end: periodEnd,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
        break;
      }
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj = event.data.object;
        const customer = await stripe.customers.retrieve(obj.customer);
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
