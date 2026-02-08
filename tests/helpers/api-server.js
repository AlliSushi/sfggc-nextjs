const http = require("node:http");
const { parse } = require("node:url");

const attachHelpers = (req, res) => {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json");
    }
    res.end(JSON.stringify(payload));
  };
};

const parseBody = async (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          resolve(undefined);
        }
        return;
      }
      resolve(undefined);
    });
  });

const createApiServer = async (handler, { withQuery = true } = {}) =>
  new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const parsed = parse(req.url, true);
      if (withQuery) {
        req.query = parsed.query || {};
      }
      req.body = await parseBody(req);
      attachHelpers(req, res);
      await handler(req, res);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done) => {
            server.close(done);
          }),
      });
    });
  });

module.exports = { createApiServer };
