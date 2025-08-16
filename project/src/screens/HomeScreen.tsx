import React from 'react';
import { Screen } from '../types';
import { Upload, GitCompare, BarChart3, ArrowRight } from 'lucide-react';
import { TitleHeader } from '../components/TitleHeader';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-[#0b0f1a] dark:to-[#0b0f1a]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero con logo + título reutilizable */}
        <div className="flex items-center gap-5 mb-3">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-2xl bg-[#22378C] ring-4 ring-[#6CC04A] shadow-xl" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-2xl font-extrabold tracking-wide">GP</span>
            </div>
          </div>
          <div className="flex-1">
            <TitleHeader
              eyebrow="Gampack · Plataforma"
              titleMain="Comparador de precios"
              titleAfter=""
              subtitle="Organización de proveedores y sistema de comparación de precios."
            />
          </div>
        </div>

        {/* Grid de acciones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {/* Card 1 */}
          <button
            onClick={() => onNavigate('manual')}
            className="
              group text-left
              rounded-2xl border border-gray-200 dark:border-white/10
              bg-white/80 dark:bg-white/5
              hover:bg-white dark:hover:bg-white/10
              transition-all shadow-sm hover:shadow-md
              p-6
            "
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-white/10">
                <Upload size={22} className="text-blue-600" />
              </div>
              <ArrowRight className="opacity-0 group-hover:opacity-100 transition" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Ingreso y búsqueda
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-white/80">
              Cargar o buscar productos manualmente.
            </p>
          </button>

          {/* Card 2 */}
          <button
            onClick={() => onNavigate('equivalences')}
            className="
              group text-left
              rounded-2xl border border-gray-200 dark:border-white/10
              bg-white/80 dark:bg-white/5
              hover:bg-white dark:hover:bg-white/10
              transition-all shadow-sm hover:shadow-md
              p-6
            "
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-white/10">
                <GitCompare size={22} className="text-green-600" />
              </div>
              <ArrowRight className="opacity-0 group-hover:opacity-100 transition" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Equivalencias
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-white/80">
              Gestioná relaciones de productos y pendientes.
            </p>
          </button>

          {/* Card 3 */}
          <button
            onClick={() => onNavigate('compare')}
            className="
              group text-left
              rounded-2xl border border-gray-200 dark:border-white/10
              bg-white/80 dark:bg-white/5
              hover:bg-white dark:hover:bg-white/10
              transition-all shadow-sm hover:shadow-md
              p-6
            "
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-indigo-100 dark:bg-white/10">
                <BarChart3 size={22} className="text-blue-700" />
              </div>
              <ArrowRight className="opacity-0 group-hover:opacity-100 transition" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Comparador de precios
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-white/80">
              Análisis y diferencias por proveedor.
            </p>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-10 text-gray-500 dark:text-white/70 text-sm text-center">
          © Comparador de precios de Gampack 2025. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
};
