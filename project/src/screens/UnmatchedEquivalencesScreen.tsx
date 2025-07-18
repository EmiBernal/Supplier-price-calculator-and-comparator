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
      .then(data => {
        if (Array.isArray(data)) {
          setExternals(data);
        } else {
          console.error('Respuesta inválida para productos externos:', data);
          setExternals([]);
        }
      })
      .catch(err => {
        console.error('Error fetching externos:', err);
        setExternals([]);
      });

    fetch('http://localhost:4000/api/no-relacionados/gampack')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setInternals(data);
        } else {
          console.error('Respuesta inválida para productos internos:', data);
          setInternals([]);
        }
      })
      .catch(err => {
        console.error('Error fetching internos:', err);
        setInternals([]);
      });
  }, []);

  const handleLink = async () => {
    if (!selectedExternal || !selectedInternal) {
      alert('Seleccioná un producto de cada tabla');
      return;
    }

    const body = {
      id_lista_precios: selectedExternal.id_externo,    // CORREGIDO: id_externo
      id_lista_interna: selectedInternal.id_interno,    // CORREGIDO: id_interno
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
        setExternals(prev => prev.filter(e => e.id_externo !== selectedExternal.id_externo));
        setInternals(prev => prev.filter(i => i.id_interno !== selectedInternal.id_interno));
        setSelectedExternal(null);
        setSelectedInternal(null);
      } else {
        const error = await res.json();
        alert(`Error: ${error.message || 'No se pudo vincular'}`);
      }
    } catch (error) {
      alert('Error al conectar con el servidor');
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
                    {externals.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                          No hay productos no relacionados.
                        </td>
                      </tr>
                    ) : (
                      externals.map(item => (
                        <tr
                          key={item.id_externo}  // CORREGIDO: id_externo
                          className={rowStyle(selectedExternal?.id_externo === item.id_externo)}
                          onClick={() => setSelectedExternal(item)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.cod_externo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.nom_externo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.proveedor ?? 'Sin proveedor'}</td>
                        </tr>
                      ))
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
                    {internals.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                          No hay productos no relacionados.
                        </td>
                      </tr>
                    ) : (
                      internals.map(item => (
                        <tr
                          key={item.id_interno}  // CORREGIDO: id_interno
                          className={rowStyle(selectedInternal?.id_interno === item.id_interno)}
                          onClick={() => setSelectedInternal(item)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.cod_interno}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{item.nom_interno}</td>
                        </tr>
                      ))
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
