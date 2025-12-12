// document.service.ts - VERSIÓN CORREGIDA
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  // Cambia esta URL según tu backend
  private apiUrl = 'http://localhost:3000/api';
  // O si estás usando un proxy:
  // private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  // Método para obtener documentos con manejo de errores mejorado
  getDocuments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/documentos/pendientes`).pipe(
      catchError(this.handleError)
    );
  }

  // Método para subir PDF
  uploadPDF(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/documentos/upload`, formData).pipe(
      catchError(this.handleError)
    );
  }

  // Métodos para revisión
  markAttending(id: string, revisor: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/documentos/atender`, { id, revisor }).pipe(
      catchError(this.handleError)
    );
  }

  reviewDocument(id: string, estado: string, revisor: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/documentos/revisar`, { id, estado, revisor }).pipe(
      catchError(this.handleError)
    );
  }

  reviewDocumentWithReason(id: string, estado: string, revisor: string, motivo: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/documentos/revisar`, { id, estado, revisor, motivo }).pipe(
      catchError(this.handleError)
    );
  }

  // Métodos para el pool - Ahora con persistencia en el backend
  getPoolStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/pool/estado`).pipe(
      catchError(this.handleError)
    );
  }

  abrirPool(revisor: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/pool/abrir`, { revisor }).pipe(
      catchError(this.handleError)
    );
  }

  cerrarPool(revisor: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/pool/cerrar`, { revisor }).pipe(
      catchError(this.handleError)
    );
  }

  // Manejo de errores centralizado
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      // Error del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del servidor
      if (error.status === 0) {
        errorMessage = 'No se pudo conectar con el servidor. Verifica que esté corriendo en http://localhost:3000';
      } else if (error.status === 404) {
        errorMessage = 'Endpoint no encontrado. Verifica las rutas del backend';
      } else {
        errorMessage = `Error ${error.status}: ${error.error?.message || error.message}`;
      }
    }
    
    console.error('Error en DocumentService:', error);
    return throwError(() => new Error(errorMessage));
  }
}