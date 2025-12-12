// frontend/src/app/components/home/home.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone:false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  constructor(private router: Router) {}

  navigateToUpload() {
    this.router.navigate(['/upload']);
  }

  navigateToReview() {
    this.router.navigate(['/review']);
  }
}