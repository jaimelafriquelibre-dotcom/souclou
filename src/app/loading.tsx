export default function Loading() {
  return (
    <main aria-busy="true" className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-300" role="status">
      <p className="animate-pulse text-sm font-medium">Chargement de SOUCLOU…</p>
    </main>
  );
}
