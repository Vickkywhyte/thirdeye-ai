import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ThirdEye AI — Sign In',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-accent-blue flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6 text-white"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5Z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-foreground">
              ThirdEye <span className="text-accent-blue">AI</span>
            </span>
          </div>
          <p className="text-sm text-foreground-muted">
            AI-Powered Due Diligence Platform
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
