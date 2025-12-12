import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { SolicitanteUploadComponent } from './components/solicitante-upload/solicitante-upload.component';
import { RevisorComponent } from './components/revisor/revisor.component';
import { AppRoutingModule } from './app-routing.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { DocumentService } from './services/document.service';
import { PoolService } from './services/pool.service';
import { RevisorService } from './services/revisor.service';
@NgModule({
  declarations: [
    AppComponent,
    SolicitanteUploadComponent,
    RevisorComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    RouterModule,
    AppRoutingModule,
    BrowserAnimationsModule
  ],
  providers: [
     DocumentService,
    PoolService,
    RevisorService 
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
