import React from 'react';

type TitleHeaderProps = {
  eyebrow?: string;               // mini breadcrumb
  titleMain: string;              // parte con gradiente
  titleAfter?: string;            // parte normal después del gradiente
  subtitle?: string;              // línea explicativa
  chips?: Array<{ label: string; value?: string | number }>;
  right?: React.ReactNode;        // CTA o acciones a la derecha
  className?: string;
};

export const TitleHeader: React.FC<TitleHeaderProps> = ({
  eyebrow,
  titleMain,
  titleAfter,
  subtitle,
  chips = [],
  right,
  className = '',
}) => {
  return (
    <header className={`relative mt-1 mb-5 ${className}`}>
      <div
        className="
          rounded-2xl border border-gray-200 dark:border-white/10
          bg-white/70 dark:bg-[#0e1526]/60
          backdrop-blur
          shadow-sm
          px-5 py-4
        "
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {eyebrow}
              </div>
            )}
            <h1 className="mt-1 text-2xl md:text-3xl font-extrabold leading-tight tracking-tight">
              <span
                className="
                  bg-clip-text text-transparent
                  bg-gradient-to-r from-blue-600 via-indigo-500 to-fuchsia-500
                  dark:from-blue-300 dark:via-indigo-300 dark:to-pink-300
                "
              >
                {titleMain}
              </span>
              {titleAfter && (
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {titleAfter}
                </span>
              )}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>
            )}
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {chips.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-400/30 px-2.5 py-1 text-xs
                               text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20"
                  >
                    {c.label}{typeof c.value !== 'undefined' ? <span className="ml-1 font-semibold">{c.value}</span> : null}
                  </span>
                ))}
              </div>
            )}
          </div>

          {right && <div className="flex-shrink-0">{right}</div>}
        </div>
      </div>
    </header>
  );
};
