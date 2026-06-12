interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="mx-auto flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-[min(1120px,92vw)] items-center justify-between">
          <a href="#" className="text-sm font-semibold tracking-wide text-slate-900">
            PDF Chat
          </a>
          <nav className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <a href="#" className="rounded-full px-4 py-2 transition hover:bg-slate-900 hover:text-white">
              Home
            </a>
            <a
              href="https://www.skillpedia.ai"
              className="rounded-full px-4 py-2 transition hover:bg-emerald-600 hover:text-white"
            >
              SkillPediaAI
            </a>
          </nav>
        </div>
      </header>
      <div className="flex-1">
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
