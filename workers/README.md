# Fetch Proxy Worker

This Cloudflare Worker fetches a public HTTP(S) URL and streams the response
back to the authenticated caller.

## Cloudflare setup

1. Install dependencies:

   ```bash
   cd workers
   npm install
   ```

2. Authenticate Wrangler:

   ```bash
   npx wrangler login
   ```

3. Create the bearer token secret:

   ```bash
   npx wrangler secret put PROXY_TOKEN
   ```

4. Review `ALLOWED_HOSTS` in `wrangler.jsonc`.

   It is a comma-separated host allowlist. Subdomains are also accepted.
   The committed default is empty and permits arbitrary public HTTP(S) hosts.
   To restrict the Worker to the Taipower site, use:

   ```jsonc
   "ALLOWED_HOSTS": "service.taipower.com.tw"
   ```

5. Deploy:

   ```bash
   make worker-deploy
   ```

The deployment output contains the `workers.dev` URL. `workers_dev` must be
enabled for the Cloudflare account, or configure a custom route in
`wrangler.jsonc`.

## Requests

GET:

```bash
curl -H "Authorization: Bearer $PROXY_TOKEN" \
  --get \
  --data-urlencode "url=https://service.taipower.com.tw/info/tc/inner.aspx?mid=16&year=115&month=5&key1=&key2=" \
  https://faryne-fetch-proxy.YOUR-SUBDOMAIN.workers.dev/
```

POST:

```bash
curl -H "Authorization: Bearer $PROXY_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"url":"https://service.taipower.com.tw/info/tc/inner.aspx?mid=16&year=115&month=5&key1=&key2="}' \
  https://faryne-fetch-proxy.YOUR-SUBDOMAIN.workers.dev/
```

The Worker only performs GET requests, follows at most five redirects, and
rejects localhost, private IP literals, URL credentials, and non-HTTP schemes.
