// frontend/src/app/services/revisor.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Revisor {
  id: number;
  nombre: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class RevisorService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  // Obtener todos los revisores de la base de datos
  getRevisores(): Observable<Revisor[]> {
    return this.http.get<Revisor[]>(`${this.apiUrl}/revisores`);
  }

  // Obtener un revisor por ID
  getRevisorById(id: number): Observable<Revisor> {
    return this.http.get<Revisor>(`${this.apiUrl}/revisores/${id}`);
  }
}