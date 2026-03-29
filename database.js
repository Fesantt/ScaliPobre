const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

// Caminho cross-platform para o banco de dados
const dbPath = path.join(__dirname, 'whiteboard.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('✅ Conectado ao banco de dados SQLite em:', dbPath);
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS board_members (
    board_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'editor',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (board_id, user_id),
    FOREIGN KEY (board_id) REFERENCES boards(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS elements (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    invited_by INTEGER NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id),
    FOREIGN KEY (invited_by) REFERENCES users(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_elements_board ON elements(board_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token)`);
});

class DatabaseAPI {
  registerUser(username, email, password, callback) {
    const passwordHash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', 
      [username, email, passwordHash], 
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return callback(new Error('Username ou email já existe'));
          }
          return callback(err);
        }
        callback(null, { id: this.lastID, username, email });
      }
    );
  }

  loginUser(username, password, callback) {
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], (err, user) => {
      if (err) return callback(err);
      if (!user) return callback(new Error('Usuário não encontrado'));
      if (!user.active) return callback(new Error('Conta inativa. Entre em contato com o administrador.'));
      if (!bcrypt.compareSync(password, user.password_hash)) {
        return callback(new Error('Senha incorreta'));
      }
      callback(null, { id: user.id, username: user.username, email: user.email, isSuperAdmin: user.id === 1 });
    });
  }

  getUserById(userId, callback) {
    db.get('SELECT id, username, email FROM users WHERE id = ?', [userId], callback);
  }

  createBoard(name, ownerId, callback) {
    const boardId = crypto.randomBytes(16).toString('hex');
    db.run('INSERT INTO boards (id, name, owner_id) VALUES (?, ?, ?)', [boardId, name, ownerId], (err) => {
      if (err) return callback(err);
      db.run('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)', [boardId, ownerId, 'owner'], (err) => {
        if (err) return callback(err);
        callback(null, { id: boardId, name, owner_id: ownerId });
      });
    });
  }

  getUserBoards(userId, callback) {
    db.all(`
      SELECT b.id, b.name, b.owner_id, b.created_at, bm.role
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      WHERE bm.user_id = ?
      ORDER BY b.created_at DESC
    `, [userId], callback);
  }

  getBoardById(boardId, callback) {
    db.get('SELECT * FROM boards WHERE id = ?', [boardId], callback);
  }

  canAccessBoard(userId, boardId, callback) {
    db.get('SELECT role FROM board_members WHERE user_id = ? AND board_id = ?', [userId, boardId], (err, member) => {
      if (err) return callback(err);
      callback(null, member !== undefined);
    });
  }

  getBoardMembers(boardId, callback) {
    db.all(`
      SELECT u.id, u.username, u.email, bm.role, bm.joined_at
      FROM board_members bm
      JOIN users u ON bm.user_id = u.id
      WHERE bm.board_id = ?
    `, [boardId], callback);
  }

  saveElement(boardId, elementId, type, data, userId) {
    db.run('INSERT OR REPLACE INTO elements (id, board_id, type, data, user_id) VALUES (?, ?, ?, ?, ?)',
      [elementId, boardId, type, JSON.stringify(data), userId]);
  }

  getElements(boardId, callback) {
    db.all('SELECT id, type, data FROM elements WHERE board_id = ?', [boardId], (err, rows) => {
      if (err) return callback(err);
      const elements = rows.map(row => ({
        id: row.id,
        type: row.type,
        ...JSON.parse(row.data)
      }));
      callback(null, elements);
    });
  }

  deleteElement(elementId) {
    db.run('DELETE FROM elements WHERE id = ?', [elementId]);
  }

  clearBoardElements(boardId) {
    db.run('DELETE FROM elements WHERE board_id = ?', [boardId]);
  }

  createInvite(boardId, invitedBy, callback) {
    // Primeiro verifica se já existe um convite ativo para este board
    db.get('SELECT token, expires_at FROM invites WHERE board_id = ? AND used = 0 AND expires_at > datetime("now") ORDER BY created_at DESC LIMIT 1', 
      [boardId], 
      (err, existingInvite) => {
        if (err) return callback(err);
        
        // Se já existe um convite válido, retorna ele
        if (existingInvite) {
          return callback(null, { token: existingInvite.token, expiresAt: existingInvite.expires_at, reused: true });
        }
        
        // Senão, cria um novo
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
        const inviteId = crypto.randomBytes(16).toString('hex');
        
        db.run('INSERT INTO invites (id, board_id, invited_by, email, token, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
          [inviteId, boardId, invitedBy, '', token, expiresAt],
          (err) => {
            if (err) return callback(err);
            callback(null, { token, expiresAt });
          }
        );
      }
    );
  }

  acceptInvite(token, userId, callback) {
    db.get('SELECT * FROM invites WHERE token = ? AND expires_at > datetime("now")', [token], (err, invite) => {
      if (err) return callback(err);
      if (!invite) return callback(new Error('Convite inválido ou expirado'));

      db.get('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?', [invite.board_id, userId], (err, alreadyMember) => {
        if (err) return callback(err);
        if (alreadyMember) return callback(new Error('Você já é membro deste board'));

        db.run('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)', [invite.board_id, userId, 'editor'], (err) => {
          if (err) return callback(err);
          this.getBoardById(invite.board_id, callback);
        });
      });
    });
  }

  removeBoardMember(boardId, userId, requesterId, callback) {
    this.getBoardById(boardId, (err, board) => {
      if (err) return callback(err);
      if (!board) return callback(new Error('Board não encontrado'));
      if (board.owner_id !== requesterId) {
        return callback(new Error('Apenas o dono pode remover membros'));
      }
      if (board.owner_id === userId) {
        return callback(new Error('O dono não pode ser removido'));
      }
      
      db.run('DELETE FROM board_members WHERE board_id = ? AND user_id = ?', [boardId, userId], callback);
    });
  }

  updateBoardName(boardId, name, userId, callback) {
    this.getBoardById(boardId, (err, board) => {
      if (err) return callback(err);
      if (!board) return callback(new Error('Board não encontrado'));
      if (board.owner_id !== userId) {
        return callback(new Error('Apenas o dono pode renomear o board'));
      }
      
      db.run('UPDATE boards SET name = ? WHERE id = ?', [name, boardId], callback);
    });
  }

  deleteBoard(boardId, userId, callback) {
    this.getBoardById(boardId, (err, board) => {
      if (err) return callback(err);
      if (!board) return callback(new Error('Board não encontrado'));
      if (board.owner_id !== userId) {
        return callback(new Error('Apenas o dono pode excluir o board'));
      }
      
      db.run('DELETE FROM elements WHERE board_id = ?', [boardId], (err) => {
        if (err) console.error('Erro ao excluir elementos:', err);
        
        db.run('DELETE FROM board_members WHERE board_id = ?', [boardId], (err) => {
          if (err) console.error('Erro ao excluir membros:', err);
          
          db.run('DELETE FROM boards WHERE id = ?', [boardId], callback);
        });
      });
    });
  }

  // ==================== MÉTODOS ADMINISTRATIVOS ====================
  
  getAllUsers(callback) {
    db.all(`SELECT id, username, email, active, created_at FROM users ORDER BY created_at DESC`, callback);
  }

  getAllBoards(callback) {
    db.all(`
      SELECT b.*, u.username as owner_username 
      FROM boards b 
      JOIN users u ON b.owner_id = u.id 
      ORDER BY b.created_at DESC
    `, callback);
  }

  getUserWithStats(userId, callback) {
    db.get('SELECT id, username, email, active, created_at FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) return callback(err);
      if (!user) return callback(new Error('Usuário não encontrado'));
      
      db.all('SELECT * FROM boards WHERE owner_id = ?', [userId], (err, boards) => {
        if (err) return callback(err);
        user.boards = boards;
        callback(null, user);
      });
    });
  }

  toggleUserActive(userId, active, callback) {
    if (userId === 1) {
      return callback(new Error('Não é possível inativar o super administrador'));
    }
    db.run('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, userId], callback);
  }

  deleteUser(userId, callback) {
    if (userId === 1) {
      return callback(new Error('Não é possível excluir o super administrador'));
    }
    
    // Excluir todos os boards do usuário
    db.all('SELECT id FROM boards WHERE owner_id = ?', [userId], (err, boards) => {
      if (err) return callback(err);
      
      const boardIds = boards.map(b => b.id);
      
      // Excluir elementos de todos os boards
      if (boardIds.length > 0) {
        const placeholders = boardIds.map(() => '?').join(',');
        db.run(`DELETE FROM elements WHERE board_id IN (${placeholders})`, boardIds, (err) => {
          if (err) console.error('Erro ao excluir elementos:', err);
        });
        
        db.run(`DELETE FROM board_members WHERE board_id IN (${placeholders})`, boardIds, (err) => {
          if (err) console.error('Erro ao excluir membros:', err);
        });
        
        db.run(`DELETE FROM boards WHERE owner_id = ?`, [userId], (err) => {
          if (err) console.error('Erro ao excluir boards:', err);
        });
      }
      
      // Remover usuário como membro de outros boards
      db.run('DELETE FROM board_members WHERE user_id = ?', [userId], (err) => {
        if (err) console.error('Erro ao remover memberships:', err);
      });
      
      // Excluir invites
      db.run('DELETE FROM invites WHERE created_by = ?', [userId], (err) => {
        if (err) console.error('Erro ao excluir invites:', err);
      });
      
      // Finalmente excluir usuário
      db.run('DELETE FROM users WHERE id = ?', [userId], callback);
    });
  }

  adminDeleteBoard(boardId, callback) {
    db.run('DELETE FROM elements WHERE board_id = ?', [boardId], (err) => {
      if (err) console.error('Erro ao excluir elementos:', err);
      
      db.run('DELETE FROM board_members WHERE board_id = ?', [boardId], (err) => {
        if (err) console.error('Erro ao excluir membros:', err);
        
        db.run('DELETE FROM boards WHERE id = ?', [boardId], callback);
      });
    });
  }
}

module.exports = new DatabaseAPI();
