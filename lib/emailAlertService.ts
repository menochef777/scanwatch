/**
 * FormSubmit Email Alert Service for WatchDocs
 * Sends transactional email alerts via FormSubmit AJAX API
 */
export interface EmailAlertPayload {
  toEmail: string;
  url: string;
  title?: string;
  diffSnippet?: string;
  detectedAt?: string;
}

export async function sendEmailAlert({
  toEmail,
  url,
  title,
  diffSnippet,
  detectedAt,
}: EmailAlertPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = toEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Invalid recipient email' };
    }

    const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(cleanEmail)}`;

    const payload = {
      _subject: `🚨 [WatchDocs] Alteração detectada: ${title || url}`,
      _template: 'table',
      _captcha: 'false',
      'Site Monitorado': title || url,
      'URL da Página': url,
      'Status': 'Alteração Detectada',
      'Horário': detectedAt || new Date().toLocaleString(),
      'Diferenças': diffSnippet || 'Mudanças detectadas no conteúdo da página.',
      'Acesse o Dashboard': 'https://scanwatch8.vercel.app/',
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`FormSubmit response error (${response.status}):`, errText);
      return { success: false, error: errText };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error sending email alert via FormSubmit:', err);
    return { success: false, error: err.message };
  }
}
