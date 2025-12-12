// backend/services/revisionPoolManager.js
class RevisionPoolManager {
  constructor() {
    if (RevisionPoolManager._instance) {
      return RevisionPoolManager._instance;
    }

    this.currentSession = null;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutos en milisegundos
    this.sessionsHistory = [];
    
    // Iniciar limpieza automática de sesiones expiradas
    this.startCleanupInterval();
    
    console.log("📦 RevisionPoolManager Singleton inicializado");
    RevisionPoolManager._instance = this;
  }

  static getInstance() {
    if (!RevisionPoolManager._instance) {
      RevisionPoolManager._instance = new RevisionPoolManager();
    }
    return RevisionPoolManager._instance;
  }

  // Adquirir el pool para revisión
  acquirePool(userId, userName, userType = 'revisor') {
    this.cleanExpiredSessions();

    if (this.currentSession) {
      // Si el pool está ocupado por el mismo usuario (en otra pestaña)
      if (this.currentSession.userId === userId) {
        // Extender la sesión existente
        this.currentSession.expiresAt = new Date(Date.now() + this.sessionTimeout);
        return {
          success: true,
          message: 'Ya tienes el pool de revisión',
          session: this.currentSession,
          isExtension: true
        };
      }
      
      // Pool ocupado por otro usuario
      return {
        success: false,
        message: `El pool de revisión está ocupado por ${this.currentSession.userName}`,
        currentUser: this.currentSession.userName,
        expiresAt: this.currentSession.expiresAt,
        timeRemaining: this.getTimeRemaining()
      };
    }

    // Crear nueva sesión
    this.currentSession = {
      userId,
      userName,
      userType,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeout),
      lastActivity: new Date(),
      isActive: true
    };

    this.sessionsHistory.push({
      ...this.currentSession,
      action: 'acquired'
    });

    console.log(`🔒 Pool adquirido por ${userName} (${userId})`);
    
    return {
      success: true,
      message: 'Pool de revisión adquirido exitosamente',
      session: this.currentSession,
      expiresIn: this.sessionTimeout / (60 * 1000) // minutos
    };
  }

  // Liberar el pool
  releasePool(userId, force = false) {
    if (!this.currentSession) {
      return {
        success: false,
        message: 'El pool de revisión ya está libre'
      };
    }

    if (!force && this.currentSession.userId !== userId) {
      return {
        success: false,
        message: 'No puedes liberar el pool de otra persona'
      };
    }

    const releasedUser = this.currentSession.userName;
    
    this.sessionsHistory.push({
      ...this.currentSession,
      action: force ? 'force-released' : 'released',
      releasedAt: new Date()
    });

    this.currentSession = null;
    console.log(`🔓 Pool liberado por ${releasedUser} ${force ? '(forzado)' : ''}`);
    
    return {
      success: true,
      message: `Pool liberado ${force ? 'forzosamente' : 'exitosamente'}`,
      previousUser: releasedUser
    };
  }

  // Verificar estado del pool
  checkPoolStatus(userId = null) {
    this.cleanExpiredSessions();

    if (!this.currentSession) {
      return {
        isAvailable: true,
        message: 'Pool de revisión disponible'
      };
    }

    const timeRemaining = this.getTimeRemaining();
    const isOwner = userId && this.currentSession.userId === userId;

    return {
      isAvailable: false,
      isOwner: isOwner,
      currentUser: this.currentSession.userName,
      acquiredAt: this.currentSession.acquiredAt,
      expiresAt: this.currentSession.expiresAt,
      timeRemaining: timeRemaining,
      timeRemainingMinutes: Math.floor(timeRemaining / (60 * 1000)),
      message: isOwner 
        ? `Tienes el pool de revisión (${Math.floor(timeRemaining / (60 * 1000))} min restantes)`
        : `Pool ocupado por ${this.currentSession.userName} (${Math.floor(timeRemaining / (60 * 1000))} min restantes)`
    };
  }

  // Registrar actividad para extender sesión
  registerActivity(userId) {
    if (!this.currentSession || this.currentSession.userId !== userId) {
      return { success: false, message: 'No tienes una sesión activa' };
    }

    this.currentSession.lastActivity = new Date();
    this.currentSession.expiresAt = new Date(Date.now() + this.sessionTimeout);
    
    return {
      success: true,
      message: 'Actividad registrada, sesión extendida',
      expiresAt: this.currentSession.expiresAt
    };
  }

  // Obtener tiempo restante en milisegundos
  getTimeRemaining() {
    if (!this.currentSession) return 0;
    return Math.max(0, this.currentSession.expiresAt - new Date());
  }

  // Limpiar sesiones expiradas
  cleanExpiredSessions() {
    if (this.currentSession && new Date() > this.currentSession.expiresAt) {
      console.log(`⏰ Sesión expirada para ${this.currentSession.userName}`);
      
      this.sessionsHistory.push({
        ...this.currentSession,
        action: 'expired',
        expiredAt: new Date()
      });
      
      this.currentSession = null;
    }
  }

  // Iniciar intervalo de limpieza
  startCleanupInterval() {
    setInterval(() => {
      this.cleanExpiredSessions();
    }, 60000); // Revisar cada minuto
  }

  // Obtener estadísticas
  getStats() {
    return {
      currentSession: this.currentSession,
      sessionsToday: this.sessionsHistory.filter(s => 
        new Date(s.acquiredAt).toDateString() === new Date().toDateString()
      ).length,
      totalSessions: this.sessionsHistory.length,
      sessionTimeoutMinutes: this.sessionTimeout / (60 * 1000)
    };
  }

  // Forzar liberación (para admin)
  forceReleasePool(adminToken) {
    if (adminToken !== 'admin123') {
      return { success: false, message: 'Token de admin inválido' };
    }

    return this.releasePool(null, true);
  }

  // Agrega estos métodos si no los tienes:

// Método para verificar si un usuario puede acceder
canUserAccess(userId) {
  this.cleanExpiredSessions();
  
  if (!this.currentSession) {
    return {
      canAccess: true,
      reason: 'Pool disponible'
    };
  }
  
  if (this.currentSession.userId === userId) {
    return {
      canAccess: true,
      reason: 'Eres el dueño actual del pool',
      session: this.currentSession
    };
  }
  
  return {
    canAccess: false,
    reason: `Pool ocupado por ${this.currentSession.userName}`,
    currentUser: this.currentSession.userName,
    expiresAt: this.currentSession.expiresAt
  };
}

// Método simplificado para frontend
getSimpleStatus() {
  this.cleanExpiredSessions();
  
  if (!this.currentSession) {
    return {
      status: 'available',
      message: 'Pool disponible'
    };
  }
  
  return {
    status: 'occupied',
    currentUser: this.currentSession.userName,
    expiresAt: this.currentSession.expiresAt,
    timeRemaining: this.getTimeRemaining(),
    message: `Ocupado por ${this.currentSession.userName}`
  };
}
}

module.exports = RevisionPoolManager.getInstance();