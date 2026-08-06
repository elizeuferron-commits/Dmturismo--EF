# Regras do Aplicativo - Gestão DM Turismo

## 🛡️ Fluxo de Trabalho: Modo Sombra (Shadow Mode)
O usuário estabeleceu um workflow de "Linha Paralela" para desenvolvimento:

1. **Desenvolvimento Isolado**: Novas funcionalidades devem ser discutidas e preparadas em arquivos de extensão `.shadow.tsx` ou documentadas no `SHADOW_LOG.md` antes de serem integradas.
2. **Proteção da Estabilidade**: O código residente em `src/App.tsx`, `src/components/`, etc., é considerado a "Versão de Produção".
3. **Comando de Gatilho**: Somente quando o usuário solicitar "Atualizar o aplicativo", as alterações do Modo Sombra devem ser movidas/mescladas para os arquivos principais.
4. **Referência de Partida**: O arquivo `PONTO_DE_PARTIDA.md` serve como referência do estado estável inicial.

## 🎨 Diretrizes de Design
- Seguir o padrão "DM Turismo": Escopo visual baseado em branco, azul marinho (asphalt-900/950) e preto (zinc-900/950) como cores padrão do layout. Detalhes e destaques refinados em branco e tipografia em Inter.
- Manter o estilo de botões e cards com cantos arredondados (rounded-2xl) e fontes uppercase para labels técnicas.

## 🔒 Isolamento e Blindagem de Escopo (Scoping & Shielding)
- **Mudança Direcionada**: Ao iniciar uma modificação com a especificação "na ferramenta [X]" (ou equivalente), as alterações devem ficar restritas exclusivamente à ferramenta ou módulo escolhido.
- **Blindagem Contra Efeitos Colaterais**: Todas as outras ferramentas, componentes e coleções adjacentes devem ser totalmente blindados e protegidos contra modificações colaterais ou acidentais, preservando sua estabilidade e integridade funcional.
- **Isolamento de Documentos PDF**: Documentos salvos em PDF devem ser visíveis apenas na ferramenta onde foram adicionados. Documentos lançados em "Detalhes do Ativo" (Veículo) aparecem apenas na ficha desse ativo. Documentos lançados no "Financeiro" aparecem apenas na ferramenta Financeiro.

## 🌐 Idioma e Comunicação
- **Português do Brasil (PT-BR)**: Toda a comunicação do agente, resumos, planos de design, logs de alteração (como o SHADOW_LOG.md) e comentários de código devem ser redigidos obrigatoriamente em Português do Brasil.
