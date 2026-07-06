/**
 * check-icon-contrast.ts
 *
 * CI asset-build check for icon contrast ratios.
 *
 * Reads all *.svg files from mobile/assets/icons/, extracts fill="..." color
 * values, computes relative luminance via the WCAG 2.1 formula, and checks
 * the contrast ratio of each fill color against white (#FFFFFF).
 *
 * Exits with code 0 if ALL icons pass (contrast >= 3.0:1).
 * Exits with code 1 if ANY icon fails.
 *
 * Usage:
 *   npx ts-node scripts/check-icon-contrast.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Color utilities ─────────────────────────────────────────────────────────

/**
 * Parses a 3- or 6-digit hex color string (with or without leading #)
 * and returns { r, g, b } in the range 0–255.
 * Returns null if the color format is unrecognised.
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, '').toLowerCase();
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return null;
}

/**
 * Converts an 8-bit channel value (0–255) to a linearised sRGB value,
 * as per the WCAG 2.1 relative luminance formula.
 */
function linearise(channel: number): number {
  const sRGB = channel / 255;
  return sRGB <= 0.03928
    ? sRGB / 12.92
    : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/**
 * Computes the WCAG 2.1 relative luminance of a color.
 * Result is in the range [0, 1].
 */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * Computes the WCAG 2.1 contrast ratio between two colors.
 * Both luminance values must be in [0, 1].
 * Result is in the range [1, 21].
 */
function contrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker  = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Luminance of white (#FFFFFF)
const WHITE_LUMINANCE = relativeLuminance(255, 255, 255); // = 1.0

// ─── SVG parsing ─────────────────────────────────────────────────────────────

/**
 * Extracts all fill="..." hex color values from an SVG string.
 * Handles both fill="#rrggbb" and fill="#rgb" formats.
 * Ignores non-hex values like fill="none" or fill="currentColor".
 */
function extractFillColors(svgContent: string): string[] {
  const fillRegex = /fill=["']([^"']+)["']/gi;
  const colors: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = fillRegex.exec(svgContent)) !== null) {
    const value = match[1].trim();
    // Only accept hex colors
    if (/^#[0-9a-fA-F]{3}$/.test(value) || /^#[0-9a-fA-F]{6}$/.test(value)) {
      colors.push(value);
    }
  }

  return colors;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const MINIMUM_CONTRAST = 3.0;
const ICONS_DIR = path.resolve(__dirname, '../assets/icons');

function main(): void {
  console.log(`Checking icon contrast ratios in: ${ICONS_DIR}`);
  console.log(`Minimum required contrast ratio: ${MINIMUM_CONTRAST}:1 against white\n`);

  let svgFiles: string[];
  try {
    svgFiles = fs
      .readdirSync(ICONS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.svg'));
  } catch (err) {
    console.error(`ERROR: Could not read icons directory: ${ICONS_DIR}`);
    console.error((err as Error).message);
    process.exit(1);
  }

  if (svgFiles.length === 0) {
    console.warn('WARNING: No SVG files found in icons directory.');
    process.exit(0);
  }

  let failures = 0;
  const results: Array<{ file: string; color: string; ratio: number; pass: boolean }> = [];

  for (const svgFile of svgFiles) {
    const filePath = path.join(ICONS_DIR, svgFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    const fillColors = extractFillColors(content);

    if (fillColors.length === 0) {
      // SVG has no hex fill — treat as pass (could be using currentColor or none)
      results.push({ file: svgFile, color: '(none)', ratio: Infinity, pass: true });
      continue;
    }

    for (const color of fillColors) {
      const parsed = parseHexColor(color);
      if (!parsed) {
        // Can't parse — skip
        continue;
      }
      const lum = relativeLuminance(parsed.r, parsed.g, parsed.b);
      const ratio = contrastRatio(WHITE_LUMINANCE, lum);
      const pass = ratio >= MINIMUM_CONTRAST;

      results.push({ file: svgFile, color, ratio, pass });
      if (!pass) {
        failures++;
      }
    }
  }

  // Print results
  for (const result of results) {
    const badge = result.pass ? '✅ PASS' : '❌ FAIL';
    const ratioStr =
      result.ratio === Infinity
        ? 'N/A (no fill color)'
        : `${result.ratio.toFixed(2)}:1`;
    console.log(`${badge}  ${result.file.padEnd(30)} fill=${result.color}  contrast=${ratioStr}`);
  }

  console.log(`\n${results.length} icon fill color(s) checked. ${failures} failure(s).`);

  if (failures > 0) {
    console.error(
      `\nERROR: ${failures} icon(s) have a contrast ratio below ${MINIMUM_CONTRAST}:1 against white.`
    );
    process.exit(1);
  } else {
    console.log(`\nAll icons pass the ${MINIMUM_CONTRAST}:1 contrast requirement. ✅`);
    process.exit(0);
  }
}

main();
