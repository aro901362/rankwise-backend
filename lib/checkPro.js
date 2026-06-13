// Verify user has active Stripe subscription via Supabase
const { createClient } = require('@supabase/supabase-js');

module.exports = async function checkPro(userEmail) {
  if (!userEmail) return false;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data, error } = await supabase
    .from('subscribers')
    .select('status, current_period_end')
    .eq('email', userEmail.toLowerCase())
    .single();

  if (error || !data) return false;

  const isActive = data.status === 'active';
  const notExpired = new Date(data.current_period_end) > new Date();

  return isActive && notExpired;
};
