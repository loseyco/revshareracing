import { NextResponse } from "next/server";

/**
 * GET /api/v1/health
 * Health check endpoint - returns API status and version info.
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    version: "1.0.0",
    api: "iRCommander API",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        login: "POST /api/v1/auth/login",
        register: "POST /api/v1/auth/register",
        refresh: "POST /api/v1/auth/refresh",
        me: "GET /api/v1/auth/me"
      },
      devices: {
        list: "GET /api/v1/devices",
        get: "GET /api/v1/devices/:id",
        status: "GET /api/v1/devices/:id/status",
        queue: "GET/POST/DELETE /api/v1/devices/:id/queue",
        activate: "POST /api/v1/devices/:id/queue/activate",
        complete: "POST /api/v1/devices/:id/queue/complete",
        laps: "GET/POST /api/v1/devices/:id/laps"
      },
      leaderboards: {
        get: "GET /api/v1/leaderboards"
      },
      credits: {
        balance: "GET /api/v1/credits/balance",
        purchase: "POST /api/v1/credits/purchase"
      }
    }
  });
}

