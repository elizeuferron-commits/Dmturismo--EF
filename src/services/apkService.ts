import { toast } from 'sonner';

export const generateAPKDigital = (appUrl: string = window.location.origin, employeeName?: string) => {
  try {
    const personalizedTitle = employeeName ? `DM TURISMO PRO - ${employeeName.toUpperCase()}` : 'DM TURISMO - ATALHO DIGITAL';
    const personalizedMsg = employeeName 
      ? `Iniciando o terminal de logística personalizado para <strong>${employeeName}</strong>...`
      : 'Iniciando o terminal de logística e viagens em seu dispositivo móvel...';

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${personalizedTitle}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        :root {
          --brand: #1a50f1;
          --bg: #09090b;
          --card: #18181b;
        }
        body { 
          background: var(--bg); 
          color: white; 
          font-family: 'Inter', sans-serif; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          min-height: 100vh; 
          margin: 0; 
          text-align: center;
          padding: 20px;
          box-sizing: border-box;
          background-image: radial-gradient(circle at top right, #1a50f115, transparent), radial-gradient(circle at bottom left, #00d2ff10, transparent);
        }
        .card { 
          background: var(--card); 
          padding: 2.5rem; 
          border-radius: 2.5rem; 
          border: 1px solid rgba(255,255,255,0.05); 
          box-shadow: 0 40px 100px -20px rgba(0,0,0,0.8); 
          max-width: 400px;
          width: 100%;
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
        }
        .logo-container {
          width: 80px;
          height: 80px;
          background: var(--brand);
          border-radius: 1.5rem;
          margin: 0 auto 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 2rem;
          color: #000;
          box-shadow: 0 20px 40px -10px rgba(255,107,0,0.4);
        }
        h1 { margin: 0; font-size: 1.5rem; font-weight: 900; letter-spacing: -0.05em; text-transform: uppercase; color: white; }
        .badge {
          display: inline-block;
          padding: 0.35rem 1rem;
          background: rgba(255,107,0,0.1);
          border: 1px solid rgba(255,107,0,0.2);
          border-radius: 100px;
          color: var(--brand);
          font-size: 0.65rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 1.5rem;
        }
        p { color: #a1a1aa; font-size: 0.9rem; margin: 1.5rem 0 2rem; line-height: 1.6; }
        .instructions {
          text-align: left;
          background: rgba(0,0,0,0.2);
          padding: 1.25rem;
          border-radius: 1.25rem;
          margin-bottom: 2rem;
          font-size: 0.8rem;
          border: 1px solid rgba(255,255,255,0.03);
        }
        .instructions-title {
          font-weight: 900;
          text-transform: uppercase;
          font-size: 0.7rem;
          margin-bottom: 0.75rem;
          color: var(--brand);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .step { margin-bottom: 0.5rem; display: flex; gap: 10px; color: #d4d4d8; }
        .step-num { color: var(--brand); font-weight: 900; }
        
        .btn { 
          background: var(--brand); 
          color: #000; 
          text-decoration: none; 
          padding: 1rem 2rem; 
          border-radius: 1.25rem; 
          font-weight: 900; 
          text-transform: uppercase; 
          letter-spacing: 0.05em; 
          display: block; 
          transition: all 0.3s ease;
          box-shadow: 0 10px 20px -5px rgba(255,107,0,0.3);
        }
        .btn:active { transform: scale(0.98); }
        
        .footer {
          margin-top: 2rem;
          font-size: 0.6rem;
          color: #52525b;
          text-transform: uppercase;
          font-weight: 900;
          letter-spacing: 0.25em;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">Atalho Inteligente • DM Turismo</div>
        <div class="logo-container">DM</div>
        <h1>Instalar Terminal DM</h1>
        <p>Este arquivo é o seu acesso direto ao ecossistema corporativo DM Turismo. Siga os passos e transforme este site em um aplicativo no seu celular.</p>
        
        <div class="instructions">
          <div class="instructions-title">💡 Como Ativar o Ícone Oficial:</div>
          <div class="step"><span class="step-num">01.</span> Clique no link abaixo para carregar o sistema.</div>
          <div class="step"><span class="step-num">02.</span> No navegador, procure por "Adicionar à Tela de Início".</div>
          <div class="step"><span class="step-num">03.</span> O ícone da DM Turismo aparecerá junto aos seus outros apps.</div>
        </div>

        <a href="${appUrl}" class="btn">Ativar Aplicativo Agora</a>
    </div>
    <div class="footer">DM Turismo • Digital Ecosystem © 2026</div>
    <script>
        // Redirecionamento automático após delay caso não interaja
        setTimeout(() => { 
          if(!document.hidden) window.location.href = "${appUrl}"; 
        }, 5000);
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const downloadName = employeeName 
      ? `INSTALADOR_DM_PRO_${employeeName.replace(/\s+/g, '_').toUpperCase()}.html`
      : `INSTALADOR_DM_TURISMO_PRO.html`;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Módulo de instalação gerado!", {
      description: "Compartilhe este arquivo. Ao abrir, ele guiará a instalação do app que se atualiza sozinho.",
      duration: 8000,
    });
  } catch (error) {
    console.error("Erro ao gerar instalador:", error);
    toast.error("Erro ao gerar o módulo de instalação.");
  }
};

export const shareAppDirectly = async (appUrl: string = window.location.origin) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'DM Turismo Pro',
        text: 'Acesse o sistema de logística e faturamento DM Turismo.',
        url: appUrl,
      });
    } catch (error) {
      console.log('Erro ao compartilhar', error);
    }
  } else {
    navigator.clipboard.writeText(appUrl);
    toast.info("Link copiado!", { description: "O link do app foi copiado para sua área de transferência." });
  }
};

