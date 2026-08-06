import React from 'react';
import { X, Printer, Barcode, Check, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrintableBoleto {
  description: string;
  amount: number;
  dueDate: string;
  installmentNum?: number;
  totalInstallments?: number;
  supplier?: string; // This acts as the client/payer name
}

interface BoletoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  boletos: PrintableBoleto[];
}

/**
 * Helper to generate a realistic 47-character Brazilian Boleto Line and Nosso Número.
 */
const generateBoletoDetails = (
  amount: number,
  dueDateStr: string,
  installmentNum: number,
  totalInstallments: number
) => {
  const amtCents = Math.round(amount * 100).toString().padStart(10, '0');
  
  const dateParts = dueDateStr.split('-');
  const year = dateParts[0] || '2026';
  const month = dateParts[1] || '05';
  const day = dateParts[2] || '21';
  
  // Deterministic codes for realistic looking slips
  const keyFactor = (installmentNum * 13) % 10;
  const part1 = `00190.5000${keyFactor}`;
  const part2 = `0000${installmentNum}.34567${(installmentNum + 2) % 10}`;
  const part3 = `${day}${month}${year.substring(2)}.12345${(installmentNum + 5) % 10}`;
  const part4 = "9"; // Checksum
  const part5 = `${year.substring(2)}${month}${day}${amtCents.substring(amtCents.length - 6)}`;
  
  const linhaDigitavel = `${part1} ${part2} ${part3} ${part4} ${part5}`;
  const codigoBarras = `00199${year}${month}${day}${amtCents}${installmentNum}${totalInstallments}48020120124`.substring(0, 44);
  const uniqueId = `Cob-${year}${month}${day}-${installmentNum}${totalInstallments}`;
  const nossoNumero = `17/${(100000 + installmentNum).toString().substring(1)}-${(installmentNum % 9)}`;
  const carteira = "17-G";
  const agenciaCodigo = "3450-4 / 12345-6";
  
  return {
    linhaDigitavel,
    codigoBarras,
    nossoNumero,
    carteira,
    agenciaCodigo,
    uniqueId
  };
};

/**
 * SVG Barcode generator that creates deterministic bars depending on the code.
 */
const renderBarcodeSvg = (code: string) => {
  const bars: React.ReactNode[] = [];
  let currentX = 0;
  
  let seed = 0;
  for (let i = 0; i < code.length; i++) {
    seed += code.charCodeAt(i);
  }
  
  const pseudoRandom = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  // Generate around 140 bars of variable weights
  for (let i = 0; i < 140; i++) {
    const width = Math.floor(pseudoRandom() * 3) + 1;
    const isGap = i % 2 === 1;
    if (!isGap) {
      bars.push(
        <rect
          key={i}
          x={currentX}
          y={0}
          width={width}
          height={55}
          fill="currentColor"
        />
      );
    }
    currentX += width;
  }
  
  return (
    <svg viewBox={`0 0 ${currentX} 55`} className="w-full h-12" preserveAspectRatio="none">
      <g className="text-zinc-950 print:text-black">
        {bars}
      </g>
    </svg>
  );
};

export const BoletoModal: React.FC<BoletoModalProps> = ({
  isOpen,
  onClose,
  title = "CARNÊ DE PAGAMENTOS",
  boletos
}) => {
  if (!isOpen || boletos.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto"
        >
          {/* Dynamic print-override styles */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-area, #print-area * {
                visibility: visible !important;
              }
              #print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: #ffffff !important;
                color: #000000 !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
              }
              /* Override styles for clean print rendering on standard paper */
              .print-ticket-box {
                background-color: #ffffff !important;
                color: #000000 !important;
                border: 1px dashed #000000 !important;
                margin-bottom: 2rem !important;
                page-break-inside: avoid !important;
              }
              .print-label {
                color: #555555 !important;
                font-size: 8px !important;
                font-weight: bold !important;
              }
              .print-value {
                color: #000000 !important;
                font-size: 11px !important;
                font-weight: 900 !important;
              }
              .print-bank-banner {
                border-bottom: 2px solid #000000 !important;
              }
              .print-logo-text {
                color: #000000 !important;
                font-weight: 900 !important;
              }
              .no-print {
                display: none !important;
              }
              .boleto-page-break {
                page-break-after: always !important;
                break-after: page !important;
              }
            }
          ` }} />

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-zinc-950 border border-zinc-900 rounded-3xl w-full max-w-5xl text-left shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent">
                  <Barcode size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase">Imprima ou salve os boletos das parcelas</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2.5 bg-brand-accent text-zinc-950 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-brand-accent/95 transition-all shadow-lg active:scale-95"
                >
                  <Printer size={14} strokeWidth={2.5} />
                  Imprimir Carnê
                </button>
                <button
                  onClick={onClose}
                  className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Scroll Container */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* Printable Area starts here */}
              <div id="print-area" className="space-y-8 pr-2">
                
                {boletos.map((boleto, idx) => {
                  const currentInstallment = boleto.installmentNum || (idx + 1);
                  const totalInstallments = boleto.totalInstallments || boletos.length;
                  const details = generateBoletoDetails(
                    boleto.amount,
                    boleto.dueDate,
                    currentInstallment,
                    totalInstallments
                  );

                  // Formatar a data de vencimento
                  const dateObj = new Date(boleto.dueDate + 'T00:00:00');
                  const formattedDueDate = isNaN(dateObj.getTime())
                    ? boleto.dueDate
                    : dateObj.toLocaleDateString('pt-BR');

                  return (
                    <div 
                      key={idx} 
                      className={`print-ticket-box bg-zinc-900/45 border border-zinc-800/80 rounded-2xl p-6 relative flex flex-col md:flex-row gap-6 print:text-black print:bg-white print:border-black ${
                        idx < boletos.length - 1 ? 'boleto-page-break' : ''
                      }`}
                    >
                      {/* Cutting scissors cue */}
                      <div className="absolute -top-3 left-6 px-3 py-0.5 bg-zinc-950 border border-dashed border-zinc-800 text-[8px] font-black text-zinc-500 uppercase tracking-widest rounded-full no-print">
                        ✂️ Recortar Parcela {currentInstallment}
                      </div>

                      {/* 1. CANHOTO (RECIBO DO PAGADOR) - Left Panel (1/3 width on desktop) */}
                      <div className="w-full md:w-1/3 flex flex-col justify-between border-b md:border-b-0 md:border-r border-dashed border-zinc-850/80 pr-0 md:pr-6 pb-6 md:pb-0 print:border-black">
                        <div className="space-y-3">
                          {/* Canhoto Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 print:border-black print-bank-banner">
                            <span className="text-[10px] font-black tracking-wiest text-white print-logo-text">DM TURISMO</span>
                            <span className="px-1.5 py-0.5 bg-zinc-800 text-[8px] font-bold text-zinc-400 print:bg-white print:text-black uppercase rounded">
                              {currentInstallment}/{totalInstallments}
                            </span>
                          </div>

                          {/* Canhoto Fields */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider print-label">Beneficiário</p>
                              <p className="text-[10px] font-black text-white uppercase truncate print-value">DM TURISMO LTDA</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider print-label">Pagador / Cliente</p>
                              <p className="text-[10px] font-black text-white uppercase truncate print-value">
                                {boleto.supplier || "CLIENTE COBRADO"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider print-label">Vencimento</p>
                              <p className="text-[10px] font-black text-emerald-400 font-mono print-value">{formattedDueDate}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider print-label">Valor cobrado</p>
                              <p className="text-xs font-black text-white font-mono print-value">
                                R$ {boleto.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider print-label">Nosso Número</p>
                              <p className="text-[9px] font-bold text-zinc-400 font-mono truncate print-value">{details.nossoNumero}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider print-label">Número Doc.</p>
                              <p className="text-[9px] font-bold text-zinc-400 font-mono truncate print-value">#{details.uniqueId}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-zinc-850/60 text-[8px] text-zinc-600 font-bold uppercase tracking-normal print:border-black">
                          Recibo do Pagador. Autenticação mecânica ou assinatura no verso.
                        </div>
                      </div>

                      {/* 2. FICHA DE COMPENSAÇÃO - Right Panel (2/3 width on desktop) */}
                      <div className="w-full md:w-2/3 flex flex-col justify-between space-y-4">
                        {/* Bank Banner */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-zinc-850 print:border-black print-bank-banner gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-white tracking-widest uppercase print-logo-text">DM COBRANÇAS</span>
                            <div className="h-4 w-px bg-zinc-800 print:bg-black" />
                            <span className="text-[10px] font-black text-brand-accent tracking-wider font-mono">001-9</span>
                          </div>
                          <div className="text-[9px] font-black text-white font-mono text-right truncate print-value">
                            {details.linhaDigitavel}
                          </div>
                        </div>

                        {/* Compensation Grid */}
                        <div className="border border-zinc-800 rounded-xl overflow-hidden print:border-black">
                          {/* Row 1 */}
                          <div className="grid grid-cols-4 border-b border-zinc-800 print:border-black">
                            <div className="col-span-3 p-2.5 border-r border-zinc-800 print:border-black">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Local de Pagamento</span>
                              <span className="text-[9px] font-black text-zinc-300 print-value">PAGÁVEL EM QUALQUER BANCO OU ATÉ O VENCIMENTO NO APP DO SEU BANCO</span>
                            </div>
                            <div className="p-2.5 bg-zinc-950/30 print:bg-white">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Vencimento</span>
                              <span className="text-xs font-black text-emerald-400 font-mono block text-right print-value">{formattedDueDate}</span>
                            </div>
                          </div>

                          {/* Row 2 */}
                          <div className="grid grid-cols-4 border-b border-zinc-800 print:border-black">
                            <div className="col-span-3 p-2.5 border-r border-zinc-800 print:border-black">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Beneficiário</span>
                              <span className="text-[10px] font-black text-white uppercase print-value">DM TURISMO LTDA — CNPJ: 12.345.678/0001-90</span>
                            </div>
                            <div className="p-2.5 bg-zinc-950/30 print:bg-white">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Agência / Código Beneficiário</span>
                              <span className="text-[9px] font-mono text-zinc-300 block text-right print-value">{details.agenciaCodigo}</span>
                            </div>
                          </div>

                          {/* Row 3 */}
                          <div className="grid grid-cols-4 border-b border-zinc-800 print:border-black">
                            <div className="p-2.5 border-r border-zinc-800 print:border-black">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Data Doc.</span>
                              <span className="text-[9px] font-mono text-zinc-300 print-value">21/05/2026</span>
                            </div>
                            <div className="p-2.5 border-r border-zinc-800 print:border-black">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Número do Documento</span>
                              <span className="text-[9px] font-mono text-zinc-300 truncate block print-value">#{details.uniqueId}</span>
                            </div>
                            <div className="p-2.5 border-r border-zinc-800 print:border-black">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Espécie Doc</span>
                              <span className="text-[9px] font-mono text-zinc-300 print-value">DS</span>
                            </div>
                            <div className="p-2.5 bg-zinc-950/30 print:bg-white">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Nosso Número</span>
                              <span className="text-[9px] font-mono text-zinc-300 block text-right print-value">{details.nossoNumero}</span>
                            </div>
                          </div>

                          {/* Row 4 */}
                          <div className="grid grid-cols-4 border-b border-zinc-800 print:border-black">
                            <div className="p-2.5 border-r border-zinc-800 print:border-black">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Uso do Banco</span>
                              <span className="text-[9px] font-mono text-zinc-300 print-value">N/A</span>
                            </div>
                            <div className="p-2.5 border-r border-zinc-800 print:border-black">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Carteira</span>
                              <span className="text-[9px] font-mono text-zinc-300 print-value">{details.carteira}</span>
                            </div>
                            <div className="p-2.5 border-r border-zinc-800 print:border-black">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Espécie</span>
                              <span className="text-[9px] font-mono text-zinc-300 print-value">R$</span>
                            </div>
                            <div className="p-2.5 bg-zinc-950/30 print:bg-white">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Valor do Documento</span>
                              <span className="text-[11px] font-black text-white font-mono block text-right print-value">
                                R$ {boleto.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Row 5 - Instructions */}
                          <div className="p-3 border-b border-zinc-800 print:border-black">
                            <span className="block text-[7px] text-zinc-500 font-bold uppercase tracking-wider print-label">Instruções de Responsabilidade do Beneficiário</span>
                            <div className="h-10 text-[8px] text-zinc-400 uppercase leading-normal font-bold space-y-0.5 print-value">
                              <p>• NÃO RECEBER APÓS O VENCIMENTO.</p>
                              <p>• REFERENTE À PARCELA {currentInstallment} DE {totalInstallments} DO CONTRATO DE TURISMO.</p>
                              <p>• PAGADOR RESPONSÁVEL POR REVER E SOLICITAR QUITAÇÃO AO AGENTE EMISSOR.</p>
                            </div>
                          </div>

                          {/* Row 6 - Payer details */}
                          <div className="p-3 bg-zinc-950/20 print:bg-white">
                            <span className="block text-[7px] text-zinc-500 font-bold uppercase print-label">Pagador / Cliente</span>
                            <div className="text-[10px] font-black text-white uppercase print-value">
                              {boleto.supplier || "CLIENTE COBRADO"}
                            </div>
                            <div className="text-[8px] text-zinc-500 font-bold uppercase mt-1 print-label">
                              Sacador / Avalista: DM TURISMO LTDA
                            </div>
                          </div>
                        </div>

                        {/* Barcode SVG Rendering */}
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="w-full sm:w-2/3 border border-zinc-800/40 p-2 rounded-xl bg-white print:border-black">
                            {renderBarcodeSvg(details.codigoBarras)}
                          </div>
                          <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-tight text-right w-full sm:w-1/3">
                            <p>Ficha de Compensação</p>
                            <p className="no-print">Autenticação mecânica integrada</p>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-900 flex justify-end gap-3 no-print">
              <button
                onClick={onClose}
                className="px-5 py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-450 hover:text-white rounded-xl text-xs uppercase tracking-widest border border-zinc-800 font-bold"
              >
                Fechar Visualização
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-3 bg-brand-accent hover:bg-brand-accent/90 text-zinc-950 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"
              >
                <Printer size={15} strokeWidth={2.5} />
                Imprimir Carnê Agora
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
