import Link from 'next/link'
import { auth, signIn, signOut } from '@/lib/auth'
import HeaderTabs from './HeaderTabs'

async function signInGitHub() {
  'use server'
  await signIn('github')
}

async function signOutAction() {
  'use server'
  await signOut({ redirectTo: '/' })
}

async function getStars(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/claudewall/source',
      {
        next: { revalidate: 3600 },
        headers: { Accept: 'application/vnd.github+json' },
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { stargazers_count?: number }
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null
  } catch {
    return null
  }
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M12 .5C5.4.5 0 5.9 0 12.5c0 5.3 3.4 9.7 8.2 11.3.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.6 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.7.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.8-1.6 8.2-6 8.2-11.3C24 5.9 18.6.5 12 .5z" />
    </svg>
  )
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export default async function SiteHeader() {
  const session = await auth()
  const user = session?.user as
    | { handle?: string; image?: string | null }
    | undefined
  const stars = await getStars()

  return (
    <header className="px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 border-b border-neutral-200/70 bg-[#faf6ec]">
      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <img
            src="/logo.png"
            alt="claudewall"
            width={32}
            height={32}
            className="w-8 h-8 rounded-md flex-none"
          />
          <span className="hidden sm:inline font-serif text-2xl tracking-tight">
            claudewall
          </span>
        </Link>
        <HeaderTabs />
      </div>

      <nav className="flex items-center gap-2 sm:gap-3 text-sm flex-none">
        <a
          href="https://github.com/claudewall"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 transition"
          aria-label="claudewall on GitHub"
        >
          <GithubMark className="w-4 h-4" />
          <span className="hidden sm:inline">GitHub</span>
          {stars !== null && (
            <>
              <span className="text-neutral-300 hidden sm:inline" aria-hidden>
                |
              </span>
              <span aria-hidden>★</span>
              <span>{stars.toLocaleString()}</span>
            </>
          )}
        </a>

        {user ? (
          <>
            <Link
              href={`/u/${user.handle}`}
              className="flex items-center gap-2 hover:underline min-w-0"
              aria-label={`@${user.handle}`}
            >
              {user.image && (
                <img
                  src={user.image}
                  alt=""
                  className="w-7 h-7 rounded-full flex-none"
                />
              )}
              <span className="hidden md:inline truncate">@{user.handle}</span>
            </Link>
            <form action={signOutAction}>
              <button
                className="text-neutral-500 hover:text-neutral-900 p-1.5"
                aria-label="Sign out"
              >
                <SignOutIcon className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </>
        ) : (
          <form action={signInGitHub}>
            <button className="px-3 sm:px-4 py-1.5 bg-black text-white rounded-full text-sm whitespace-nowrap">
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Sign in with GitHub</span>
            </button>
          </form>
        )}
      </nav>
    </header>
  )
}
