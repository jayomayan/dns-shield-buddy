import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { useMemo } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "success" | "destructive" | "warning";
  delay?: number;
}

const variantStyles = {
  default: "border-border",
  primary: "border-primary/30 glow-sm",
  success: "border-success/30",
  destructive: "border-destructive/30",
  warning: "border-warning/30",
};

const iconVariants = {
  default: "text-muted-foreground bg-muted",
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  destructive: "text-destructive bg-destructive/10",
  warning: "text-warning bg-warning/10",
};

function RollingDigit({ char, index }: { char: string; index: number }) {
  const isDigit = /\d/.test(char);

  if (!isDigit) {
    return <span>{char}</span>;
  }

  return (
    <span className="inline-block relative" style={{ width: "0.62em", height: "1em", verticalAlign: "top" }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={`${index}-${char}`}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function RollingNumber({ value }: { value: string }) {
  const chars = useMemo(() => value.split(""), [value]);

  return (
    <span className="inline-flex overflow-hidden" style={{ lineHeight: "1em" }}>
      {chars.map((char, i) => (
        <RollingDigit key={`pos-${value.length - i}`} char={char} index={value.length - i} />
      ))}
    </span>
  );
}

export default function StatCard({ title, value, subtitle, icon: Icon, variant = "default", delay = 0 }: StatCardProps) {
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`bg-card rounded-lg border p-5 ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1 font-mono">
            {typeof value === "number" ? <RollingNumber value={displayValue} /> : displayValue}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${iconVariants[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}