import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

function AnimatedNumber({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 20 });
  const [display, setDisplay] = useState(value.toLocaleString());
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      prevRef.current = value;
    }
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      setDisplay(Math.round(v).toLocaleString());
    });
    return unsubscribe;
  }, [spring]);

  return (
    <span className={`transition-colors duration-500 ${flash ? "text-primary" : ""}`}>
      {display}
    </span>
  );
}

export default function StatCard({ title, value, subtitle, icon: Icon, variant = "default", delay = 0 }: StatCardProps) {
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
            {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
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