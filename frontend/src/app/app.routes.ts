import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { CrmService } from './services/crm.service';

const authGuard: CanActivateFn = () => {
  const crmService = inject(CrmService);
  const router = inject(Router);
  if (crmService.isLoggedIn()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};

const loginGuard: CanActivateFn = () => {
  const crmService = inject(CrmService);
  const router = inject(Router);
  if (crmService.isLoggedIn()) {
    router.navigate(['/']);
    return false;
  }
  return true;
};

export const routes: Routes = [
  { path: '', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
  { path: '**', redirectTo: '' }
];
