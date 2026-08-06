import React from 'react';
import { motion } from 'motion/react';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ 
        duration: 0.32, 
        ease: [0.16, 1, 0.3, 1] // Curva de easing suave de alta fidelidade
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};
