import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db, cleanUndefined } from '../lib/firebase';
import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  FileSpreadsheet,
  Download,
  Monitor,
  Clock,
  Cake,
  Calendar,
  Camera,
  Phone,
  ShieldCheck,
  Key,
  Share2,
  Unlock,
  AlertTriangle,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  format, 
  differenceInDays, 
  parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from './Cards';
import { Employee } from '../types';
import { PointManagement } from './PointManagement';
import { UserManagement } from './UserManagement';
import { PermissionsManagement } from './PermissionsManagement';
import { hasPermission } from '../lib/permissions';
import { cn } from '../lib/utils';
import { ImageOptimizer, optimizeImageBeforeUpload } from './ImageOptimizer';

interface StaffManagementProps {
  employees: Employee[];
  onExportToExcel: () => void;
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string, name: string) => void;
  onUpdateEmployeePhoto?: (id: string, photoUrl: string) => Promise<void>;
  user: any;
}

export const StaffManagement: React.FC<StaffManagementProps> = ({
  employees,
  onExportToExcel,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onUpdateEmployeePhoto,
  user
}) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'point' | 'users' | 'permissions'>('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');

  const availableRoles = useMemo(() => {
    const rolesSet = new Set(employees.map(e => e.role).filter(Boolean));
    return ['Todos', ...Array.from(rolesSet)];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return roleFilter === 'Todos' || e.role === roleFilter;

      const matchesSearch = 
        (e.name || '').toLowerCase().includes(term) ||
        (e.role || '').toLowerCase().includes(term) ||
        (e.email || '').toLowerCase().includes(term) ||
        (e.phone || '').includes(term) ||
        (e.cpf || '').includes(term);

      const matchesRole = roleFilter === 'Todos' || e.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [employees, searchTerm, roleFilter]);

  const showPointTab = user?.role === 'Dono / Proprietário' || 
                       user?.role === 'Dono' || 
                       user?.role === 'Proprietário' || 
                       user?.role === 'Administrativo' ||
                       hasPermission(user?.role, 'finance', user?.email, user?.permissions, user?.displayName) ||
                       hasPermission(user?.role, 'point', user?.email, user?.permissions, user?.displayName);

  const showUsersTab = user?.role === 'Dono / Proprietário' || 
                       user?.role === 'Dono' || 
                       user?.role === 'Proprietário' || 
                       user?.role === 'Administrativo' ||
                       hasPermission(user?.role, 'finance', user?.email, user?.permissions, user?.displayName) ||
                       user?.email === 'elizeuferron@gmail.com';

  // Determine current tab safely based on visibility permissions
  const currentTab = 
    activeTab === 'point' && !showPointTab ? 'employees' : 
    activeTab === 'users' && !showUsersTab ? 'employees' : 
    activeTab;

  const liberarAcessoParaTodos = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', 'in', ['Pendente de Liberação', 'Aguardando Liberação']));
      const querySnapshot = await getDocs(q);
      
      let count = 0;
      for (const userDoc of querySnapshot.docs) {
        const userData = userDoc.data();
        const employeeMatch = employees.find(e => e.email === userData.email);
        
        if (employeeMatch) {
          await updateDoc(doc(db, 'users', userDoc.id), cleanUndefined({ role: 'Motorista' }));
          count++;
        }
      }
      
      if (count > 0) {
        toast.success(`${count} usuários liberados com sucesso!`);
      } else {
        toast.info("Nenhum funcionário com solicitação pendente encontrado no fichário operacional.");
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao liberar acesso em massa.');
    }
  };

  const downloadInstaller = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    const appUrl = window.location.origin;
    const batContent = `@echo off
set "URL=${appUrl}"
set "SHORTCUT_NAME=DM Turismo Pro"
set "SCRIPT=%TEMP%\\CreateShortcut.vbs"

echo Set oWS = CreateObject("WScript.Shell") > "%SCRIPT%"
echo sLinkFile = oWS.SpecialFolders("Desktop") & "\\%SHORTCUT_NAME%.lnk" >> "%SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SCRIPT%"
echo oLink.TargetPath = "msedge.exe" >> "%SCRIPT%"
echo oLink.Arguments = "--app=%URL%" >> "%SCRIPT%"
echo oLink.Description = "Sistema de Gestão DM Turismo" >> "%SCRIPT%"
echo oLink.IconLocation = "msedge.exe,0" >> "%SCRIPT%"
echo oLink.Save >> "%SCRIPT%"

cscript /nologo "%SCRIPT%"
del "%SCRIPT%"

echo ==========================================
echo   DM TURISMO - INSTALADOR WINDOWS
echo ==========================================
echo.
echo   Atalho criado com sucesso na Area de Trabalho!
echo   Agora voce pode abrir o sistema como um Programa.
echo.
echo ==========================================
pause`;

    const blob = new Blob([batContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Instalar_DM_Turismo.bat';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const formatBirthDate = (dateStr?: string) => {
    if (!dateStr) return 'Não inf.';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-8 gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter font-display">Fichário Operacional</h1>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-zinc-500 font-medium tracking-tight flex items-center gap-2">
              <Users size={14} />
              {employees.length} Colaboradores Registrados
            </p>
            <button 
              onClick={liberarAcessoParaTodos}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/50 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-900 hover:text-white transition-all shadow-lg active:scale-95 border border-white/5"
            >
              <Unlock size={12} />
              Liberar Acessos da Equipe
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center text-right justify-between md:justify-end w-full">
          {(showPointTab || showUsersTab) && (
            <div className="flex flex-wrap gap-1 p-1 bg-zinc-950/80 border border-white/5 rounded-2xl w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('employees')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                  currentTab === 'employees'
                    ? "bg-zinc-800 text-brand-accent shadow"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Users size={12} />
                Funcionários
              </button>
              {showPointTab && (
                <button
                  onClick={() => setActiveTab('point')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                    currentTab === 'point'
                      ? "bg-zinc-800 text-brand-accent shadow"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Clock size={12} />
                  Cartão Ponto
                </button>
              )}
              {showUsersTab && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                    currentTab === 'users'
                      ? "bg-zinc-800 text-brand-accent shadow"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <ShieldCheck size={12} />
                  Acessos
                </button>
              )}
              {showUsersTab && (
                <button
                  onClick={() => setActiveTab('permissions')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                    currentTab === 'permissions'
                      ? "bg-zinc-800 text-brand-accent shadow"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Key size={12} />
                  Permissões
                </button>
              )}
            </div>
          )}
          <div>
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">Hoje é dia</p>
            <p className="text-2xl font-black text-brand-accent tracking-tighter uppercase font-display">
              {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>
      
      {currentTab === 'employees' ? (
        <div className="space-y-6">
          {/* Barra de Pesquisa e Filtros Reativos */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-900/20 p-4 border border-white/5 rounded-3xl backdrop-blur-md">
            <div className="relative w-full md:max-w-md">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Pesquisar por nome, cargo, e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-white placeholder-zinc-500 focus:outline-none focus:border-brand-accent/50 transition-all uppercase tracking-wide"
              />
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-end">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mr-2">Cargo:</span>
              {availableRoles.map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all border",
                    roleFilter === role
                      ? "bg-zinc-800 text-brand-accent border-brand-accent/20 shadow-md"
                      : "bg-zinc-950/40 text-zinc-400 border-white/5 hover:text-white"
                  )}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button 
              onClick={onAddEmployee}
              className="h-full min-h-[220px] flex flex-col items-center justify-center gap-4 bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl hover:border-brand-accent/50 hover:bg-zinc-900/50 transition-all group"
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 group-hover:bg-brand-accent group-hover:text-zinc-950 transition-all">
                <Plus size={24} />
              </div>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Admitir Funcionário</span>
            </button>

            {filteredEmployees.map(e => {
            const expDate = e.licenseExpiration ? parseISO(e.licenseExpiration) : null;
            const daysToExpiry = expDate ? differenceInDays(expDate, new Date()) : null;
            const isExpiringSoon = e.role === 'Motorista' && daysToExpiry !== null && daysToExpiry <= 30;

            return (
              <Card 
                key={e.id} 
                onClick={() => onEditEmployee(e)}
                className={cn(
                  "relative overflow-hidden group border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-all cursor-pointer p-0",
                  isExpiringSoon && "border-amber-500/50"
                )}
              >
                {isExpiringSoon && (
                  <div className="absolute top-2 right-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center gap-1 z-10">
                    <AlertTriangle size={12} />
                    <span className="text-[8px] font-black uppercase tracking-widest">{daysToExpiry! < 0 ? 'VENCIDA' : `Vence em ${daysToExpiry} d`}</span>
                  </div>
                )}
                <div className="p-6 border-b border-zinc-800/50 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative group/avatar w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 overflow-hidden shrink-0">
                    {e.photoUrl ? (
                      <ImageOptimizer src={e.photoUrl} alt={e.name} className="w-full h-full object-cover" maxWidth={150} quality={0.7} />
                    ) : (
                      <Users size={24} />
                    )}
                    {onUpdateEmployeePhoto && (
                      <label 
                        onClick={(evt) => evt.stopPropagation()}
                        className="absolute inset-0 bg-black/75 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer"
                        title="Upload Foto"
                      >
                        <Camera size={14} className="text-white" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(evt) => {
                            evt.stopPropagation();
                            const file = evt.target.files?.[0];
                            if (file) {
                              optimizeImageBeforeUpload(file, 200, 0.75)
                                .then((compressedBase64) => {
                                  onUpdateEmployeePhoto(e.id, compressedBase64);
                                })
                                .catch((err) => {
                                  console.error('Failed to optimize avatar upload:', err);
                                  // Fallback to traditional reader on error
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    onUpdateEmployeePhoto(e.id, reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                });
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-white uppercase text-sm tracking-tight leading-none mb-1.5">{e.name}</h4>
                    <span className="text-[8px] font-black px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded uppercase tracking-widest">{e.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={(evt) => {
                      evt.stopPropagation();
                      const appUrl = window.location.origin;
                      const shareUrl = `${appUrl}/?emp=${e.id}`;
                      let permissionText = "Permissões padrão de " + (e.role || "Funcionário");
                      if (e.permissions && e.permissions.length > 0) {
                        const labels: Record<string, string> = {
                          dashboard: "Painel",
                          trips: "Trabalhos",
                          fleet: "Gestão de Frotas",
                          finance: "Financeiros",
                          fuel: "Abastecimento",
                          inventory: "Almoxarifado",
                          gabinete: "Gabinete"
                        };
                        permissionText = e.permissions.map(p => labels[p] || p).join(", ");
                      }

                      const message = `🚀 *DM TURISMO PRO - TERMINAL DE OPERAÇÕES*%0A%0AOlá *${e.name}*! 👋%0A%0AO seu acesso personalizado para o aplicativo da DM Turismo foi pré-estabelecido com as suas credenciais e permissões.%0A%0A💼 *CARGO:* ${e.role || "Colaborador"}%0A🔑 *AUTORIZAÇÕES:* ${permissionText}%0A%0A🔗 *SEU LINK EXCLUSIVO:*%0A${shareUrl}%0A%0A*COMO INSTALAR / UTILIZAR:*%0A1. Abra o link acima no seu smartphone.%0A2. No menu do navegador, clique em "Adicionar à Tela de Início" (para obter o ícone de Aplicativo PWA).%0A3. Todo o seu painel de relatórios, escalas de trabalho e jornadas estará acessível sem necessidade de novas configurações!%0A%0A_DM Turismo - prazer em viajar bem._`;
                      
                      if (e.phone) {
                        const cleanPhone = e.phone.replace(/\D/g, '');
                        const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
                        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;
                        window.open(whatsappUrl, '_blank');
                      } else {
                        navigator.clipboard.writeText(shareUrl).then(() => {
                          toast.success("Link exclusivo copiado! Envie-o para o funcionário.");
                        }).catch(() => {
                          toast.error("Erro ao copiar o link para área de transferência.");
                        });
                      }
                    }}
                    className="p-2 text-zinc-500 hover:text-brand-accent rounded-lg transition-all"
                    title="Compartilhar Acesso Credenciado"
                  >
                    <Share2 size={16} />
                  </button>
                  <button 
                    onClick={(evt) => {
                      evt.stopPropagation();
                      onDeleteEmployee(e.id, e.name);
                    }}
                    className="p-2 text-zinc-600 hover:text-rose-500 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="p-6">
                 <div className="flex items-center gap-2">
                   <div className="flex-1 px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-lg text-[10px] font-bold text-zinc-500 font-mono">
                      {e.phone || 'N/A'} • 🎂 {formatBirthDate(e.birthDate)}
                   </div>
                   {e.name.toLowerCase().includes('elizeu ferron') && (
                      <button 
                        onClick={downloadInstaller}
                        className="px-3 py-2 bg-brand-accent text-zinc-950 rounded-lg flex items-center gap-2 text-[8px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-brand-accent/20"
                        title="Baixar Executável Windows"
                      >
                        <Monitor size={12} />
                        Instalador
                      </button>
                    )}
                </div>
              </div>
            </Card>
            );
          })}
          </div>
        </div>
      ) : currentTab === 'point' ? (
        <div className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 backdrop-blur-md shadow-2xl animate-in fade-in duration-300">
          <PointManagement user={user} />
        </div>
      ) : currentTab === 'permissions' ? (
        <div className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 backdrop-blur-md shadow-2xl animate-in fade-in duration-300">
          <PermissionsManagement />
        </div>
      ) : (
        <div className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 backdrop-blur-md shadow-2xl animate-in fade-in duration-300">
          <UserManagement employees={employees} />
        </div>
      )}
    </div>
  );
};
