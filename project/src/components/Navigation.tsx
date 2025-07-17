import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface NavigationProps {
  onBack: () => void;
  title: string;
}

export const Navigation: React.FC<NavigationProps> = ({ onBack, title }) => {
  return (
    <div className="flex items-center justify-between mb-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 text-gray-700"
      >
        <ArrowLeft size={20} />
        <span>Volver</span>
      </button>
      <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      <div className="w-32"></div> {/* Spacer for centering */}
    </div>
  );
};