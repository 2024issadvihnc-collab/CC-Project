/**
 * High-performance Native Reverse Proxy for ShowTime API Gateway
 * Compatible with Node 18+ without external proxy dependencies
 */

export function buildProxy(targetUrl) {
  return async (req, res) => {
    // Preserve full query string and path
    const url = `${targetUrl}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];

    // Forward injected user context headers
    if (req.user) {
      headers["x-user-id"] = req.user.id;
      headers["x-user-role"] = req.user.role || "user";
      if (req.user.email) headers["x-user-email"] = req.user.email;
      if (req.user.phone) headers["x-user-phone"] = req.user.phone;
    }

    try {
      const options = {
        method: req.method,
        headers,
        signal: AbortSignal.timeout(10000), // 10s timeout
      };

      if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length > 0) {
        options.body = JSON.stringify(req.body);
        headers["content-type"] = "application/json";
      }

      const response = await fetch(url, options);
      res.status(response.status);

      response.headers.forEach((val, key) => {
        const lowerKey = key.toLowerCase();
        if (!["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)) {
          res.setHeader(key, val);
        }
      });

      const bodyText = await response.text();
      res.send(bodyText);
    } catch (err) {
      console.error(`[API-Gateway] Proxy error routing ${req.method} ${req.url} -> ${targetUrl}: ${err.message}`);
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Downstream microservice temporarily unavailable",
          target: targetUrl,
          details: err.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  };
}
