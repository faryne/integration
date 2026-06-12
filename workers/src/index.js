const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    if (!env.PROXY_TOKEN) {
      return jsonResponse({ error: "Worker is missing PROXY_TOKEN" }, 500);
    }

    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${env.PROXY_TOKEN}`) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let target;
    try {
      target = await readTargetURL(request);
      validateTargetURL(target, env.ALLOWED_HOSTS);
    } catch (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    try {
      return await fetchTarget(target, env.ALLOWED_HOSTS);
    } catch (error) {
      return jsonResponse({ error: error.message }, 502);
    }
  },
};

async function readTargetURL(request) {
  let value;
  if (request.method === "GET") {
    value = new URL(request.url).searchParams.get("url");
  } else {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error("POST body must be application/json");
    }
    const body = await request.json();
    value = body?.url;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("url is required");
  }

  return new URL(value);
}

async function fetchTarget(initialURL, allowedHosts) {
  let target = initialURL;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    validateTargetURL(target, allowedHosts);

    const upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 (compatible; faryne-fetch-proxy/1.0)",
      },
    });

    if (!isRedirect(upstream.status)) {
      return proxyResponse(upstream);
    }

    const location = upstream.headers.get("location");
    if (!location) {
      return proxyResponse(upstream);
    }
    if (redirects === MAX_REDIRECTS) {
      throw new Error("Too many redirects");
    }

    target = new URL(location, target);
  }

  throw new Error("Too many redirects");
}

function validateTargetURL(target, allowedHosts) {
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }

  if (target.username || target.password) {
    throw new Error("URLs containing credentials are not allowed");
  }

  const hostname = target.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isBlockedHostname(hostname)) {
    throw new Error("Private or local targets are not allowed");
  }

  const allowlist = parseAllowedHosts(allowedHosts);
  if (allowlist.length > 0 && !allowlist.some((host) => hostnameMatches(hostname, host))) {
    throw new Error("Target host is not allowed");
  }
}

function parseAllowedHosts(value) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

function hostnameMatches(hostname, allowedHost) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function isBlockedHostname(hostname) {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    return true;
  }

  const ipv4 = parseIPv4(hostname);
  if (!ipv4) {
    return hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:");
  }

  const [a, b] = ipv4;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function parseIPv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const values = parts.map(Number);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return values;
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function proxyResponse(upstream) {
  const headers = new Headers(upstream.headers);
  headers.delete("set-cookie");
  headers.delete("set-cookie2");
  headers.delete("content-security-policy");
  headers.set("access-control-allow-origin", "*");
  headers.set("x-content-type-options", "nosniff");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
