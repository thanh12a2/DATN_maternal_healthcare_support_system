import type { MouseEvent } from 'react';
type Item = { label: string; href?: string };
export default function PillNav(props: {
  items: Item[];
  activeHref?: string;
  onItemClick?: (item: Item, index: number, event: MouseEvent) => void;
  theme?: 'light' | 'dark';
  surface?: 'none' | 'solid' | 'glass';
  itemStyle?: 'plain' | 'pill';
  hoverEffect?: 'fill' | 'glide' | 'none';
  indicator?: 'dot' | 'pill' | 'none';
  highlightColor?: string;
  highlightTextColor?: string;
  textColor?: string;
  collapse?: 'auto' | 'always' | 'never';
  intro?: boolean;
  ariaLabel?: string;
}): React.ReactNode;
