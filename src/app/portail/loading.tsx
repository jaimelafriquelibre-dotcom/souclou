export default function PortalLoading() {
  return (
    <main aria-busy="true" className="min-h-screen px-6 py-16 text-slate-600" role="status">
      <div className="mx-auto h-24 w-full max-w-5xl animate-pulse rounded-2xl bg-slate-200/70" />
      <p className="mx-auto mt-4 max-w-5xl text-sm">Chargement de votre portail…</p>
    </main>
  );
}
