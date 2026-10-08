/**
 * How Skyelight looks in a terminal.
 *
 * Pulled out of `cli.js` because the installer had five one-line escape
 * helpers and no brand at all — the same five every Node CLI writes, so the
 * output read as generic tooling rather than as Skyelight. This is the one
 * place that decides, and it is plain data plus string functions so the
 * installer stays about installing.
 *
 * Colour is a courtesy, not a guarantee. Everything degrades: truecolor where
 * the terminal says it has it, the 256-colour cube where it does not, plain
 * text where colour is unwanted or the output is not a terminal at all. A CLI
 * whose output is piped into a file should produce a file somebody can read.
 */

/**
 * Whether to colour at all.
 *
 * `NO_COLOR` is honoured because it is the convention and costs nothing to
 * respect — see no-color.org. A non-TTY stdout means the output is being
 * piped or captured, where escape codes are noise. `TERM=dumb` says so
 * outright.
 */
const COLOR =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  Boolean(process.stdout.isTTY);

/**
 * Whether 24-bit colour is available.
 *
 * Only `COLORTERM` answers this honestly; `TERM` lies in both directions, and
 * probing costs a round trip nobody wants on a command that finishes in a
 * second. Without it the brand blue falls back to the nearest cube colour,
 * which is close enough that nobody who has not seen both would notice.
 */
const TRUECOLOR = /^(truecolor|24bit)$/i.test(process.env.COLORTERM ?? "");

/**
 * The accent, and only the accent.
 *
 * `#3b82f6` is `--accent` from `shared/styles/tokens.css`, so the terminal
 * and the app are the same blue rather than two blues that were each chosen
 * to look right on their own. `33` is the nearest 256-colour cube entry.
 */
const BRAND_RGB = [59, 130, 246];
const BRAND_256 = 33;

const wrap = (open, s) => (COLOR ? `\x1b[${open}m${s}\x1b[0m` : String(s));

export const bold = (s) => wrap("1", s);
export const dim = (s) => wrap("2", s);
export const green = (s) => wrap("32", s);
export const amber = (s) => wrap("33", s);
export const red = (s) => wrap("31", s);

/** The brand blue, at whatever fidelity this terminal can manage. */
export const brand = (s) =>
  !COLOR
    ? String(s)
    : TRUECOLOR
      ? `\x1b[38;2;${BRAND_RGB.join(";")}m${s}\x1b[0m`
      : `\x1b[38;5;${BRAND_256}m${s}\x1b[0m`;

/**
 * Marks, spelled out so a terminal that cannot draw them still says
 * something.
 *
 * Windows consoles and CI log viewers turn an unsupported glyph into a
 * replacement character, which is worse than an ASCII stand-in — it reads as
 * corruption rather than as plainness. `LANG` naming UTF-8 is the cheapest
 * honest signal available.
 */
const UNICODE = /UTF-?8/i.test(
  process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || "",
);

export const MARK = {
  logo: UNICODE ? "◆" : "*",
  tick: UNICODE ? "✓" : "OK",
  arrow: UNICODE ? "›" : ">",
  bullet: UNICODE ? "•" : "-",
  dot: UNICODE ? "·" : ".",
};

/**
 * The header every command opens with.
 *
 * A mark and a name rather than an ASCII-art banner. A banner is six lines
 * of somebody else's enthusiasm at the top of a tool you are running for the
 * fourth time today, and it pushes the thing you actually asked for below
 * the fold on a short terminal.
 *
 * `subtitle` carries which deployment is being configured, because running
 * this against the wrong one is the mistake with the least visible symptom:
 * everything succeeds, against somebody else's data.
 */
export function header(subtitle) {
  const line = `${brand(MARK.logo)} ${bold("Skyelight")}`;
  return subtitle ? `\n  ${line}  ${dim(subtitle)}\n` : `\n  ${line}\n`;
}

/** A section heading — the word, then the things under it, indented. */
export const heading = (s) => `  ${bold(s)}`;

/**
 * Pad to a visible width, counting characters rather than bytes.
 *
 * `padEnd` on a styled string counts the escape codes, so a column of them
 * comes out ragged by however many codes each one happens to carry — which
 * is why this takes the plain text and the caller styles afterwards.
 */
export const pad = (plain, width) => String(plain).padEnd(width);

/** Two spaces of indent, applied to a block that may already have newlines. */
export const indent = (s, by = 4) =>
  String(s)
    .split("\n")
    .map((l) => (l ? " ".repeat(by) + l : l))
    .join("\n");
