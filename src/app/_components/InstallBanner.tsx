export default function InstallBanner() {
  return (
    <details className="sticky top-0 z-30 bg-[#faf6ec]/95 backdrop-blur border-b border-neutral-200/70 group">
      <summary className="cursor-pointer list-none px-4 sm:px-6 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100/60 flex items-center justify-between gap-3 select-none">
        <span className="truncate">Want to add to the wall?</span>
        <span className="text-xs text-neutral-500 flex-none flex items-center gap-1.5">
          <span className="hidden sm:inline">Install steps</span>
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5 transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </summary>
      <div className="px-4 sm:px-6 pb-5 pt-2">
        <ol className="text-sm text-neutral-700 space-y-3 max-w-xl">
          <li className="flex gap-3">
            <span className="font-serif text-lg text-neutral-400 leading-none flex-none w-5">
              1.
            </span>
            <span>
              In any Claude Code session, ask Claude to run{' '}
              <code className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono text-xs">
                npx claudewall init
              </code>
              . Approve the device code in the browser when it opens.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-serif text-lg text-neutral-400 leading-none flex-none w-5">
              2.
            </span>
            <span>
              Exit and restart Claude Code — slash commands are loaded at
              session start.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-serif text-lg text-neutral-400 leading-none flex-none w-5">
              3.
            </span>
            <span>
              Run{' '}
              <code className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono text-xs">
                /wall
              </code>{' '}
              in a fresh session and pick the lines you want on the wall.
            </span>
          </li>
        </ol>
      </div>
    </details>
  )
}
