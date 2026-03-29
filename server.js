const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ==================== MIDDLEWARES ====================

function requireAuth(req, res, next) {
  const sessionId = req.cookies.session;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.redirect('/login');
  }
  
  next();
}

function requireSuperAdmin(req, res, next) {
  const sessionId = req.cookies.session;
  const session = sessions.get(sessionId);
  
  if (!session || session.userId !== 1) {
    return res.redirect('/boards');
  }
  
  next();
}

// ==================== ROTAS DE PÁGINAS ====================

app.get('/', (req, res) => {
  const sessionId = req.cookies.session;
  const session = sessions.get(sessionId);
  
  if (session) {
    return res.redirect('/boards');
  }
  
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
  const sessionId = req.cookies.session;
  const session = sessions.get(sessionId);
  
  if (session) {
    return res.redirect('/boards');
  }
  
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/boards', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'boards.html'));
});

app.get('/admin', requireAuth, requireSuperAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/board/:boardId', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'board.html'));
});

app.get('/invite', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'invite.html'));
});

// Bloquear acesso direto aos arquivos HTML protegidos
app.use((req, res, next) => {
  const protectedPages = ['boards.html', 'admin.html', 'board.html', 'invite.html'];
  const requestedFile = path.basename(req.path);
  
  if (protectedPages.includes(requestedFile)) {
    return res.status(403).send('Acesso negado');
  }
  
  next();
});

// Bloquear acesso a arquivos sensíveis
app.use((req, res, next) => {
  const blockedExtensions = ['.db', '.db-journal', '.db-shm', '.db-wal'];
  const blockedFiles = [
    'package.json',
    'package-lock.json',
    'ecosystem.config.js',
    'server.js',
    'database.js',
    '.env',
    '.gitignore'
  ];
  
  const requestPath = req.path.toLowerCase();
  
  if (blockedExtensions.some(ext => requestPath.endsWith(ext))) {
    return res.status(403).send('Acesso negado');
  }
  
  const filename = path.basename(requestPath);
  if (blockedFiles.includes(filename)) {
    return res.status(403).send('Acesso negado');
  }
  
  next();
});

app.use(express.static('.'));

const sessions = new Map();
const boardConnections = new Map();

function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionId, { userId, createdAt: Date.now() });
  return sessionId;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function isSuperAdmin(req, res, next) {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  if (session.userId !== 1) {
    return res.status(403).json({ error: 'Acesso negado. Apenas super administrador.' });
  }
  
  next();
}

app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
  }
  
  db.registerUser(username, email, password, (err, user) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    const sessionId = createSession(user.id);
    res.cookie('session', sessionId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e senha são obrigatórios' });
  }
  
  db.loginUser(username, password, (err, user) => {
    if (err) {
      return res.status(401).json({ error: err.message });
    }
    
    const sessionId = createSession(user.id);
    res.cookie('session', sessionId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user });
  });
});

app.post('/api/logout', (req, res) => {
  const sessionId = req.cookies.session;
  if (sessionId) {
    sessions.delete(sessionId);
    res.clearCookie('session');
  }
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  db.getUserById(session.userId, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    user.isSuperAdmin = session.userId === 1;
    res.json({ user });
  });
});

app.post('/api/boards', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Nome do board é obrigatório' });
  }
  
  db.createBoard(name, session.userId, (err, board) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, board });
  });
});

app.get('/api/boards', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  db.getUserBoards(session.userId, (err, boards) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ boards });
  });
});

app.get('/api/boards/:boardId', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  const { boardId } = req.params;
  
  db.canAccessBoard(session.userId, boardId, (err, canAccess) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!canAccess) {
      return res.status(403).json({ error: 'Sem permissão para acessar este board' });
    }
    
    db.getBoardById(boardId, (err, board) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.getBoardMembers(boardId, (err, members) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ board, members });
      });
    });
  });
});

app.post('/api/boards/:boardId/invite', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  const { boardId } = req.params;
  
  db.canAccessBoard(session.userId, boardId, (err, canAccess) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!canAccess) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    
    db.createInvite(boardId, session.userId, (err, invite) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const inviteLink = `${req.protocol}://${req.get('host')}/invite?token=${invite.token}`;
      res.json({ success: true, inviteLink, token: invite.token, reused: invite.reused });
    });
  });
});

app.post('/api/invites/accept', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  const { token } = req.body;
  db.acceptInvite(token, session.userId, (err, board) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ success: true, board });
  });
});

app.patch('/api/boards/:boardId', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  const { boardId } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }
  
  db.updateBoardName(boardId, name, session.userId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.delete('/api/boards/:boardId', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  const { boardId } = req.params;
  
  db.deleteBoard(boardId, session.userId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.delete('/api/boards/:boardId/members/:userId', (req, res) => {
  const sessionId = req.cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  const { boardId, userId } = req.params;
  db.removeBoardMember(boardId, parseInt(userId), session.userId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// ==================== ROTAS ADMINISTRATIVAS ====================

app.get('/api/admin/users', isSuperAdmin, (req, res) => {
  db.getAllUsers((err, users) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ users });
  });
});

app.get('/api/admin/boards', isSuperAdmin, (req, res) => {
  db.getAllBoards((err, boards) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ boards });
  });
});

app.get('/api/admin/users/:userId', isSuperAdmin, (req, res) => {
  const { userId } = req.params;
  db.getUserWithStats(parseInt(userId), (err, user) => {
    if (err) {
      return res.status(404).json({ error: err.message });
    }
    res.json({ user });
  });
});

app.patch('/api/admin/users/:userId/toggle', isSuperAdmin, (req, res) => {
  const { userId } = req.params;
  const { active } = req.body;
  
  db.toggleUserActive(parseInt(userId), active, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.delete('/api/admin/users/:userId', isSuperAdmin, (req, res) => {
  const { userId } = req.params;
  
  db.deleteUser(parseInt(userId), (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.delete('/api/admin/boards/:boardId', isSuperAdmin, (req, res) => {
  const { boardId } = req.params;
  
  db.adminDeleteBoard(boardId, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

wss.on('connection', (ws, req) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.session;
  const session = getSession(sessionId);
  
  if (!session) {
    ws.close(1008, 'Não autenticado');
    return;
  }
  
  ws.userId = session.userId;
  ws.sessionId = crypto.randomBytes(8).toString('hex');
  
  db.getUserById(ws.userId, (err, user) => {
    if (!err && user) {
      ws.username = user.username;
    } else {
      ws.username = `User ${ws.userId}`;
    }
  });
  
  console.log(`Cliente conectado: user ${ws.userId}`);
  
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      handleWebSocket(ws, data);
    } catch (err) {
      console.error('Erro ao processar mensagem:', err);
    }
  });
  
  ws.on('close', () => {
    console.log(`Cliente desconectado: user ${ws.userId}`);
    if (ws.boardId) {
      broadcastToBoard(ws.boardId, {
        type: 'user_disconnected',
        userId: ws.sessionId
      });
      
      const connections = boardConnections.get(ws.boardId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          boardConnections.delete(ws.boardId);
        }
      }
    }
  });
});

function handleWebSocket(ws, data) {
  switch (data.type) {
    case 'join_board':
      db.canAccessBoard(ws.userId, data.boardId, (err, canAccess) => {
        if (err || !canAccess) {
          ws.send(JSON.stringify({ type: 'error', message: 'Sem permissão' }));
          return;
        }
        
        ws.boardId = data.boardId;
        
        if (!boardConnections.has(data.boardId)) {
          boardConnections.set(data.boardId, new Set());
        }
        boardConnections.get(data.boardId).add(ws);
        
        db.getElements(data.boardId, (err, elements) => {
          if (err) {
            console.error('Erro ao carregar elementos:', err);
            elements = [];
          }
          
          ws.send(JSON.stringify({
            type: 'init',
            userId: ws.sessionId,
            elements
          }));
        });
      });
      break;
      
    case 'draw_live':
      broadcastToBoard(ws.boardId, {
        type: 'draw_live',
        userId: ws.sessionId,
        tool: data.tool,
        point: data.point,
        color: data.color,
        size: data.size
      }, ws);
      break;
      
    case 'cursor_move':
      broadcastToBoard(ws.boardId, {
        type: 'cursor_move',
        userId: ws.sessionId,
        username: ws.username || `User ${ws.userId}`,
        x: data.x,
        y: data.y
      }, ws);
      break;
      
    case 'laser_clear':
      broadcastToBoard(ws.boardId, {
        type: 'laser_clear',
        userId: ws.sessionId,
        laserId: data.laserId
      }, ws);
      break;
      
    case 'add_element':
      const element = data.element;
      if (!element.id) {
        element.id = crypto.randomBytes(16).toString('hex');
      }
      
      db.saveElement(ws.boardId, element.id, element.type, element, ws.userId);
      
      broadcastToBoard(ws.boardId, {
        type: 'element_added',
        element,
        userId: ws.sessionId
      }, ws);
      break;
      
    case 'update_element':
      db.getElements(ws.boardId, (err, elements) => {
        if (err) {
          console.error('Erro ao buscar elemento:', err);
          return;
        }
        
        const existingElement = elements.find(el => el.id === data.id);
        const elementType = existingElement ? existingElement.type : (data.changes.type || 'pen');
        
        const updatedElement = existingElement ? { ...existingElement, ...data.changes } : data.changes;
        
        db.saveElement(ws.boardId, data.id, elementType, updatedElement, ws.userId);
        
        broadcastToBoard(ws.boardId, {
          type: 'element_updated',
          id: data.id,
          changes: data.changes
        }, ws);
      });
      break;
      
    case 'delete_element':
      db.deleteElement(data.id);
      
      broadcastToBoard(ws.boardId, {
        type: 'element_deleted',
        id: data.id
      }, ws);
      break;
      
    case 'clear_all':
      db.clearBoardElements(ws.boardId);
      
      broadcastToBoard(ws.boardId, {
        type: 'cleared'
      }, ws);
      break;
  }
}

function broadcastToBoard(boardId, data, except = null) {
  const connections = boardConnections.get(boardId);
  if (!connections) return;
  
  const msg = JSON.stringify(data);
  connections.forEach(client => {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = value;
    });
  }
  return cookies;
}

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});