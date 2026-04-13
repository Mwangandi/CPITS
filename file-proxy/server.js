/**
 * Frappe Image Optimization Proxy
 *
 * Fetches images from Frappe, processes them with sharp (resize, compress,
 * format conversion), and caches the results in memory.
 *
 * Supports both public (/files/) and private (/private/files/) images.
 * Private files use Frappe API token authentication.
 *
 * Endpoints:
 *   GET /image?url=/files/photo.jpg&w=400&h=300&q=75&format=webp
 *   GET /health
 *
 * Query params:
 *   url    — Frappe file path (required), e.g. /files/photo.jpg
 *   w      — Target width in pixels (optional, max 2000)
 *   h      — Target height in pixels (optional, max 2000)
 *   q      — Quality 1-100 (default: 80)
 *   format — Output format: webp, jpeg, png, avif (default: auto-detect from Accept header)
 *   fit    — sharp fit mode: cover, contain, fill, inside, outside (default: cover)
 */

require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const express = require("express");
const crypto = require("crypto");
const sharp = require("sharp");
const NodeCache = require("node-cache");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const nodemailer = require("nodemailer");

// ─────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────

const {
  FRAPPE_BASE_URL,
  ACCESS_TOKEN,
  API_KEY,
  API_SECRET,
  FRAPPE_USER,
  FRAPPE_PASS,
  PORT = 3001,
  CACHE_TTL = 3600,
  ALLOWED_ORIGINS = "*",
  MAX_CACHE_KEYS = 1000,
} = process.env;

if (!FRAPPE_BASE_URL) {
  console.error("[FATAL] Missing required env var: FRAPPE_BASE_URL");
  process.exit(1);
}
if (!ACCESS_TOKEN) {
  console.error("[FATAL] Missing required env var: ACCESS_TOKEN");
  process.exit(1);
}

// ─────────────────────────────────────────────
// Cache — stores processed image buffers keyed by url+params
// ─────────────────────────────────────────────

const cache = new NodeCache({
  stdTTL: Number(CACHE_TTL),
  maxKeys: Number(MAX_CACHE_KEYS),
  checkperiod: 120,
  useClones: false,
});

// Track original image bytes fetched vs optimized bytes served
let stats = { originalBytes: 0, optimizedBytes: 0, processed: 0 };

// ─────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const origins = ALLOWED_ORIGINS === "*" ? "*" : ALLOWED_ORIGINS.split(",").map((s) => s.trim());
app.use(cors({ origin: origins, methods: ["GET", "POST", "DELETE"], maxAge: 86400 }));

app.use(morgan(":date[iso] :method :url :status :res[content-length] - :response-time ms"));

app.use(express.json());

app.set("trust proxy", 1);

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const VALID_FORMATS = new Set(["webp", "jpeg", "jpg", "png", "avif"]);
const VALID_FITS = new Set(["cover", "contain", "fill", "inside", "outside"]);
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i;

const isValidFileUrl = (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== "string") return false;
  if (!fileUrl.startsWith("/files/") && !fileUrl.startsWith("/private/files/")) return false;
  if (fileUrl.includes("..") || fileUrl.includes("//")) return false;
  if (fileUrl.includes("\0")) return false;
  const parts = fileUrl.split("/");
  const filename = parts[parts.length - 1];
  if (!filename || filename.length > 255) return false;
  return true;
};

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// ─────────────────────────────────────────────
// Auth middleware — validates proxy access token
// ─────────────────────────────────────────────

const authenticate = (req, res, next) => {
  const token = req.query.token || req.headers["x-proxy-token"];
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Provide token query param or X-Proxy-Token header." });
  }
  try {
    if (crypto.timingSafeEqual(Buffer.from(String(token)), Buffer.from(ACCESS_TOKEN))) {
      return next();
    }
  } catch { /* length mismatch */ }
  console.warn(`[AUTH] Invalid token from ${req.ip}`);
  return res.status(403).json({ error: "Invalid access token" });
};

// ─────────────────────────────────────────────
// Rate limiting (per-IP)
// ─────────────────────────────────────────────

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 200;

const rateLimit = (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { windowStart: now, count: 1 });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    console.warn(`[RATE] Limit exceeded for ${req.ip}`);
    return res.status(429).json({ error: "Too many requests" });
  }
  return next();
};

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW * 2);

// ─────────────────────────────────────────────
// Image processing with sharp
// ─────────────────────────────────────────────

const processImage = async (inputBuffer, { width, height, quality, format, fit }) => {
  let pipeline = sharp(inputBuffer, { failOn: "none", animated: false });

  // Get metadata to avoid upscaling
  const metadata = await pipeline.metadata();

  // Only resize if dimensions are specified and smaller than original
  if (width || height) {
    const targetW = width ? Math.min(width, metadata.width || width) : undefined;
    const targetH = height ? Math.min(height, metadata.height || height) : undefined;
    pipeline = pipeline.resize(targetW, targetH, {
      fit: fit || "cover",
      withoutEnlargement: true,
    });
  }

  // Convert format and set quality
  const q = quality || 80;
  switch (format) {
    case "webp":
      pipeline = pipeline.webp({ quality: q, effort: 4 });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality: q, effort: 4 });
      break;
    case "png":
      pipeline = pipeline.png({ quality: q, compressionLevel: 6 });
      break;
    case "jpeg":
    case "jpg":
    default:
      pipeline = pipeline.jpeg({ quality: q, mozjpeg: true });
      break;
  }

  return pipeline.toBuffer();
};

/**
 * Determine the best output format based on Accept header and requested format.
 */
const negotiateFormat = (acceptHeader, requestedFormat, originalUrl) => {
  if (requestedFormat && VALID_FORMATS.has(requestedFormat)) {
    return requestedFormat === "jpg" ? "jpeg" : requestedFormat;
  }

  // Auto-negotiate: prefer WebP if browser supports it
  if (acceptHeader && acceptHeader.includes("image/webp")) {
    return "webp";
  }

  // Fall back to original format or JPEG
  const ext = originalUrl.split(".").pop()?.toLowerCase();
  if (ext === "png") return "png";
  if (ext === "gif") return "jpeg"; // sharp converts GIF to static
  return "jpeg";
};

const FORMAT_TO_CONTENT_TYPE = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
};

// ─────────────────────────────────────────────
// Frappe Session Management
// ─────────────────────────────────────────────

let frappeSessionCookie = null;
let sessionInitPromise = null;

const initFrappeSession = async () => {
  if (frappeSessionCookie) return frappeSessionCookie;
  if (sessionInitPromise) return sessionInitPromise;

  sessionInitPromise = (async () => {
    try {
      console.log("[SESSION] Logging in to Frappe...");
      const response = await fetch(
        `${FRAPPE_BASE_URL}/api/method/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `usr=${encodeURIComponent(FRAPPE_USER)}&pwd=${encodeURIComponent(FRAPPE_PASS)}`,
          redirect: "manual",
        }
      );

      if (response.ok || response.status === 302) {
        // Extract sid cookie from response
        const setCookies = response.headers.getSetCookie?.() || [];
        const raw = response.headers.raw?.();
        const cookieHeaders = setCookies.length > 0
          ? setCookies
          : (raw?.["set-cookie"] || []);

        for (const cookie of cookieHeaders) {
          const sidMatch = cookie.match(/sid=([^;]+)/);
          if (sidMatch && sidMatch[1] !== "Guest") {
            frappeSessionCookie = `sid=${sidMatch[1]}`;
            console.log("[SESSION] Frappe session established successfully");
            return frappeSessionCookie;
          }
        }
        console.warn("[SESSION] No valid sid cookie in response");
      } else {
        console.warn(`[SESSION] Login failed: HTTP ${response.status}`);
      }
    } catch (err) {
      console.error("[SESSION] Error establishing session:", err.message);
    }
    sessionInitPromise = null;
    return null;
  })();

  return sessionInitPromise;
};

// Re-establish session periodically (every 4 hours)
setInterval(() => {
  frappeSessionCookie = null;
  sessionInitPromise = null;
  initFrappeSession();
}, 4 * 60 * 60 * 1000);

// ─────────────────────────────────────────────
// Fetch image from Frappe
// ─────────────────────────────────────────────

const fetchFromFrappe = async (fileUrl) => {
  const isPrivate = fileUrl.startsWith("/private/");

  let fetchUrl;
  const headers = { Accept: "image/*,*/*" };

  if (isPrivate) {
    // Private files: use download_file API with session cookie auth
    fetchUrl = `${FRAPPE_BASE_URL}/api/method/frappe.core.doctype.file.file.download_file?file_url=${encodeURIComponent(fileUrl)}`;

    // Try session cookie auth first (Frappe requires this for download_file)
    const cookie = await initFrappeSession();
    if (cookie) {
      headers["Cookie"] = cookie;
    }
    // Also send token auth as fallback
    if (API_KEY && API_SECRET) {
      headers["Authorization"] = `token ${API_KEY}:${API_SECRET}`;
    }
  } else {
    // Public files can be fetched directly
    fetchUrl = `${FRAPPE_BASE_URL}${fileUrl}`;
  }

  const response = await fetch(fetchUrl, { headers, redirect: "follow" });

  if (!response.ok) {
    // If 403 on private file, session may have expired — retry with fresh session
    if (response.status === 403 && isPrivate && frappeSessionCookie) {
      console.log("[FETCH] Session expired, re-authenticating...");
      frappeSessionCookie = null;
      sessionInitPromise = null;
      const newCookie = await initFrappeSession();
      if (newCookie) {
        headers["Cookie"] = newCookie;
        const retry = await fetch(fetchUrl, { headers, redirect: "follow" });
        if (retry.ok) {
          const arrayBuffer = await retry.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.length === 0) throw new Error("Empty response from upstream");
          return { buffer, contentType: retry.headers.get("content-type") || "application/octet-stream" };
        }
      }
    }
    const error = new Error(`Upstream ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error("Empty response from upstream");
  }

  return {
    buffer,
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
};

// ─────────────────────────────────────────────
// Main endpoint: GET /image
// ─────────────────────────────────────────────

app.get("/image", rateLimit, authenticate, async (req, res) => {
  const fileUrl = req.query.url;

  if (!isValidFileUrl(fileUrl)) {
    return res.status(400).json({
      error: "Invalid url. Must start with /files/ or /private/files/ and contain no path traversal.",
    });
  }

  // Parse and validate query params
  const width = req.query.w ? clamp(parseInt(req.query.w, 10), 10, 2000) : null;
  const height = req.query.h ? clamp(parseInt(req.query.h, 10), 10, 2000) : null;
  const quality = req.query.q ? clamp(parseInt(req.query.q, 10), 1, 100) : 80;
  const fit = req.query.fit && VALID_FITS.has(req.query.fit) ? req.query.fit : "cover";
  const format = negotiateFormat(req.headers.accept, req.query.format, fileUrl);

  // Check if this is an image file
  if (!IMAGE_EXTENSIONS.test(fileUrl)) {
    return res.status(400).json({ error: "Not an image file" });
  }

  // Build cache key from URL + processing params
  const cacheKey = `${fileUrl}|${width || ""}|${height || ""}|${quality}|${format}|${fit}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    res.set("Content-Type", cached.contentType);
    res.set("Content-Length", String(cached.buffer.length));
    res.set("X-Cache", "HIT");
    res.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
    res.set("Vary", "Accept");
    return res.send(cached.buffer);
  }

  try {
    // Fetch original image from Frappe
    const original = await fetchFromFrappe(fileUrl);
    stats.originalBytes += original.buffer.length;

    // Process with sharp
    const optimized = await processImage(original.buffer, {
      width: width ? Number(width) : null,
      height: height ? Number(height) : null,
      quality,
      format,
      fit,
    });

    stats.optimizedBytes += optimized.length;
    stats.processed++;

    const contentType = FORMAT_TO_CONTENT_TYPE[format] || "image/jpeg";

    // Cache the processed image
    cache.set(cacheKey, { buffer: optimized, contentType });

    const savings = ((1 - optimized.length / original.buffer.length) * 100).toFixed(0);
    console.log(
      `[OPTIMIZED] ${fileUrl} ${(original.buffer.length / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB (${savings}% smaller) [${width || "auto"}x${height || "auto"} ${format} q${quality}]`
    );

    res.set("Content-Type", contentType);
    res.set("Content-Length", String(optimized.length));
    res.set("X-Cache", "MISS");
    res.set("X-Original-Size", String(original.buffer.length));
    res.set("X-Optimized-Size", String(optimized.length));
    res.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
    res.set("Vary", "Accept");
    return res.send(optimized);
  } catch (err) {
    console.error(`[ERROR] ${fileUrl}: ${err.message}`);
    if (err.status === 404) return res.status(404).json({ error: "File not found" });
    if (err.status === 403) return res.status(403).json({ error: "Access denied by backend" });
    return res.status(502).json({ error: "Failed to process image" });
  }
});

// ─────────────────────────────────────────────
// Email — send OTP emails via SMTP (Gmail / custom)
// ─────────────────────────────────────────────

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

let emailTransporter = null;
if (SMTP_USER && SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
  emailTransporter.verify()
    .then(() => console.log("[EMAIL] SMTP transporter ready"))
    .catch((err) => console.error("[EMAIL] SMTP verification failed:", err.message));
}

app.post("/send-email", rateLimit, async (req, res) => {
  if (!emailTransporter) {
    return res.status(503).json({ error: "Email not configured" });
  }

  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: "to, subject, and html are required" });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  try {
    const info = await emailTransporter.sendMail({
      from: `"CPMTS Taita Taveta" <${SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL] Sent to ${to.replace(/(.{2}).*(@.*)/, "$1***$2")}: ${info.messageId}`);
    return res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error(`[EMAIL] Error sending to ${to}:`, err.message);
    return res.status(502).json({ error: "Failed to send email" });
  }
});

// ─────────────────────────────────────────────
// SMS Proxy — avoids CORS when calling TextSMS from browser
// ─────────────────────────────────────────────

const SMS_GATEWAY_URL = "https://sms.textsms.co.ke/api/services/sendsms/?";
const SMS_API_KEY_VAL = "bb4fd5a44fd916edceb8605412ce6794";
const SMS_PARTNER_ID = "14137";
const SMS_SHORTCODE = "TextSMS";

app.use(express.json());

app.post("/send-sms", rateLimit, async (req, res) => {
  const { mobile, message } = req.body;
  if (!mobile || !message) {
    return res.status(400).json({ error: "mobile and message are required" });
  }

  // Basic validation
  const cleanMobile = mobile.replace(/[^\d]/g, "");
  if (cleanMobile.length < 10 || cleanMobile.length > 15) {
    return res.status(400).json({ error: "Invalid mobile number" });
  }

  try {
    const params = new URLSearchParams({
      apikey: SMS_API_KEY_VAL,
      partnerID: SMS_PARTNER_ID,
      message,
      shortcode: SMS_SHORTCODE,
      mobile: cleanMobile,
    });

    const response = await fetch(`${SMS_GATEWAY_URL}${params.toString()}`);
    const result = await response.json();
    console.log(`[SMS] Sent to ${cleanMobile.slice(0, 6)}***: ${JSON.stringify(result)}`);
    return res.json(result);
  } catch (err) {
    console.error(`[SMS] Error:`, err.message);
    return res.status(502).json({ error: "SMS gateway unreachable" });
  }
});

// ─────────────────────────────────────────────
// Frappe API Proxy — keeps API credentials server-side
// ─────────────────────────────────────────────

const ALLOWED_DOCTYPES = new Set([
  "ProjectX",
  "ProjectX PMC",
  "ProjectX Gallery",
  "ProjectX Feedback",
  "ProjectX Document",
  "Project Investments",
  "User",
]);

const ALLOWED_API_METHODS = new Set([
  "frappe.auth.get_logged_user",
  "frappe.core.doctype.communication.email.make",
]);

app.all("/frappe-api/*", rateLimit, async (req, res) => {
  try {
    const subPath = req.params[0]; // everything after /frappe-api/

    // Validate: resource endpoints
    if (subPath.startsWith("resource/")) {
      const resourcePath = subPath.slice("resource/".length);
      const slashIdx = resourcePath.indexOf("/");
      const doctype = decodeURIComponent(
        slashIdx === -1 ? resourcePath : resourcePath.slice(0, slashIdx)
      );
      if (!ALLOWED_DOCTYPES.has(doctype)) {
        console.warn(`[FRAPPE-API] Blocked access to doctype: ${doctype}`);
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (subPath.startsWith("method/")) {
      const method = subPath.slice("method/".length);
      if (!ALLOWED_API_METHODS.has(method)) {
        console.warn(`[FRAPPE-API] Blocked access to method: ${method}`);
        return res.status(403).json({ error: "Access denied" });
      }
    } else {
      return res.status(400).json({ error: "Invalid API path" });
    }

    // Build target URL
    const targetUrl = new URL(`/api/${subPath}`, FRAPPE_BASE_URL);
    for (const [key, value] of Object.entries(req.query)) {
      targetUrl.searchParams.set(key, String(value));
    }

    const headers = {
      Authorization: `token ${API_KEY}:${API_SECRET}`,
      Accept: "application/json",
    };

    const fetchOpts = { method: req.method, headers };

    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      headers["Content-Type"] = "application/json";
      fetchOpts.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl.toString(), fetchOpts);
    const contentType = upstream.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).set("Content-Type", contentType).send(buffer);
  } catch (err) {
    console.error("[FRAPPE-API] Proxy error:", err.message);
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// ─────────────────────────────────────────────
// File Download Proxy — for private Frappe files
// ─────────────────────────────────────────────

app.get("/frappe-file", rateLimit, async (req, res) => {
  const fileUrl = req.query.url;
  if (!fileUrl || typeof fileUrl !== "string") {
    return res.status(400).json({ error: "url parameter required" });
  }
  if (!fileUrl.startsWith("/files/") && !fileUrl.startsWith("/private/files/")) {
    return res.status(400).json({ error: "Invalid file path" });
  }
  if (fileUrl.includes("..") || fileUrl.includes("\0")) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  try {
    const isPrivate = fileUrl.startsWith("/private/");
    let fetchUrl;
    const headers = {};

    if (isPrivate) {
      fetchUrl = `${FRAPPE_BASE_URL}/api/method/frappe.core.doctype.file.file.download_file?file_url=${encodeURIComponent(fileUrl)}`;
      const cookie = await initFrappeSession();
      if (cookie) headers["Cookie"] = cookie;
      if (API_KEY && API_SECRET) headers["Authorization"] = `token ${API_KEY}:${API_SECRET}`;
    } else {
      fetchUrl = `${FRAPPE_BASE_URL}${fileUrl}`;
    }

    const upstream = await fetch(fetchUrl, { headers, redirect: "follow" });
    if (!upstream.ok) {
      if (upstream.status === 403 && isPrivate && frappeSessionCookie) {
        // Session expired, retry
        frappeSessionCookie = null;
        sessionInitPromise = null;
        const newCookie = await initFrappeSession();
        if (newCookie) {
          headers["Cookie"] = newCookie;
          const retry = await fetch(fetchUrl, { headers, redirect: "follow" });
          if (retry.ok) {
            const buffer = Buffer.from(await retry.arrayBuffer());
            const ct = retry.headers.get("content-type") || "application/octet-stream";
            res.set("Content-Type", ct);
            res.set("Content-Length", String(buffer.length));
            res.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
            return res.send(buffer);
          }
        }
      }
      return res.status(upstream.status).json({ error: "File not found" });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    res.set("Content-Type", ct);
    res.set("Content-Length", String(buffer.length));
    res.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
    res.send(buffer);
  } catch (err) {
    console.error("[FRAPPE-FILE] Error:", err.message);
    res.status(502).json({ error: "File download failed" });
  }
});

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────

app.get("/health", (req, res) => {
  const totalSaved = stats.originalBytes - stats.optimizedBytes;
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    cache: {
      keys: cache.keys().length,
      hits: cache.getStats().hits,
      misses: cache.getStats().misses,
    },
    optimization: {
      imagesProcessed: stats.processed,
      originalMB: (stats.originalBytes / 1048576).toFixed(1),
      optimizedMB: (stats.optimizedBytes / 1048576).toFixed(1),
      savedMB: (totalSaved / 1048576).toFixed(1),
      savingsPercent: stats.originalBytes > 0
        ? ((totalSaved / stats.originalBytes) * 100).toFixed(0)
        : "0",
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

app.listen(Number(PORT), () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║       Frappe Image Optimization Proxy            ║
╠══════════════════════════════════════════════════╣
║  Port:        ${String(PORT).padEnd(34)}║
║  Backend:     ${FRAPPE_BASE_URL.slice(0, 34).padEnd(34)}║
║  Cache TTL:   ${String(CACHE_TTL + "s").padEnd(34)}║
║  Max cached:  ${String(MAX_CACHE_KEYS).padEnd(34)}║
║  Sharp:       ${("v" + sharp.versions.sharp).padEnd(34)}║
╚══════════════════════════════════════════════════╝
  `);

  // Pre-establish Frappe session for private file access
  initFrappeSession().then((cookie) => {
    if (cookie) {
      console.log("[STARTUP] Frappe session ready for private file access");
    } else {
      console.warn("[STARTUP] Could not establish Frappe session — private files may fail");
    }
  });
});
