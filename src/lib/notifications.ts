import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export async function sendPushNotification(
  pushToken: string,
  title: string,
  message: string,
  data: Record<string, any> = {}
): Promise<boolean> {
  if (!pushToken) return false;

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/pushy-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ token: pushToken, title, message, data }),
    });

    if (!response.ok) {
      console.error('Push notification error:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error sending push notification:', err);
    return false;
  }
}

export async function notifyAdminOfNewUser(userName: string): Promise<void> {
  try {
    const { data: adminProfiles, error } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('role', 'admin')
      .not('push_token', 'is', null);

    if (error || !adminProfiles) {
      console.error('Error fetching admin tokens:', error);
      return;
    }

    for (const admin of adminProfiles) {
      if (admin.push_token) {
        await sendPushNotification(
          admin.push_token,
          'Nueva solicitud de usuario',
          `${userName} ha solicitado unirse.`,
          { screen: 'AdminApprovals' }
        );
      }
    }
  } catch (err) {
    console.error('Error notifying admin:', err);
  }
}