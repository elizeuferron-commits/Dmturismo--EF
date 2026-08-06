# 🌑 Modo Sombra (Shadow Mode)

Este arquivo registra o progresso das funcionalidades em desenvolvimento paralelo. As alterações aqui listadas **não** foram aplicadas à versão estável do aplicativo.

## 📋 Backlog de Desenvolvimento (Sombra)
- [ ] **Habilitação e Infraestrutura Cloud SQL (PostgreSQL)**:
  - **Instância Ativa**: Instância provisionada na região `europe-west2` via RPC.
  - **Infraestrutura Drizzle ORM**: Preparação dos arquivos de configuração (`drizzle.config.shadow.ts`) e conexão (`src/db/index.shadow.ts`).
  - **Schema Inicial**: Definição do schema base (`src/db/schema.shadow.ts`) incluindo tabelas de usuários, frotas e logs operacionais.
  - **Middleware de Autenticação**: Preparação do middleware de verificação de token Firebase Admin para rotas de API SQL.
- [x] **Fechamento Mensal em Matriz/Tabela Padronizada (`ClientClosingGrid.shadow.tsx` & `ClientClosingPdf.shadow.ts`)**:
  - **Matriz de Faturamento Diário por Turno (Modelo Unochapeco)**: Construção da visualização interativa do mês (dias 01 ao final do mês) dividida nas colunas `DIA`, `MANHÃ` e `TARDE` (ou turnos/saídas estipulados).
  - **Mapeamento de Status por Célula**: Aplicação de cores e estados visuais padronizados — verde para dias com viagens/operação realizada (ex: R$ 370,00 | R$ 185,00), bege para `SEM OPERAÇÃO` e laranja/salmão para `FINAL DE SEMANA` e `FERIADO`.
  - **Somas dos Turnos & Dias Trabalhados**: Cálculo dinâmico das somas acumuladas por turno e da contagem exata de `DIAS TRABALHADOS` para Manhã e Tarde.
  - **Serviços Adicionais & Lançamentos Extras**: Módulo para adicionar serviços adicionais ao fechamento (ex: `PLOTAGEM VEICULAR` no valor de R$ 500,00, horas extras, higienização) com recálculo automático do `VALOR TOTAL`.
  - **Gerador de PDF Dossiê Faturamento**: Exportador PDF em layout banner/grid idêntico à imagem de referência utilizando `jspdf` e `jspdf-autotable` com visualização e download imediato.
  - **Integração no Modal de Fechamento do Cliente (`ClientClosingModal.tsx`)**: Inclusão do alternador de modo no modal de acerto do cliente na ferramenta Fretados.
- [x] **Lançamento de Múltiplas Viagens/Saídas por Dia para Clientes (`CharteredRoutesMultiTrip.shadow.tsx`)**:
  - **Suporte a 2+ Viagens por Dia**: Criação do componente isolado no Modo Sombra permitindo ao operador incluir múltiplas saídas/horários (ex: Turno 1 Manhã, Turno 2 Tarde, Turno 3 Noturno) para o mesmo dia ou para lote de dias.
  - **Valores e Horários Individuais**: Cada saída permite especificar um horário exato (`time`), identificador de turno/linha (`label`) e valor cobrado individual (`value`), recalculando dinamicamente o total acumulado do dia.
  - **Inclusão e Remoção Dinâmica**: Botões para adicionar ou remover saídas com interface responsiva e feedback de totais em R$.
- [x] **Estratégia de Pré-carregamento de Imagens (PhotoGallery.shadow.tsx & ImageOptimizer.tsx)**:
  - **Injeção Dinâmica de rel='preload'**: Implementação de um motor de injeção de tags `<link rel="preload">` no cabeçalho do documento para as 8 primeiras fotos da galeria e para as imagens vizinhas no lightbox, garantindo download prioritário pelo navegador.
  - **Atributo loading='eager'**: Configuração do componente `ImageOptimizer` para suportar o atributo `loading`, aplicando `'eager'` nas imagens críticas para evitar o atraso de lazy-loading em elementos visíveis.
  - **Navegação Instantânea**: Sincronização entre o cache preditivo e a renderização do lightbox, resultando em visualização imediata sem placeholders.
- [ ] 

## 🔄 Histórico de Sincronização
- **2026-08-05 (SINC - ATUALIZAÇÃO COMPLETA & DEPLOY v0.3.6)**:
  - **Lançamento v0.3.6**: Consolidação de todas as correções de infraestrutura e build.
  - **Resiliência de Build**: Remoção de plugins redundantes e simplificação do empacotamento para garantir 100% de integridade nos artefatos.
  - **Verify-Dist V2**: Motor de integridade recursivo validado e ativo.
  - **Estabilidade**: App versionada e buildada com sucesso para produção.

- **2026-08-05 (SINC - CORREÇÃO DE BUILD & DEPLOY)**:
  - **Resolução de Erro de Artefatos Vazios**: Identificada e corrigida a inconsistência no processo de upload de artefatos da plataforma. A complexidade do build anterior (centenas de arquivos devido a chunks manuais e compressão tripla) estava impactando a coleta de artefatos.
  - **Simplificação Estrutural de Build**: Refatoração do `vite.config.ts` para reduzir a fragmentação de arquivos, removendo `manualChunks` agressivos e plugins de compressão redundantes (`gzip`/`br`), resultando em um bundle mais coeso e estável para o ambiente de produção.
  - **Integridade Automatizada (`verify-dist.js`)**: Atualização do motor de verificação de integridade pós-build para suportar recursividade, garantindo a validação correta de assets em subdiretórios (`dist/assets/`).
  - **Padronização de Caminhos**: Ajuste dos caminhos de saída do Rollup para garantir que `index.html` e `server.cjs` permaneçam na raiz do diretório `dist`, otimizando a detecção pelo runtime da plataforma.
  - **Validação Final**: Build de produção e linter de tipos validados com 100% de sucesso.

- **2026-08-05 (SINC)**: **Restabelecimento da Sinergia do Banco de Dados e Atualização de Ícone PWA (DM)**:
  - **Sinergia do Banco de Dados**: Verificação e confirmação de conexão com a base Firestore `ai-studio-dmturismo-98ffbc34-a1e2-4c6a-badf-f0aff2be91e8` do projeto `gen-lang-client-0708969846`. Re-publicação de regras de acesso em `firestore.rules`.
  - **Monograma e Ícone do Atalho (DM)**: Atualizado o componente `InstallModal.tsx` para exibir a marca **DM** (eliminando o monograma antigo "EF"). O atalho PWA, manifest.json e favicons estão totalmente padronizados para **DM Turismo**.
  - **Verificação de Compilação**: Teste de integridade de código (lint) e build de produção validados com sucesso.

- **2026-08-04 (SINC - ATUALIZAÇÃO COMPLETA DE PRODUÇÃO)**:
  - **Fechamento Mensal em Matriz de Faturamento (Modelo Unochapeco)**: Módulo integrado no modal de fechamento do cliente na ferramenta Fretados. Exibe a tabela do mês completo dividida em DIA, MANHÃ e TARDE com marcação automática de `FINAL DE SEMANA`, `SEM OPERAÇÃO` e valores dos turnos.
  - **Somas de Turnos e Contagem de Dias Trabalhados**: Cálculo automático da quantidade de dias operados nos turnos e somatório do mês.
  - **Lançamento de Adicionais/Extras**: Módulo interativo para inclusão de itens como Plotagem Veicular, Horas Extras ou Higienização no fechamento.
  - **Exportação PDF de Alta Precisão**: Gerador de relatório PDF com layout idêntico ao modelo visual recebido (banner superior, cores por célula, tabela de adicionais e destaque de valor total).
  - **Lançamento Múltiplo de Saídas Diárias**: Suporte a 2 ou mais saídas por dia com horários e valores individuais.
  - **Estabilidade e Compilação**: Verificação completa de TypeScript (lint) e build de produção sem erros.

- **2026-08-04 (SINC)**: **Sincronização Geral e Consolidação de Versão**:
  - **Múltiplas Viagens/Saídas Diárias**: Módulo de lançamento múltiplo integrado à gestão de fretados e clientes.
  - **Firebase Firestore & Auth**: Projeto `gen-lang-client-0708969846` configurado e ativo com regras irrestritas de persistência direta.
  - **Identidade DM Turismo**: Ícone SVG, manifest PWA e meta tags atualizadas e ativas.
  - **Validação de Produção**: Linter e compilação de produção concluídos com 0 erros.

- **2026-08-04 (SINC)**: **Provisionamento do Firebase Firestore & Auth**:
  - **Provisionamento de Projeto**: Conectado e ativado no projeto `gen-lang-client-0708969846` com banco Firestore `ai-studio-dmturismo-98ffbc34-a1e2-4c6a-badf-f0aff2be91e8` na região `europe-west2`.
  - **Regras de Segurança**: Publicação e validação de `firestore.rules` atualizado.
  - **Validação de Build**: Verificação completa de linting e compilação sem erros.

- **2026-08-04 (SINC)**: **Integração de Múltiplas Viagens por Dia para Clientes (`CharteredRoutes.tsx`)**:
  - **Lançamento Múltiplo Ativo**: Integração do componente de Múltiplas Saídas Diárias na janela de lançamento de fretamento por cliente na aba Fretados.
  - **Lançamento em Lote com Horários e Preços Individuais**: Permite cadastrar 2 ou mais saídas em um mesmo dia ou lote de dias, com identificadores de turno, horários e valores R$ individuais por viagem.
  - **Validação e Compilação**: Linter e build de produção validados sem nenhum erro.

- **2026-08-04 (SINC)**: **Padronização e Fixação do Ícone do Atalho PWA (DM Turismo)**:
  - **Identidade Visual DM Turismo**: Redesenho do vetor SVG do ícone do aplicativo (`public/logo_dm.svg`) exibindo com precisão as letras **D M** e o rótulo **DM TURISMO**, eliminando traços antigos.
  - **Configuração de Atalho e Favicon**: Atualização do `manifest.json` com nome fixo `"DM Turismo"`, categorias e atalhos PWA, bem como injeção no `index.html` dos links de `favicon`, `shortcut icon` e meta tags de app para iOS/Android.
  - **Validação de Estabilidade**: Linter e compilação de produção validados com sucesso (0 erros).

- **2026-08-04 (SINC)**: **Salvamento Direto Sem Confirmação em Todos os Botões**:
  - **Garantia de Gravação Direta**: Verificação e confirmação de que todos os botões de salvamento do aplicativo (viagens, veículos, cadastros, relatórios e configurações) realizam a gravação direta e imediata no Firestore e no cache local sem exibir telas ou diálogos de confirmação intermediários.
  - **Validação de Estabilidade**: Compilação e checagem de lint validados com sucesso (0 erros).

- **2026-08-04 (SINC)**: **Configuração de Frequência de Backups e Exportações CSV (`SyncSettings`)**:
  - **Interface para o Proprietário**: Adicionada nova seção exclusiva nas configurações do sistema (`SyncSettings.tsx`) permitindo ao proprietário definir a periodicidade dos backups do Firestore (Diário, Semanal, Mensal ou Desativado) e das exportações CSV (Semanal/Sexta, Quinzenal, Mensal ou Desativado).
  - **Integração com `backupService`**: Conexão direta com os métodos de agendamento do `backupService` (`checkAndTriggerConfiguredBackup` e `checkAndTriggerConfiguredExport`) e persistência das preferências em `settings/backup_settings` no Firestore, no cache offline (`dbCacheService`) e no `localStorage`.
  - **Botões de Teste Agendado**: Incluídos botões para acionamento e teste imediato das rotinas agendadas diretamente pela interface.
  - **Validação de Estabilidade**: Linter e compilação concluídos com sucesso (0 erros).

- **2026-08-04 (SINC)**: **Camada de Persistência LRU no Cache de Veículos (`dbCacheService`)**:
  - **Limite de 100 Itens**: Refatoração do `dbCacheService` com limite estrito de até 100 veículos salvos em memória e IndexedDB, otimizando o consumo de memória em dispositivos móveis e de baixo armazenamento.
  - **Algoritmo LRU (Least Recently Used)**: Implementação do mapa de acessos `vehicleAccessMap` e atribuição de timestamp `_lastAccessedAt` para cada veículo, reordenando e descartando os veículos menos acessados ao exceder 100 itens.
  - **Métodos de Controle LRU**: Adição de `touchVehicle(id)`, `getVehicleFromCache(id)` e `getVehiclesLRUStats()` para atualização dinâmica do ranking de acesso LRU.
  - **Validação de Estabilidade**: Compilação e checagem de lint efetuadas com sucesso (0 erros).

- **2026-08-04 (SINC)**: **Acesso Irrestrito & Salvamento Direto no Firestore**:
  - **Acesso Aberto sem Bloqueios**: Atualização e implantação das regras em `firestore.rules` permitindo leitura e escrita irrestritas (`allow read, write: if true;`), eliminando qualquer restrição de validação, permissão ou verificação no salvamento do banco.
  - **Salvamento Direto nos Formulários**: Garantida a gravação imediata e sem interrupções em todos os botões de salvamento do aplicativo.
  - **Validação de Build**: Compilação e checagem de lint efetuadas com sucesso (0 erros).

- **2026-08-03 (SINC)**: **Blindagem de Integridade & Sincronização em Tempo Real (Total)**:
  - **Sincronização Bidirecional Instantânea**: Expansão e consolidação do sistema de subscrição reativa (`onSnapshot`) para cobrir todas as coleções do sistema (Viagens, Manutenção, Combustível, Financeiro, Estoque, Funcionários, Veículos e Documentos). Mudanças realizadas em qualquer dispositivo agora refletem instantaneamente em todos os usuários conectados com feedback visual de "Sino de Sincronização".
  - **Blindagem contra Objetos Indefinidos**: Aplicação global da função `cleanUndefined` em todas as operações de escrita (`addDoc`, `setDoc`, `updateDoc` e `runTransaction`) no `App.tsx` e `GabineteView.tsx`, eliminando erros críticos do Firestore ao tentar salvar campos com valores `undefined`.
  - **Feedback Visual de Sincronia**: Ativação de um motor de eventos customizado (`dmturismo_firestore_sync`) que dispara animações sutis no ícone de notificações e atualiza indicadores de status global sempre que novos dados são detectados no barramento de rede.
  - **Estabilização de Salvamento (Foreground)**: Refatoração de funções críticas (`handleSaveEmployee`, `handleSaveTrip`, `handleSaveMaintenance`, `handleSaveFuel`) para utilizar padrões `await` rigorosos, garantindo que o usuário receba confirmação de sucesso apenas após a persistência física no banco de dados.
  - **Governança de Documentos Financeiros**: Integração do `cleanUndefined` no motor de anexos de PDFs para Vencimentos, garantindo estabilidade no registro de documentos com metadados parciais.
  - **Validação Final**: Compilação total do projeto concluída com sucesso (0 erros de linter) e promoção para o estado de "Versão Estável Atualizada".

- **2026-08-03 (SINC)**: **Correção Crítica de Conectividade & Infraestrutura Firestore**:
  - **Resiliência de Rede**: Reconfiguração do SDK do Firestore para utilizar `experimentalForceLongPolling: true` e desativar detecção automática, mitigando erros de timeout ("Backend didn't respond within 10 seconds") comuns em ambientes de sandbox/iframe.
  - **Consistência de Identidade**: Correção do ID do banco de dados (`ai-studio-dmturismo-...`) nos arquivos `server.ts`, `firebase.json` e no deploy de regras, garantindo que o backend e o frontend apontem para a mesma instância de produção.
  - **Governança de Regras**: Re-implantação das regras de segurança no banco de dados correto para evitar falhas de permissão silenciosas.

- **2026-08-03 (SINC)**: **Otimização de Layout dos Terminais de Operação**:
  - **Relatórios Gabinete Pro**: Refatoração completa das grades de dados (Grids) nas abas de Frota, Viagens, Manutenção e Abastecimento do `GabineteView.tsx`. Implementação de layouts flexíveis e aumento da densidade de informação para garantir visibilidade de campos críticos como **Prefixo**, **Placa**, **Cliente**, **Motorista Reserva** e **Local de Abastecimento/Posto**, eliminando truncamentos indesejados.
  - **Monitoramento Unificado de Operações**: Atualização da lista unificada no `UnifiedOperationsManager.tsx` para incluir o mapeamento em tempo real do **Número de Frota (Prefixo)** via subscrição dedicada da coleção de veículos, além de expandir a exibição de detalhes de tripulação e ativos.
  - **Cards de Viagem Enriquecidos**: Ajuste visual no `TripsManagement.tsx` para destacar o **Prefixo do Veículo** em destaque visual junto à placa, facilitando a identificação rápida da escala pelo time de tráfego.
  - **Correção de Governança de Data**: Removido o campo `nextPreventiveMaintenanceDate` de todos os formulários e visualizações, unificando o controle de manutenção estritamente por quilometragem (KM).

- **2026-08-03 (SINC)**: **Restrição do Número de Frota (Prefixo) & Remoção de Preventiva por Data**:
  - **Bloqueio do Número de Frota**: O campo `prefix` no formulário de veículos (`VehicleForm`) é desabilitado quando o veículo já possui um número de frota gravado. Exibe mensagem explicativa com ícone de cadeado.
  - **Liberação Exclusiva no Gabinete**: A alteração do número de frota (prefixo) é liberada exclusivamente na interface do Gabinete (`GabineteView`), com botão dedicado de alteração ("Nº Frota") e modal administrativo de confirmação.
  - **Remoção da Data de Próxima Preventiva**: O campo `nextPreventiveMaintenanceDate` foi totalmente removido dos formulários de cadastro de veículos (`VehicleForm`), registro de manutenção (`MaintenanceForm`), alertas da frota (`FleetAlerts`), lista principal (`FleetList`), ficha técnica em PDF e detalhes do ativo (`VehicleDetail`), unificando o controle de manutenção preventiva exclusivamente por limite de Quilometragem (KM).
