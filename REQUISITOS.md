# DM Turismo - Documento de Requisitos (PRD)

## 1. Visão Geral
Sistema de gestão para empresas de turismo e fretamento, focado em Vans e Ônibus, visando controle total de frota, manutenção, funcionários e estoque próprio.

## 2. Módulos do Sistema

### 2.1 Gestão de Frota (Vans e Ônibus)
- **Cadastro**: Placa, Modelo, Ano, Tipo (Van/Bus), Capacidade, Odômetro Atual.
- **Vencimentos**: Alertas de Licenciamento, Seguro e Vistorias obrigatórias.
- **Status**: Disponível, Em Viagem, Em Manutenção, Reservado.

### 2.2 Controle de Combustível (Estoque Próprio)
- **Tanques Internos**: Cadastro de tanques (Ex: S10, Diesel Comum) com capacidade total.
- **Abastecimento**: Registro de data/hora, veículo, motorista, quantidade de litros e KM atual.
- **Cálculo de Média**: O sistema deve calcular automaticamente a média de KM/L por veículo.

### 2.3 Gestão de Manutenção
- **Preventiva**: Troca de óleo, filtros, correias e pneus com base no KM ou Tempo.
- **Corretiva**: Registro de quebras e reparos imprevistos.
- **Oficina**: Histórico completo de custos e peças utilizadas por veículo.

### 2.4 Gestão de Funcionários (RH)
- **Motoristas**: Cadastro de CNH, Categoria, Vencimento e Exame Toxicológico.
- **Staff Interno**: Mecânicos e Administrativo.

### 2.5 Almoxarifado (Matéria-prima e Peças)
- **Estoque**: Cadastro de peças (filtros, pastilhas, lâmpadas) e insumos (óleo, aditivo).
- **Entrada/Saída**: Registro de compras e aplicação das peças nas ordens de serviço.

## 3. Hierarquia de Acessos (RBAC)
- **Administrador**: Acesso total, incluindo custos financeiros e exclusão de dados.
- **Gerente de Frota**: Gestão de veículos, abastecimentos e manutenções.
- **Motorista**: Visualização do perfil e registro de abastecimentos.

## 4. Requisitos Não Funcionais
- **Disponibilidade**: Dados em tempo real (Firebase).
- **Segurança**: Regras de Firestore para impedir que motoristas alterem registros de outros.
- **Mobilidade**: Interface mobile-first para uso por motoristas no pátio.
