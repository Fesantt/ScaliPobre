# 🚀 Guia de Deploy - Whiteboard Colaborativo

Este guia descreve como fazer deploy da aplicação usando PM2 em Windows e Linux.

## 📋 Pré-requisitos

- Node.js 14.0.0 ou superior
- npm ou yarn
- PM2 (será instalado automaticamente)

## 🔧 Instalação

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd projetinho
```

### 2. Instale as dependências

```bash
npm install
```

Isso instalará todas as dependências, incluindo o PM2.

## 🐧 Deploy no Linux

### Instalação e Inicialização

```bash
# Instalar dependências
npm install

# Iniciar aplicação com PM2
npm run pm2:start

# Configurar PM2 para iniciar automaticamente no boot
npm run pm2:startup
# Execute o comando que o PM2 mostrar no terminal (com sudo)

# Salvar configuração atual
npm run pm2:save
```

### Comandos úteis

```bash
# Ver status
npm run pm2:status

# Ver logs em tempo real
npm run pm2:logs

# Monitorar aplicação
npm run pm2:monit

# Reiniciar aplicação
npm run pm2:restart

# Parar aplicação
npm run pm2:stop

# Remover do PM2
npm run pm2:delete
```

## 🪟 Deploy no Windows

### Instalação e Inicialização

```powershell
# Instalar dependências
npm install

# Iniciar aplicação com PM2
npm run pm2:start

# Configurar PM2 para iniciar automaticamente no boot
npm run pm2:startup
# Execute o comando que o PM2 mostrar no PowerShell (como Administrador)

# Salvar configuração atual
npm run pm2:save
```

### Comandos úteis (PowerShell)

```powershell
# Ver status
npm run pm2:status

# Ver logs em tempo real
npm run pm2:logs

# Monitorar aplicação
npm run pm2:monit

# Reiniciar aplicação
npm run pm2:restart

# Parar aplicação
npm run pm2:stop

# Remover do PM2
npm run pm2:delete
```

### Configurar como Serviço Windows (Opcional)

Para executar o PM2 como serviço Windows:

```powershell
# Instalar pm2-windows-service globalmente
npm install -g pm2-windows-service

# Instalar o serviço
pm2-service-install -n PM2
```

## 🗄️ Banco de Dados SQLite

O banco de dados SQLite é criado automaticamente na primeira execução:
- **Localização**: `./whiteboard.db`
- **Compatibilidade**: Funciona em Windows e Linux
- **Backup**: Recomenda-se fazer backup regular do arquivo `.db`

### Backup do Banco de Dados

**Linux/Mac:**
```bash
cp whiteboard.db whiteboard.db.backup
```

**Windows:**
```powershell
copy whiteboard.db whiteboard.db.backup
```

## 📊 Logs

Os logs são salvos em:
- `./logs/err.log` - Erros
- `./logs/out.log` - Output padrão
- `./logs/combined.log` - Combinado

### Limpar logs

```bash
npm run logs:clear
```

## 🔐 Configuração de Porta

Por padrão, a aplicação roda na porta **3000**.

Para alterar, edite o arquivo `ecosystem.config.js`:

```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3000  // Altere aqui
}
```

## 🌐 Configuração de Firewall

### Linux (Ubuntu/Debian)

```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

### Windows

```powershell
# No PowerShell como Administrador
New-NetFirewallRule -DisplayName "Whiteboard App" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

## 🔄 Atualização da Aplicação

```bash
# 1. Parar a aplicação
npm run pm2:stop

# 2. Atualizar código
git pull

# 3. Instalar novas dependências (se houver)
npm install

# 4. Reiniciar aplicação
npm run pm2:restart
```

## 🐛 Troubleshooting

### Porta já em uso

Se a porta 3000 já estiver em uso:

1. Identifique o processo:
   - **Linux**: `lsof -i :3000`
   - **Windows**: `netstat -ano | findstr :3000`

2. Mate o processo ou altere a porta no `ecosystem.config.js`

### Permissões (Linux)

Se encontrar erros de permissão:

```bash
# Dar permissões de execução
chmod +x server.js

# Executar PM2 com permissões corretas
sudo npm run pm2:start
```

### PM2 não inicia automaticamente

**Linux:**
```bash
pm2 save
pm2 startup
# Execute o comando gerado
```

**Windows:**
```powershell
# Como Administrador
pm2 save
pm2 startup
# Execute o comando gerado
```

## 📱 Acessar a Aplicação

Após o deploy, acesse:
- **Local**: `http://localhost:3000`
- **Rede**: `http://<seu-ip>:3000`

## 🛡️ Segurança em Produção

### Recomendações:

1. **Use HTTPS**: Configure um proxy reverso (Nginx/Apache) com SSL
2. **Variáveis de Ambiente**: Nunca commite senhas ou secrets
3. **Firewall**: Permita apenas portas necessárias
4. **Backups**: Configure backups automáticos do SQLite
5. **Atualizações**: Mantenha as dependências atualizadas

### Exemplo Nginx (Linux)

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs: `npm run pm2:logs`
2. Confira o status: `npm run pm2:status`
3. Reinicie a aplicação: `npm run pm2:restart`

---

**Desenvolvido com ❤️ usando Node.js, Express, WebSocket e SQLite**
