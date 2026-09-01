import {
  Zap, Droplet, Wind, Paintbrush, Grid, Hammer, Lock, Wrench, Sparkles,
  Lightbulb, Fuel, Camera, type LucideIcon,
} from 'lucide-react-native';

const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  droplet: Droplet,
  wind: Wind,
  paintbrush: Paintbrush,
  grid: Grid,
  hammer: Hammer,
  lock: Lock,
  wrench: Wrench,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  fuel: Fuel,
  camera: Camera,
};

export function getServiceIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName?.toLowerCase()] || Wrench;
}
