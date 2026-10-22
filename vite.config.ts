import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import type {IncomingMessage, ServerResponse} from 'node:http';

type GaiaSkyReply = {
  success?: boolean;
  value?: unknown;
  text?: string;
};

type BridgeCommand =
  | {name: 'status'}
  | {name: 'focus-object'; objectName: string}
  | {name: 'set-year'; year: number}
  | {name: 'point-at-sky-coordinate'; raDeg: number; decDeg: number};

const sendJson = (response: ServerResponse, statusCode: number, body: unknown) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

const isLoopbackHost = (value: string | undefined): boolean =>
  Boolean(value && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(value));

const readJsonBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  let raw = '';
  for await (const chunk of request) {
    raw += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    if (raw.length > 4096) throw new Error('Request body is too large.');
  }
  if (!raw.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
};

const gaiaSkyRestBridge = (): Plugin => ({
  name: 'neuropulse-gaiasky-local-bridge',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const requestUrl = new URL(request.url || '/', 'http://localhost');
      if (!requestUrl.pathname.startsWith('/api/gaiasky/')) {
        next();
        return;
      }

      void (async () => {
        // This bridge can control a local desktop process, so never accept LAN or remote-page traffic.
        if (!isLoopbackHost(request.headers.host)) {
          sendJson(response, 403, {success: false, message: 'Gaia Sky bridge is restricted to localhost.'});
          return;
        }
        const originHeader = request.headers.origin;
        if (originHeader) {
          let origin: URL;
          try {
            origin = new URL(originHeader);
          } catch {
            sendJson(response, 403, {success: false, message: 'Invalid request origin.'});
            return;
          }
          if (origin.protocol !== 'http:' || !isLoopbackHost(origin.host)) {
            sendJson(response, 403, {success: false, message: 'Gaia Sky bridge only accepts localhost origins.'});
            return;
          }
        }

        const portValue = Number(process.env.GAIASKY_REST_PORT || 34487);
        if (!Number.isInteger(portValue) || portValue < 1024 || portValue > 65535) {
          sendJson(response, 500, {success: false, message: 'GAIASKY_REST_PORT must be a valid TCP port.'});
          return;
        }
        const upstreamBase = `http://127.0.0.1:${portValue}`;
        const pathname = requestUrl.pathname.replace(/^\/api\/gaiasky\//, '');
        const statusRequest = pathname === 'status';
        const allowedActions = new Set(['focus-object', 'set-year', 'point-at-sky-coordinate']);

        if (statusRequest && request.method !== 'GET') {
          sendJson(response, 405, {success: false, message: 'Use GET for the Gaia Sky status check.'});
          return;
        }
        if (!statusRequest && (!allowedActions.has(pathname) || request.method !== 'POST')) {
          sendJson(response, 404, {success: false, message: 'Unsupported Gaia Sky bridge action.'});
          return;
        }

        let command: BridgeCommand;
        try {
          if (statusRequest) {
            command = {name: 'status'};
          } else {
            const body = await readJsonBody(request);
            if (pathname === 'focus-object') {
              const objectName = typeof body.objectName === 'string' ? body.objectName.trim() : '';
              if (!objectName || objectName.length > 120 || /[\u0000-\u001f\u007f]/.test(objectName)) {
                sendJson(response, 400, {success: false, message: 'Enter a valid Gaia Sky object name (1–120 characters).'});
                return;
              }
              command = {name: 'focus-object', objectName};
            } else if (pathname === 'set-year') {
              const year = body.year;
              if (typeof year !== 'number' || !Number.isInteger(year) || year < -10000 || year > 9999) {
                sendJson(response, 400, {success: false, message: 'Year must be an integer from 10,000 BCE through 9999 CE.'});
                return;
              }
              command = {name: 'set-year', year};
            } else {
              const raDeg = body.raDeg;
              const decDeg = body.decDeg;
              if (
                typeof raDeg !== 'number' || !Number.isFinite(raDeg) || raDeg < 0 || raDeg > 360 ||
                typeof decDeg !== 'number' || !Number.isFinite(decDeg) || decDeg < -90 || decDeg > 90
              ) {
                sendJson(response, 400, {success: false, message: 'RA must be 0–360 degrees and declination must be -90–90 degrees.'});
                return;
              }
              command = {name: 'point-at-sky-coordinate', raDeg, decDeg};
            }
          }

          const upstreamPath = command.name === 'status'
            ? '/apiv2/time/get_clock'
            : command.name === 'focus-object'
              ? '/apiv2/camera/go_to_object_instant'
              : command.name === 'set-year'
                ? '/apiv2/time/set_clock'
                : '/apiv2/camera/point_at_sky_coordinate';

          const parameters = new URLSearchParams();
          if (command.name === 'focus-object') {
            parameters.set('name', command.objectName);
          } else if (command.name === 'set-year') {
            // Build UTC noon without Date.UTC's special handling of years 0–99.
            const date = new Date(0);
            date.setUTCFullYear(command.year, 0, 1);
            date.setUTCHours(12, 0, 0, 0);
            parameters.set('time', String(date.getTime()));
          } else if (command.name === 'point-at-sky-coordinate') {
            // Gaia Sky's current API declares these parameters as long integers in degrees.
            parameters.set('ra', String(Math.round(command.raDeg)));
            parameters.set('dec', String(Math.round(command.decDeg)));
          }

          const upstreamUrl = parameters.size
            ? `${upstreamBase}${upstreamPath}?${parameters.toString()}`
            : `${upstreamBase}${upstreamPath}`;
          const upstreamResponse = await fetch(upstreamUrl, {
            method: command.name === 'status' ? 'GET' : 'POST',
            signal: AbortSignal.timeout(3500),
          });
          const rawResponse = await upstreamResponse.text();
          let payload: GaiaSkyReply;
          try {
            payload = JSON.parse(rawResponse) as GaiaSkyReply;
          } catch {
            payload = {success: false, text: rawResponse.slice(0, 300)};
          }

          if (!upstreamResponse.ok || payload.success === false) {
            sendJson(response, 502, {
              success: false,
              message: payload.text || `Gaia Sky returned HTTP ${upstreamResponse.status}.`,
            });
            return;
          }

          sendJson(response, 200, {
            success: true,
            connected: true,
            action: command.name,
            simulationTimeUtc: command.name === 'status' ? payload.value : undefined,
            message: command.name === 'status'
              ? 'Connected to Gaia Sky REST API.'
              : command.name === 'focus-object'
                ? `Sent focus command for ${command.objectName}.`
                : command.name === 'set-year'
                  ? `Set Gaia Sky simulation time to year ${command.year}.`
                  : 'Sent sky-coordinate navigation command.',
            resultText: payload.text,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown bridge error.';
          const isConnectionFailure = /fetch failed|ECONNREFUSED|timed out|aborted/i.test(message);
          sendJson(response, isConnectionFailure ? 503 : 400, {
            success: false,
            connected: false,
            message: isConnectionFailure
              ? `Gaia Sky REST API not reachable at 127.0.0.1:${portValue}. Start Gaia Sky and enable its localhost-only REST server.`
              : message,
          });
        }
      })().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unexpected Gaia Sky bridge error.';
        if (!response.headersSent) sendJson(response, 500, {success: false, message});
        else response.end();
      });
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), gaiaSkyRestBridge()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
