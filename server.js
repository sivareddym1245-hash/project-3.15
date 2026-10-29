const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Marketplace, MarketplaceError } = require("./marketplace");

const publicDirectory = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const claimTtlSeconds = Number(process.env.CLAIM_TTL_SECONDS || 60);
const marketplace = new Marketplace({
  claimTtlMs: Number.isFinite(claimTtlSeconds) && claimTtlSeconds > 0 ? claimTtlSeconds * 1000 : 60_000,
});

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        reject(new MarketplaceError(413, "body_too_large", "Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new MarketplaceError(400, "invalid_json", "Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function serveStatic(request, response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Unable to read file");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(contents);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const pathname = url.pathname;
  try {
    if (request.method === "GET" && pathname === "/api/items") {
      sendJson(response, 200, { items: marketplace.listItems() });
      return;
    }

    if (request.method === "POST" && pathname === "/api/items") {
      const item = marketplace.createItem(await readJson(request));
      sendJson(response, 201, { item });
      return;
    }

    const itemRoute = pathname.match(/^\/api\/items\/([^/]+)(?:\/(claim|handoff|sold))?$/);
    if (itemRoute) {
      const [, id, action] = itemRoute;
      if (request.method === "POST" && action === "claim") {
        const { buyerName } = await readJson(request);
        sendJson(response, 200, { item: marketplace.claimItem(id, buyerName) });
        return;
      }
      if (request.method === "POST" && action === "handoff") {
        const { claimId } = await readJson(request);
        sendJson(response, 200, { item: marketplace.confirmHandoff(id, claimId) });
        return;
      }
      if (request.method === "POST" && action === "sold") {
        sendJson(response, 200, { item: marketplace.markSold(id) });
        return;
      }
      if (request.method === "DELETE" && !action) {
        sendJson(response, 200, { item: marketplace.removeItem(id) });
        return;
      }
    }

    if (request.method === "GET") {
      serveStatic(request, response, pathname);
      return;
    }
    sendJson(response, 404, { error: "not_found", message: "Endpoint not found." });
  } catch (error) {
    if (error instanceof MarketplaceError) {
      sendJson(response, error.status, { error: error.code, message: error.message });
      return;
    }
    console.error("Request failed:", error);
    sendJson(response, 500, { error: "internal_error", message: "Something went wrong. Please try again." });
  }
});

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Dorm Marketplace running at http://localhost:${port}`);
    const ttl = marketplace.claimTtlMs / 1000;
    console.log(`Claims expire after ${ttl} second${ttl === 1 ? "" : "s"}.`);
  });
}

module.exports = { server, marketplace };
