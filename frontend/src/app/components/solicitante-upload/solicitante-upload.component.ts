// solicitante-upload.component.ts
import { Component } from '@angular/core';
import { DocumentService } from '../../services/document.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-solicitante-upload',
  standalone:false,
  templateUrl: './solicitante-upload.component.html',
  styleUrls: ['./solicitante-upload.component.css'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateY(-20px)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateY(-20px)', opacity: 0 }))
      ])
    ])
  ]
})
export class SolicitanteUploadComponent {
  selectedFile: File | null = null;
  email = '';
  isUploading = false;
  attemptedSubmit = false;
  
  // Notificaciones
  showSuccessNotification = false;
  showErrorNotification = false;
  uploadedDocId: number | null = null;
  errorMessage = '';

  constructor(private docService: DocumentService) {}

  onFileChange(event: any) {
    const file = event.target.files?.[0];
    
    if (file) {
      // Validar que sea PDF
      if (file.type !== 'application/pdf') {
        this.showError('Solo se permiten archivos PDF');
        this.selectedFile = null;
        event.target.value = '';
        return;
      }

      // Validar tamaño (10MB máximo)
      const maxSize = 10 * 1024 * 1024; // 10MB en bytes
      if (file.size > maxSize) {
        this.showError('El archivo no debe superar los 10 MB');
        this.selectedFile = null;
        event.target.value = '';
        return;
      }

      this.selectedFile = file;
    }
  }

  removeFile() {
    this.selectedFile = null;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  subir() {
    this.attemptedSubmit = true;

    // Validar email
    if (!this.email || !this.isValidEmail(this.email)) {
      this.showError('Por favor ingresa un correo electrónico válido');
      return;
    }

    // Validar archivo
    if (!this.selectedFile) {
      this.showError('Por favor selecciona un archivo PDF');
      return;
    }

    // Crear FormData
    const formData = new FormData();
    formData.append('pdf', this.selectedFile);
    formData.append('email', this.email);

    // Iniciar carga
    this.isUploading = true;
    this.hideNotifications();

    // Enviar al servidor
    this.docService.uploadPDF(formData).subscribe({
      next: (res) => {
        this.isUploading = false;
        this.uploadedDocId = res.id;
        this.showSuccess();
        this.resetForm();
      },
      error: (err) => {
        this.isUploading = false;
        const message = err.error?.error || err.error?.message || 'Error al subir el documento';
        this.showError(message);
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private showSuccess() {
    this.showSuccessNotification = true;
    setTimeout(() => {
      this.showSuccessNotification = false;
    }, 8000);
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.showErrorNotification = true;
    setTimeout(() => {
      this.showErrorNotification = false;
    }, 6000);
  }

  private hideNotifications() {
    this.showSuccessNotification = false;
    this.showErrorNotification = false;
  }

  private resetForm() {
    this.selectedFile = null;
    this.email = '';
    this.attemptedSubmit = false;
  }
}