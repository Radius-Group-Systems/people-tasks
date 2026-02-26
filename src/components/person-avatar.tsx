import { cn } from "@/lib/utils";

interface PersonAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  ringColor?: string;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-lg",
};

export function PersonAvatar({ name, photoUrl, size = "md", ringColor, className }: PersonAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeClass = sizeClasses[size];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn(
          sizeClass,
          "rounded-full object-cover flex-shrink-0",
          ringColor && `ring-2 ${ringColor}`,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0",
        ringColor && `ring-2 ${ringColor}`,
        className,
      )}
    >
      {initials}
    </div>
  );
}
