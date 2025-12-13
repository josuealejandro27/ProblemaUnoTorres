// frontend/src/app/services/pool.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface PoolStatus {
  isAvailable: boolean;
  isOwner?: boolean;
  currentUser?: string;
  expiresAt?: Date;
  timeRemaining?: number;
  timeRemainingMinutes?: number;
  message: string;
}

export interface SimplePoolStatus {
  status: 'available' | 'occupied' | 'error';
  currentUser?: string;
  expiresAt?: Date;
  timeRemaining?: number;
  message: string;
}

export interface AcquireResponse {
  success: boolean;
  message: string;
  session?: any;
  expiresIn?: number;
  currentUser?: string;
  isExtension?: boolean;
}

@Injectable({
  providedIn: 'root' // ✅ Garantiza instancia única en toda la app
})
export class PoolService {
  // ✅ PATRÓN SINGLETON: Instancia estática única
  private static instance: PoolService | null = null;
  
  // URLs y configuración
  private readonly apiUrl = 'http://localhost:3000/api/revision-pool';
  
  // ✅ Claves de almacenamiento
  private readonly SESSION_ID_KEY = 'poolSessionId';
  private readonly USER_NAME_KEY = 'revisorName';
  private readonly USER_EMAIL_KEY = 'revisorEmail';
  private readonly POOL_OWNER_KEY = 'poolOwnerSessionId';
  
  // ✅ Propiedades de instancia única
  private sessionId: string=''; // Único por pestaña
  private userName: string = '';
  private userEmail: string = '';
  private activityInterval: any;
  
  constructor(private http: HttpClient) {
    // ✅ PATRÓN SINGLETON: Verificar instancia única
    if (PoolService.instance) {
      console.warn('⚠️ PoolService ya existe. Retornando instancia existente.');
      return PoolService.instance;
    }

    console.log('🏗️ Creando nueva instancia de PoolService...');

    // ✅ Generar o recuperar sessionId ÚNICO POR PESTAÑA
    this.sessionId = this.getOrCreateSessionId();
    
    // Cargar datos del usuario desde localStorage (compartido entre pestañas)
    this.loadUserData();
    
    // ✅ Guardar instancia única
    PoolService.instance = this;
    
    console.log(`✅ PoolService inicializado:
      - SessionId: ${this.sessionId}
      - Usuario: ${this.userName || 'No autenticado'}
      - Email: ${this.userEmail || 'N/A'}`);
    
    // Limpieza al cerrar pestaña
    this.setupBeforeUnloadHandler();
  }

  // ✅ MÉTODO ESTÁTICO para obtener instancia (Patrón Singleton clásico)
  public static getInstance(): PoolService {
    if (!PoolService.instance) {
      throw new Error('PoolService no ha sido inicializado. Inyecta el servicio primero.');
    }
    return PoolService.instance;
  }

  /**
   * ✅ Genera o recupera sessionId ÚNICO por pestaña
   * Usa sessionStorage (no compartido entre pestañas)
   */
  private getOrCreateSessionId(): string {
    // Intentar recuperar de sessionStorage (único por pestaña)
    let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
    
    if (!sessionId) {
      // Generar nuevo ID único
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
      console.log('🆕 Nuevo sessionId generado:', sessionId);
    } else {
      console.log('♻️ SessionId recuperado:', sessionId);
    }
    
    return sessionId;
  }

  /**
   * ✅ Carga datos del usuario desde localStorage
   */
  private loadUserData(): void {
    const savedName = localStorage.getItem(this.USER_NAME_KEY);
    const savedEmail = localStorage.getItem(this.USER_EMAIL_KEY);
    
    if (savedName) {
      this.userName = savedName;
    }
    
    if (savedEmail) {
      this.userEmail = savedEmail;
    }
  }

  /**
   * ✅ Configura limpieza automática al cerrar pestaña
   */
  private setupBeforeUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Solo liberar si ESTA pestaña es dueña del pool
      if (this.isPoolOwner()) {
        console.log('🚪 Cerrando pestaña dueña del pool - liberando...');
        // Sincrónico para que ejecute antes de cerrar
        navigator.sendBeacon(`${this.apiUrl}/release`, JSON.stringify({
          userId: this.sessionId
        }));
        this.clearPoolOwnership();
      }
    });
  }

  /**
   * ✅ Guarda datos del usuario en el servicio
   */
  setUserData(name: string, email: string): void {
    this.userName = name;
    this.userEmail = email;
    
    // Guardar en localStorage (compartido entre pestañas del mismo usuario)
    localStorage.setItem(this.USER_NAME_KEY, name);
    localStorage.setItem(this.USER_EMAIL_KEY, email);
    
    console.log('💾 Datos de usuario actualizados:', { name, email });
  }

  /**
   * ✅ Obtiene el sessionId ÚNICO de esta pestaña
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * ✅ Obtiene el nombre del usuario
   */
  getUserName(): string {
    return this.userName;
  }

  /**
   * ✅ Obtiene el email del usuario
   */
  getUserEmail(): string {
    return this.userEmail;
  }

  /**
   * ✅ Verifica si hay un usuario configurado
   */
  hasUser(): boolean {
    return !!this.userName;
  }

  /**
   * ✅ Verifica si ESTA pestaña es dueña del pool
   */
  isPoolOwner(): boolean {
    const ownerSessionId = localStorage.getItem(this.POOL_OWNER_KEY);
    const isOwner = ownerSessionId === this.sessionId;
    
    console.log(`🔍 isPoolOwner check:
      - Owner session: ${ownerSessionId}
      - This session: ${this.sessionId}
      - Result: ${isOwner}`);
    
    return isOwner;
  }

  /**
   * ✅ Marca esta pestaña como dueña del pool
   */
  private setPoolOwnership(): void {
    localStorage.setItem(this.POOL_OWNER_KEY, this.sessionId);
    console.log('👑 Esta pestaña ahora es dueña del pool');
  }

  /**
   * ✅ Limpia la propiedad del pool
   */
  private clearPoolOwnership(): void {
    const currentOwner = localStorage.getItem(this.POOL_OWNER_KEY);
    
    // Solo limpiar si esta sesión es la dueña
    if (currentOwner === this.sessionId) {
      localStorage.removeItem(this.POOL_OWNER_KEY);
      console.log('🔓 Propiedad del pool liberada');
    }
  }

  /**
   * ✅ Verifica el estado del pool
   */
  checkStatus(): Observable<PoolStatus> {
    console.log(`🔍 checkStatus llamado:
      - SessionId: ${this.sessionId}
      - UserName: ${this.userName}
      - URL: ${this.apiUrl}/status`);
    
    return this.http.get<PoolStatus>(`${this.apiUrl}/status`, {
      params: { userId: this.sessionId } // ✅ Usar sessionId único
    }).pipe(
      tap(status => {
        console.log('📊 Estado del pool recibido:', status);
        
        // Actualizar propiedad local basada en respuesta
        if (!status.isAvailable && status.currentUser === this.userName) {
          // Verificar si somos dueños
          status.isOwner = this.isPoolOwner();
        }
      }),
      catchError(error => {
        console.error('❌ Error en checkStatus:', error);
        console.error('URL intentada:', `${this.apiUrl}/status?userId=${this.sessionId}`);
        return of({
          isAvailable: false,
          isOwner: false,
          message: `Error al verificar estado del pool: ${error.status || 'Sin conexión'}`
        });
      })
    );
  }

  /**
   * ✅ Obtiene estado simple del pool
   */
  getSimpleStatus(): Observable<SimplePoolStatus> {
    console.log('🔍 getSimpleStatus llamado');
    
    return this.http.get<SimplePoolStatus>(`${this.apiUrl}/simple-status`).pipe(
      catchError(error => {
        console.error('❌ Error en getSimpleStatus:', error);
        return of({
          status: 'error' as 'error',
          message: `Error de conexión: ${error.status || 'Servidor no responde'}`
        });
      })
    );
  }

  /**
   * ✅ Adquiere el pool de revisión
   */
  acquirePool(): Observable<AcquireResponse> {
    if (!this.userName) {
      throw new Error('Nombre de revisor requerido. Por favor selecciona un revisor primero.');
    }

    console.log(`🔓 Intentando adquirir pool:
      - SessionId: ${this.sessionId}
      - Usuario: ${this.userName}`);
    
    return this.http.post<AcquireResponse>(`${this.apiUrl}/acquire`, {
      userId: this.sessionId, // ✅ Usar sessionId único
      userName: this.userName,
      userEmail: this.userEmail,
      userType: 'revisor'
    }).pipe(
      tap(response => {
        if (response.success) {
          // ✅ Marcar esta pestaña como dueña
          this.setPoolOwnership();
          console.log('✅ Pool adquirido exitosamente');
        } else {
          console.warn('⚠️ No se pudo adquirir el pool:', response.message);
        }
      }),
      catchError(error => {
        console.error('❌ Error en acquirePool:', error);
        return of({
          success: false,
          message: 'Error de conexión al servidor'
        });
      })
    );
  }

  /**
   * ✅ Libera el pool de revisión
   */
  releasePool(): Observable<any> {
    // Verificar si esta pestaña es dueña
    if (!this.isPoolOwner()) {
      console.warn('⚠️ Esta pestaña no es dueña del pool. No se puede liberar.');
      return of({ 
        success: false, 
        message: 'Solo la pestaña que abrió el pool puede liberarlo' 
      });
    }

    this.stopActivityMonitoring();
    
    console.log(`🔒 Liberando pool:
      - SessionId: ${this.sessionId}
      - Usuario: ${this.userName}`);
    
    return this.http.post(`${this.apiUrl}/release`, {
      userId: this.sessionId // ✅ Usar sessionId único
    }).pipe(
      tap((response: any) => {
        if (response.success) {
          this.clearPoolOwnership();
          console.log('✅ Pool liberado exitosamente');
        }
      }),
      catchError(error => {
        console.error('❌ Error en releasePool:', error);
        // Limpiar ownership aunque falle la llamada
        this.clearPoolOwnership();
        return of({ success: false, message: 'Error al liberar pool' });
      })
    );
  }

  /**
   * ✅ Registra actividad para mantener sesión viva
   */
  registerActivity(): Observable<any> {
    if (!this.isPoolOwner()) {
      // No registrar actividad si no somos dueños
      return of({ success: false, message: 'No eres dueño del pool' });
    }

    return this.http.post(`${this.apiUrl}/activity`, {
      userId: this.sessionId
    }).pipe(
      tap((response: any) => {
        if (response.success) {
          console.log('💓 Actividad registrada - sesión extendida');
        }
      }),
      catchError(error => {
        console.error('❌ Error en registerActivity:', error);
        return of({ success: false, message: 'Error al registrar actividad' });
      })
    );
  }

  /**
   * ✅ Inicia monitoreo de actividad (mantener sesión viva)
   */
  startActivityMonitoring(): void {
    // Limpiar cualquier intervalo previo
    this.stopActivityMonitoring();
    
    console.log('🔄 Iniciando monitoreo de actividad (cada 2 minutos)');
    
    this.activityInterval = setInterval(() => {
      if (this.userName && this.isPoolOwner()) {
        this.registerActivity().subscribe({
          next: (response) => {
            if (!response.success) {
              console.warn('⚠️ No se pudo registrar actividad - pool perdido?');
              this.stopActivityMonitoring();
              this.clearPoolOwnership();
            }
          },
          error: (err) => {
            console.error('❌ Error crítico al registrar actividad:', err);
            this.stopActivityMonitoring();
          }
        });
      } else {
        console.log('⏸️ Sin usuario o sin ownership - deteniendo monitoreo');
        this.stopActivityMonitoring();
      }
    }, 120000); // 2 minutos
  }

  /**
   * ✅ Detiene el monitoreo de actividad
   */
  stopActivityMonitoring(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
      console.log('⏹️ Monitoreo de actividad detenido');
    }
  }

  /**
   * ✅ Limpia la sesión completa (logout)
   */
  clearSession(): void {
    // Si somos dueños del pool, liberarlo primero
    if (this.isPoolOwner()) {
      this.releasePool().subscribe();
    }

    // Limpiar datos de usuario
    this.userName = '';
    this.userEmail = '';
    
    localStorage.removeItem(this.USER_NAME_KEY);
    localStorage.removeItem(this.USER_EMAIL_KEY);
    this.clearPoolOwnership();
    
    this.stopActivityMonitoring();
    
    console.log('🧹 Sesión limpiada completamente');
  }

  /**
   * ✅ Limpia SOLO el sessionStorage de esta pestaña
   */
  clearTabSession(): void {
    sessionStorage.removeItem(this.SESSION_ID_KEY);
    console.log('🗑️ Session storage de esta pestaña limpiado');
  }

  /**
   * Hook de destrucción del servicio
   */
  ngOnDestroy(): void {
    console.log('💀 PoolService destruyéndose...');
    this.stopActivityMonitoring();
    
    if (this.isPoolOwner()) {
      this.releasePool().subscribe();
    }
  }
}