# EaD Dashboard

Dashboard interativo para visualização de avaliações de disciplinas em formato `.json`.

## Como usar

1. Abra `index.html` no navegador (requer servidor local para módulos ES):

   ```bash
   cd /home/licensed/dash
   npx -y serve .
   ```

   Acesse: http://localhost:3000

2. Na interface, clique em **Selecionar Arquivos** ou arraste arquivos `.json` para a área de upload.

3. Use os botões de navegação para alternar entre:
   - **Individual** — visualiza uma disciplina por vez
   - **Consolidado** — agrega todas as disciplinas
   - **Comparar** — gráficos lado a lado por pergunta

4. Alterne o tema com o botão 🌙/☀️ no canto superior direito.

5. Exporte os gráficos em PNG ou os dados em CSV pelos botões na barra superior.

## Formato esperado dos arquivos JSON

Cada arquivo `.json` deve ter **11 chaves**, uma por pergunta, com arrays de respostas:

```json
{
  "Você gostou da organização da sala virtual?": ["Sim", "Sim", "Não", ...],
  "A carga horária foi suficiente?": ["Sim", ...],
  ...
}
```

> O nome do arquivo (sem `.json`) será usado como nome da disciplina.

## Arquivos de exemplo

Na pasta `sample/` há 3 arquivos prontos para testar:

- `Matematica_I.json`
- `Lingua_Portuguesa.json`
- `Historia_da_Educacao.json`

## Estrutura

```
dash/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js          ← Orquestrador principal
│   ├── upload.js       ← Parse e validação de JSON
│   ├── processor.js    ← Agregação e métricas
│   ├── charts.js       ← Plotly.js (pizza + barras)
│   ├── filters.js      ← Estado dos filtros
│   ├── theme.js        ← Tema claro/escuro
│   └── export.js       ← PNG e CSV
└── sample/             ← Arquivos JSON de exemplo
```
