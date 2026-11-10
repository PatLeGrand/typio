export function HomeTrackScene({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`absolute inset-0 dark:brightness-50 dark:saturate-50 ${className}`}
      style={{ backgroundImage: "url('/race/track.svg'), url('/race/meadow.svg'), url('/race/meadow-distant.svg')", backgroundRepeat: "repeat-x", backgroundPosition: "left bottom, left bottom 80px, left bottom 110px", backgroundSize: "1440px 110px, 1440px 120px, 1440px 208px" }} />
  );
}
