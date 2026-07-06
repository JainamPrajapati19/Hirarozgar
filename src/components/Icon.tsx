/**
 * Icon component
 *
 * Renders a bundled SVG icon by key, using the IconRegistry to resolve
 * the React component. Every icon has a consistent size and color API.
 *
 * Props:
 * - `name`: IconKey — required, the icon key to render
 * - `size`: number — optional, defaults to 24px
 * - `color`: string — optional, defaults to #595959 (6.04:1 contrast vs white)
 * - `testID`: string — optional, for testing frameworks
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { SvgProps } from 'react-native-svg';

import { IconRegistry, IconKey } from './IconRegistry';

interface IconProps {
  /** The icon key to render (e.g. 'home', 'settings', 'logout') */
  name: IconKey;
  /** Icon size in logical pixels. Defaults to 24. */
  size?: number;
  /** Fill color. Defaults to #595959 (6.04:1 contrast vs white). */
  color?: string;
  /** Test identifier for automated tests. */
  testID?: string;
}

const DEFAULT_SIZE = 24;
const DEFAULT_COLOR = '#595959';

/**
 * Icon
 *
 * Displays a bundled SVG icon using react-native-svg.
 * The icon component is fetched from IconRegistry, which validates at
 * startup that all required keys are present (Req 1.4).
 */
export function Icon({
  name,
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  testID,
}: IconProps): React.ReactElement {
  // Retrieve the SVG component from the registry.
  // If somehow the key is invalid, getIcon throws MissingIconError.
  const SvgComponent = IconRegistry.getIcon(name);

  return (
    <SvgComponent
      width={size}
      height={size}
      color={color}
      fill={color}
      testID={testID}
    />
  );
}
