import { cn } from "@/lib/utils";

interface SonaVoiceProps {
  children: React.ReactNode;
  className?: string;
}

export function SonaVoice({ children, className }: SonaVoiceProps) {
  return (
    <p
      className={cn("font-serif italic text-base leading-relaxed text-muted-foreground", className)}
    >
      {children}
    </p>
  );
}
