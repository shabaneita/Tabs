// Tiny Supabase-style API gateway for the local stack:
//   /auth/v1/*  -> GoTrue
//   /rest/v1/*  -> PostgREST
// Adds permissive CORS so the Next.js dev server can call it.
import http from "node:http";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const routes = [
  { prefix: "/auth/v1", target: Number(process.env.GOTRUE_PORT ?? 54331) },
  { prefix: "/rest/v1", target: Number(process.env.POSTGREST_PORT ?? 54332) },
];

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, prefer, range, accept-profile, content-profile, x-supabase-api-version, x-retry-count",
  "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range, content-location",
};

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    const route = routes.find((r) => req.url.startsWith(r.prefix));
    if (!route) {
      res.writeHead(404, { ...cors, "content-type": "application/json" });
      return res.end(JSON.stringify({ message: "not available in local stack" }));
    }
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: route.target,
        method: req.method,
        path: req.url.slice(route.prefix.length) || "/",
        headers: { ...req.headers, host: `127.0.0.1:${route.target}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on("error", (err) => {
      res.writeHead(502, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify({ message: String(err) }));
    });
    req.pipe(upstream);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`gateway on :${PORT}`));
