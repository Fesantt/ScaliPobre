# 🎨 Whiteboard Colaborativo

Uma lousa infinita multiplayer em tempo real com persistência, inspirada no Excalidraw.

## ✨ Features

### 🎯 Ferramentas de Desenho
- **Caneta livre** - Desenho à mão livre suave
- **Linha** - Linhas retas
- **Retângulo** - Formas retangulares
- **Círculo** - Círculos perfeitos
- **Seta** - Setas direcionais
- **Texto** - Adicionar anotações de texto
- **Seleção** - Selecionar e deletar elementos

### 🌍 Canvas Infinito
- Pan (arrastar) com espaço + mouse ou botão do meio
- Zoom suave com scroll do mouse (10% - 500%)
- Coordenadas virtuais ilimitadas
- Viewport dinâmico responsivo

### 👥 Multiplayer Real-Time
- Sincronização instantânea entre usuários
- Cada usuário tem ID único
- Broadcast eficiente de mudanças
- Sem conflitos de edição

### 💾 Persistência Real
- Salvamento automático assíncrono
- Arquivo JSON com todos os elementos
- Debouncing de 1 segundo para otimizar I/O
- Carregamento automático ao conectar

### 🎨 UI Moderna
- Toolbar flutuante estilo Excalidraw
- Seletor de cores visual
- Controle de espessura de traço
- Indicadores de zoom e contagem de elementos
- Atalhos de teclado intuitivos

### ⚡ Funcionalidades Avançadas
- Undo/Redo (Ctrl+Z / Ctrl+Y)
- Deletar selecionado (Delete)
- Limpar tudo (confirmação necessária)
- Seleção visual com bounding box
- Preview em tempo real ao desenhar

## 🚀 Como Usar

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm start
```

O servidor iniciará em `http://localhost:3000`

### Deploy em Produção (PM2)

Para deploy com PM2 (recomendado para produção):

```bash
# Iniciar com PM2
npm run pm2:start

# Ver status
npm run pm2:status

# Ver logs
npm run pm2:logs
```

📖 **Documentação completa de deploy**: Veja [DEPLOY.md](./DEPLOY.md) para instruções detalhadas de deploy em Windows e Linux.

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `P` | Caneta |
| `L` | Linha |
| `R` | Retângulo |
| `C` | Círculo |
| `A` | Seta |
| `T` | Texto |
| `V` | Selecionar |
| `Espaço` | Pan (temporário) |
| `Scroll` | Zoom |
| `Shift + Drag` | Pan |
| `Botão do Meio` | Pan |
| `Ctrl + Z` | Desfazer |
| `Ctrl + Y` | Refazer |
| `Delete` | Deletar selecionado |

## 🏗️ Arquitetura

### Backend (`server.js`)
- **WebSocket Server** com `ws` library
- **Persistência assíncrona** com debouncing
- **Broadcast inteligente** (não envia para o remetente)
- **IDs únicos** gerados com crypto
- **CRUD completo** de elementos

### Frontend (`index.html`)
- **Canvas API** com transformações 2D
- **Sistema de coordenadas** screen/world
- **State management** centralizado
- **Event handling** otimizado
- **Rendering engine** eficiente

## 📦 Estrutura de Dados

### Elemento
```javascript
{
  id: "unique-id",
  type: "pen" | "line" | "rectangle" | "circle" | "arrow" | "text",
  color: "#000000",
  size: 2,
  userId: "user-id",
  createdAt: timestamp,
  
  // Específico do tipo
  points: [{x, y}],  // pen
  x1, y1, x2, y2,    // line, arrow, circle
  x, y, width, height, // rectangle
  text, x, y          // text
}
```

### Mensagens WebSocket

**Cliente → Servidor:**
```javascript
{ type: "add_element", element: {...} }
{ type: "update_element", id: "...", changes: {...} }
{ type: "delete_element", id: "..." }
{ type: "clear_all" }
```

**Servidor → Cliente:**
```javascript
{ type: "init", userId: "...", elements: [...] }
{ type: "element_added", element: {...} }
{ type: "element_updated", id: "...", changes: {...} }
{ type: "element_deleted", id: "..." }
{ type: "cleared" }
```

## 🎯 Melhorias Futuras

- [ ] Drag & drop de elementos selecionados
- [ ] Borracha para apagar partes de desenhos
- [ ] Preenchimento de formas
- [ ] Camadas (layers)
- [ ] Exportar como PNG/SVG
- [ ] Temas (claro/escuro)
- [ ] Cursores de outros usuários em tempo real
- [ ] Spatial indexing para performance com muitos elementos
- [ ] Compressão de pontos para desenhos suaves
- [ ] Histórico persistente (undo/redo global)

## 🛠️ Tecnologias

- **Backend:** Node.js, Express, WebSocket (`ws`)
- **Frontend:** Vanilla JavaScript, Canvas API, WebSocket Client
- **Autenticação:** BCrypt.js, Cookie-based sessions
- **Banco de Dados:** SQLite3 (cross-platform)
- **Deploy:** PM2 (Windows & Linux)
- **Real-time:** WebSocket para colaboração instantânea

## 📝 Licença

MIT

---

Feito com ❤️ para colaboração em tempo real
