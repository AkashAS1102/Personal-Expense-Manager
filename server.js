const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const ROOT = __dirname;
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxnJ53DMvXsxzkdkAMrtixvwODsxOjQJar-sakGPW-7foi_mGVvRsFlfWSkaApmxJTm/exec";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Upstream request failed with status ${response.status}`);
  }
  return response.text();
}

async function loadSheetPayload() {
  const scriptText = await fetchText(APPS_SCRIPT_URL);
  const payload = JSON.parse(scriptText);
  return {
    state: payload.state || "unreachable",
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    source: "apps_script",
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function serveFile(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const absolutePath = path.join(ROOT, path.normalize(normalizedPath));

  if (!absolutePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(absolutePath, (error, fileBuffer) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const extension = path.extname(absolutePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });
    response.end(fileBuffer);
  });
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/expenses") {
    try {
      const payload = await loadSheetPayload();
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 502, {
        state: "unreachable",
        rows: [],
        message: error.message,
      });
    }
    return;
  }

  serveFile(url.pathname, response);
});

server.listen(PORT, () => {
  console.log(`Expense Manager running at http://localhost:${PORT}`);
});
