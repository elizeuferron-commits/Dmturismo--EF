import { format } from 'date-fns';
import { toast } from 'sonner';
import { Passenger, CharteredRoute, CustomTrip } from './CharterTypes';

export const parseSafeDate = (dateStr: any): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }
  
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d;
  }
  
  if (typeof dateStr === 'string') {
    const standardStr = dateStr.trim().replace(/\s+/, 'T');
    d = new Date(standardStr);
    if (!isNaN(d.getTime())) {
      return d;
    }
    
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      d = new Date(year, month, day, hour, minute);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }
  
  return null;
};

export const safeFormatDate = (dateStr: any, formatPattern: string = 'dd/MM/yyyy HH:mm', fallback: string = '--/--'): string => {
  try {
    const d = parseSafeDate(dateStr);
    if (!d) return fallback;
    return format(d, formatPattern);
  } catch (e) {
    console.error("Error formatting date:", dateStr, e);
    return fallback;
  }
};

export const getMapsDirUrl = (
  locationUrl?: string, 
  fallbackQuery?: string, 
  userCoords?: { lat: number; lng: number } | null
): string => {
  const origin = userCoords ? `${userCoords.lat},${userCoords.lng}` : 'My Location';
  const originParam = `&origin=${origin}`;
  const dirAction = '&travelmode=driving&dir_action=navigate';

  if (!locationUrl || locationUrl.trim() === '') {
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(fallbackQuery || '')}${dirAction}`;
  }

  const urlStr = locationUrl.trim();
  const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
  const match = urlStr.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${lat},${lng}${dirAction}`;
    }
  }

  const urlCoordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const urlMatch = urlStr.match(urlCoordRegex);
  if (urlMatch) {
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${urlMatch[1]},${urlMatch[2]}${dirAction}`;
  }

  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(urlStr)}${dirAction}`;
  }

  if (urlStr.includes('google.com/maps')) {
    const separator = urlStr.includes('?') ? '&' : '?';
    return `${urlStr}${separator}saddr=${origin}&dirflg=d&travelmode=driving&dir_action=navigate`;
  }

  return urlStr;
};

export const getMapsEmbedUrl = (
  locationUrl?: string, 
  fallbackQuery?: string, 
  userCoords?: { lat: number; lng: number } | null
): string => {
  let query = fallbackQuery || 'DM Turismo';
  if (locationUrl && locationUrl.trim() !== '') {
    const urlStr = locationUrl.trim();
    const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    const match = urlStr.match(coordRegex);
    if (match) {
      query = `${match[1]},${match[2]}`;
    } else if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      query = urlStr;
    } else {
      const urlCoordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const urlMatch = urlStr.match(urlCoordRegex);
      if (urlMatch) {
        query = `${urlMatch[1]},${urlMatch[2]}`;
      }
    }
  }
  const origin = userCoords ? `${userCoords.lat},${userCoords.lng}` : 'My Location';
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${encodeURIComponent(query)}&dirflg=d&t=&z=16&ie=UTF8&iwloc=&output=embed`;
};

export const extractCoordinates = (url?: string): { lat: number; lng: number } | null => {
  if (!url || typeof url !== 'string') return null;
  const decoded = decodeURIComponent(url);
  const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
  const match = decoded.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
};

export const exportRouteToGpx = (route: CharteredRoute) => {
  const passengers = route.passengers || [];
  if (passengers.length === 0) {
    toast.error("Esta rota não possui passageiros ou pontos cadastrados para criar o arquivo GPX.");
    return;
  }

  let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="DM Turismo Pro" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${route.name.replace(/[<>&'"]/g, '')} - ${route.client.replace(/[<>&'"]/g, '')}</name>
    <desc>Itinerario de passageiros para GPS Offline - DM Turismo (Cliente: ${route.client.replace(/[<>&'"]/g, '')})</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>`;

  let addedPointsCount = 0;

  passengers.forEach((psg, idx) => {
    const coords = extractCoordinates(psg.locationUrl);
    if (coords) {
      const pName = `${idx + 1} - ${psg.name.replace(/[<>&'"]/g, '')}`;
      const pDesc = `Embarque: ${psg.boardingTime || 'Sem horario'} | Contato: ${psg.phone || 'Sem telefone'}`;
      gpxContent += `
  <wpt lat="${coords.lat}" lon="${coords.lng}">
    <name>${pName}</name>
    <desc>${pDesc}</desc>
    <sym>Ferry</sym>
  </wpt>`;
      addedPointsCount++;
    }
  });

  gpxContent += `\n</gpx>`;

  if (addedPointsCount === 0) {
    toast.error("Nenhum passageiro possui coordenadas válidas salvas. Certifique-se de que os links do Google Maps contêm latitude e longitude numéricas para exportar o GPX.");
    return;
  }

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${route.client.toLowerCase().replace(/\s+/g, '_')}_${route.name.toLowerCase().replace(/\s+/g, '_')}_itinerario.gpx`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`GPX Baixado! Importe no Maps.me, Organic Maps ou OsmAnd para usar 100% offline com GPS!`);
};

export const exportRouteToPdf = async (route: CharteredRoute) => {
  const passengers = route.passengers || [];
  const jsPDF = (await import('jspdf')).jsPDF;
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, 210, 48, 'F');

  doc.setTextColor(255, 107, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("DM TURISMO", 14, 20);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SISTEMA DE GESTÃO E CONTROLE DE FRETAMENTO", 14, 27);

  doc.setDrawColor(255, 107, 0);
  doc.setLineWidth(1.5);
  doc.line(14, 32, 196, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`ITINERÁRIO: ${route.name.toUpperCase()}`, 14, 43);

  doc.setTextColor(113, 113, 122);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Cliente: ${route.client.toUpperCase()}  |  Data de Exportação: ${new Date().toLocaleDateString('pt-BR')}`, 14, 56);

  const tableData = passengers.map((p, idx) => {
    const coords = extractCoordinates(p.locationUrl);
    const coordsStr = coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'S/ Coordenadas';
    return [
      idx + 1,
      p.name || 'Sem Nome',
      p.boardingTime || '--:--',
      p.phone || 'Nenhum',
      coordsStr,
      p.locationUrl ? 'Sim (Disponível)' : 'Não cadastrado'
    ];
  });

  autoTable(doc, {
    startY: 62,
    head: [['Nº', 'Passageiro', 'Embarque', 'Telefone', 'Coordenadas (Lat/Lng)', 'Link do Local']],
    body: tableData,
    headStyles: {
      fillColor: [255, 107, 0],
      textColor: [24, 24, 27],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [39, 39, 42]
    },
    alternateRowStyles: {
      fillColor: [244, 244, 245]
    },
    styles: {
      cellPadding: 3,
      valign: 'middle'
    }
  });

  // @ts-ignore
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 150;

  if (finalY < 270) {
    doc.setFillColor(244, 244, 245);
    doc.rect(14, finalY, 182, 38, 'F');
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.5);
    doc.rect(14, finalY, 182, 38);

    doc.setTextColor(24, 24, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("📱 GUIA DE SUPORTE - TRABALHO 100% OFFLINE COM GPS:", 18, finalY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(63, 63, 70);
    doc.text("1. Antes de iniciar a viagem, no aplicativo oficial do Google Maps, pesquise pela sua região e digite 'ok maps' para baixar o mapa offline.", 18, finalY + 14);
    doc.text("2. Abra o arquivo GPX gerado em aplicativos como Maps.me, Organic Maps ou Garmin para ter os pontos de embarque salvos no GPS físico.", 18, finalY + 21);
    doc.text("3. Caso precise acionar o passageiro sem sinal de internet cellular nativo, utilize o telefone de contato fixado acima para ligações de voz diretas.", 18, finalY + 28);
  }

  doc.save(`${route.client.toLowerCase().replace(/\s+/g, '_')}_itinerario_offline.pdf`);
  toast.success("Documento PDF Itinerário gerado para navegação e escala offline!");
};

export const exportRouteToOfflineHtml = (route: CharteredRoute) => {
  const passengers = route.passengers || [];
  
  const passengerCards = passengers.map((p, idx) => {
    const coords = extractCoordinates(p.locationUrl);
    const coordsStr = coords ? `${coords.lat},${coords.lng}` : '';
    const mapsLink = coords ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving&dir_action=navigate` : (p.locationUrl || '#');
    
    return `
      <div class="card" id="card-${idx}">
        <div class="row">
          <div class="idx-badge">${idx + 1}</div>
          <div class="info">
            <h3>${p.name || 'Sem nome'}</h3>
            <p><strong>⏱️ Horário:</strong> ${p.boardingTime || '--:--'}</p>
            <p><strong>📞 Tel:</strong> ${p.phone || 'Não informado'}</p>
            \${coordsStr ? \`<p class="coords"><strong>📍 Coords:</strong> \${coordsStr}</p>\` : ''}
          </div>
          <div class="actions">
            <input type="checkbox" class="cb" id="cb-\${idx}" onchange="toggleCheck(\${idx})">
          </div>
        </div>
        <div class="btn-group">
          \${coordsStr ? \`
            <a href="\${mapsLink}" class="btn btn-primary" target="_blank">🗺️ ROTA GPS</a>
            <button class="btn btn-secondary" onclick="copyCoords('\${coordsStr}')">📋 COPIAR COORDS</button>
          \` : \`
            <a href="\${p.locationUrl || '#'}" class="btn btn-secondary" target="_blank">🗺️ GOOGLE MAPS</a>
          \`}
          \${p.phone ? \`<a href="tel:\${p.phone}" class="btn btn-whatsapp">📞 LIGAR</a>\` : ''}
        </div>
      </div>
    `;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DM Turismo - Escala Offline (${route.name})</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #18181b;
      color: #f4f4f5;
      margin: 0;
      padding: 0;
    }
    header {
      background: #09090b;
      padding: 20px;
      border-bottom: 3px solid #ff6b00;
      text-align: center;
    }
    h1 {
      color: #ff6b00;
      margin: 0;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .client {
      font-size: 11px;
      font-weight: bold;
      color: #a1a1aa;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .container {
      padding: 15px;
      max-width: 500px;
      margin: 0 auto;
    }
    .info-box {
      background: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      padding: 15px;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .info-box h2 {
      margin-top: 0;
      color: #ff6b00;
      font-size: 14px;
      text-transform: uppercase;
    }
    .card {
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 15px;
      margin-bottom: 15px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
    }
    .card.completed {
      opacity: 0.5;
      border-color: #ff6b0033;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .idx-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #ff6b001a;
      border: 1px solid #ff6b0033;
      color: #ff6b00;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }
    .info {
      flex: 1;
    }
    .info h3 {
      margin: 0 0 5px 0;
      font-size: 13px;
      text-transform: uppercase;
    }
    .info p {
      margin: 3px 0;
      font-size: 11px;
      color: #d4d4d8;
    }
    .coords {
      font-family: monospace;
      color: #71717a !important;
    }
    .actions {
      display: flex;
      align-items: center;
    }
    .cb {
      width: 24px;
      height: 24px;
      accent-color: #ff6b00;
      cursor: pointer;
    }
    .btn-group {
      margin-top: 15px;
      display: flex;
      gap: 10px;
    }
    .btn {
      flex: 1;
      text-decoration: none;
      font-size: 10px;
      font-weight: bold;
      padding: 8px;
      border-radius: 10px;
      text-align: center;
      transition: background 0.2s;
      text-transform: uppercase;
      border: none;
      cursor: pointer;
    }
    .btn-primary {
      background: #ff6b00;
      color: #18110b;
    }
    .btn-secondary {
      background: #27272a;
      color: #f4f4f5;
    }
    .btn-whatsapp {
      background: #059669;
      color: white;
    }
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff6b00;
      color: #000;
      padding: 10px 20px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 12px;
      display: none;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <header>
    <h1>DM TURISMO - OFFLINE</h1>
    <div class="client">${route.client} / ${route.name}</div>
  </header>
  <div class="container">
    <div class="info-box">
      <h2>FICHA INTERATIVA OFFLINE</h2>
      <p>Este painel funciona <strong>sem qualquer conexão com a internet</strong>! Use para orientar sua viagem das paradas.</p>
      <p>💡 <strong>Como usar:</strong> Marque a caixinha do passageiro concluído para acompanhar o andamento. Copie as coordenadas para colar no Maps ou Waze se estiver offline.</p>
    </div>
    
    <div id="passenger-list">
      ${passengerCards}
    </div>
  </div>

  <div id="toast" class="toast">Texto copiado!</div>

  <script>
    const routeId = '${route.id}';
    
    function init() {
      const saved = localStorage.getItem('offline_chk_' + routeId);
      if (saved) {
        const checkedIndexes = JSON.parse(saved);
        checkedIndexes.forEach(idx => {
          const cb = document.getElementById('cb-' + idx);
          if (cb) {
            cb.checked = true;
            document.getElementById('card-' + idx).classList.add('completed');
          }
        });
      }
    }

    function toggleCheck(idx) {
      const cb = document.getElementById('cb-' + idx);
      const card = document.getElementById('card-' + idx);
      if (cb.checked) {
        card.classList.add('completed');
      } else {
        card.classList.remove('completed');
      }
      
      const cbs = document.querySelectorAll('.cb');
      const checkedIndexes = [];
      cbs.forEach((item, index) => {
        if (item.checked) checkedIndexes.push(index);
      });
      localStorage.setItem('offline_chk_' + routeId, JSON.stringify(checkedIndexes));
    }

    function copyCoords(text) {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      
      const toast = document.getElementById('toast');
      toast.innerText = 'Coordenadas copiadas: ' + text;
      toast.style.display = 'block';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 2500);
    }
    
    init();
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${route.client.toLowerCase().replace(/\s+/g, '_')}_itinerario_interativo.html`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('Ficha de Itinerário Interativa Baixada! Pode abrir no celular mesmo sem internet.');
};

export const exportClosingPdf = async (client: any, openTrips: any[], employees: any[], vehicles: any[], onPreviewReady: (preview: { pdfUrl: string, trips: any[], client: any, fileName: string }) => void) => {
  const jsPDF = (await import('jspdf')).jsPDF;
  const autoTable = (await import('jspdf-autotable')).default;
  const pdfDoc = new jsPDF();
  
  pdfDoc.setFillColor(24, 24, 27); 
  pdfDoc.rect(0, 0, 210, 45, 'F');
  
  pdfDoc.setTextColor(255, 107, 0); 
  pdfDoc.setFontSize(22);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("DM TURISMO", 15, 20);
  
  pdfDoc.setTextColor(255, 255, 255);
  pdfDoc.setFontSize(10);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text("DEMONSTRATIVO DE FECHAMENTO FINANCEIRO", 15, 26);
  pdfDoc.text(`Serviços Pendentes e em Acerto Financeiro`, 15, 31);
  pdfDoc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 140, 20);
  
  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.setFontSize(11);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("DADOS DO CLIENTE / COBRANÇA", 15, 55);
  pdfDoc.setDrawColor(228, 228, 231);
  pdfDoc.line(15, 58, 195, 58);
  
  pdfDoc.setFontSize(8.5);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Cliente:", 15, 65);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.name?.toUpperCase() || 'NÃO CONFIGURADO', 45, 65);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Documento (CNPJ):", 15, 71);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.document || 'NÃO CONFIGURADO', 45, 71);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("E-mail Financeiro:", 15, 77);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.email || 'NÃO CONFIGURADO', 45, 77);

  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Contato:", 115, 65);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.phone || 'NÃO CONFIGURADO', 145, 65);

  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Endereço:", 115, 71);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.address || 'NÃO CONFIGURADO', 145, 71, { maxWidth: 50 });

  const totalOpenValue = openTrips.reduce((acc, t) => {
    const appliedValue = client?.defaultTripValue !== undefined && client.defaultTripValue > 0
      ? client.defaultTripValue
      : (t.value || 0);
    return acc + appliedValue;
  }, 0);
  
  pdfDoc.setFontSize(11);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("RESUME DO FECHAMENTO OPERACIONAL", 15, 91);
  pdfDoc.line(15, 94, 195, 94);
  
  pdfDoc.setFillColor(254, 244, 232); 
  pdfDoc.rect(15, 98, 180, 16, 'F');
  
  pdfDoc.setFontSize(8);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.setTextColor(255, 107, 0); 
  pdfDoc.text("SALDO CONSOLIDADO EM ABERTO PARA COBRANÇA", 20, 104);
  pdfDoc.setFontSize(11);
  pdfDoc.text(`R$ ${totalOpenValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, 111);

  pdfDoc.setFontSize(8);
  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.text("TOTAL DE SERVIÇOS NO DOSSIÊ", 130, 104);
  pdfDoc.setFontSize(11);
  pdfDoc.text(`${openTrips.length} VIAGENS`, 130, 111);
  
  let currentY = 124;

  if (client.fixedRoutes && client.fixedRoutes.length > 0) {
    pdfDoc.setTextColor(24, 24, 27);
    pdfDoc.setFontSize(11);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("ROTAS FIXAS CONTRATADAS (HORÁRIOS E MOTORISTAS)", 15, currentY);
    pdfDoc.line(15, currentY + 3, 195, currentY + 3);
    currentY += 10;

    client.fixedRoutes.forEach((route: any) => {
      const routeDriver = employees.find(e => e.id === route.driverId);
      const routeVehicle = vehicles.find(v => v.id === route.vehicleId);
      const driverName = routeDriver ? routeDriver.name.toUpperCase() : 'NÃO ALOCADO';
      const vehicleInfo = routeVehicle ? `PLACA: ${routeVehicle.plate.toUpperCase()}` : 'NENHUM VEÍCULO';
      const dayNamesMap: Record<number, string> = {
        1: 'SEG',
        2: 'TER',
        3: 'QUA',
        4: 'QUI',
        5: 'SEX',
        6: 'SAB',
        0: 'DOM'
      };
      const formattedDays = route.daysOfWeek && route.daysOfWeek.length > 0
        ? route.daysOfWeek.map((d: number) => dayNamesMap[d] || '').join(', ')
        : 'DIAS NÃO DEF.';

      pdfDoc.setFontSize(7.5);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text(`ROTA: ${route.name.toUpperCase()}`, 15, currentY);

      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.text(`HORÁRIO: ${route.schedule}`, 75, currentY);
      pdfDoc.text(`DIAS: ${formattedDays}`, 108, currentY);
      pdfDoc.text(`CONDUTOR: ${driverName.split(' ')[0]}   (${vehicleInfo})`, 146, currentY);

      currentY += 6.5;
    });

    currentY += 5;
  }

  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.setFontSize(11);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text(`DETALHAMENTO DOS SERVIÇOS COM PENDÊNCIA FINANCEIRA (${openTrips.length})`, 15, currentY);
  pdfDoc.line(15, currentY + 3, 195, currentY + 3);

  const tableRows = openTrips.map((trip, index) => {
    let formattedDate = safeFormatDate(trip.dateTime, 'dd/MM/yyyy HH:mm');
    
    const tripDriver = employees.find(e => e.id === trip.driverId);
    const tripVehicle = vehicles.find(v => v.id === trip.vehicleId);
    
    let pStatusStr = 'EM ABERTO';
    if (trip.paymentStatus === 'billed') pStatusStr = 'FATURADO';
    
    const appliedValue = client?.defaultTripValue !== undefined && client.defaultTripValue > 0
      ? client.defaultTripValue
      : (trip.value || 0);

    return [
      (index + 1).toString().padStart(2, '0'),
      formattedDate,
      `${trip.origin || ''} -> ${trip.destination || ''}`.toUpperCase(),
      tripDriver ? tripDriver.name.toUpperCase().split(' ')[0] : 'NÃO ALOC',
      tripVehicle ? tripVehicle.plate.toUpperCase() : 'NÃO ALOC',
      `R$ ${appliedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      pStatusStr
    ];
  });
  
  autoTable(pdfDoc, {
    head: [['#', 'DATA DE EMBARQUE', 'ROTA REALIZADA (ORIGEM -> DESTINO)', 'MOTORISTA', 'PLACA', 'VALOR', 'STATUS']],
    body: tableRows,
    startY: currentY + 8,
    theme: 'striped',
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [255, 107, 0], 
      fontSize: 7.5,
      font: "helvetica"
    },
    bodyStyles: {
      fontSize: 7.5,
      font: "helvetica"
    }
  });

  const pageCount = pdfDoc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdfDoc.setPage(i);
    pdfDoc.setFontSize(7);
    pdfDoc.setTextColor(113, 113, 122);
    pdfDoc.text("DM TURISMO LTDA • DEPARTAMENTO FINANCEIRO / COBRANÇA", 15, 285);
    pdfDoc.text(`Página ${i} de ${pageCount}`, 180, 285);
  }
  
  try {
    const blobUrl = pdfDoc.output('bloburl').toString();
    const fileName = `FECHAMENTO_${client.name?.toUpperCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.pdf`;
    
    onPreviewReady({
      pdfUrl: blobUrl,
      trips: openTrips,
      client: client,
      fileName: fileName
    });
    toast.success('Dossiê de fechamento gerado! Abrindo visualização de acerto...');
  } catch (e) {
    console.error(e);
    pdfDoc.save(`FECHAMENTO_${client.name?.toUpperCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
    toast.success('Dossiê baixado diretamente devido às permissões do navegador.');
  }
};

export const exportClientDossierPdf = async (client: any, clientTrips: any[], employees: any[], vehicles: any[]) => {
  const jsPDF = (await import('jspdf')).jsPDF;
  const autoTable = (await import('jspdf-autotable')).default;
  const pdfDoc = new jsPDF();
  
  pdfDoc.setFillColor(24, 24, 27); 
  pdfDoc.rect(0, 0, 210, 45, 'F');
  
  pdfDoc.setTextColor(255, 107, 0); 
  pdfDoc.setFontSize(22);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("DM TURISMO", 15, 20);
  
  pdfDoc.setTextColor(255, 255, 255);
  pdfDoc.setFontSize(10);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text("FRETAMENTOS & SERVIÇOS DE TRANSPORTE", 15, 25);
  pdfDoc.text("DOSSIÊ OPERACIONAL E FINANCEIRO DO CLIENTE", 15, 30);
  pdfDoc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 140, 20);
  
  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.setFontSize(13);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("1. INFORMAÇÕES CADASTRAIS DO CLIENTE", 15, 60);
  pdfDoc.setDrawColor(228, 228, 231);
  pdfDoc.line(15, 63, 195, 63);
  
  pdfDoc.setFontSize(9);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Cliente / Nome Fantasia:", 15, 71);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.name?.toUpperCase() || 'NÃO CONFIGURADO', 65, 71);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Razão Social / Nome Completo:", 15, 78);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.companyName?.toUpperCase() || 'NÃO CONFIGURADO', 65, 78);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Documento (CNPJ / CPF):", 15, 85);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.document || 'NÃO CONFIGURADO', 65, 85);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Telefone de Contato:", 15, 92);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.phone || 'NÃO CONFIGURADO', 65, 92);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("E-mail Financeiro:", 15, 100);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.email || 'NÃO CONFIGURADO', 65, 100);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Endereço Completo:", 15, 107);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.address || 'NÃO CONFIGURADO', 65, 107);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Notas / Observações:", 15, 114);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.notes || 'SEM OBSERVAÇÕES ADICIONAIS', 65, 114, { maxWidth: 130 });

  const activeTrips = clientTrips.filter(t => t.status !== 'cancelled');
  const totalValue = activeTrips.reduce((acc, t) => acc + (t.value || 0), 0);
  const receivedValue = activeTrips.filter(t => t.paymentStatus === 'received').reduce((acc, t) => acc + (t.value || 0), 0);
  const openValue = totalValue - receivedValue;
  
  pdfDoc.setFontSize(13);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("2. RESUMO DE CAIXA OPERACIONAL", 15, 131);
  pdfDoc.line(15, 134, 195, 134);
  
  pdfDoc.setFillColor(244, 244, 245);
  pdfDoc.rect(15, 139, 55, 20, 'F');
  pdfDoc.rect(75, 139, 55, 20, 'F');
  pdfDoc.rect(135, 139, 60, 20, 'F');
  
  pdfDoc.setFontSize(7.5);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.setTextColor(113, 113, 122);
  pdfDoc.text("FATURAMENTO TOTAL DO CLIENTE", 18, 144);
  pdfDoc.text("MONTANTE RECEBIDO / PAGO", 78, 144);
  pdfDoc.text("SALDO EM ABERTO PARA COBRANÇA", 138, 144);
  
  pdfDoc.setFontSize(10.5);
  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 153);
  pdfDoc.setTextColor(16, 185, 129); // Emerald
  pdfDoc.text(`R$ ${receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 78, 153);
  pdfDoc.setTextColor(239, 68, 68); // Rose
  pdfDoc.text(`R$ ${openValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 138, 153);
  
  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.setFontSize(13);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("3. HISTÓRICO COMPLETO DE ROTAS E VIAGENS REALIZADAS", 15, 171);
  pdfDoc.line(15, 174, 195, 174);
  
  const tableRows = clientTrips.map((trip, index) => {
    let formattedDate = safeFormatDate(trip.dateTime, 'dd/MM/yyyy HH:mm');
    
    const tripDriver = employees.find(e => e.id === trip.driverId);
    const tripVehicle = vehicles.find(v => v.id === trip.vehicleId);
    
    let pStatusStr = 'EM ABERTO';
    if (trip.paymentStatus === 'received') pStatusStr = 'RECEBIDO';
    else if (trip.paymentStatus === 'billed') pStatusStr = 'FATURADO';
    
    if (trip.status === 'cancelled') {
      pStatusStr = 'CANCELADO';
    }

    return [
      (index + 1).toString().padStart(2, '0'),
      formattedDate,
      `${trip.origin || ''} -> ${trip.destination || ''}`.toUpperCase(),
      tripDriver ? tripDriver.name.toUpperCase().split(' ')[0] : 'NÃO ALOC',
      tripVehicle ? tripVehicle.plate.toUpperCase() : 'NÃO ALOC',
      `R$ ${(trip.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      pStatusStr
    ];
  });
  
  autoTable(pdfDoc, {
    head: [['#', 'DATA DE EMBARQUE', 'ROTA REALIZADA (ORIGEM -> DESTINO)', 'MOT.', 'PLACA', 'VALOR (R$)', 'FINANCEIRO']],
    body: tableRows,
    startY: 179,
    theme: 'striped',
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [255, 107, 0],
      fontSize: 7.5,
      font: "helvetica"
    },
    bodyStyles: {
      fontSize: 7.5,
      font: "helvetica"
    },
    columnStyles: {
      2: { cellWidth: 65 },
      5: { fontStyle: 'bold' }
    }
  });
  
  pdfDoc.save(`DOSSIE_CLIENTE_${client.name?.toUpperCase().replace(/\s+/g, '_')}.pdf`);
  toast.success('Dossiê do cliente em PDF gerado e salvo!');
};

export const exportClientPeriodDossierPdf = async (
  client: any,
  clientTrips: any[],
  startDateStr: string,
  endDateStr: string,
  employees: any[],
  vehicles: any[]
) => {
  const jsPDF = (await import('jspdf')).jsPDF;
  const autoTable = (await import('jspdf-autotable')).default;
  const pdfDoc = new jsPDF();
  
  // Header background
  pdfDoc.setFillColor(24, 24, 27); 
  pdfDoc.rect(0, 0, 210, 45, 'F');
  
  // Header brand
  pdfDoc.setTextColor(255, 107, 0); 
  pdfDoc.setFontSize(22);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("DM TURISMO", 15, 18);
  
  pdfDoc.setTextColor(255, 255, 255);
  pdfDoc.setFontSize(10);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text("FRETAMENTOS & SERVIÇOS DE TRANSPORTE", 15, 24);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("DOSSIÊ OPERACIONAL E FINANCEIRO POR PERÍODO", 15, 30);
  
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.setFontSize(9);
  pdfDoc.text(`Período de Consulta: ${safeFormatDate(startDateStr, 'dd/MM/yyyy', startDateStr)} a ${safeFormatDate(endDateStr, 'dd/MM/yyyy', endDateStr)}`, 15, 37);
  pdfDoc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 140, 20);
  
  // Section 1: Informações Cadastrais
  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.setFontSize(13);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("1. INFORMAÇÕES CADASTRAIS DO CLIENTE", 15, 58);
  pdfDoc.setDrawColor(228, 228, 231);
  pdfDoc.line(15, 61, 195, 61);
  
  pdfDoc.setFontSize(9);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Cliente / Nome Fantasia:", 15, 69);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.name?.toUpperCase() || 'NÃO CONFIGURADO', 65, 69);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Razão Social / Nome Completo:", 15, 76);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.companyName?.toUpperCase() || 'NÃO CONFIGURADO', 65, 76);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Documento (CNPJ / CPF):", 15, 83);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.document || 'NÃO CONFIGURADO', 65, 83);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("Telefone de Contato:", 15, 90);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.phone || 'NÃO CONFIGURADO', 65, 90);
  
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("E-mail Financeiro:", 15, 97);
  pdfDoc.setFont("helvetica", "normal");
  pdfDoc.text(client.email || 'NÃO CONFIGURADO', 65, 97);
  
  // Section 2: Resumo Financeiro
  const activeTrips = clientTrips.filter(t => t.status !== 'cancelled');
  const totalValue = activeTrips.reduce((acc, t) => {
    const baseVal = t.isExtra ? (t.value || 0) : (client.defaultTripValue || t.value || 0);
    const extraVal = (t.hasExtraService && t.extraServiceVal) ? t.extraServiceVal : 0;
    return acc + (baseVal + extraVal);
  }, 0);
  const receivedValue = activeTrips.filter(t => t.paymentStatus === 'received').reduce((acc, t) => {
    const baseVal = t.isExtra ? (t.value || 0) : (client.defaultTripValue || t.value || 0);
    const extraVal = (t.hasExtraService && t.extraServiceVal) ? t.extraServiceVal : 0;
    return acc + (baseVal + extraVal);
  }, 0);
  const openValue = totalValue - receivedValue;
  
  pdfDoc.setFontSize(13);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("2. RESUMO OPERACIONAL DO PERÍODO", 15, 114);
  pdfDoc.line(15, 117, 195, 117);
  
  pdfDoc.setFillColor(244, 244, 245);
  pdfDoc.rect(15, 122, 55, 20, 'F');
  pdfDoc.rect(75, 122, 55, 20, 'F');
  pdfDoc.rect(135, 122, 60, 20, 'F');
  
  pdfDoc.setFontSize(7.5);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.setTextColor(113, 113, 122);
  pdfDoc.text("VALOR TOTAL NO PERÍODO", 18, 127);
  pdfDoc.text("MONTANTE PAGO NO PERÍODO", 78, 127);
  pdfDoc.text("SALDO EM ABERTO NO PERÍODO", 138, 127);
  
  pdfDoc.setFontSize(10.5);
  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 136);
  pdfDoc.setTextColor(16, 185, 129); // Emerald
  pdfDoc.text(`R$ ${receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 78, 136);
  pdfDoc.setTextColor(239, 68, 68); // Rose
  pdfDoc.text(`R$ ${openValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 138, 136);
  
  // Section 3: Serviços Realizados
  pdfDoc.setTextColor(24, 24, 27);
  pdfDoc.setFontSize(13);
  pdfDoc.setFont("helvetica", "bold");
  pdfDoc.text("3. DETALHAMENTO DE SERVIÇOS NO PERÍODO", 15, 153);
  pdfDoc.line(15, 156, 195, 156);
  
  const tableRows = clientTrips.map((trip, index) => {
    let formattedDate = safeFormatDate(trip.dateTime, 'dd/MM/yyyy HH:mm');
    
    const tripDriver = employees.find(e => e.id === trip.driverId);
    const tripVehicle = vehicles.find(v => v.id === trip.vehicleId);
    
    const baseVal = trip.isExtra ? (trip.value || 0) : (client.defaultTripValue || trip.value || 0);
    const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
    const finalVal = baseVal + extraVal;

    let pStatusStr = 'EM ABERTO (NÃO CONSTA COMO PAGO)';
    if (trip.paymentStatus === 'received') pStatusStr = 'PAGO (CONSTA COMO PAGO)';
    else if (trip.paymentStatus === 'billed') pStatusStr = 'FATURADO (NÃO CONSTA COMO PAGO)';
    
    if (trip.status === 'cancelled') {
      pStatusStr = 'CANCELADO';
    }

    let descriptionText = (trip.description || 'SERVIÇO DE FRETAMENTO').toUpperCase();
    if (trip.isExtra) {
      descriptionText += " (VIAGEM EXTRA)";
    }
    if (trip.hasExtraService && trip.extraServiceDesc) {
      descriptionText += ` + SERV. EXTRA: ${trip.extraServiceDesc.toUpperCase()} (+R$ ${trip.extraServiceVal})`;
    }

    return [
      (index + 1).toString().padStart(2, '0'),
      formattedDate,
      descriptionText,
      tripDriver ? tripDriver.name.toUpperCase().split(' ')[0] : 'NÃO ALOC',
      tripVehicle ? tripVehicle.plate.toUpperCase() : 'NÃO ALOC',
      `R$ ${finalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      pStatusStr
    ];
  });
  
  autoTable(pdfDoc, {
    head: [['#', 'DATA/HORA', 'SERVIÇO REALIZADO & INFORMAÇÕES ADICIONAIS', 'MOT.', 'PLACA', 'VALOR (R$)', 'STATUS NO SISTEMA']],
    body: tableRows,
    startY: 161,
    theme: 'striped',
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [255, 107, 0],
      fontSize: 7,
      font: "helvetica"
    },
    bodyStyles: {
      fontSize: 7,
      font: "helvetica"
    },
    columnStyles: {
      2: { cellWidth: 55 },
      6: { fontStyle: 'bold', cellWidth: 45 }
    }
  });
  
  pdfDoc.save(`DOSSIE_PERIODO_${client.name?.toUpperCase().replace(/\s+/g, '_')}_${startDateStr}_A_${endDateStr}.pdf`);
  toast.success('Dossiê do cliente para o período selecionado gerado com sucesso!');
};
