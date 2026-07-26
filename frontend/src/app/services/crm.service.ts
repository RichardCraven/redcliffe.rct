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

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  private apiUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<CrmStatus> {
    return this.http.get<CrmStatus>(`${this.apiUrl}/status`);
  }

  reauth(): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(`${this.apiUrl}/reauth`, {});
  }

  getRecentAccounts(limit: number = 10): Observable<{ list: AccountBean[] }> {
    return this.http.get<{ list: AccountBean[] }>(`${this.apiUrl}/accounts?limit=${limit}`);
  }

  importCsv(file: File): Observable<ImportResults> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportResults>(`${this.apiUrl}/import`, formData);
  }

  deleteAccount(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/accounts/${id}`);
  }

  deleteAllAccounts(password: string): Observable<{ success: boolean; deleted: number; failed: number }> {
    return this.http.post<{ success: boolean; deleted: number; failed: number }>(`${this.apiUrl}/accounts/delete-all`, { password });
  }
}
