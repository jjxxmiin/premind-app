/**
 * Whether the login screen offers the offline demo.
 *
 * A store build talks to the real server, and a demo account there is a dead
 * end for someone who installed the app to use it: nothing they record is
 * kept. So the entry is for development, and for a build with no server
 * behind it, where it is the only way in.
 *
 * Kept as a pure rule rather than an inline condition so the release
 * behaviour is something a test can state.
 */
export function shouldOfferDemo(options: {
  /** `__DEV__`: false in a release bundle. */
  development: boolean;
  /** Whether this build has an API base URL compiled into it. */
  serverConfigured: boolean;
}): boolean {
  return options.development || !options.serverConfigured;
}
