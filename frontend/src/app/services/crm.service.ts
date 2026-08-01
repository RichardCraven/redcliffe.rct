import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const crmService = inject(CrmService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // If unauthorized (401), and not the login endpoint
      if (error.status === 401 && !req.url.includes('/api/login')) {
        crmService.sessionTimeout$.next();
      }
      return throwError(() => error);
    })
  );
};

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
  isOutlook?: boolean;
  joinUrl?: string | null;
}

export interface UserBean {
  id: string;
  user_name: string;
  first_name?: string;
  last_name?: string;
  status: string;
  is_admin: any;
  portal_only?: any;
  is_api_user?: any;
  external_auth_only?: any;
  email1?: string;
}

export interface ReportBean {
  id: string;
  name: string;
  report_module: string;
  date_modified: string;
  assigned_user_name?: string;
  assigned_user_id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  public sessionTimeout$ = new Subject<void>();
  private apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : '/api';

  getApiUrl() {
    return this.apiUrl;
  }

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

  getAccount(id: string): Observable<AccountBean> {
    return this.http.get<AccountBean>(`${this.apiUrl}/accounts/${id}`, this.getHeaders());
  }

  getRecentMeetings(limit: number = 100): Observable<{ list: MeetingBean[] }> {
    return this.http.get<{ list: MeetingBean[] }>(`${this.apiUrl}/meetings?limit=${limit}`, this.getHeaders());
  }

  getRecentUsers(limit: number = 100): Observable<{ list: UserBean[] }> {
    return this.http.get<{ list: UserBean[] }>(`${this.apiUrl}/users?limit=${limit}`, this.getHeaders());
  }

  getRecentReports(limit: number = 100): Observable<{ list: ReportBean[] }> {
    return this.http.get<{ list: ReportBean[] }>(`${this.apiUrl}/reports?limit=${limit}`, this.getHeaders());
  }

  importCsv(file: File): Observable<ImportResults> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportResults>(`${this.apiUrl}/import`, formData, this.getHeaders());
  }

  deleteAccount(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/accounts/${id}`, this.getHeaders());
  }

  deleteMeeting(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/meetings/${id}`, this.getHeaders());
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/users/${id}`, this.getHeaders());
  }

  deleteReport(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/reports/${id}`, this.getHeaders());
  }

  updateUserStatus(id: string, status: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/${id}/status`, { status }, this.getHeaders());
  }

  updateUser(id: string, updateData: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/users/${id}`, updateData, this.getHeaders());
  }

  deleteAllAccounts(password: string): Observable<{ success: boolean; deleted: number; failed: number }> {
    return this.http.post<{ success: boolean; deleted: number; failed: number }>(`${this.apiUrl}/accounts/delete-all`, { password }, this.getHeaders());
  }

  getOutlookStatus(userId: string): Observable<{ connected: boolean }> {
    return this.http.get<{ connected: boolean }>(`${this.apiUrl}/users/${userId}/outlook-status`, this.getHeaders());
  }

  saveOutlookTokens(userId: string, tokens: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/${userId}/outlook-tokens`, { tokens }, this.getHeaders());
  }

  getOutlookEvents(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/outlook/events?userId=${userId}`, this.getHeaders());
  }

  createOutlookEvent(userId: string, eventData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/outlook/events`, { userId, eventData }, this.getHeaders());
  }

  createMeeting(meetingData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/meetings`, meetingData, this.getHeaders());
  }

  getMeeting(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/meetings/${id}`, this.getHeaders());
  }

  getOutlookEvent(id: string, userId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/outlook/events/${id}?userId=${userId}`, this.getHeaders());
  }
}
