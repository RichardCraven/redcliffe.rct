import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CrmService } from '../../services/crm.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(private crmService: CrmService, private router: Router) {}

  onSubmit() {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter both username and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.crmService.login(this.username, this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.token) {
          sessionStorage.setItem('auth_token', res.token);
          sessionStorage.setItem('username', res.user.username);
          sessionStorage.setItem('user_name', res.user.name);
          this.router.navigate(['/']);
        } else {
          this.errorMessage = 'Invalid username or password.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.error || 'Authentication failed. Please try again.';
      }
    });
  }
}
