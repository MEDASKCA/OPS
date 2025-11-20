/**
 * Cloudflare Pages Function to handle registration requests
 * Sends email notifications via MailChannels (free for Cloudflare Workers)
 */

export async function onRequest(context) {
  // Only allow POST requests
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // Parse the JSON body
    const data = await context.request.json();

    // Basic validation
    if (!data.email || !data.first_name || !data.last_name || !data.organisation) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Check honeypot (bot detection)
    if (data.website) {
      return new Response('Success', { status: 200 }); // Silent success for bots
    }

    // Prepare email content
    const emailSubject = `New Access Request: ${data.name || `${data.first_name} ${data.last_name}`}`;
    const emailBody = `
New access request received:

Name: ${data.name || `${data.title || ''} ${data.first_name} ${data.last_name}`.trim()}
Email: ${data.email}
Organisation: ${data.organisation}
Role: ${data.role || 'Not specified'}
Country: ${data.country || 'Not specified'}
Intended Use: ${data.intended_use || 'Not specified'}
Referral: ${data.referral || 'Not specified'}${data.referral_other ? ` - ${data.referral_other}` : ''}

Additional Notes: ${data.notes || 'None'}

---
Received: ${new Date().toISOString()}
    `.trim();

    // Send email via MailChannels (free for Cloudflare Workers)
    const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: 'registrations@medaskca.com', name: 'MEDASKCA Registrations' }],
            dkim_domain: 'medaskca.com', // Optional: configure DKIM in Cloudflare DNS
            dkim_selector: 'mailchannels', // Optional: configure DKIM in Cloudflare DNS
          },
        ],
        from: {
          email: 'noreply@medaskca.com',
          name: 'MEDASKCA Registration Form',
        },
        reply_to: {
          email: data.email,
          name: data.name || `${data.first_name} ${data.last_name}`,
        },
        subject: emailSubject,
        content: [
          {
            type: 'text/plain',
            value: emailBody,
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      console.error('Failed to send email:', await emailResponse.text());
      return new Response('Failed to send notification', { status: 500 });
    }

    // Return success
    return new Response(JSON.stringify({ success: true, message: 'Registration received' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error processing registration:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
