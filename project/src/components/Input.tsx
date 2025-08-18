import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-white/80">
          {label}
        </label>
      )}
      <input
        {...props}
        className={[
          // base
          'w-full px-3 py-2 rounded-lg border shadow-sm outline-none transition-colors duration-200',
          // light
          'bg-white text-gray-900 placeholder-gray-400 border-gray-300',
          'focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/60',
          // dark (alto contraste y legible)
          'dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10',
          'dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60',
          // permitir overrides externos
          className,
        ].join(' ')}
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
