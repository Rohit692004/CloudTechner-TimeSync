import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="fixed inset-0 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] bg-white overflow-auto font-sans">
      {/* Left: Hero panel */}
      <div className="relative hidden md:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-[#061e1a] via-[#0b2b24] to-[#123b2a] overflow-hidden">
        {/* Floating background shapes */}
        <div className="absolute -top-20 -right-20 w-[280px] h-[280px] bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-[320px] h-[320px] bg-teal-500/10 rounded-full blur-[70px] pointer-events-none" />
        
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        />

        {/* Top Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.png" alt="CloudTechner Logo" className="h-10 w-10 object-contain rounded-md bg-white p-0.5" />
          <div>
            <strong className="text-base font-semibold tracking-tight block text-white">CloudTechner</strong>
            <small className="text-xs text-white/60">TimeSync · Enterprise</small>
          </div>
        </div>

        {/* Center Body Content */}
        <div className="relative z-10 max-w-md my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-semibold text-[#7AC143] uppercase tracking-wider mb-6">
            <span className="w-1.5 h-1.5 bg-[#7AC143] rounded-full animate-pulse shadow-[0_0_8px_#7AC143]" />
            CloudTechner Internal
          </div>
          <h1 className="text-4xl font-bold tracking-tight leading-none mb-4">
            Every hour, <span className="bg-gradient-to-r from-[#7AC143] to-[#0E9DC4] bg-clip-text text-transparent">accounted for.</span>
          </h1>
          <p className="text-sm text-white/70 leading-relaxed mb-8">
            Log time against projects, track approvals, and manage allocations — replacing external portals with a workflow built for how our teams actually operate.
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-sm text-white/90">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                ✓
              </div>
              <span>Weekly timesheets with draft, submit, and approval workflow</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/90">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                %
              </div>
              <span>Partial allocation and staggered assignments across projects</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/90">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                ▦
              </div>
              <span>Live utilization dashboards for managers and HR</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex justify-between items-center text-xs text-white/50">
          <span>🔒 SSO enabled · SOC 2 compliant</span>
          <span>© 2026 CloudTechner</span>
        </div>
      </div>

      {/* Right: Form panel */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            {/* Show mobile branding since hero is hidden */}
            <div className="flex md:hidden items-center gap-3 mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#7AC143] via-[#0E9DC4] to-[#3B82F6] text-sm font-bold text-white">
                C
              </div>
              <div>
                <strong className="text-sm font-bold tracking-tight block">CloudTechner</strong>
                <small className="text-xs text-muted-foreground">TimeSync</small>
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500">Sign in to access your timesheets, approvals, and reports.</p>
          </div>

          <form action={loginAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Work email</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">✉</span>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@cloudtechner.com"
                  className="pl-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
                <a href="#" className="text-xs text-emerald-600 hover:underline">Forgot?</a>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  className="pl-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600">
                Invalid email or password. Try again.
              </p>
            )}

            <Button type="submit" className="w-full h-11 mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-lg shadow-md shadow-emerald-500/10 transition-all duration-150">
              Sign in →
            </Button>
          </form>

          <div className="flex items-center gap-4 my-6 text-xs text-gray-400 uppercase font-semibold tracking-wider before:content-[''] before:flex-1 before:h-[1px] before:bg-gray-100 after:content-[''] after:flex-1 after:h-[1px] after:bg-gray-100">
            or continue with
          </div>

          <Button variant="outline" className="w-full h-11 border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg flex items-center justify-center gap-2 transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google Workspace
          </Button>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Local Dev seed log-ins:</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>Password:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600 font-mono">password123</code><br />
              <strong>HR Admin:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600 font-mono">bhavya@cloudtechner.com</code><br />
              <strong>Employee:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600 font-mono">sachin@cloudtechner.com</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

