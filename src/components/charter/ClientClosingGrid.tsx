import React, { useState } from 'react';
import { safeFormatDate } from './CharterUtils';
import { Calendar, DollarSign, Plus, Trash2, Printer, Sparkles, AlertCircle } from 'lucide-react';

export interface ExtraServiceItem {
  id: string;
  description: string;
  value: number;
}

export interface ClientClosingGridProps {
  client: any;
  closingMonthYear: string; // "yyyy-MM" (ex: "2026-06")
  trips: any[]; // ClientTrip[]
  showValues?: boolean;
  onGenerateGridPDF?: (extraServices: ExtraServiceItem[]) => void;
}

export const ClientClosingGrid: React.FC<ClientClosingGridProps> = ({
  client,
  closingMonthYear,
  trips,
  showValues = true,
  onGenerateGridPDF
}) => {
  const [extraServices, setExtraServices] = useState<ExtraServiceItem[]>([]);
  const [newExtraDesc, setNewExtraDesc] = useState('');
  const [newExtraVal, setNewExtraVal] = useState<number | ''>('');

  // Extrair Ano e Mês da competência
  const [yearStr, monthStr] = closingMonthYear ? closingMonthYear.split('-') : ['2026', '06'];
  const year = parseInt(yearStr, 10) || 2026;
  const month = parseInt(monthStr, 10) || 6;

  // Quantidade de dias no mês
  const daysInMonth = new Date(year, month, 0).getDate();

  // Gerar lista com todos os dias do mês
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateObj = new Date(year, month - 1, dayNum);
    const dayOfWeek = dateObj.getDay(); // 0: DOM, 6: SÁB
    const formattedDate = `${dayNum.toString().padStart(2, '0')}/${monthStr.padStart(2, '0')}/${year}`;
    const isoDate = `${yearStr}-${monthStr.padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
    
    return {
      dayNum,
      dateObj,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      formattedDate,
      isoDate
    };
  });

  // Agrupar viagens por dia e por turno (Manhã: <12:00, Tarde: >=12:00 e <18:00, Noturno/Outros)
  // Para manter o layout idêntico à imagem de referência: Colunas MANHÃ e TARDE
  const getTripsForDayAndTurn = (isoDate: string) => {
    const dayTrips = trips.filter(t => {
      const tripDateStr = t.dateTime ? t.dateTime.split('T')[0] : '';
      return tripDateStr === isoDate;
    });

    const manhaTrips = dayTrips.filter(t => {
      if (!t.dateTime) return false;
      const hour = parseInt(t.dateTime.split('T')[1]?.split(':')[0] || '0', 10);
      return hour < 12 || (t.description && t.description.toLowerCase().includes('manhã'));
    });

    const tardeTrips = dayTrips.filter(t => {
      if (!t.dateTime) return false;
      const hour = parseInt(t.dateTime.split('T')[1]?.split(':')[0] || '12', 10);
      return hour >= 12 || (t.description && t.description.toLowerCase().includes('tarde'));
    });

    return { dayTrips, manhaTrips, tardeTrips };
  };

  // Calcular totais
  let totalManha = 0;
  let diasTrabalhadosManha = 0;

  let totalTarde = 0;
  let diasTrabalhadosTarde = 0;

  monthDays.forEach(d => {
    const { manhaTrips, tardeTrips } = getTripsForDayAndTurn(d.isoDate);
    
    if (manhaTrips.length > 0) {
      diasTrabalhadosManha++;
      manhaTrips.forEach(t => {
        const val = client.defaultTripValue || t.value || 0;
        totalManha += val;
      });
    }

    if (tardeTrips.length > 0) {
      diasTrabalhadosTarde++;
      tardeTrips.forEach(t => {
        const val = client.defaultTripValue || t.value || 0;
        totalTarde += val;
      });
    }
  });

  const totalExtras = extraServices.reduce((acc, item) => acc + item.value, 0);
  const valorTotalGeral = totalManha + totalTarde + totalExtras;

  const handleAddExtraService = () => {
    if (!newExtraDesc.trim() || !newExtraVal || newExtraVal <= 0) return;
    setExtraServices([
      ...extraServices,
      {
        id: Math.random().toString(36).substring(2, 9),
        description: newExtraDesc.trim().toUpperCase(),
        value: Number(newExtraVal)
      }
    ]);
    setNewExtraDesc('');
    setNewExtraVal('');
  };

  const handleRemoveExtraService = (id: string) => {
    setExtraServices(extraServices.filter(e => e.id !== id));
  };

  return (
    <div className="bg-white text-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-6 font-sans">
      {/* Cabeçalho do Fechamento */}
      <div className="bg-slate-200 border-2 border-slate-400 rounded-2xl p-4 text-center shadow-sm">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider font-mono">
          FECHAMENTO {monthStr}/{year} - {client?.name?.toUpperCase() || 'CLIENTE'}
        </h2>
        {client?.companyName && (
          <p className="text-xs font-bold text-slate-600 uppercase mt-1">
            {client.companyName}
          </p>
        )}
      </div>

      {/* Tabela do Mês Padronizada */}
      <div className="overflow-x-auto rounded-2xl border-2 border-slate-300">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="bg-slate-300 text-slate-900 font-black text-xs uppercase tracking-wider border-b-2 border-slate-400">
              <th className="py-2.5 px-3 border-r-2 border-slate-400 w-1/3">DIA</th>
              <th className="py-2.5 px-3 border-r-2 border-slate-400 w-1/3">MANHÃ</th>
              <th className="py-2.5 px-3 w-1/3">TARDE</th>
            </tr>
          </thead>
          <tbody className="text-xs font-bold divide-y divide-slate-300">
            {monthDays.map(d => {
              const { manhaTrips, tardeTrips } = getTripsForDayAndTurn(d.isoDate);
              const hasManha = manhaTrips.length > 0;
              const hasTarde = tardeTrips.length > 0;

              return (
                <tr key={d.isoDate} className="hover:bg-slate-50 transition-colors">
                  {/* Célula DIA */}
                  <td className="py-2 px-3 border-r-2 border-slate-300 font-mono text-slate-800 bg-slate-100">
                    {d.formattedDate}
                  </td>

                  {/* Célula MANHÃ */}
                  <td className={`py-2 px-3 border-r-2 border-slate-300 ${
                    hasManha 
                      ? 'bg-lime-200 text-slate-900 font-black font-mono' 
                      : d.isWeekend 
                        ? 'bg-orange-200 text-amber-900 font-extrabold text-[10px]' 
                        : 'bg-slate-100 text-slate-500 font-medium text-[10px]'
                  }`}>
                    {hasManha ? (
                      showValues 
                        ? `R$ ${(client.defaultTripValue || manhaTrips[0].value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                        : 'R$ ***'
                    ) : d.isWeekend ? (
                      'FINAL DE SEMANA'
                    ) : (
                      'SEM OPERAÇÃO'
                    )}
                  </td>

                  {/* Célula TARDE */}
                  <td className={`py-2 px-3 ${
                    hasTarde 
                      ? 'bg-lime-200 text-slate-900 font-black font-mono' 
                      : d.isWeekend 
                        ? 'bg-orange-200 text-amber-900 font-extrabold text-[10px]' 
                        : 'bg-slate-100 text-slate-500 font-medium text-[10px]'
                  }`}>
                    {hasTarde ? (
                      showValues 
                        ? `R$ ${(client.defaultTripValue || tardeTrips[0].value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                        : 'R$ ***'
                    ) : d.isWeekend ? (
                      'FINAL DE SEMANA'
                    ) : (
                      'SEM OPERAÇÃO'
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Linha de Subtotais da Tabela */}
            <tr className="bg-lime-300 text-slate-900 font-black font-mono text-xs border-t-2 border-slate-400">
              <td className="py-2 px-3 border-r-2 border-slate-400 bg-slate-200">
                SOMA DOS TURNOS:
              </td>
              <td className="py-2 px-3 border-r-2 border-slate-400">
                {showValues ? `R$ ${totalManha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ***'}
              </td>
              <td className="py-2 px-3">
                {showValues ? `R$ ${totalTarde.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ***'}
              </td>
            </tr>

            {/* Linha de Dias Trabalhados */}
            <tr className="bg-slate-200 text-slate-900 font-black text-xs uppercase border-t-2 border-slate-400">
              <td className="py-2.5 px-3 border-r-2 border-slate-400 text-left font-mono">
                DIAS TRABALHADOS:
              </td>
              <td className="py-2.5 px-3 border-r-2 border-slate-400 font-mono text-sm bg-lime-100">
                {diasTrabalhadosManha}
              </td>
              <td className="py-2.5 px-3 font-mono text-sm bg-lime-100">
                {diasTrabalhadosTarde}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Seção de Servicos Adicionais / Extras (Ex: Plotagem Veicular) */}
      <div className="space-y-3 bg-slate-50 p-4 border-2 border-slate-300 rounded-2xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Sparkles size={14} className="text-amber-500" /> Serviços Adicionais & Lançamentos Extras
          </span>
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Ex: Plotagem, Horas Extras, Higienização
          </span>
        </div>

        {/* Lista de Extras */}
        {extraServices.length > 0 && (
          <div className="space-y-2">
            {extraServices.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-lime-200/80 p-2.5 border border-lime-400 rounded-xl font-mono text-xs">
                <span className="font-extrabold text-slate-900 uppercase">{item.description}</span>
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-900">
                    {showValues ? `R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ***'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExtraService(item.id)}
                    className="text-rose-600 hover:text-rose-800 transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form para Adicionar Extra */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-1">
          <input
            type="text"
            placeholder="Descrição do Adicional (Ex: PLOTAGEM VEICULAR)"
            value={newExtraDesc}
            onChange={e => setNewExtraDesc(e.target.value)}
            className="md:col-span-7 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 uppercase font-mono outline-none focus:border-slate-500"
          />
          <input
            type="number"
            placeholder="Valor R$"
            value={newExtraVal}
            onChange={e => setNewExtraVal(e.target.value === '' ? '' : Number(e.target.value))}
            className="md:col-span-3 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono outline-none focus:border-slate-500"
          />
          <button
            type="button"
            onClick={handleAddExtraService}
            className="md:col-span-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-1.5 px-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Caixa do Valor Total Final */}
      <div className="bg-lime-400 border-2 border-lime-600 rounded-2xl p-4 flex justify-between items-center shadow-md">
        <span className="text-sm font-black text-slate-950 uppercase tracking-widest font-mono">
          VALOR TOTAL:
        </span>
        <span className="text-2xl font-black text-slate-950 font-mono tracking-tight">
          {showValues ? `R$ ${valorTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ***'}
        </span>
      </div>

      {/* Botão de Ação para Exportar o PDF do Fechamento no Novo Formato */}
      {onGenerateGridPDF && (
        <button
          type="button"
          onClick={() => onGenerateGridPDF(extraServices)}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
        >
          <Printer size={15} className="text-lime-400" /> Exportar Fechamento em PDF Padronizado (Modelo Imagem)
        </button>
      )}
    </div>
  );
};
