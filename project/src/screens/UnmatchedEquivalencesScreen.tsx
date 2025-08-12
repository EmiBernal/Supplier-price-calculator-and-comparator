import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Navigation } from '../components/Navigation';
import { Screen } from '../types';

export const UnmatchedEquivalencesScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => {
  const [externals, setExternals] = useState<any[]>([]);
  const [internals, setInternals] = useState<any[]>([]);
  const [selectedExternals, setSelectedExternals] = useState<any[]>([]);
  const [selectedInternal, setSelectedInternal] = useState<any | null>(null);

  useEffect(() => {
    fetch('http://localhost:4000/api/no-relacionados/proveedores')
      .then(res => res.json())
      .then(data => setExternals(Array.isArray(data) ? data : []))
      .catch(() => setExternals([]));

    fetch('http://localhost:4000/api/no-relacionados/gampack')
      .then(res => res.json())
      .then(data => setInternals(Array.isArray(data) ? data : []))
      .catch(() => setInternals([]));
  }, []);

  const handleLink = async () => {
    if (!selectedInternal || selectedExternals.length === 0) {
      alert('Seleccioná un producto Gampack y al menos un proveedor');
      return;
    }

    const body = {
      id_lista_interna: selectedInternal.id_interno,
      ids_lista_precios: selectedExternals.map(e => e.id_externo),
      criterio: 'manual',
    };

    try {
      const res = await fetch('http://localhost:4000/api/relacionar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        alert('¡Productos vinculados!');
        setExternals(prev => prev.filter(e => !selectedExternals.some(se => se.id_externo === e.id_externo)));
        setInternals(prev => prev.filter(i => i.id_interno !== selectedInternal.id_interno));
        setSelectedExternals([]);
        setSelectedInternal(null);
      } else {
        const error = await res.json();
        alert(`Error: ${error.message || 'No se pudo vincular'}`);
      }
    } catch {
      alert('Error al conectar con el servidor');
    }
  };

  const toggleExternalSelection = (item: any) => {
    setSelectedExternals(prev =>
      prev.find(e => e.id_externo === item.id_externo)
        ? prev.filter(e => e.id_externo !== item.id_externo)
        : [...prev, item]
    );
  };

  const rowStyle = (selected: boolean) =>
    selected
      ? 'bg-blue-100 dark:bg-blue-900 cursor-pointer'
      : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="Relacionar productos manualmente" />

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Productos Proveedores no relacionados</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left">Código</th>
                      <th className="px-6 py-3 text-left">Nombre</th>
                      <th className="px-6 py-3 text-left">Proveedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {externals.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No hay productos no relacionados.</td></tr>
                    ) : (
                      externals.map(item => (
                        <tr key={item.id_externo}
                            className={rowStyle(selectedExternals.some(e => e.id_externo === item.id_externo))}
                            onClick={() => toggleExternalSelection(item)}>
                          <td className="px-6 py-4">{item.cod_externo}</td>
                          <td className="px-6 py-4">{item.nom_externo}</td>
                          <td className="px-6 py-4">{item.proveedor ?? 'Sin proveedor'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Productos Gampack no relacionados</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left">Código</th>
                      <th className="px-6 py-3 text-left">Nombre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {internals.length === 0 ? (
                      <tr><td colSpan={2} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No hay productos no relacionados.</td></tr>
                    ) : (
                      internals.map(item => (
                        <tr key={item.id_interno}
                            className={rowStyle(selectedInternal?.id_interno === item.id_interno)}
                            onClick={() => setSelectedInternal(item)}>
                          <td className="px-6 py-4">{item.cod_interno}</td>
                          <td className="px-6 py-4">{item.nom_interno}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button onClick={handleLink} disabled={selectedExternals.length === 0 || !selectedInternal}>
              Vincular manualmente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
