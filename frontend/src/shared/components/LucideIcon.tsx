import React from 'react';
import * as LucideIcons from 'lucide-react';

interface LucideIconProps extends LucideIcons.LucideProps {
  name: string;
  fallback?: React.ComponentType<LucideIcons.LucideProps>;
}

// Chuyển kebab-case, snake_case hoặc camelCase thành PascalCase
function toPascalCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^(\w)/, (_, c) => c.toUpperCase());
}

export const LucideIcon: React.FC<LucideIconProps> = ({
  name,
  fallback: Fallback = LucideIcons.Sparkles,
  ...props
}) => {
  if (!name) {
    return <Fallback {...props} />;
  }

  const pascalName = toPascalCase(name);
  const IconComponent = (LucideIcons as Record<string, any>)[pascalName] ||
    (LucideIcons as Record<string, any>)[name] ||
    Fallback;

  return <IconComponent {...props} />;
};

