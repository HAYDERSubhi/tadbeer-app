// src/app/(auth)/layout.tsx
// This layout is no longer used with anonymous authentication.
import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Return null to ensure nothing from the old layout or its children is rendered.
  return null;
}
