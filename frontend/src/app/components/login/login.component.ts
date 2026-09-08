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
  successMessage = '';
  isLoading = false;

  // Password reset state
  isResetMode = false;
  resetIdentifier = '';
  newPassword = '';
  confirmPassword = '';
  isResetting = false;

  constructor(private crmService: CrmService, private router: Router) {}

  toggleResetMode(enable: boolean) {
    this.isResetMode = enable;
    this.errorMessage = '';
    this.successMessage = '';
    this.newPassword = '';
    this.confirmPassword = '';
    if (enable && this.username) {
      this.resetIdentifier = this.username;
    }
  }

  onSubmit() {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter both username and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

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

  onResetSubmit() {
    if (!this.resetIdentifier.trim()) {
      this.errorMessage = 'Please enter your username or email address.';
      return;
    }

    if (!this.newPassword) {
      this.errorMessage = 'Please enter a new password.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'New password must be at least 6 characters long.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match. Please verify and try again.';
      return;
    }

    this.isResetting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.crmService.resetPassword(this.resetIdentifier.trim(), this.newPassword).subscribe({
      next: (res) => {
        this.isResetting = false;
        this.successMessage = res.message || 'Password reset successfully! You can now sign in.';
        this.username = this.resetIdentifier.trim();
        this.password = '';
        this.newPassword = '';
        this.confirmPassword = '';

        // Automatically switch back to login mode after 2.2 seconds
        setTimeout(() => {
          this.isResetMode = false;
          this.successMessage = 'Password updated! Please sign in with your new password.';
        }, 2200);
      },
      error: (err) => {
        this.isResetting = false;
        this.errorMessage = err.error?.error || 'Failed to reset password. Please try again.';
      }
    });
  }
}
