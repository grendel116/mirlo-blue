const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    if (moduleName === "react-native-track-player") {
      return {
        filePath: path.resolve(__dirname, "shims/react-native-track-player.web.ts"),
        type: "sourceFile",
      };
    }
    if (moduleName === "@preeternal/react-native-cookie-manager") {
      return {
        filePath: path.resolve(__dirname, "shims/cookie-manager.web.ts"),
        type: "sourceFile",
      };
    }
    if (moduleName === "expo-secure-store") {
      return {
        filePath: path.resolve(__dirname, "shims/expo-secure-store.web.ts"),
        type: "sourceFile",
      };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add API proxy middleware for Web development to forward /api/* to https://mirlo.space
const https = require("https");
const previousEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    const nextMiddleware = previousEnhanceMiddleware
      ? previousEnhanceMiddleware(metroMiddleware, server)
      : metroMiddleware;

    return (req, res, next) => {
      if (req.url && req.url.startsWith("/feed-proxy")) {
        const parsed = new URL(req.url, "http://localhost:8081");
        const targetUrlStr = parsed.searchParams.get("url");
        if (!targetUrlStr) {
          res.statusCode = 400;
          res.end("Missing url parameter");
          return;
        }

        fetch(targetUrlStr, {
          headers: {
            "User-Agent": "MirloBlue/1.0",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
        })
          .then(async (targetRes) => {
            const xml = await targetRes.text();
            res.writeHead(targetRes.status, {
              "Content-Type": "application/xml; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(xml);
          })
          .catch((err) => {
            console.error("Feed proxy error:", err);
            res.statusCode = 502;
            res.end("Failed to fetch feed");
          });
        return;
      }

      if (req.url && req.url.startsWith("/api/")) {
        const targetPath = req.url.replace(/^\/api/, "");
        const targetUrl = new URL(targetPath, "https://mirlo.space");

        const outgoingHeaders = { ...req.headers, host: targetUrl.host };
        delete outgoingHeaders["accept-encoding"];

        const jwt = req.headers["x-mirlo-jwt"];
        const refresh = req.headers["x-mirlo-refresh"];
        if (jwt || refresh) {
          const cookieParts = [];
          if (jwt) cookieParts.push(`jwt=${jwt}`);
          if (refresh) cookieParts.push(`refresh=${refresh}`);
          outgoingHeaders["cookie"] = cookieParts.join("; ");
        }

        const clientReq = https.request(
          targetUrl,
          {
            method: req.method,
            headers: outgoingHeaders,
          },
          (targetRes) => {
            const setCookie = targetRes.headers["set-cookie"] || [];
            let jwtToken = "";
            let refreshToken = "";

            setCookie.forEach((cookieStr) => {
              const matchJwt = cookieStr.match(/jwt=([^;]+)/);
              if (matchJwt) jwtToken = matchJwt[1];
              const matchRefresh = cookieStr.match(/refresh=([^;]+)/);
              if (matchRefresh) refreshToken = matchRefresh[1];
            });

            const resHeaders = { ...targetRes.headers };
            delete resHeaders["content-encoding"];

            if (jwtToken) resHeaders["x-mirlo-jwt"] = jwtToken;
            if (refreshToken) resHeaders["x-mirlo-refresh"] = refreshToken;

            const contentType = targetRes.headers["content-type"] || "";
            if (contentType.includes("application/json") && (jwtToken || refreshToken)) {
              let bodyChunks = [];
              targetRes.on("data", (chunk) => bodyChunks.push(chunk));
              targetRes.on("end", () => {
                try {
                  const rawBody = Buffer.concat(bodyChunks).toString("utf8");
                  const json = JSON.parse(rawBody);
                  json._tokens = { jwt: jwtToken, refresh: refreshToken };
                  const newBody = JSON.stringify(json);
                  resHeaders["content-length"] = Buffer.byteLength(newBody);
                  res.writeHead(targetRes.statusCode, resHeaders);
                  res.end(newBody);
                } catch {
                  res.writeHead(targetRes.statusCode, resHeaders);
                  res.end(Buffer.concat(bodyChunks));
                }
              });
            } else {
              res.writeHead(targetRes.statusCode, resHeaders);
              targetRes.pipe(res);
            }
          }
        );

        clientReq.on("error", (err) => {
          console.error("Metro proxy error:", err);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: "Proxy connection error" }));
        });

        req.pipe(clientReq);
        return;
      }

      return nextMiddleware(req, res, next);
    };
  },
};

module.exports = config;
