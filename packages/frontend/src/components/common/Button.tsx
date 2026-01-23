import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50';

  const variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
