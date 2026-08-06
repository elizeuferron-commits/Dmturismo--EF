import React, { useState } from 'react';
import { Save, Loader2, Shield } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, cleanUndefined } from '../lib/firebase';
import { toast } from 'sonner';
import { ROLE_PERMISSIONS } from '../lib/permissions';

export function PermissionsManagement() {
  const [permissions, setPermissions] = useState(ROLE_PERMISSIONS);
  const [loading, setLoading] = useState(false);

  const modules = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'trips', label: 'Trabalhos' },
    { id: 'fleet', label: 'Gestão de Frotas' },
    { id: 'finance', label: 'Financeiros' },
    { id: 'fuel', label: 'Abastecimento' },
    { id: 'inventory', label: 'Almoxarifado' },
    { id: 'gabinete', label: 'Gabinete' }
  ];

  const togglePermission = (role: string, moduleId: string) => {
    setPermissions(prev => {
      const current = prev[role] || [];
      const updated = current.includes(moduleId)
        ? current.filter(id => id !== moduleId)
        : [...current, moduleId];
      return { ...prev, [role]: updated };
    });
  };

  const savePermissions = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'permissions'), cleanUndefined({ roles: permissions }));
      toast.success('Permissões salvas com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar permissões');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Shield className="text-brand-accent"/> Gestão de Permissões
        </h3>
        <button 
          onClick={savePermissions}
          disabled={loading}
          className="h-12 px-6 bg-brand-accent text-zinc-950 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />}
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="p-3 text-[10px] font-black text-zinc-500 uppercase">Cargo</th>
              {modules.map(m => <th key={m.id} className="p-3 text-[10px] font-black text-zinc-500 uppercase text-center">{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.keys(permissions).map(role => (
              <tr key={role} className="border-t border-zinc-800">
                <td className="p-3 text-xs font-bold text-white">{role}</td>
                {modules.map(m => (
                  <td key={m.id} className="p-3 text-center">
                    <input 
                      type="checkbox" 
                      checked={permissions[role].includes(m.id)}
                      onChange={() => togglePermission(role, m.id)}
                      className="accent-brand-accent"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
