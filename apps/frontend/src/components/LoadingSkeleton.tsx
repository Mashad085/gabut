export default function LoadingSkeleton() {
  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-screen-xl mx-auto animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 w-40 bg-white/[0.06] rounded mb-2" />
          <div className="h-7 w-64 bg-white/[0.08] rounded" />
        </div>
        <div className="h-9 w-32 bg-white/[0.06] rounded-xl" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06]" />
            <div className="h-3 w-24 bg-white/[0.05] rounded" />
            <div className="h-6 w-32 bg-white/[0.08] rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <div className="h-4 w-40 bg-white/[0.07] rounded mb-4" />
          <div className="h-52 bg-white/[0.03] rounded-xl shimmer" />
        </div>
        <div className="card">
          <div className="h-4 w-24 bg-white/[0.07] rounded mb-4" />
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.03] rounded-xl shimmer" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
