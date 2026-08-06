import React, { memo } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { cn } from '../lib/utils';

interface CardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export const Card = ({ children, className, ...props }: CardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ 
      y: -8, 
      scale: 1.025,
      boxShadow: "0 20px 40px -15px rgba(255, 107, 0, 0.15), 0 0 25px 3px rgba(255, 107, 0, 0.1)",
      borderColor: "rgba(255, 107, 0, 0.35)",
      transition: { duration: 0.3, ease: "easeOut" } 
    }}
    transition={{ type: "spring", stiffness: 260, damping: 20 }}
    className={cn("glass-card p-8 transition-all duration-300 relative group", className)} 
    {...props}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] pointer-events-none" />
    {children}
  </motion.div>
);

interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  trend?: string;
  color: string;
  glow?: string;
  onClick?: () => void;
  className?: string;
}

export const StatCard = memo(({ title, value, icon: Icon, trend, color, glow, onClick, className }: StatCardProps) => (
  <Card 
    onClick={onClick} 
    className={cn("flex flex-col gap-8 border-white/5", onClick && "cursor-pointer active:scale-95 hover:border-brand-accent/30 transition-all", glow, className)}
  >
    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transform -rotate-3 transition-transform group-hover:rotate-0", color)}>
      <Icon className="w-7 h-7 text-asphalt-950" strokeWidth={2.5} />
    </div>
    <div>
      <p className="text-[10px] font-black text-sky-blue uppercase tracking-[0.25em] mb-3 opacity-80">{title}</p>
      <h3 className="text-4xl font-black text-white tracking-tighter mb-4 tabular-nums font-display">{value}</h3>
      {trend && (
        <div className="flex items-center gap-3">
          <div className="flex items-center px-2 py-1 bg-asphalt-950/50 rounded-lg border border-white/5">
            <span className={cn("text-[10px] font-black tracking-widest", trend.startsWith('+') || trend.includes('operação') || trend.includes('curso') ? "text-emerald-500" : "text-brand-accent")}>{trend}</span>
          </div>
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest opacity-50">Trend</span>
        </div>
      )}
    </div>
  </Card>
));
