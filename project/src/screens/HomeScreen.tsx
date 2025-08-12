import React from 'react';
import { Screen } from '../types';
import { Upload, GitCompare, BarChart3 } from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-[#0b0f1a] dark:to-[#0b0f1a] flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          {/* Logo GP estilo Gampack */}
            {/* Logo GP: fondo azul y contorno verde */}
            <div className="relative w-32 h-32 mx-auto mb-6">
              {/* Círculo azul con borde/contorno verde */}
              <div className="absolute inset-0 rounded-full bg-[#22378C] ring-4 ring-[#6CC04A] shadow-xl" />
              {/* Brillo sutil arriba para darle volumen (opcional) */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              {/* Texto */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-4xl font-extrabold tracking-wide">GP</span>
              </div>
            </div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            Comparador de precios
          </h1>
          <p className="text-xl text-gray-600 dark:text-white/80">
            Organización de proveedores y sistema de comparación de precios
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div
            onClick={() => onNavigate('manual')}
            className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-105"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-blue-100 dark:bg-white/10 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-white/20 transition-colors">
                <Upload size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Ingreso y busqueda</h3>
              <p className="text-gray-600 dark:text-white/80 text-center">
                Cargar o buscar productos manualmente
              </p>
            </div>
          </div>

          <div
            onClick={() => onNavigate('equivalences')}
            className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-105"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-green-100 dark:bg-white/10 rounded-full group-hover:bg-green-200 dark:group-hover:bg-white/20 transition-colors">
                <GitCompare size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Equivalencias entre productos</h3>
              <p className="text-gray-600 dark:text-white/80 text-center">
                Gestionar relaciones de productos
              </p>
            </div>
          </div>

          <div
            onClick={() => onNavigate('compare')}
            className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-105"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-blue-100 dark:bg-white/10 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-white/20 transition-colors">
                <BarChart3 size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Comparador de precios</h3>
              <p className="text-gray-600 dark:text-white/80 text-center">
                Análisis de precios
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-gray-500 dark:text-white/70 text-sm">
          <p>© Comparador de precios de Gampack 2025. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};
