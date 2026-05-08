import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = import.meta.env.PUBLIC_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.PUBLIC_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.PUBLIC_EMAILJS_PUBLIC_KEY || '';

export async function sendNewUserAdminEmail(params: {
  name: string;
  email: string;
  user_type: string;
  id_type?: string;
  verification_id?: string;
  birth_date?: string;
}) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY) {
    console.warn('EmailJS no está configurado');
    return { success: false, error: 'EmailJS not configured' };
  }

  try {
    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      'template_4nrl6cp',
      {
        to_email: 'reverzo.app@outlook.com',
        name: params.name,
        email: params.email,
        user_type: params.user_type,
        user_type_class: params.user_type === 'editorial' ? 'badge-editorial' : '',
        id_type: params.id_type || '',
        verification_id: params.verification_id || '',
        birth_date: params.birth_date || '',
        registration_date: new Date().toLocaleString('es-CO', { 
          timeZone: 'America/Bogota',
          dateStyle: 'full',
          timeStyle: 'short'
        }),
      },
      EMAILJS_PUBLIC_KEY
    );
    return { success: true, result };
  } catch (error: any) {
    console.error('EmailJS send failed:', error);
    return { success: false, error: error?.text || 'Failed to send email' };
  }
}

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
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
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
