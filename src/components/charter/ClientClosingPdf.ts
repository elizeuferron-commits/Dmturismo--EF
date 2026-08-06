import { format } from 'date-fns';
import { ExtraServiceItem } from './ClientClosingGrid';

export const exportGridClosingPdf = async (
  client: any,
  closingMonthYear: string,
  trips: any[],
  extraServices: ExtraServiceItem[],
  onPreviewReady: (preview: { pdfUrl: string, trips: any[], client: any, fileName: string }) => void
) => {
  const jsPDF = (await import('jspdf')).jsPDF;
  const autoTable = (await import('jspdf-autotable')).default;
  const pdfDoc = new jsPDF('portrait', 'mm', 'a4');

  // Competência
  const [yearStr, monthStr] = closingMonthYear ? closingMonthYear.split('-') : ['2026', '06'];
  const year = parseInt(yearStr, 10) || 2026;
  const month = parseInt(monthStr, 10) || 6;
  const daysInMonth = new Date(year, month, 0).getDate();

  // Gerar dias do mês
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

  // Agrupar viagens
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

  let totalManha = 0;
  let diasTrabalhadosManha = 0;

  let totalTarde = 0;
  let diasTrabalhadosTarde = 0;

  const tableData: any[] = [];

  monthDays.forEach(d => {
    const { manhaTrips, tardeTrips } = getTripsForDayAndTurn(d.isoDate);

    let manhaText = '';
    let manhaBgColor: [number, number, number] = [240, 240, 240]; // neutro

    let tardeText = '';
    let tardeBgColor: [number, number, number] = [240, 240, 240]; // neutro

    if (manhaTrips.length > 0) {
      diasTrabalhadosManha++;
      const val = client.defaultTripValue || manhaTrips[0].value || 0;
      totalManha += val;
      manhaText = `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      manhaBgColor = [163, 230, 53]; // lime-400 / verde
    } else if (d.isWeekend) {
      manhaText = 'FINAL DE SEMANA';
      manhaBgColor = [254, 215, 170]; // orange-200 / salmão
    } else {
      manhaText = 'SEM OPERAÇÃO';
      manhaBgColor = [245, 245, 245];
    }

    if (tardeTrips.length > 0) {
      diasTrabalhadosTarde++;
      const val = client.defaultTripValue || tardeTrips[0].value || 0;
      totalTarde += val;
      tardeText = `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      tardeBgColor = [163, 230, 53]; // lime-400 / verde
    } else if (d.isWeekend) {
      tardeText = 'FINAL DE SEMANA';
      tardeBgColor = [254, 215, 170]; // orange-200 / salmão
    } else {
      tardeText = 'SEM OPERAÇÃO';
      tardeBgColor = [245, 245, 245];
    }

    tableData.push({
      dia: d.formattedDate,
      manha: manhaText,
      tarde: tardeText,
      manhaBgColor,
      tardeBgColor
    });
  });

  // Título da Tabela superior
  const titleText = `FECHAMENTO ${monthStr}/${year} - ${client.name?.toUpperCase() || 'CLIENTE'}`;

  // Desenhar Título estilo Banner
  pdfDoc.setFillColor(203, 213, 225); // slate-300
  pdfDoc.rect(14, 12, 182, 12, 'F');
  pdfDoc.setDrawColor(100, 116, 139);
  pdfDoc.rect(14, 12, 182, 12, 'S');

  pdfDoc.setTextColor(15, 23, 42); // slate-900
  pdfDoc.setFontSize(13);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text(titleText, 105, 20, { align: 'center' });

  // Tabela autoTable
  autoTable(pdfDoc, {
    head: [['DIA', 'MANHA', 'TARDE']],
    body: tableData.map(row => [row.dia, row.manha, row.tarde]),
    startY: 27,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    headStyles: {
      fillColor: [203, 213, 225],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
      textColor: [15, 23, 42]
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        const rowItem = tableData[rowIndex];
        if (data.column.index === 1 && rowItem) {
          data.cell.styles.fillColor = rowItem.manhaBgColor;
        } else if (data.column.index === 2 && rowItem) {
          data.cell.styles.fillColor = rowItem.tardeBgColor;
        }
      }
    }
  });

  // Pegar Y final da tabela principal
  let finalY = (pdfDoc as any).lastAutoTable.finalY + 2;

  // Linha de Somas dos Turnos
  autoTable(pdfDoc, {
    body: [
      [
        '',
        `R$ ${totalManha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${totalTarde.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]
    ],
    startY: finalY,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    bodyStyles: {
      fillColor: [190, 242, 100], // lime-300
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    }
  });

  finalY = (pdfDoc as any).lastAutoTable.finalY + 1;

  // Linha de Dias Trabalhados
  autoTable(pdfDoc, {
    body: [
      [
        'DIAS TRABALHADOS:',
        diasTrabalhadosManha.toString(),
        diasTrabalhadosTarde.toString()
      ]
    ],
    startY: finalY,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    bodyStyles: {
      fillColor: [226, 232, 240], // slate-200
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    }
  });

  finalY = (pdfDoc as any).lastAutoTable.finalY + 6;

  // Se houver Serviços Extras / Plotagem
  const totalExtras = extraServices.reduce((acc, s) => acc + s.value, 0);

  if (extraServices.length > 0) {
    extraServices.forEach(item => {
      autoTable(pdfDoc, {
        body: [
          [
            item.description.toUpperCase(),
            `R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          ]
        ],
        startY: finalY,
        margin: { left: 14, right: 14 },
        theme: 'grid',
        columnStyles: {
          0: { cellWidth: 120, fontStyle: 'bold', fillColor: [241, 245, 249] },
          1: { cellWidth: 62, fontStyle: 'bold', halign: 'center', fillColor: [190, 242, 100] }
        }
      });
      finalY = (pdfDoc as any).lastAutoTable.finalY + 2;
    });
  }

  // Linha Final de Valor Total
  const valorTotalGeral = totalManha + totalTarde + totalExtras;

  autoTable(pdfDoc, {
    body: [
      [
        'VALOR TOTAL:',
        `R$ ${valorTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]
    ],
    startY: finalY + 2,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 120, fontStyle: 'bold', fillColor: [241, 245, 249] },
      1: { cellWidth: 62, fontStyle: 'bold', halign: 'center', fillColor: [132, 204, 22] } // lime-500
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [15, 23, 42]
    }
  });

  const blobUrl = pdfDoc.output('bloburl').toString();
  const fileName = `FECHAMENTO_${monthStr}_${year}_${client.name?.toUpperCase().replace(/\s+/g, '_')}.pdf`;

  onPreviewReady({
    pdfUrl: blobUrl,
    trips: trips,
    client: client,
    fileName: fileName
  });
};
