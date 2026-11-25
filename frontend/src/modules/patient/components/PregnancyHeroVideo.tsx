import { useEffect, useRef, useState } from 'react';

/** Pexels / RDNE Stock project, video 6150142 (illustrative stock footage). */
export function PregnancyHeroVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const element = video.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void element.play().catch(() => setPaused(true));
  }, []);

  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPaused(true));
    else element.pause();
  };

  return (
    <figure className="pg-story-frame pg-hero-video-frame">
      <div className="pg-story-images">
        <video ref={video} muted loop playsInline preload="metadata"
          poster="/images/pregnancy-7055918.jpg" aria-hidden="true" tabIndex={-1}
          onPlay={() => setPaused(false)} onPause={() => setPaused(true)}>
          <source src="/videos/pregnancy-guide-pexels-6150142.mp4" type="video/mp4" />
        </video>
      </div>
      <button type="button" className="pg-video-toggle" onClick={toggle} aria-pressed={paused}>
        {paused ? 'Phát video' : 'Tạm dừng video'}
      </button>
    </figure>
  );
}
