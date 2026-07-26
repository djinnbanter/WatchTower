export function BootScreen({ message = 'Starting WatchTower…' }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-wt-bg0 px-6 text-wt-text">
      <img
        src="./assets/watchtower-icon-simple.png"
        alt=""
        width={48}
        height={48}
        className="rounded-xl"
      />
      <p className="text-sm text-wt-text-mid" role="status">
        {message}
      </p>
    </div>
  );
}
