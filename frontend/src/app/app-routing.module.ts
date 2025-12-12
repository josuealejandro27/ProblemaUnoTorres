// app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SolicitanteUploadComponent } from './components/solicitante-upload/solicitante-upload.component';
import { RevisorComponent } from './components/revisor/revisor.component';
import { HomeComponent } from './components/home/home.component';

const routes: Routes = [
  { path: '', component: HomeComponent }, 
  { path: 'upload', component: SolicitanteUploadComponent },
  { path: 'review', component: RevisorComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }