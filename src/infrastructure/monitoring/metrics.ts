import type { Application, NextFunction, Request, Response } from "express";
import * as client from "prom-client";
import { metricsEnabled, metricsPath } from "../../config/env";

const serviceName = "chat-community";
const metricPrefix = "chat_community_";

client.collectDefaultMetrics({
  prefix: metricPrefix,
  labels: {
    service: serviceName,
  },
});

const httpRequestDurationSeconds = new client.Histogram({
  name: `${metricPrefix}http_request_duration_seconds`,
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestsTotal = new client.Counter({
  name: `${metricPrefix}http_requests_total`,
  help: "Total number of HTTP requests.",
  labelNames: ["method", "route", "status_code"] as const,
});

const activeHttpRequests = new client.Gauge({
  name: `${metricPrefix}http_active_requests`,
  help: "Number of active HTTP requests.",
  labelNames: ["method"] as const,
});

function getRouteLabel(req: Request): string {
  if (req.route?.path) {
    return `${req.baseUrl}${String(req.route.path)}` || "/";
  }

  return req.path === metricsPath ? metricsPath : "unmatched";
}

function getDurationSeconds(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
}

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!metricsEnabled || req.path === metricsPath) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  const method = req.method;
  activeHttpRequests.inc({ method });

  res.on("finish", () => {
    const route = getRouteLabel(req);
    const statusCode = String(res.statusCode);
    const labels = { method, route, status_code: statusCode };

    activeHttpRequests.dec({ method });
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, getDurationSeconds(startedAt));
  });

  next();
}

export function setupMonitoring(app: Application) {
  if (!metricsEnabled) {
    return;
  }

  app.use(metricsMiddleware);
  app.get(metricsPath, async (_req, res) => {
    res.setHeader("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  });
}
