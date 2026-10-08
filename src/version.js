/**
 * One version number, read by everything that reports one.
 *
 * `initialize` used to answer `0.1.0` from a literal in `server.js` while the
 * package on npm was 0.3.0, and the remote endpoint had its own copy of the
 * same stale literal. A client that logs the server version — or a person
 * reading it to work out which build they are talking to — was told something
 * that had not been true for two releases.
 *
 * A constant rather than a read of `package.json`, because this module is
 * bundled into the Convex deployment for the remote endpoint and there is no
 * filesystem there. `test/server.test.js` asserts the two agree, so the pair
 * cannot drift again without a test going red.
 */
export const VERSION = "0.7.2";
