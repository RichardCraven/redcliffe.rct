import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CrmStatus {
  status: string;
  crmUrl?: string;
  authenticated: boolean;
  message?: string;
  token?: string;
}

export interface ImportResults {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}

export interface AccountBean {
  id: string;
  name: string;
  email1?: string;
  website?: string;
  industry?: string;
  description?: string;
  shipping_address_city?: string;
  shipping_address_state?: string;
}

export interface MeetingBean {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  status: string;
  parent_id?: string;
  parent_type?: string;
  parent_name?: string;
  assigned_user_name?: string;
  assigned_user_id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  private apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : '/api';

  constructor(private http: HttpClient) {}

  private getHeaders() {
    const token = sessionStorage.getItem('auth_token');
    return {
      headers: {
        'Authorization': `Bearer ${token || ''}`
      }
    };
  }

  login(username: string, password: string): Observable<{ success: boolean; token: string; user: { username: string; name: string } }> {
    return this.http.post<{ success: boolean; token: string; user: { username: string; name: string } }>(`${this.apiUrl}/login`, { username, password });
  }

  logout(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/logout`, {}, this.getHeaders());
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem('auth_token');
  }

  getStatus(): Observable<CrmStatus> {
    return this.http.get<CrmStatus>(`${this.apiUrl}/status`, this.getHeaders());
  }

  reauth(): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(`${this.apiUrl}/reauth`, {}, this.getHeaders());
  }

  getRecentAccounts(limit: number = 10): Observable<{ list: AccountBean[] }> {
    return this.http.get<{ list: AccountBean[] }>(`${this.apiUrl}/accounts?limit=${limit}`, this.getHeaders());
  }

  getRecentMeetings(limit: number = 100): Observable<{ list: MeetingBean[] }> {
    return this.http.get<{ list: MeetingBean[] }>(`${this.apiUrl}/meetings?limit=${limit}`, this.getHeaders());
  }

  importCsv(file: File): Observable<ImportResults> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportResults>(`${this.apiUrl}/import`, formData, this.getHeaders());
  }

  deleteAccount(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/accounts/${id}`, this.getHeaders());
  }

  deleteAllAccounts(password: string): Observable<{ success: boolean; deleted: number; failed: number }> {
    return this.http.post<{ success: boolean; deleted: number; failed: number }>(`${this.apiUrl}/accounts/delete-all`, { password }, this.getHeaders());
  }
}
