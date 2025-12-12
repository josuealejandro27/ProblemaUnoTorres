import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { DocumentService } from '../../services/document.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-revisor',
  standalone: false,
  templateUrl: './revisor.component.html',
  styleUrls: ['./revisor.component.css']
})
export class RevisorComponent implements OnInit, OnDestroy {
  documentos: any[] = [];
  revisorName = '';
  isLoading = false;
  
  // Filtros
  currentFilter: string | null = null;
  
  // Modal de rechazo
  showRejectModal = false;
  documentoARechazar: any = null;
  motivoRechazo = '';
  attemptedReject = false;
  
  // Notificaciones
  showSuccessNotification = false;
  showErrorNotification = false;
  successMessage = '';
  errorMessage = '';

  // Pool de revisión - CON SISTEMA DE BLOQUEO GLOBAL
  poolAbierto = false;
  poolOwner: string = '';
  fechaApertura: Date | null = null;
  documentosRevisados: number = 0;
  poolSubscription: Subscription | null = null;

  // Registro de actividades en tiempo real
  actividades: any[] = [];
  showActividades = false;

  // Clave para localStorage
  private readonly POOL_STORAGE_KEY = 'document_review_pool';
  private readonly POOL_TIMEOUT = 5 * 60 * 1000; // 5 minutos de timeout

  constructor(private docService: DocumentService) {}

  ngOnInit() {
    this.cargar();
    this.verificarPoolEstado();
    
    // Escuchar cambios en el pool desde otras pestañas
    window.addEventListener('storage', this.handleStorageEvent.bind(this));
  }

  ngOnDestroy() {
    // Si este usuario cerró la pestaña y era el dueño del pool, liberarlo
    if (this.poolAbierto && this.poolOwner === this.revisorName) {
      this.liberarPoolPorTimeout();
    }
    
    if (this.poolSubscription) {
      this.poolSubscription.unsubscribe();
    }
    
    window.removeEventListener('storage', this.handleStorageEvent.bind(this));
  }

  // Escuchar cuando el usuario cierra la pestaña
  @HostListener('window:beforeunload', ['$event'])
  beforeunloadHandler(event: Event) {
    if (this.poolAbierto && this.poolOwner === this.revisorName) {
      this.liberarPoolPorTimeout();
    }
  }

  /**
   * Manejar eventos de almacenamiento entre pestañas
   */
  private handleStorageEvent(event: StorageEvent) {
    if (event.key === this.POOL_STORAGE_KEY) {
      this.verificarPoolEstado();
    }
  }

  /**
   * Verificar el estado del pool desde localStorage
   */
  private verificarPoolEstado() {
    const poolData = localStorage.getItem(this.POOL_STORAGE_KEY);
    
    if (!poolData) {
      this.poolAbierto = false;
      this.poolOwner = '';
      return;
    }

    try {
      const pool = JSON.parse(poolData);
      const ahora = new Date().getTime();
      const tiempoPool = new Date(pool.fechaApertura).getTime();
      
      // Verificar si el pool ha expirado (5 minutos)
      if (ahora - tiempoPool > this.POOL_TIMEOUT) {
        localStorage.removeItem(this.POOL_STORAGE_KEY);
        this.poolAbierto = false;
        this.poolOwner = '';
        console.log('Pool expirado, liberando...');
        return;
      }
      
      this.poolAbierto = true;
      this.poolOwner = pool.revisor;
      this.fechaApertura = new Date(pool.fechaApertura);
      this.documentosRevisados = pool.documentosRevisados || 0;
      
      // Si este revisor es el dueño, actualizar contador
      if (this.revisorName === this.poolOwner) {
        this.iniciarActualizacionAutomatica();
      }
    } catch (error) {
      console.error('Error al parsear datos del pool:', error);
      localStorage.removeItem(this.POOL_STORAGE_KEY);
      this.poolAbierto = false;
      this.poolOwner = '';
    }
  }

  /**
   * Guardar estado del pool en localStorage
   */
  private guardarPoolEstado() {
    const poolData = {
      revisor: this.poolOwner,
      fechaApertura: this.fechaApertura,
      documentosRevisados: this.documentosRevisados,
      timestamp: new Date().getTime()
    };
    
    localStorage.setItem(this.POOL_STORAGE_KEY, JSON.stringify(poolData));
  }

  /**
   * Liberar pool por timeout
   */
  private liberarPoolPorTimeout() {
    console.log('Liberando pool por timeout...');
    localStorage.removeItem(this.POOL_STORAGE_KEY);
  }

  cargar(silent = false) {
    if (!silent) {
      this.isLoading = true;
    }
    
    this.docService.getDocuments().subscribe({
      next: (docs: any[]) => {
        this.documentos = docs;
        this.isLoading = false;
        
        // Actualizar actividades en tiempo real
        this.actualizarActividades();
        
        console.log('📥 Documentos cargados:', this.documentos.length);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.showError('Error al cargar documentos: ' + (err.message || 'Verifica que el backend esté corriendo'));
        console.error('Error detallado:', err);
        
        // Mostrar documentos de prueba si el backend no responde
        if (err.message?.includes('No se pudo conectar') || !this.documentos.length) {
          this.documentos = this.getDocumentosDePrueba();
          this.showError('Modo demo: usando datos de prueba. El backend no está disponible.');
        }
      }
    });
  }

  /**
   * Datos de prueba para desarrollo
   */
  private getDocumentosDePrueba(): any[] {
    return [
      {
        id: '1',
        nombreArchivo: 'documento_1.pdf',
        solicitanteEmail: 'cliente1@ejemplo.com',
        fechaSubido: new Date('2024-01-15T10:30:00'),
        estado: 'PENDIENTE',
        atendidoPor: null
      },
      {
        id: '2',
        nombreArchivo: 'documento_2.pdf',
        solicitanteEmail: 'cliente2@ejemplo.com',
        fechaSubido: new Date('2024-01-15T11:15:00'),
        estado: 'EN_REVISION',
        atendidoPor: 'RevisorA'
      },
      {
        id: '3',
        nombreArchivo: 'documento_3.pdf',
        solicitanteEmail: 'cliente3@ejemplo.com',
        fechaSubido: new Date('2024-01-14T09:45:00'),
        estado: 'ACEPTADO',
        atendidoPor: 'RevisorB'
      },
      {
        id: '4',
        nombreArchivo: 'documento_4.pdf',
        solicitanteEmail: 'cliente4@ejemplo.com',
        fechaSubido: new Date('2024-01-14T14:20:00'),
        estado: 'RECHAZADO',
        atendidoPor: 'RevisorA',
        motivoRechazo: 'Documento ilegible'
      }
    ];
  }

  /**
   * ABRIR POOL - Solo uno a la vez
   */
  abrirPool() {
    if (!this.revisorName.trim()) {
      this.showError('Por favor selecciona tu nombre de revisor');
      return;
    }

    // Verificar si ya hay un pool activo
    this.verificarPoolEstado();
    
    if (this.poolAbierto) {
      this.showError(`❌ El pool está ocupado por ${this.poolOwner}. Solo puede haber un revisor a la vez.`);
      return;
    }

    this.isLoading = true;
    
    // Simular apertura de pool (si no tienes backend)
    setTimeout(() => {
      this.poolAbierto = true;
      this.poolOwner = this.revisorName;
      this.fechaApertura = new Date();
      this.documentosRevisados = 0;
      
      // Guardar en localStorage para otras pestañas
      this.guardarPoolEstado();
      
      // Iniciar actualización automática
      this.iniciarActualizacionAutomatica();
      
      this.isLoading = false;
      this.showSuccess(`✅ ${this.revisorName} abrió el pool. Ahora eres el único revisor activo.`);
      this.agregarActividad('🎯', `${this.revisorName} tomó control del pool`, 'propia');
      
      // Recargar documentos
      this.cargar(true);
    }, 500);
  }

  /**
   * CERRAR POOL - Liberar para otros
   */
  cerrarPool() {
    if (!this.poolAbierto || this.poolOwner !== this.revisorName) {
      this.showError('No tienes permiso para cerrar este pool');
      return;
    }

    this.isLoading = true;
    
    // Simular cierre de pool
    setTimeout(() => {
      this.poolAbierto = false;
      this.poolOwner = '';
      this.fechaApertura = null;
      
      // Eliminar de localStorage
      localStorage.removeItem(this.POOL_STORAGE_KEY);
      
      // Detener actualización automática
      if (this.poolSubscription) {
        this.poolSubscription.unsubscribe();
        this.poolSubscription = null;
      }
      
      this.isLoading = false;
      this.showSuccess('🔓 Pool cerrado. Ahora otro revisor puede tomarlo.');
      this.agregarActividad('🔒', `${this.revisorName} liberó el pool`, 'propia');
      
      // Recargar documentos
      this.cargar(true);
    }, 500);
  }

  /**
   * Iniciar actualización automática
   */
  private iniciarActualizacionAutomatica() {
    // Actualizar cada 10 segundos
    this.poolSubscription = interval(10000).subscribe(() => {
      this.cargar(true);
      this.verificarPoolEstado(); // Verificar si aún somos dueños
    });
  }

  /**
   * Verificar si este revisor es el dueño del pool
   */
  get esDueñoDelPool(): boolean {
    return this.poolAbierto && this.poolOwner === this.revisorName;
  }

  /**
   * Verificar si hay pool activo de otro revisor
   */
  get poolOcupadoPorOtro(): boolean {
    return this.poolAbierto && this.poolOwner !== this.revisorName;
  }

  /**
   * Cambiar filtro
   */
  cambiarFiltro(filtro: string | null) {
    if (this.currentFilter === filtro) {
      this.currentFilter = null;
    } else {
      this.currentFilter = filtro;
    }
  }

  /**
   * Obtener documentos filtrados
   */
  get documentosFiltrados(): any[] {
    if (!this.currentFilter) {
      return this.documentos;
    }
    
    switch (this.currentFilter) {
      case 'DISPONIBLES':
        return this.documentos.filter(doc => this.isDocumentAvailable(doc));
      case 'ASIGNADOS':
        return this.documentos.filter(doc => this.isDocumentAssigned(doc));
      case 'ACEPTADO':
        return this.documentos.filter(doc => doc.estado === 'ACEPTADO');
      case 'RECHAZADO':
        return this.documentos.filter(doc => doc.estado === 'RECHAZADO');
      default:
        return this.documentos;
    }
  }

  /**
   * Documentos disponibles para revisión
   */
  isDocumentAvailable(doc: any): boolean {
    const atendidoPor = doc.atendidoPor || doc.reviewer;
    const estado = this.normalizeEstado(doc.estado);
    return !atendidoPor && (estado === 'PENDIENTE' || !estado);
  }

  /**
   * Documentos asignados (a cualquier revisor)
   */
  isDocumentAssigned(doc: any): boolean {
    const atendidoPor = doc.atendidoPor || doc.reviewer;
    const estado = this.normalizeEstado(doc.estado);
    
    const tieneRevisor = !!atendidoPor;
    const estaEnProceso = estado === 'EN_REVISION' || estado === 'PENDIENTE' || !estado;
    const noFinalizado = !this.isDocumentFinalized(doc);
    
    return tieneRevisor && estaEnProceso && noFinalizado;
  }

  /**
   * Documento finalizado
   */
  isDocumentFinalized(doc: any): boolean {
    const estado = this.normalizeEstado(doc.estado);
    return estado === 'ACEPTADO' || estado === 'RECHAZADO';
  }

  /**
   * TOMAR DOCUMENTO PARA REVISIÓN (dentro del pool)
   */
  tomarDocumento(doc: any) {
    if (!this.esDueñoDelPool) {
      this.showError('Debes ser el dueño del pool para tomar documentos');
      return;
    }

    if (!this.isDocumentAvailable(doc)) {
      this.showError('Este documento ya está siendo revisado');
      return;
    }

    this.docService.markAttending(doc.id, this.revisorName).subscribe({
      next: () => {
        this.showSuccess(`📄 Documento "${doc.nombreArchivo}" tomado para revisión`);
        this.agregarActividad('📝', `Tomó "${doc.nombreArchivo}" para revisar`, 'propia');
        this.cargar(true);
      },
      error: (err: any) => {
        this.showError('Error al tomar documento: ' + err.message);
      }
    });
  }

  /**
   * ACEPTAR DOCUMENTO (sin cerrar pool)
   */
  aceptar(doc: any) {
    if (!this.esDueñoDelPool) {
      this.showError('Debes ser el dueño del pool para aceptar documentos');
      return;
    }

    const atendidoPor = doc.atendidoPor || doc.reviewer;
    if (!atendidoPor || atendidoPor !== this.revisorName) {
      this.showError('Este documento no está asignado a ti');
      return;
    }

    if (this.isDocumentFinalized(doc)) {
      this.showError('Este documento ya fue finalizado');
      return;
    }

    this.docService.reviewDocument(doc.id, 'Aceptado', this.revisorName).subscribe({
      next: () => {
        this.documentosRevisados++;
        this.showSuccess('✅ Documento aceptado');
        this.agregarActividad('✅', `Aceptó "${doc.nombreArchivo}"`, 'propia');
        this.cargar(true);
      },
      error: (err: any) => {
        this.showError('Error al aceptar documento: ' + err.message);
      }
    });
  }

  /**
   * Abrir modal de rechazo
   */
  openRejectModal(doc: any) {
    if (!this.esDueñoDelPool) {
      this.showError('Debes ser el dueño del pool para rechazar documentos');
      return;
    }

    const atendidoPor = doc.atendidoPor || doc.reviewer;
    if (!atendidoPor || atendidoPor !== this.revisorName) {
      this.showError('Este documento no está asignado a ti');
      return;
    }

    if (this.isDocumentFinalized(doc)) {
      this.showError('Este documento ya fue finalizado');
      return;
    }

    this.documentoARechazar = doc;
    this.motivoRechazo = '';
    this.attemptedReject = false;
    this.showRejectModal = true;
  }

  /**
   * Confirmar rechazo
   */
  confirmarRechazo() {
    this.attemptedReject = true;

    if (!this.motivoRechazo.trim()) {
      return;
    }

    const doc = this.documentoARechazar;
    
    this.docService.reviewDocumentWithReason(
      doc.id, 
      'Rechazado', 
      this.revisorName,
      this.motivoRechazo
    ).subscribe({
      next: () => {
        this.documentosRevisados++;
        this.showSuccess('❌ Documento rechazado');
        this.agregarActividad('❌', `Rechazó "${doc.nombreArchivo}": ${this.motivoRechazo}`, 'propia');
        this.closeRejectModal();
        this.cargar(true);
      },
      error: (err: any) => {
        console.error('Error al rechazar:', err);
        this.showError('Error al rechazar documento: ' + err.message);
      }
    });
  }

  /**
   * Cerrar modal de rechazo
   */
  closeRejectModal() {
    this.showRejectModal = false;
    this.documentoARechazar = null;
    this.motivoRechazo = '';
    this.attemptedReject = false;
  }

  /**
   * Agregar actividad al registro
   */
  private agregarActividad(icono: string, texto: string, tipo: 'propia' | 'otro' | 'sistema') {
    const actividad = {
      icono,
      texto,
      tipo,
      fecha: new Date(),
      revisor: this.revisorName
    };
    
    this.actividades.unshift(actividad); // Agregar al inicio
    
    // Mantener solo las últimas 20 actividades
    if (this.actividades.length > 20) {
      this.actividades.pop();
    }
  }

  /**
   * Actualizar actividades automáticamente
   */
  private actualizarActividades() {
    // Agregar actividades de otros revisores basadas en cambios de documentos
    this.documentos.forEach(doc => {
      if (doc.ultimaAccion && doc.ultimaAccion.revisor !== this.revisorName) {
        const existe = this.actividades.some(a => 
          a.texto.includes(doc.nombreArchivo) && 
          (new Date().getTime() - a.fecha.getTime()) < 5000
        );
        
        if (!existe) {
          if (doc.estado === 'ACEPTADO') {
            this.agregarActividad('✅', `${doc.ultimaAccion.revisor} aceptó "${doc.nombreArchivo}"`, 'otro');
          } else if (doc.estado === 'RECHAZADO') {
            this.agregarActividad('❌', `${doc.ultimaAccion.revisor} rechazó "${doc.nombreArchivo}"`, 'otro');
          }
        }
      }
    });
  }

  /**
   * Formatear tiempo transcurrido
   */
  getTiempoTranscurrido(): string {
    if (!this.fechaApertura) return '';
    
    const ahora = new Date();
    const diff = Math.floor((ahora.getTime() - this.fechaApertura.getTime()) / 1000);
    
    if (diff < 60) return `${diff} segundos`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutos`;
    return `${Math.floor(diff / 3600)} horas`;
  }

  /**
   * Contadores
   */
  contarDisponibles(): number {
    return this.documentos.filter(doc => this.isDocumentAvailable(doc)).length;
  }

  contarAsignados(): number {
    return this.documentos.filter(doc => this.isDocumentAssigned(doc)).length;
  }

  contarPorEstado(estado: string): number {
    const normalizedEstado = this.normalizeEstado(estado);
    return this.documentos.filter(d => this.normalizeEstado(d.estado) === normalizedEstado).length;
  }

  /**
   * Normalizar estado
   */
  private normalizeEstado(estado: string): string {
    if (!estado) return '';
    
    return estado.toUpperCase()
      .replace(/Á/gi, 'A')
      .replace(/É/gi, 'E')
      .replace(/Í/gi, 'I')
      .replace(/Ó/gi, 'O')
      .replace(/Ú/gi, 'U')
      .replace(/Ñ/gi, 'N')
      .replace(/\s+/g, '_')
      .replace(/[^A-Z_]/g, '');
  }

  /**
   * Obtener clase CSS según estado
   */
  getStatusClass(estado: string): string {
    const normalized = this.normalizeEstado(estado);
    const classes: any = {
      'PENDIENTE': 'status-pending',
      'EN_REVISION': 'status-review',
      'ACEPTADO': 'status-accepted',
      'RECHAZADO': 'status-rejected'
    };
    return classes[normalized] || 'status-pending';
  }

  /**
   * Obtener texto del estado
   */
  getStatusText(estado: string): string {
    if (!estado) return 'Pendiente';
    
    if (estado === 'EN REVISIÓN' || estado === 'EN_REVISION' || estado === 'En revisión') {
      return 'En Revisión';
    }
    
    const normalized = this.normalizeEstado(estado);
    const texts: any = {
      'PENDIENTE': 'Pendiente',
      'EN_REVISION': 'En Revisión',
      'ACEPTADO': 'Aceptado',
      'RECHAZADO': 'Rechazado'
    };
    return texts[normalized] || estado;
  }

  /**
   * Formatear fecha
   */
  formatDate(date: any): string {
    if (!date) return 'Sin fecha';
    const d = new Date(date);
    return d.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Mostrar notificaciones
   */
  private showSuccess(message: string) {
    this.successMessage = message;
    this.showSuccessNotification = true;
    setTimeout(() => {
      this.showSuccessNotification = false;
    }, 4000);
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.showErrorNotification = true;
    setTimeout(() => {
      this.showErrorNotification = false;
    }, 5000);
  }

  /**
   * Descargar/Ver PDF
   */
  descargarPDF(doc: any) {
    if (!doc.id) {
      this.showError('Documento no disponible para descarga');
      return;
    }
    
    const url = `http://localhost:3000/api/documentos/descargar/${doc.id}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = doc.nombreArchivo || 'documento.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showSuccess('Descargando documento...');
  }

  verPDF(doc: any) {
    if (!doc.id) {
      this.showError('Documento no disponible para visualización');
      return;
    }
    
    const url = `http://localhost:3000/api/documentos/ver/${doc.id}`;
    window.open(url, '_blank');
    this.showSuccess('Abriendo documento...');
  }

  /**
   * Alternar visibilidad de actividades
   */
  toggleActividades() {
    this.showActividades = !this.showActividades;
  }

  /**
   * Limpiar actividades
   */
  clearActividades() {
    this.actividades = [];
  }
}