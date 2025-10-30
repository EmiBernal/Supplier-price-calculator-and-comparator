import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/theme';

type Props = {
  className?: string;
  labelVisible?: boolean;
};

export function ThemeToggleButton({ className, labelVisible = true }: Props) {
  const { theme, toggleTheme } = useTheme();
  const baseClasses =
    'group inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-100';
  const classes = className ? `${baseClasses} ${className}` : baseClasses;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={classes}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {labelVisible && (
        <span className="hidden sm:inline">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
      )}
    </button>
  );
}

export default ThemeToggleButton;
