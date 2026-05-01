import emailjs from '@emailjs/browser';

// EmailJS credentials
const EMAILJS_SERVICE_ID = import.meta.env.PUBLIC_EMAILJS_SERVICE_ID || 'service_l306yyq';
const EMAILJS_TEMPLATE_ID = import.meta.env.PUBLIC_EMAILJS_TEMPLATE_ID || 'template_ltx5siy';
const EMAILJS_PUBLIC_KEY = import.meta.env.PUBLIC_EMAILJS_PUBLIC_KEY || 'rjSjmmuzoD3Vp_6SW';

export async function sendReportEmail(params: {
  to_email: string;
  report_type: string;
  reporter_id: string;
  reporter_email: string;
  reported_user_id: string;
  reported_user_name: string;
  message_id: string | null;
  reason: string;
  status: string;
  extra_info?: string;
}) {
  if (
    EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID' ||
    EMAILJS_TEMPLATE_ID === 'YOUR_TEMPLATE_ID' ||
    EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY'
  ) {
    console.warn('EmailJS no está configurado. Configura PUBLIC_EMAILJS_SERVICE_ID, PUBLIC_EMAILJS_TEMPLATE_ID y PUBLIC_EMAILJS_PUBLIC_KEY en variables de entorno.');
    return { success: false, error: 'EmailJS not configured' };
  }

  try {
    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: params.to_email,
        report_type: params.report_type,
        reporter_id: params.reporter_id,
        reporter_email: params.reporter_email,
        reported_user_id: params.reported_user_id,
        reported_user_name: params.reported_user_name,
        message_id: params.message_id || 'N/A',
        reason: params.reason,
        status: params.status,
        extra_info: params.extra_info || '',
        date: new Date().toISOString(),
      },
      EMAILJS_PUBLIC_KEY
    );
    return { success: true, result };
  } catch (error: any) {
    console.error('EmailJS send failed:', error);
    return { success: false, error: error?.text || 'Failed to send email' };
  }
}
