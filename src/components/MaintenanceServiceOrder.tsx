import React, { useRef, useState } from 'react';
import { 
  Printer, 
  Wrench, 
  Bus, 
  Calendar, 
  Clock, 
  FileText,
  ShieldCheck,
  Check,
  Share2,
  FileDown,
  Circle,
  Hash,
  Activity,
  DollarSign,
  Type,
  FileCode,
  PenTool,
  X
} from 'lucide-react';

import { MaintenanceLog, Vehicle } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from './UI';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { SignaturePad } from './SignaturePad';


interface MaintenanceServiceOrderProps {
  log: MaintenanceLog;
  vehicle?: Vehicle;
}

export const MaintenanceServiceOrder = ({ log, vehicle }: MaintenanceServiceOrderProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [driverSignature, setDriverSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isReadMode, setIsReadMode] = useState(false);
  const orderRef = useRef<HTMLDivElement>(null);


  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!orderRef.current) return;
    setIsGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const osNum = log.id?.substring(0, 8).toUpperCase() || 'NEW';
      const canvas = await html2canvas(orderRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`OS_MANUTENCAO_${vehicle?.plate || 'VEICULO'}_${osNum}.pdf`);
      toast.success('OS de Manutenção (Layout) gerada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF (Layout)');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadTextPDF = async () => {
    setIsGenerating(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const pdf = new jsPDF();
      const osNum = log.id?.substring(0, 8).toUpperCase() || 'NEW';
      const margin = 15;
      const pageWidth = pdf.internal.pageSize.getWidth();
      let currentY = 20;

      // Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(30, 30, 30);
      pdf.text("DM TURISMO", margin, currentY);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text("CENTRO DE MANUTENÇÃO INTELIGENTE", margin, currentY + 7);
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text(`OS: ${osNum}`, pageWidth - margin - 40, currentY + 5);
      
      currentY += 20;
      pdf.setDrawColor(240, 240, 240);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // Service Header
      pdf.setFontSize(16);
      pdf.text("RELATÓRIO TÉCNICO DE MANUTENÇÃO", margin, currentY);
      currentY += 10;

      // Basic Info
      autoTable(pdf, {
        startY: currentY,
        margin: { left: margin },
        head: [['VEÍCULO', 'DETALHES']],
        body: [
          ['Placa', vehicle?.plate || '---'],
          ['Modelo', vehicle?.model || '---'],
          ['Ano', vehicle?.factoryYear?.toString() || '---'],
          ['Odômetro', `${log.odometer?.toLocaleString() || '---'} KM`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [40, 40, 40] },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // Service Details
      autoTable(pdf, {
        startY: currentY,
        margin: { left: margin },
        head: [['SERVIÇO', 'INFORMAÇÃO']],
        body: [
          ['Tipo', log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'],
          ['Status', log.status === 'completed' ? 'CONCLUÍDO' : 'EM ANDAMENTO'],
          ['Data', log.completedAt ? format(parseISO(log.completedAt), "dd/MM/yyyy") : format(parseISO(log.scheduledDate), "dd/MM/yyyy")],
          ['Custo Total', `R$ ${log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [60, 60, 60] },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // Description
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("DESCRIÇÃO DO SERVIÇO", margin, currentY);
      currentY += 7;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const splitDesc = pdf.splitTextToSize(log.description, pageWidth - (2 * margin));
      pdf.text(splitDesc, margin, currentY);

      pdf.save(`OS_MANUTENCAO_TEXTO_${osNum}.pdf`);
      toast.success('PDF (Texto) gerado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF (Texto)');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadWord = async () => {
    setIsGenerating(true);
    try {
        const docx = await import('docx');
        const fileSaver = await import('file-saver');
        const saveAs = fileSaver.saveAs;
        const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = docx;

        const osNum = log.id?.substring(0, 8).toUpperCase() || 'NEW';
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "DM TURISMO",
                                bold: true,
                                size: 48,
                                color: "1E1E1E",
                            }),
                        ],
                        spacing: { after: 200 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "CENTRO DE MANUTENÇÃO INTELIGENTE",
                                size: 20,
                                color: "646464",
                            }),
                        ],
                        spacing: { after: 400 },
                    }),
                    new Paragraph({
                        text: `ORDEM DE SERVIÇO DE MANUTENÇÃO: ${osNum}`,
                        heading: HeadingLevel.HEADING_2,
                        spacing: { after: 300 },
                    }),
                    
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ITEM", bold: true })] })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "DESCRIÇÃO", bold: true })] })] }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("VEÍCULO (PLACA)")] }),
                                    new TableCell({ children: [new Paragraph(vehicle?.plate || '---')] }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("ODÔMETRO")] }),
                                    new TableCell({ children: [new Paragraph(`${log.odometer || '---'} KM`)] }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("TIPO")] }),
                                    new TableCell({ children: [new Paragraph(log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA')] }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("DATA")] }),
                                    new TableCell({ children: [new Paragraph(log.completedAt ? format(parseISO(log.completedAt), "dd/MM/yyyy") : format(parseISO(log.scheduledDate), "dd/MM/yyyy"))] }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("CUSTO TOTAL")] }),
                                    new TableCell({ children: [new Paragraph(`R$ ${log.cost.toLocaleString()}`)] }),
                                ]
                            }),
                        ]
                    }),

                    new Paragraph({ text: "", spacing: { before: 400 } }),
                    new Paragraph({ 
                        text: "DESCRIÇÃO DOS SERVIÇOS", 
                        heading: HeadingLevel.HEADING_3,
                        spacing: { after: 200 }
                    }),
                    new Paragraph({ text: log.description, spacing: { after: 600 } }),

                    new Paragraph({ text: "", spacing: { before: 800 } }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "_______________________________________", color: "000000" }),
                            new TextRun({ text: "\nASSINATURA DO TÉCNICO", size: 16, bold: true, break: 1 })
                        ]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `OS_MANUTENCAO_${osNum}.docx`);
        toast.success('Arquivo Word gerado com sucesso!');
    } catch (error) {
        console.error(error);
        toast.error('Erro ao gerar arquivo Word');
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      {!isReadMode && (
        <div className="flex flex-wrap items-center justify-end gap-3 no-print p-4 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl">
          <div className="flex-1 flex items-center gap-4 px-4 border-r border-zinc-800">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Wrench size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Manutenção Técnica</p>
              <p className="text-sm font-black text-white uppercase tracking-tight">Relatório de Serviço Mecânico</p>
            </div>
          </div>

          <Button 
            variant="secondary"
            onClick={() => setIsReadMode(true)}
            className="gap-2 bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700 h-12 px-6 rounded-2xl"
          >
            <FileText size={18} />
            MODO LEITURA
          </Button>

          <Button 
            variant="secondary"
            onClick={handleDownloadTextPDF} 
            disabled={isGenerating}
            className="gap-2 bg-asphalt-800 text-zinc-400 hover:text-white border-asphalt-700 h-12 px-6 rounded-2xl"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Type size={18} />}
            PDF (TEXTO)
          </Button>

          <Button 
            variant="secondary"
            onClick={handleDownloadWord} 
            disabled={isGenerating}
            className="gap-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border-blue-500/20 h-12 px-6 rounded-2xl"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <FileCode size={18} />}
            WORD
          </Button>

          <Button 
            variant="secondary"
            onClick={handleDownloadPDF} 
            disabled={isGenerating}
            className="gap-2 bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-zinc-200 h-12 px-6 rounded-2xl"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
            PDF (LAYOUT)
          </Button>

          <Button onClick={handlePrint} disabled={isGenerating} className="gap-2 h-12 px-6 rounded-2xl bg-amber-500 text-zinc-950 hover:bg-white border-amber-500 transition-all font-black">
            <Printer size={18} />
            IMPRIMIR RELATÓRIO
          </Button>
          <Button onClick={() => setShowSignaturePad(true)} className="gap-2 h-12 px-6 rounded-2xl bg-zinc-800 text-white hover:bg-zinc-700 transition-all font-black">
            <PenTool size={18} />
            ASSINAR
          </Button>
        </div>
      )}

      {/* Exit Read Mode floating button */}
      {isReadMode && (
        <button 
          onClick={() => setIsReadMode(false)}
          className="fixed top-6 right-6 z-[60] bg-zinc-900 text-white p-4 rounded-full shadow-2xl hover:bg-zinc-700 transition-all"
        >
          <X size={24} />
        </button>
      )}

      {/* Signature Section */}
      {showSignaturePad && !driverSignature && (
        <SignaturePad onSignatureConfirmed={(data) => { setDriverSignature(data); setShowSignaturePad(false); }} />
      )}

      {/* Document Container */}
      <div 
        ref={orderRef}
        className="bg-white text-zinc-900 mx-auto rounded-none border shadow-2xl font-sans w-full max-w-[210mm] min-h-[297mm] print:p-0 print:m-0 print:shadow-none print:border-0 relative overflow-hidden"
      >
        {/* Top Accent */}
        <div className="absolute top-0 right-0 left-0 h-2 bg-amber-500" />
        
        <div className="p-12">
          {/* Header */}
          <div className="grid grid-cols-2 gap-10 border-b-2 border-zinc-100 pb-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center text-amber-500 shadow-xl">
                  <Activity size={32} strokeWidth={2.5} />
                </div>
                <div>
                   <h1 className="text-3xl font-black uppercase tracking-tighter leading-none text-zinc-900">DM TURISMO</h1>
                   <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-2">Centro de Manutenção Inteligente</p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="bg-zinc-50 border-2 border-zinc-100 p-6 rounded-3xl inline-block min-w-[240px] shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-2">Relatório Técnico de Serviço</p>
                <p className="text-3xl font-black tabular-nums text-zinc-900">
                  #{log.id?.substring(0, 8).toUpperCase() || 'PROCESSO'}
                </p>
                <div className={cn(
                  "mt-3 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest inline-block border",
                  log.status === 'completed' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-amber-50 border-amber-100 text-amber-600"
                )}>
                  {log.status === 'completed' ? 'SERVIÇO CONCLUÍDO' : 'EM PROCESSAMENTO'}
                </div>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase mt-4 tracking-widest flex items-center justify-end gap-2">
                <Calendar size={12} /> Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}
              </p>
            </div>
          </div>

          {/* Vehicle Stats Bar */}
          <div className="grid grid-cols-4 gap-4 mb-12">
            <div className="bg-zinc-900 text-white p-6 rounded-[30px] flex flex-col justify-between h-32 shadow-xl">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Unidade / Placa</p>
              <p className="text-2xl font-black tracking-tight" contentEditable suppressContentEditableWarning>{vehicle?.plate || '---'}</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 p-6 rounded-[30px] flex flex-col justify-between h-32">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Modelo / Ano</p>
              <p className="text-lg font-black text-zinc-800" contentEditable suppressContentEditableWarning>{vehicle?.model || '---'} {vehicle?.factoryYear}</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 p-6 rounded-[30px] flex flex-col justify-between h-32">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Odômetro no Ato</p>
              <p className="text-xl font-black text-zinc-800 tabular-nums" contentEditable suppressContentEditableWarning>{log.odometer?.toLocaleString() || '---'} KM</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 p-6 rounded-[30px] flex flex-col justify-between h-32">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Total Investido</p>
              <p className="text-xl font-black text-emerald-600 tabular-nums">R$ {log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Service Details */}
          <div className="grid grid-cols-12 gap-12 mb-12">
            <div className="col-span-12 lg:col-span-8 space-y-10">
              <div className="p-10 bg-zinc-50 rounded-[40px] border border-zinc-100 relative">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
                    <FileText size={18} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Descrição Detalhada do Serviço</h3>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm min-h-[150px] mb-8">
                  <p className="text-sm text-zinc-600 leading-relaxed font-medium whitespace-pre-wrap" contentEditable suppressContentEditableWarning>
                    {log.description}
                  </p>
                </div>

                {log.checklist && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-2">Checks Técnicos de Intervenção</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'oilChanged', label: 'Troca de Óleo' },
                        { key: 'filtersChanged', label: 'Troca de Filtros' },
                        { key: 'frontPadsChanged', label: 'Pastilha Dianteira' },
                        { key: 'rearPadsChanged', label: 'Pastilha Traseira' },
                        { key: 'frontDiscsChanged', label: 'Disco Dianteiro' },
                        { key: 'rearDiscsChanged', label: 'Disco Traseira' },
                        { key: 'airConditioning', label: 'Ar Condicionado' },
                        { key: 'tires', label: 'Pneus / Rodas' },
                        { key: 'suspension', label: 'Suspensão' },
                        { key: 'transmission', label: 'Transmissão' },
                        { key: 'bathroom', label: 'Banheiro' },
                        { key: 'minibar', label: 'Frigobar' },
                        { key: 'tachograph', label: 'Tacógrafo' }
                      ].filter(item => (log.checklist as any)[item.key]).map(item => (
                        <div key={item.key} className="flex items-center gap-2 p-3 bg-white border border-zinc-100 rounded-xl">
                          <Check size={12} className="text-emerald-500" />
                          <span className="text-[9px] font-bold text-zinc-700 uppercase">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="p-8 bg-zinc-50 rounded-[35px] border border-zinc-100">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-6">Classificação do Serviço</h4>
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-brand-accent">
                        {log.type === 'preventive' ? <ShieldCheck size={24} /> : <Activity size={24} />}
                     </div>
                     <div>
                        <p className="text-xl font-black text-zinc-900 uppercase tracking-tight">{log.type === 'preventive' ? 'Preventiva' : 'Corretiva'}</p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Protocolo de Segurança</p>
                     </div>
                  </div>
                </div>
                <div className="p-8 bg-zinc-50 rounded-[35px] border border-zinc-100">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-6">Data de Execução</h4>
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-brand-accent">
                        <Clock size={24} />
                     </div>
                     <div>
                        <p className="text-xl font-black text-zinc-900 tracking-tight">
                          {log.completedAt ? format(parseISO(log.completedAt), "dd/MM/yyyy") : format(parseISO(log.scheduledDate), "dd/MM/yyyy")}
                        </p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Finalização do Processo</p>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-8">
              <div className="p-8 bg-zinc-900 text-white rounded-[40px] shadow-2xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl" />
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="text-amber-500" size={24} />
                    <h3 className="text-sm font-black uppercase tracking-widest">Resumo Financeiro</h3>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-end">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Mão de Obra / Peças</p>
                      <p className="text-lg font-black text-white italic tracking-tighter">TOTALIZADO</p>
                    </div>
                    <p className="text-4xl font-black text-amber-500 tabular-nums tracking-tighter">
                      R$ {log.cost.toLocaleString()}
                    </p>
                    <p className="text-[8px] font-bold text-zinc-500 uppercase leading-relaxed italic">
                      VALOR CALCULADO COM BASE NO RELATÓRIO TÉCNICO E CONTRATOS DE MANUTENÇÃO VIGENTES.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 rounded-[40px] border border-zinc-100 flex flex-col items-center justify-center text-center space-y-4">
                 <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-300">
                   <Hash size={32} />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Contador de Frota</p>
                   <p className="text-xs font-bold text-zinc-500">Este documento é o registro nº {log.id?.substring(0, 4)} de processos técnicos realizados este ano.</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Signature Sections */}
          <div className="mt-20 pt-20 border-t-2 border-zinc-50">
            <div className="grid grid-cols-2 gap-24">
              <div className="text-center group">
                 <div className="w-full h-0.5 bg-zinc-200 mb-6 group-hover:bg-zinc-900 transition-colors" />
                 <p className="text-[11px] font-black uppercase tracking-widest text-zinc-900 mb-1">Mecânico / Técnico Responsável</p>
                 <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Assinatura Certificada</p>
              </div>
              <div className="text-center group">
                 {driverSignature ? (
                    <img src={driverSignature} alt="Assinatura do Motorista" className="h-20 mx-auto" />
                 ) : (
                    <div className="w-full h-0.5 bg-zinc-200 mb-6 group-hover:bg-zinc-900 transition-colors" />
                 )}
                 <p className="text-[11px] font-black uppercase tracking-widest text-zinc-900 mb-1">Assinatura do Motorista</p>
                 <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Validação Administrativa</p>
              </div>
            </div>
            
            <div className="mt-20 text-center space-y-4">
              <p className="text-[7px] font-black text-zinc-300 uppercase tracking-[0.5em] leading-relaxed">
                Relatório gerado digitalmente via DM Turismo. O histórico de manutenção é auditável e compõe o dossiê legal do veículo conforme normas de segurança de transporte terrestre.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Loader2 = ({ size, className }: { size: number, className?: string }) => {
  return <Circle className={cn("animate-spin", className)} size={size} />;
};
