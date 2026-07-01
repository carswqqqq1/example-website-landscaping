const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};

const LEAD_ENDPOINT_PATH = '/.netlify/functions/send-ticket-emails';
const NETLIFY_LEAD_ENDPOINT = 'https://thinkgreen-az.netlify.app/.netlify/functions/send-ticket-emails';

export async function onRequest({ request }) {
  const url = new URL(request.url);

  if (url.pathname !== LEAD_ENDPOINT_PATH) {
    return new Response('Not found', {
      status: 404,
      headers: corsHeaders
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders
    });
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('accept', 'application/json');

  const upstream = await fetch(NETLIFY_LEAD_ENDPOINT, {
    method: 'POST',
    headers,
    body: await request.arrayBuffer()
  });
  const body = await upstream.text();
  const responseHeaders = new Headers(corsHeaders);
  responseHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json');

  return new Response(body, {
    status: upstream.status,
    headers: responseHeaders
  });
}
