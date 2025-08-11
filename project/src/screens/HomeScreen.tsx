import React from 'react';
import { Screen } from '../types';  // Ajusta la ruta según tu estructura
import { Upload, GitCompare, BarChart3 } from 'lucide-react';


interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;  // Aquí el cambio importante
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-32 h-32 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center mx-auto mb-6">
            <div className="text-4xl font-bold text-blue-600">GP</div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Comparador de precios
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Organización de proveedores y sistema de comparación de precios
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div 
            onClick={() => onNavigate('manual')}
            className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-105"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                <Upload size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Ingreso y busqueda  </h3>
              <p className="text-gray-600 dark:text-gray-300 text-center">
                Cargar o buscar productos manualmente
              </p>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('equivalences')}
            className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-105"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                <GitCompare size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Equivalencias entre productos</h3>
              <p className="text-gray-600 dark:text-gray-300 text-center">
                Gestionar relaciones de productos
              </p>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('compare')}
            className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-105"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                <BarChart3 size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Comparador de precios</h3>
              <p className="text-gray-600 dark:text-gray-300 text-center">
                Análisis de precios
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-gray-500 dark:text-gray-400 text-sm">
          <p>© Comparador de precios de Gampack 2025. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};