import { Halo } from '@/components/motion/Halo';

/**
 * The instant placeholder for a page the server has to query before it can
 * render — an account, the back office.
 *
 * Without one the router holds the OLD page until the server answers, and the
 * view transition freezes the screen for that whole wait: a click that seems
 * to do nothing is the most "laggy" thing a site can do.
 *
 * Deliberately NOT used at the root: a streamed page has already sent its
 * 200 by the time a `redirect()` or `notFound()` runs, so routes that answer
 * with those (tracking, confirmation, drink pages) render without one.
 */
export function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <Halo size={56} stroke={1.8} progress={0.3} spinning animateOnMount={false} />
      <span className="sr-only">Loading</span>
    </div>
  );
}
