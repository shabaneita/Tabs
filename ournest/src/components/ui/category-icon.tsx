import {
  Baby, BookOpen, Briefcase, Car, Coffee, CreditCard, Dumbbell, Fuel, Gift, GraduationCap, HeartPulse, Home, Landmark, Plane,
  ReceiptText, Shield, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Tag, Tv, Utensils, Wifi, Wrench, Zap, PawPrint,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: Home,
  car: Car,
  fuel: Fuel,
  zap: Zap,
  landmark: Landmark,
  wifi: Wifi,
  "shopping-cart": ShoppingCart,
  utensils: Utensils,
  sparkles: Sparkles,
  "credit-card": CreditCard,
  shield: Shield,
  coffee: Coffee,
  "shopping-bag": ShoppingBag,
  shirt: Shirt,
  "heart-pulse": HeartPulse,
  plane: Plane,
  gift: Gift,
  baby: Baby,
  "graduation-cap": GraduationCap,
  dumbbell: Dumbbell,
  smartphone: Smartphone,
  tv: Tv,
  wrench: Wrench,
  book: BookOpen,
  briefcase: Briefcase,
  receipt: ReceiptText,
  paw: PawPrint,
  tag: Tag,
};

export const CATEGORY_COLORS = ["emerald", "sky", "sand", "sage", "violet", "rose"] as const;

export function categoryColorVar(color: string) {
  const c = (CATEGORY_COLORS as readonly string[]).includes(color) ? color : "emerald";
  return { ink: `var(--cat-${c})`, soft: `var(--cat-${c}-soft)` };
}

export function CategoryIcon({ icon, color, size = 40, className }: { icon: string; color: string; size?: number; className?: string }) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag;
  const { ink, soft } = categoryColorVar(color);
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-2xl", className)}
      style={{ width: size, height: size, background: soft, color: ink }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} />
    </span>
  );
}
