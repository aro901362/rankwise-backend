import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function getUserStatus(email) {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (!user) return { tier: 'none', scansToday: 0, userId: null };

  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', today);

  return {
    tier: user.stripe_status === 'active' ? 'pro' : 'free',
    scansToday: count || 0,
    userId: user.id
  };
}

export async function logScan(userId) {
  await supabase.from('scans').insert({ user_id: userId });
}

export async function upsertUser(email, stripeCustomerId = null) {
  const { data } = await supabase
    .from('users')
    .upsert({ email, stripe_customer_id: stripeCustomerId }, { onConflict: 'email' })
    .select()
    .single();
  return data;
}

export async function updateStripeStatus(stripeCustomerId, status) {
  await supabase
    .from('users')
    .update({ stripe_status: status })
    .eq('stripe_customer_id', stripeCustomerId);
}
