import React from 'react';
import { Setting } from '../types';

interface ThemeWrapperProps {
  settings: Setting | null;
  children: React.ReactNode;
}

export const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ settings, children }) => {
  // Fallback defaults jika settings belum diset
  const primaryColor = settings?.primary_color || '#78350f';
  const secondaryColor = settings?.secondary_color || '#d97706';
  const backgroundColor = settings?.background_color || '#fffbeb';
  const textColor = settings?.text_color || '#1f2937';
  const fontFamily = settings?.font_family || 'Inter, sans-serif';

  const themeStyles = {
    '--color-primary': primaryColor,
    '--color-secondary': secondaryColor,
    '--color-bg': backgroundColor,
    '--color-text': textColor,
    fontFamily: fontFamily,
    backgroundColor: backgroundColor,
    color: textColor,
  } as React.CSSProperties;

  return (
    <div style={themeStyles} className="min-h-screen transition-colors duration-300">
      {children}
    </div>
  );
};
