// Keen's internal icon. Decorative by default; a standalone icon takes a label and becomes an image.
import { type IconName, iconRegistry } from "./registry.ts";

export interface IconProps {
  name: IconName;
  size?: "sm" | "md";
  // Only for an icon that stands alone and conveys meaning. Text, never an element ID.
  label?: string;
}

export function Icon({ name, size = "md", label }: IconProps) {
  const Glyph = iconRegistry[name];
  return (
    <Glyph
      className={`keen-icon keen-icon--${size}`}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    />
  );
}
