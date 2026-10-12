'use client';
/**
 * `next/image`, with the three things it does not do on its own:
 *
 *   1. A loading state you can SEE. Until the bitmap has decoded the image
 *      sits at opacity 0 over the shimmer its container draws (`.img-smart`
 *      in base.css), then fades up. A slow first transform used to read as an
 *      empty box — the "images do not load" report.
 *   2. A fallback. A source that errors (a dead CDN link, an optimiser quota
 *      answering 402) swaps to a local texture instead of a broken-image glyph.
 *   3. Remote photos skip the optimiser. Unsplash already serves sized, encoded
 *      images from its URL parameters; routing them through `/_next/image` too
 *      spent the host's transformation quota for nothing, and once that quota
 *      runs out every remote image on the site fails at once.
 *
 * Same props as `next/image`, so it is a one-line import swap.
 */
import NextImage, { type ImageProps } from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

const FALLBACK = '/img/texture-crema.webp';

/** `cached` = decoded before we looked: shown as-is, no fade to replay. */
type State = 'idle' | 'cached' | 'loading' | 'loaded' | 'error';

export default function SmartImage({ src, className, onLoad, onError, unoptimized, ...rest }: ImageProps) {
  const [failed, setFailed] = useState(false);
  // `idle` on the server and in the first client render, so markup matches and
  // a visitor without JavaScript still sees every image.
  const [state, setState] = useState<State>('idle');
  const ref = useRef<HTMLImageElement | null>(null);

  const remote = typeof src === 'string' && /^https?:\/\//.test(src);
  const source = failed ? FALLBACK : src;

  useEffect(() => {
    const img = ref.current;
    // Already decoded before hydration (cached, or above the fold): no fade,
    // nothing to wait for. Otherwise hide it until `onLoad` says otherwise.
    setState(img && img.complete && img.naturalWidth > 0 ? 'cached' : 'loading');
  }, [source]);

  const handleLoad = useCallback<NonNullable<ImageProps['onLoad']>>(
    (e) => {
      setState((prev) => (prev === 'cached' ? prev : 'loaded'));
      onLoad?.(e);
    },
    [onLoad],
  );

  const handleError = useCallback<NonNullable<ImageProps['onError']>>(
    (e) => {
      if (!failed) setFailed(true);
      else setState('error');
      onError?.(e);
    },
    [failed, onError],
  );

  return (
    <NextImage
      {...rest}
      ref={ref}
      src={source}
      unoptimized={unoptimized ?? (remote && !failed)}
      className={className ? `img-smart ${className}` : 'img-smart'}
      data-state={state === 'idle' ? undefined : state}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
