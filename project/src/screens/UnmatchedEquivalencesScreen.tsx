import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Navigation } from '../components/Navigation';
import { Screen } from '../types';

export const UnmatchedEquivalencesScreen: React.FC<{ onNavigate: (screen: Screen) => void }> = ({ onNavigate }) => {
  const [externals, setExternals] = useState<any[]>([]);
  const [internals, setInternals] = useState<any[]>([]);
  const [selectedExternal, setSelectedExternal] = useState<any | null>(null);
  const [selectedInternal, setSelectedInternal] = useState<any | null>(null);

  useEffect(() => {
    fetch('http://localhost:4000/api/no-relacionados/proveedores')
      .then(res => res.json())
      .then(setExternals);

    fetch('http://localhost:4000/api/no-relacionados/gampack')
      .then(res => res.json())
      .then(setInternals);
  }, []);

  const handleLink = async () => {
    if (!selectedExternal || !selectedInternal) return alert('Seleccioná un producto de cada tabla');

    const body = {
      id_lista_precios: selectedExternal.id_lista_precios,
      id_lista_interna: selectedInternal.id_lista_interna,
      criterio: 'manual',
    };

    const res = await fetch('http://localhost:4000/api/relacionar-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      alert('¡Productos vinculados!');
      setExternals(externals.filter(e => e.id_lista_precios !== selectedExternal.id_lista_precios));
      setInternals(internals.filter(i => i.id_lista_interna !== selectedInternal.id_lista_interna));
      setSelectedExternal(null);
      setSelectedInternal(null);
    } else {
      const error = await res.json();
      alert(`Error: ${error.message || 'No se pudo vincular'}`);
    }
  };

  const rowStyle = (isSelected: boolean) =>
    isSelected
      ? 'bg-blue-100 cursor-pointer'
      : 'hover:bg-gray-50 cursor-pointer';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="Relacionar productos manualmente" />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Productos Proveedores no relacionados</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Código</th>
                      <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                      <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {externals.map(item => (
                      <tr
                        key={item.id_lista_precios}
                        className={rowStyle(selectedExternal?.id_lista_precios === item.id_lista_precios)}
                        onClick={() => setSelectedExternal(item)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.cod_externo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.nom_externo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.proveedor}</td>
                      </tr>
                    ))}
                    {externals.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                          No hay productos no relacionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Productos Gampack no relacionados</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Código</th>
                      <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {internals.map(item => (
                      <tr
                        key={item.id_lista_interna}
                        className={rowStyle(selectedInternal?.id_lista_interna === item.id_lista_interna)}
                        onClick={() => setSelectedInternal(item)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.cod_interno}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.nom_interno}</td>
                      </tr>
                    ))}
                    {internals.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                          No hay productos no relacionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button onClick={handleLink} disabled={!selectedExternal || !selectedInternal}>
              Vincular manualmente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
