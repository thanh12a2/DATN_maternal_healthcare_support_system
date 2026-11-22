import type { CSSProperties, ReactNode } from 'react';
export interface AnimatedContentProps {
  children: ReactNode;
  distance?: number;
  direction?: 'vertical' | 'horizontal';
  duration?: number;
  ease?: string;
  threshold?: number;
  stagger?: number;
  trigger?: 'scroll' | 'mount';
  once?: boolean;
  className?: string;
  style?: CSSProperties;
}
export default function AnimatedContent(props: AnimatedContentProps): ReactNode;
