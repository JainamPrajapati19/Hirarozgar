/**
 * Type declarations for SVG imports.
 * Enables TypeScript to treat .svg files as React components
 * when using react-native-svg-transformer.
 */

declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}
