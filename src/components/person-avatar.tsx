import { cn } from "@/lib/utils";

interface PersonAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  ringColor?: string;
  className?: string;
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { width: 32, height: 32, minWidth: 32, minHeight: 32 },
  md: { width: 40, height: 40, minWidth: 40, minHeight: 40 },
  lg: { width: 64, height: 64, minWidth: 64, minHeight: 64 },
};

const textClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
};

export function PersonAvatar({ name, photoUrl, size = "md", ringColor, className }: PersonAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const style = sizeStyles[size];
  const textClass = textClasses[size];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={style}
        className={cn(
          "rounded-full object-cover flex-shrink-0",
          ringColor && `ring-2 ${ringColor}`,
          className,
        )}
      />
    );
  }

  return (
    <div
      style={style}
      className={cn(
        textClass,
        "rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0",
        ringColor && `ring-2 ${ringColor}`,
        className,
      )}
    >
      {initials}
    </div>
  );
}
