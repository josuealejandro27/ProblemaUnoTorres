// revisor.component.ts - VERSIÓN CORREGIDA CON SINGLETON
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { DocumentService } from '../../services/document.service';
import { PoolService } from '../../services/pool.service';
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

  // Pool de revisión
  poolAbierto = false;
  poolOwner: string = '';
  fechaApertura: Date | null = null;
  documentosRevisados: number = 0;
  poolSubscription: Subscription | null = null;
  
  // ✅ Control de sesión - SIMPLIFICADO
  isOriginalOwner = false; // Esta pestaña abrió el pool
  
  // Registro de actividades
  actividades: any[] = [];
  showActividades = false;

  constructor(
    private docService: DocumentService,
    private poolService: PoolService
  ) {
    // ✅ Ya no necesitamos generar userId aquí
    // El servicio Singleton lo maneja internamente
  }

  ngOnInit() {
    this.cargar();
    this.verificarPoolEstado();
    
    // Verificar pool cada 5 segundos
    this.poolSubscription = interval(5000).subscribe(() => {
      this.verificarPoolEstado();
    });
  }

  ngOnDestroy() {
    if (this.poolSubscription) {
      this.poolSubscription.unsubscribe();
    }
    
    // ✅ El servicio maneja la liberación automáticamente
    // Solo necesitamos llamarlo si somos dueños
    if (this.isOriginalOwner && this.poolAbierto) {
      this.poolService.releasePool().subscribe();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeunloadHandler(event: Event) {
    // ✅ El servicio tiene su propio handler de beforeunload
    // Este es redundante pero mantiene compatibilidad
    if (this.isOriginalOwner && this.poolAbierto) {
      // La liberación real la hace el servicio via sendBeacon
      this.poolService.releasePool().subscribe();
    }
  }

  /**
   * ✅ VERIFICAR POOL - SIMPLIFICADO
   */
  private verificarPoolEstado() {
    this.poolService.checkStatus().subscribe({
      next: (status) => {
        this.poolAbierto = !status.isAvailable;
        this.poolOwner = status.currentUser || '';
        
        // ✅ El servicio determina si somos dueños
        this.isOriginalOwner = status.isOwner || false;
        
        if (this.poolAbierto && status.expiresAt) {
          this.fechaApertura = new Date(status.expiresAt);
        } else {
          this.fechaApertura = null;
        }
      },
      error: (err) => {
        console.error('Error al verificar pool:', err);
        this.showError('Error al verificar estado del pool');
      }
    });
  }

  /**
   * ✅ ABRIR POOL - SIMPLIFICADO
   */
  abrirPool() {
    if (!this.revisorName.trim()) {
      this.showError('Por favor selecciona tu nombre de revisor');
      return;
    }

    this.isLoading = true;
    
    // ✅ Configurar datos del usuario en el servicio
    this.poolService.setUserData(this.revisorName, `${this.revisorName}@example.com`);
    
    this.poolService.acquirePool().subscribe({
      next: (response) => {
        this.isLoading = false;
        
        if (response.success) {
          this.poolAbierto = true;
          this.poolOwner = this.revisorName;
          this.fechaApertura = new Date();
          this.documentosRevisados = 0;
          
          // ✅ El servicio marca automáticamente el ownership
          this.isOriginalOwner = true;
          
          this.showSuccess(`✅ ${this.revisorName} abrió el pool. Ahora eres el único revisor activo.`);
          this.agregarActividad('🎯', `${this.revisorName} tomó control del pool`, 'propia');
          
          // Iniciar monitoreo de actividad
          this.poolService.startActivityMonitoring();
          
          this.cargar(true);
        } else {
          this.showError(response.message || 'No se pudo abrir el pool');
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showError(`Error: ${err.message || 'Error desconocido'}`);
      }
    });
  }

  /**
   * ✅ CERRAR POOL - SIMPLIFICADO
   */
  cerrarPool() {
    // ✅ Validaciones básicas
    if (!this.poolAbierto) {
      this.showError('No hay pool abierto para cerrar');
      return;
    }

    if (!this.isOriginalOwner) {
      this.showError('Solo puedes cerrar el pool desde la pestaña donde lo abriste');
      return;
    }

    this.isLoading = true;
    
    // ✅ El servicio verifica internamente si podemos liberar
    this.poolService.releasePool().subscribe({
      next: (response) => {
        this.isLoading = false;
        
        if (response.success) {
          this.poolAbierto = false;
          this.poolOwner = '';
          this.fechaApertura = null;
          this.isOriginalOwner = false;
          
          this.poolService.stopActivityMonitoring();
          
          this.showSuccess('🔓 Pool cerrado. Ahora otro revisor puede tomarlo.');
          this.agregarActividad('🔒', `${this.revisorName} liberó el pool`, 'propia');
          
          this.cargar(true);
        } else {
          this.showError(response.message || 'Error al cerrar pool');
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.showError(`Error al cerrar pool: ${err.message || 'Error desconocido'}`);
      }
    });
  }

  /**
   * Tomar documento para revisión
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
   * Cargar lista de documentos
   */
  cargar(silent = false) {
    if (!silent) {
      this.isLoading = true;
    }
    
    this.docService.getDocuments().subscribe({
      next: (docs: any[]) => {
        this.documentos = docs;
        this.isLoading = false;
        console.log('📥 Documentos cargados:', this.documentos.length);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.showError('Error al cargar documentos: ' + (err.message || 'Verifica el backend'));
        console.error('Error detallado:', err);
      }
    });
  }

  /**
   * ✅ Getters de estado del pool
   */
  get esDueñoDelPool(): boolean {
    return this.poolAbierto && this.poolOwner === this.revisorName && this.isOriginalOwner;
  }

  get poolOcupadoPorOtro(): boolean {
    return this.poolAbierto && this.poolOwner !== this.revisorName;
  }

  get puedeControlarPool(): boolean {
    return this.esDueñoDelPool;
  }

  /**
   * Cambiar filtro de documentos
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
        return this.documentos.filter(doc => this.normalizeEstado(doc.estado) === 'ACEPTADO');
      case 'RECHAZADO':
        return this.documentos.filter(doc => this.normalizeEstado(doc.estado) === 'RECHAZADO');
      default:
        return this.documentos;
    }
  }

  /**
   * Verificar si documento está disponible
   */
  isDocumentAvailable(doc: any): boolean {
    const atendidoPor = doc.atendidoPor || doc.reviewer;
    const estado = this.normalizeEstado(doc.estado);
    return !atendidoPor && (estado === 'PENDIENTE' || !estado);
  }

  /**
   * Verificar si documento está asignado
   */
  isDocumentAssigned(doc: any): boolean {
    const atendidoPor = doc.atendidoPor || doc.reviewer;
    const estado = this.normalizeEstado(doc.estado);
    return !!atendidoPor && estado === 'EN_REVISION' && !this.isDocumentFinalized(doc);
  }

  /**
   * Verificar si documento está finalizado
   */
  isDocumentFinalized(doc: any): boolean {
    const estado = this.normalizeEstado(doc.estado);
    return estado === 'ACEPTADO' || estado === 'RECHAZADO';
  }

  /**
   * Aceptar documento
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
   * Confirmar rechazo de documento
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
    
    this.actividades.unshift(actividad);
    
    if (this.actividades.length > 20) {
      this.actividades.pop();
    }
  }

  /**
   * Obtener tiempo transcurrido desde apertura del pool
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
   * Contadores de documentos por estado
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
   * Normalizar estado del documento
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
   * Obtener texto legible del estado
   */
  getStatusText(estado: string): string {
    if (!estado) return 'Pendiente';
    
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
   * Mostrar notificación de éxito
   */
  private showSuccess(message: string) {
    this.successMessage = message;
    this.showSuccessNotification = true;
    setTimeout(() => {
      this.showSuccessNotification = false;
    }, 4000);
  }

  /**
   * Mostrar notificación de error
   */
  private showError(message: string) {
    this.errorMessage = message;
    this.showErrorNotification = true;
    setTimeout(() => {
      this.showErrorNotification = false;
    }, 5000);
  }

  /**
   * Descargar PDF
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

  /**
   * Ver PDF en nueva pestaña
   */
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
   * Toggle panel de actividades
   */
  toggleActividades() {
    this.showActividades = !this.showActividades;
  }

  /**
   * Limpiar registro de actividades
   */
  clearActividades() {
    this.actividades = [];
  }
}