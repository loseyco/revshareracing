import Link from "next/link";

export default function IntegrationPage() {
  return (
    <main className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/help"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Help
          </Link>
          <h1 className="text-4xl font-semibold text-white mb-2">Building Child Sites</h1>
          <p className="text-lg text-neutral-400">
            Complete guide for building sites that integrate with iRCommander APIs
          </p>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
          <div className="prose prose-invert max-w-none text-neutral-300 space-y-4">
            <p>
              Child sites like <strong>RevShareRacing</strong> are user-facing applications that consume 
              iRCommander APIs to provide sim racing experiences. This guide will help you build your own 
              child site from scratch.
            </p>
            <p>
              By using iRCommander as the backend, you can focus on building a great user experience while 
              leveraging robust infrastructure for device management, queues, telemetry, and more.
            </p>
          </div>
        </section>

        {/* Architecture */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Architecture Overview</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <div className="space-y-4 text-neutral-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold">1</div>
                <div>
                  <strong className="text-white">Your Child Site</strong> (Frontend + Backend)
                  <p className="text-sm text-neutral-400 mt-1">Next.js, React, Vue, or any framework</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold">2</div>
                <div>
                  <strong className="text-white">iRCommander API</strong> (Mother Site)
                  <p className="text-sm text-neutral-400 mt-1">https://ircommander.gridpass.app/api/v1</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold">3</div>
                <div>
                  <strong className="text-white">Shared Infrastructure</strong>
                  <p className="text-sm text-neutral-400 mt-1">Devices, queues, telemetry, databases</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 1: Setup */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Step 1: Get Your Tenant API Key</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <p className="text-sm text-neutral-300">
              Before building your child site, you need a tenant API key from iRCommander. This key authenticates 
              your site and scopes all API calls to your tenant.
            </p>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/50">
              <p className="text-sm text-blue-300">
                <strong>Contact the iRCommander admin</strong> to get your tenant API key. You'll need:
              </p>
              <ul className="list-disc list-inside text-sm text-blue-300 mt-2 space-y-1">
                <li>Your site name (e.g., "RevShareRacing")</li>
                <li>Your site domain</li>
                <li>Any specific requirements or settings</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Store Your API Key Securely</h3>
              <p className="text-sm text-neutral-300 mb-3">
                Store your tenant API key as an environment variable. Never commit it to version control.
              </p>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`.env.local
IRC_API_KEY=irc_tenant_your_api_key_here
IRC_API_BASE_URL=https://ircommander.gridpass.app/api/v1`}
              </pre>
            </div>
          </div>
        </section>

        {/* Step 2: API Client Setup */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Step 2: Create API Client</h2>
          <div className="space-y-6">
            <ExampleCard
              title="TypeScript/JavaScript API Client"
              language="typescript"
              code={`// lib/irc-api.ts
const API_BASE_URL = process.env.IRC_API_BASE_URL || 'https://ircommander.gridpass.app/api/v1';
const TENANT_API_KEY = process.env.IRC_API_KEY;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class IRCommanderAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.apiKey = TENANT_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('IRC_API_KEY environment variable is required');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = \`\${this.baseUrl}\${endpoint}\`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': this.apiKey,
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || data.error || 'API request failed');
    }

    return data;
  }

  // Device methods
  async getDevices() {
    return this.request('/devices');
  }

  async getDevice(deviceId: string) {
    return this.request(\`/devices/\${deviceId}\`);
  }

  async getDeviceStatus(deviceId: string) {
    return this.request(\`/devices/\${deviceId}/status\`);
  }

  // Queue methods (requires user authentication)
  async getQueue(deviceId: string, userToken: string) {
    return this.request(\`/devices/\${deviceId}/queue\`, {
      headers: {
        'Authorization': \`Bearer \${userToken}\`,
      },
    });
  }

  async joinQueue(deviceId: string, userToken: string) {
    return this.request(\`/devices/\${deviceId}/queue\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${userToken}\`,
      },
    });
  }

  async leaveQueue(deviceId: string, userToken: string) {
    return this.request(\`/devices/\${deviceId}/queue\`, {
      method: 'DELETE',
      headers: {
        'Authorization': \`Bearer \${userToken}\`,
      },
    });
  }

  async activateQueue(deviceId: string, userToken: string) {
    return this.request(\`/devices/\${deviceId}/queue/activate\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${userToken}\`,
      },
    });
  }

  // Stats methods
  async getLapStats(filters?: {
    start_date?: string;
    end_date?: string;
    track?: string;
  }) {
    const params = new URLSearchParams(filters);
    return this.request(\`/stats/laps?\${params}\`);
  }

  // Leaderboards
  async getLeaderboards(filters?: {
    track?: string;
    car?: string;
    limit?: number;
  }) {
    const params = new URLSearchParams(filters);
    return this.request(\`/leaderboards?\${params}\`);
  }
}

export const ircAPI = new IRCommanderAPI();`}
            />
          </div>
        </section>

        {/* Step 3: User Authentication */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Step 3: User Authentication</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <p className="text-sm text-neutral-300">
              For user-facing features (queues, sessions, credits), users need to authenticate with iRCommander. 
              You have two options:
            </p>
            
            <div className="space-y-4">
              <AuthOption
                title="Option 1: Direct iRCommander Auth"
                description="Users register/login directly with iRCommander. Your site redirects to iRCommander auth pages."
                pros={[
                  "No user management needed",
                  "Shared user accounts across child sites",
                  "Simpler implementation"
                ]}
                cons={[
                  "Users leave your site for auth",
                  "Less control over user experience"
                ]}
              />
              
              <AuthOption
                title="Option 2: Proxy Authentication"
                description="Your site handles registration/login UI, then proxies to iRCommander APIs."
                pros={[
                  "Full control over UX",
                  "Users stay on your site",
                  "Can add custom fields/features"
                ]}
                cons={[
                  "More complex implementation",
                  "You handle auth UI/validation"
                ]}
              />
            </div>

            <ExampleCard
              title="Authentication Proxy Example (Next.js API Route)"
              language="typescript"
              code={`// app/api/auth/login/route.ts (Next.js App Router)
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Proxy to iRCommander
    const response = await fetch('https://ircommander.gridpass.app/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Login failed' },
        { status: response.status }
      );
    }

    // Store tokens in httpOnly cookies or return to client
    const { access_token, refresh_token, user } = data.data;

    // Set cookies (example)
    const cookieResponse = NextResponse.json({ user });
    cookieResponse.cookies.set('irc_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    cookieResponse.cookies.set('irc_refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return cookieResponse;
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}`}
            />
          </div>
        </section>

        {/* Step 4: Common Patterns */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Step 4: Common Integration Patterns</h2>
          
          <div className="space-y-6">
            <PatternCard
              title="Device List Page"
              description="Display available racing rigs to users"
              code={`// Example: Device List Component
'use client';

import { useEffect, useState } from 'react';
import { ircAPI } from '@/lib/irc-api';

export default function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDevices() {
      try {
        const response = await ircAPI.getDevices();
        if (response.success) {
          setDevices(response.data || []);
        }
      } catch (error) {
        console.error('Failed to load devices:', error);
      } finally {
        setLoading(false);
      }
    }
    loadDevices();
  }, []);

  if (loading) return <div>Loading devices...</div>;

  return (
    <div>
      <h1>Available Racing Rigs</h1>
      {devices.map((device) => (
        <div key={device.device_id}>
          <h2>{device.name}</h2>
          <p>Status: {device.status}</p>
          <a href={\`/devices/\${device.device_id}\`}>View Details</a>
        </div>
      ))}
    </div>
  );
}`}
            />

            <PatternCard
              title="Queue Management"
              description="Allow users to join queues and activate sessions"
              code={`// Example: Queue Component
'use client';

import { useEffect, useState } from 'react';
import { ircAPI } from '@/lib/irc-api';
import { getUserToken } from '@/lib/auth'; // Your auth helper

export default function QueueComponent({ deviceId }: { deviceId: string }) {
  const [queue, setQueue] = useState(null);
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    async function loadQueue() {
      const token = getUserToken();
      if (!token) return;

      try {
        const response = await ircAPI.getQueue(deviceId, token);
        if (response.success) {
          setQueue(response.data);
          setPosition(response.data.current_user_position);
        }
      } catch (error) {
        console.error('Failed to load queue:', error);
      }
    }

    loadQueue();
    const interval = setInterval(loadQueue, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [deviceId]);

  const handleJoinQueue = async () => {
    const token = getUserToken();
    if (!token) {
      alert('Please log in first');
      return;
    }

    try {
      const response = await ircAPI.joinQueue(deviceId, token);
      if (response.success) {
        setPosition(response.data.position);
      }
    } catch (error) {
      alert('Failed to join queue');
    }
  };

  const handleActivate = async () => {
    const token = getUserToken();
    if (!token) return;

    try {
      await ircAPI.activateQueue(deviceId, token);
      alert('Session activated!');
    } catch (error) {
      alert('Failed to activate session');
    }
  };

  return (
    <div>
      <h2>Queue Status</h2>
      {position !== null ? (
        <div>
          <p>Your position: {position + 1}</p>
          {position === 0 && (
            <button onClick={handleActivate}>Activate Session</button>
          )}
        </div>
      ) : (
        <button onClick={handleJoinQueue}>Join Queue</button>
      )}
    </div>
  );
}`}
            />

            <PatternCard
              title="Leaderboard Display"
              description="Show lap times and leaderboards"
              code={`// Example: Leaderboard Component
'use client';

import { useEffect, useState } from 'react';
import { ircAPI } from '@/lib/irc-api';

export default function Leaderboard({ track, car }: { track?: string; car?: string }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const response = await ircAPI.getLeaderboards({ track, car, limit: 100 });
        if (response.success) {
          setLeaderboard(response.data || []);
        }
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    }
    loadLeaderboard();
  }, [track, car]);

  if (loading) return <div>Loading...</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Driver</th>
          <th>Time</th>
          <th>Track</th>
          <th>Car</th>
        </tr>
      </thead>
      <tbody>
        {leaderboard.map((entry, index) => (
          <tr key={entry.id}>
            <td>{index + 1}</td>
            <td>{entry.driver_name || 'Anonymous'}</td>
            <td>{formatLapTime(entry.lap_time)}</td>
            <td>{entry.track_name}</td>
            <td>{entry.car_name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return mins > 0 ? \`\${mins}:\${secs.padStart(6, '0')}\` : secs;
}`}
            />
          </div>
        </section>

        {/* Best Practices */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Best Practices</h2>
          <div className="space-y-3">
            <PracticeItem
              title="Use Environment Variables"
              description="Always store API keys and base URLs in environment variables. Never hardcode them or commit them to version control."
            />
            <PracticeItem
              title="Handle Errors Gracefully"
              description="API calls can fail due to network issues, rate limits, or invalid requests. Always implement proper error handling and user feedback."
            />
            <PracticeItem
              title="Cache When Appropriate"
              description="Device lists and leaderboards don't change frequently. Cache responses to reduce API calls and improve performance."
            />
            <PracticeItem
              title="Polling vs WebSockets"
              description="For real-time updates (queue status, device status), use polling with reasonable intervals (10-30 seconds). Consider WebSockets for very frequent updates."
            />
            <PracticeItem
              title="Rate Limiting"
              description="Be mindful of API rate limits. Implement request throttling and exponential backoff for retries."
            />
            <PracticeItem
              title="User Feedback"
              description="Show loading states, success messages, and error messages to users. Queue operations can take time—keep users informed."
            />
          </div>
        </section>

        {/* Complete Example Structure */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Project Structure Example</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <pre className="text-sm text-neutral-300 font-mono overflow-x-auto">
{`your-child-site/
├── .env.local                 # Environment variables
├── lib/
│   ├── irc-api.ts            # API client
│   └── auth.ts               # Auth helpers
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── login/        # Proxy login endpoint
│   │       └── register/     # Proxy register endpoint
│   ├── devices/
│   │   ├── page.tsx          # Device list
│   │   └── [id]/
│   │       ├── page.tsx      # Device details
│   │       └── queue/        # Queue management
│   ├── leaderboard/
│   │   └── page.tsx          # Leaderboards
│   └── dashboard/
│       └── page.tsx          # User dashboard
└── components/
    ├── DeviceCard.tsx
    ├── QueueStatus.tsx
    └── Leaderboard.tsx`}
            </pre>
          </div>
        </section>

        {/* Testing */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Testing Your Integration</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <div>
              <h3 className="font-semibold text-white mb-2">1. Health Check</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`curl https://ircommander.gridpass.app/api/v1/health`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">2. Test Tenant API Key</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`curl https://ircommander.gridpass.app/api/v1/devices \\
  -H "X-Tenant-Key: your-tenant-api-key"`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">3. Test in Your App</h3>
              <p className="text-sm text-neutral-300">
                Start with simple API calls from your application. Use browser dev tools to inspect requests/responses. 
                Check for CORS issues, authentication errors, and data format mismatches.
              </p>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Next Steps</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/help/api"
              className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-orange-500/50 transition"
            >
              <h3 className="font-semibold text-white mb-2">Browse API Reference</h3>
              <p className="text-sm text-neutral-400">
                Complete endpoint documentation with all available APIs
              </p>
            </Link>
            <Link
              href="/help/authentication"
              className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-orange-500/50 transition"
            >
              <h3 className="font-semibold text-white mb-2">Authentication Guide</h3>
              <p className="text-sm text-neutral-400">
                Detailed authentication documentation
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function ExampleCard({ title, language, code }: { title: string; language: string; code: string }) {
  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h3 className="font-semibold text-white mb-3">{title}</h3>
      <pre className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function PatternCard({ title, description, code }: { title: string; description: string; code: string }) {
  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-neutral-400 mb-4">{description}</p>
      <pre className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 font-mono overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function AuthOption({
  title,
  description,
  pros,
  cons,
}: {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
}) {
  return (
    <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/30">
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-300 mb-3">{description}</p>
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-green-400 font-semibold mb-1">Pros:</div>
          <ul className="list-disc list-inside text-neutral-400 space-y-1">
            {pros.map((pro, i) => (
              <li key={i}>{pro}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-yellow-400 font-semibold mb-1">Cons:</div>
          <ul className="list-disc list-inside text-neutral-400 space-y-1">
            {cons.map((con, i) => (
              <li key={i}>{con}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PracticeItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-neutral-300">{description}</p>
    </div>
  );
}
