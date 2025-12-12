// frontend/src/app/services/pool.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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
  providedIn: 'root'
})
export class PoolService {
  private apiUrl = 'http://localhost:3000/api/revision-pool';
  
  private userName: string = '';
  private userId: string;
  private userEmail: string = '';
  private activityInterval: any;

  constructor(private http: HttpClient) {
    // Generar ID único para esta sesión/pestaña
    this.userId = this.generateUserId();
    
    // Cargar datos de localStorage si existen
    const savedName = localStorage.getItem('revisorName');
    const savedEmail = localStorage.getItem('revisorEmail');
    
    if (savedName) {
      this.userName = savedName;
    }
    
    if (savedEmail) {
      this.userEmail = savedEmail;
    }
    
    console.log('📦 Pool Service inicializado para usuario:', this.userName || 'No autenticado');
  }

  private generateUserId(): string {
    // Usar timestamp + random para unicidad
    return `revisor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setUserData(name: string, email: string): void {
    this.userName = name;
    this.userEmail = email;
    
    localStorage.setItem('revisorName', name);
    localStorage.setItem('revisorEmail', email);
    localStorage.setItem('poolUserId', this.userId);
  }

  getUserId(): string {
    return this.userId;
  }

  getUserName(): string {
    return this.userName;
  }

  getUserEmail(): string {
    return this.userEmail;
  }

  hasUser(): boolean {
    return !!this.userName;
  }

  checkStatus(): Observable<PoolStatus> {
  console.log('🔍 checkStatus llamado con userId:', this.userId, 'userName:', this.userName);
  return this.http.get<PoolStatus>(`${this.apiUrl}/status`, {
    params: { userId: this.userId }
  }).pipe(
    catchError(error => {
      console.error('❌ Error en checkStatus:', error);
      console.error('URL intentada:', `${this.apiUrl}/status?userId=${this.userId}`);
      return of({
        isAvailable: false,
        message: `Error al verificar estado del pool: ${error.status || 'Sin conexión'}`
      });
    })
  );
}

  getSimpleStatus(): Observable<SimplePoolStatus> {
  console.log('🔍 getSimpleStatus llamado');
  return this.http.get<SimplePoolStatus>(`${this.apiUrl}/simple-status`).pipe(
    catchError(error => {
      console.error('❌ Error en getSimpleStatus:', error);
      console.error('URL intentada:', `${this.apiUrl}/simple-status`);
      return of({
        status: 'error' as 'error',
        message: `Error de conexión: ${error.status || 'Servidor no responde'}`
      });
    })
  );
}


  acquirePool(): Observable<AcquireResponse> {
    if (!this.userName) {
      throw new Error('Nombre de revisor requerido. Por favor selecciona un revisor primero.');
    }

    return this.http.post<AcquireResponse>(`${this.apiUrl}/acquire`, {
      userId: this.userId,
      userName: this.userName,
      userEmail: this.userEmail,
      userType: 'revisor'
    }).pipe(
      catchError(error => {
        console.error('Error en acquirePool:', error);
        return of({
          success: false,
          message: 'Error de conexión al servidor'
        });
      })
    );
  }

  releasePool(): Observable<any> {
    this.stopActivityMonitoring();
    
    return this.http.post(`${this.apiUrl}/release`, {
      userId: this.userId
    }).pipe(
      catchError(error => {
        console.error('Error en releasePool:', error);
        return of({ success: false, message: 'Error al liberar pool' });
      })
    );
  }

  registerActivity(): Observable<any> {
    return this.http.post(`${this.apiUrl}/activity`, {
      userId: this.userId
    }).pipe(
      catchError(error => {
        console.error('Error en registerActivity:', error);
        return of({ success: false, message: 'Error al registrar actividad' });
      })
    );
  }

  startActivityMonitoring(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }
    
    this.activityInterval = setInterval(() => {
      if (this.userName) {
        this.registerActivity().subscribe({
          next: (response) => {
            if (response && response.success) {
              console.log('✅ Actividad registrada, sesión extendida');
            }
          },
          error: (err) => {
            console.error('Error al registrar actividad:', err);
          }
        });
      }
    }, 120000); // 2 minutos
  }

  stopActivityMonitoring(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
  }

  clearSession(): void {
    this.userName = '';
    this.userEmail = '';
    localStorage.removeItem('revisorName');
    localStorage.removeItem('revisorEmail');
    localStorage.removeItem('poolUserId');
    this.stopActivityMonitoring();
  }
}