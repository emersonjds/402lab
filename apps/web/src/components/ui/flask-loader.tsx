const DROP_DELAYS = ['0s', '0.5s', '1s'] as const;

export const FlaskLoader = ({ label = 'Loading 402Lab' }: { label?: string }) => (
  <div
    role="status"
    aria-label={label}
    className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg"
  >
    <div className="relative h-36 w-24">
      <div aria-hidden="true" className="absolute top-0 left-1/2 h-12 w-3 -translate-x-1/2">
        {DROP_DELAYS.map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: delay }}
            className="absolute top-0 left-0 animate-drip opacity-0 motion-reduce:animate-none motion-reduce:opacity-100"
          >
            <span className="block size-3 rotate-45 rounded-full rounded-tl-none bg-lime" />
          </span>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing for next/image to optimize */}
      <img
        src="/logo-flask.svg"
        alt=""
        width={96}
        height={96}
        className="absolute bottom-0 left-0"
      />
    </div>
    <p className="font-mono text-xs text-muted">{label}…</p>
  </div>
);
