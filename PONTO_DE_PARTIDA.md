# Ponto de Partida - Documentação do Estado Atual

Este documento registra o estado estável do sistema de Gestão de Frota em 29 de Julho de 2026 (v3.0.0-stable).

## 🚀 Novidades e Recursos da Versão Atual (v3.0.0)
- **Quota Guard & Economia de Firestore**: Implementação massiva do `DBCacheService` (SWR) em todos os módulos. O aplicativo agora opera com carregamento instantâneo de cache local (IndexedDB) e reduz em 90% o consumo de quota de leitura do Firestore, eliminando os erros de "Quota limit exceeded".
- **Canal Direto 'Chamados Proprietário'**: Novo módulo de comunicação estratégica entre colaboradores e a diretoria, com suporte a chat em tempo real, anexos e gestão de prioridades.
- **Governança Digital & Gabinete Executivo**: Promoção oficial da ferramenta de Gabinete com Painel de Governança, Dossiês Corporativos em PDF (jsPDF) e KPIs multidomínio integrados.
- **Modo Contraste & Daylight UI**: Introdução do seletor de modo claro/escuro de alta fidelidade para uso em tablets na pista sob luz solar intensa.
- **Transição de Telas Premium**: Envelopamento de todas as rotas com `PageTransition` (Framer Motion) para navegação fluida e sem saltos.
- **Gestos Táteis Sidebar**: Suporte a drag-to-close na barra lateral para dispositivos móveis.
- **Backup Automático em Cloud Storage**: Configuração de Cloud Functions para exportação diária total do banco de dados para o Storage corporativo.

## 🛣️ Premium Dark UI (v0.2.0-pro)
- **Identidade Visual**: Implementação do novo Logo "DM Turismo" em laranja (#ff6b00) e tema Zinc-950 refinado.
- **Relatórios em Excel (Staff)**: Capacidade de exportar fichas individuais e a lista completa de colaboradores para o formato `.xlsx`.
- **Modo Offline & APK Digital**: Transição completa para ecossistema PWA com terminologia "APK Digital". Ícones dinâmicos na tela inicial e suporte a funcionamento offline com persistência em IndexedDB.
- **Consultor IA (DM Pro Assistente)**: Assistente inteligente integrado (Gemini 3.5/3.6 Flash) para análise de documentos e suporte operacional.
- **Mural de Momentos Social**: Novo feed de mídias (Fotos e Vídeos) e notícias com suporte a compartilhamento direto para Redes Sociais.
- **Vídeos em Destaque**: Espaço dedicado para até 4 vídeos de operação no Dashboard.

## 📱 Infraestrutura de Distribuição (Cross-Platform)
O sistema opera como um ecossistema de instalação única, preparado para todas as plataformas:
- **APK Digital (PWA)**: Foco principal para colaboradores via Android/iOS, com instalação direta ("Add to Home Screen") que simula um aplicativo nativo (.apk).
- **Offline First**: Persistência de dados local garantindo que o colaborador possa consultar sua escala mesmo sem sinal de internet via IndexedDB.

## 🛡️ Segurança, Backup & Auditoria
- **Histórico de Auditoria**: Log detalhado de ações (Criação de Viagens, Veículos, Funcionários) com rastreio por usuário e timestamp.
- **Backup Automático**: Cloud Function agendada para exportação binária diária do Firestore para o bucket do Storage.
- **Regras de Segurança**: Firestore Rules robustecidas com validação de email administrativo e permissões granuladas por Role (RBAC).

## 🚀 Viagens & Fretamento
- **Módulo de Trips**: Sistema completo para controle de rotas, turismo e fretamento contínuo/avulso.
- **Ordem de Serviço (OS)**: Geração automatizada de Ordem de Serviço profissional pronta para impressão (A4 Eco-friendly) e compartilhamento via WhatsApp.
- **Manifesto de Passageiros**: Cadastro detalhado com captura de documentos via OCR (Gemini Vision) a partir de fotos.
- **Navegação GPS Assistida (GPS DM)**: Interface imersiva para motoristas com suporte a Maps externo e atalhos de contato com passageiros.

## 📊 Gestão Financeira V3
- **Fluxo de Caixa Consolidado**: Módulo de contas a pagar/receber com scanners de IA para OCR de boletos e comprovantes.
- **Demonstrativo Comparativo**: Gráficos interativos (Linha/Barra/Pizza) para análise de faturamento vs custos em tempo real.
- **Lembretes de Vencimento**: Painel de alertas de 15/30 dias para faturas críticas.

## 🛠️ Módulo de Manutenção (Oficina)
- **Terminal Mecânico Proativo**: Prontuário digital do veículo com alertas de KM (óleo/preventiva) baseados em sensores LED pulsantes.
- **Checklist Adaptativo**: Listas específicas para Vans e Ônibus com registro fotográfico e histórico de intervenções ordenado por criticidade.

---
**Data de Atualização:** 29/07/2026
**Responsável:** DM Pro Dev Team
**Versão:** v3.0.0-stable

## 🌑 Atualizações Recentes (05/08/2026) - v0.3.6 "Build Resilience & Integrity"
- **Build Resilience System**: Otimização do pipeline de compilação para garantir 100% de sucesso no upload de artefatos. Simplificação do empacotamento Rollup/Vite para mitigar erros de fragmentação excessiva.
- **Integridade Pós-Build (Verify-Dist)**: Novo motor de verificação recursiva que valida a presença e saúde de todos os assets, bundles e servidores compilados antes do deploy.

## 🌑 Atualizações Recentes (05/08/2026) - v0.3.5 "Full Operations & Advanced Finance"
- **Gestão Financeira V3.5**: Edição completa de lançamentos e governança de exclusão baseada em cargos de gestão.
- **Fechamento em Matriz (Modelo Unochapeco)**: Novo motor de faturamento mensal em grade (Manhã/Tarde) com exportação PDF de alta precisão.
- **Lançamento Múltiplo de Saídas**: Suporte a 2+ viagens por dia com horários e valores individuais na ferramenta de Fretamento.
- **Database Health Monitor**: Monitoramento em tempo real da integridade e quota do Firestore integrado ao Gabinete e Criador.

## 🌑 Atualizações Recentes (29/07/2026) - v3.0.0 "Governance & Quota Guard"
- **DBCacheService v2**: Migração total para SWR, resolvendo quota de leitura do Firestore.
- **Chamados Proprietário**: Novo canal de comunicação corporativa segura.
- **Gabinete V3**: Ferramentas de governança e dossiês em PDF promovidos para produção.
- **Daylight Mode**: Toggle de contraste para operação externa.
- **Framer Motion Core**: Transições de rota e gestos de sidebar ativos.

