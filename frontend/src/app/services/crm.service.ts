import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CensusImportResult, CarrierCensusFormatSpec, CensusEmployee } from '../models/census.model';
export * from '../models/census.model';

export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const crmService = inject(CrmService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only trigger session timeout if the user is currently logged in,
      // and the 401 is for a core API endpoint (exclude login, password reset, and external integrations like Outlook)
      const isExempt = req.url.includes('/api/login') ||
                       req.url.includes('/api/password/reset') ||
                       req.url.includes('/outlook');

      if (error.status === 401 && crmService.isLoggedIn() && !isExempt) {
        crmService.sessionTimeout$.next();
      }
      return throwError(() => error);
    })
  );
};

export interface CrmStatus {
  status: string;
  backend?: 'spice' | 'sqlite';
  label?: string;
  crmUrl?: string;
  authenticated: boolean;
  message?: string;
  token?: string;
  stats?: any;
}

export interface ImportResults {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}

export interface ContactBean {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  account_id?: string;
  account_name?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type IndividualBean = ContactBean;

export interface GroupBenefitsData {
  renewal_date?: string;
  carrier_tpa?: string;
  num_employees?: string | number;
}

export interface PlanAdminData {
  names: string[];
  emails: string[];
  phones: string[];
  contacts?: ContactBean[];
  individuals: ContactBean[];
}

export interface AccountBean {
  id: string;
  name: string;
  account_type?: string;
  email1?: string;
  website?: string;
  industry?: string;
  description?: string;
  shipping_address_city?: string;
  shipping_address_state?: string;
  renewal_date?: string;
  carrier_tpa?: string;
  num_employees?: string | number;
  group_benefits?: GroupBenefitsData;
  plan_admin?: PlanAdminData;
  [key: string]: any;
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

export interface ReportColumn {
  fieldid: string;
  label: string;
  fieldname?: string;
  sequence?: number;
}

export interface ReportExecutionResult {
  id: string;
  name: string;
  report_module: string;
  total: number;
  columns: ReportColumn[];
  records: Array<Record<string, string>>;
}

export interface Carrier {
  id: string;
  carrier: string;
  description: string;
  clientIdentifier: string;
  clients: string[];
  created_at?: string;
  updated_at?: string;
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

  login(username: string, password: string): Observable<{ success: boolean; token: string; user: { username: string; name: string; is_demo?: boolean } }> {
    return this.http.post<{ success: boolean; token: string; user: { username: string; name: string; is_demo?: boolean } }>(`${this.apiUrl}/login`, { username, password });
  }

  logout(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/logout`, {}, this.getHeaders());
  }

  resetPassword(identifier: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/password/reset`, {
      identifier,
      newPassword
    });
  }

  changePassword(username: string, currentPassword: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/password/change`, {
      username,
      currentPassword,
      newPassword
    }, this.getHeaders());
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

  getRecentAccounts(limit: number = 10, search?: string): Observable<{ list: AccountBean[] }> {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return this.http.get<{ list: AccountBean[] }>(`${this.apiUrl}/accounts?limit=${limit}${q}`, this.getHeaders());
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

  getReportData(id: string): Observable<ReportExecutionResult> {
    return this.http.get<ReportExecutionResult>(`${this.apiUrl}/reports/${id}/data`, this.getHeaders());
  }

  downloadReportCsv(id: string): Observable<Blob> {
    const token = sessionStorage.getItem('auth_token');
    return this.http.get(`${this.apiUrl}/reports/${id}/export/csv`, {
      headers: {
        'Authorization': `Bearer ${token || ''}`
      },
      responseType: 'blob'
    });
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

  updateAccountCustomFields(id: string, customData: Partial<GroupBenefitsData>): Observable<{ success: boolean; data: any }> {
    return this.http.patch<{ success: boolean; data: any }>(`${this.apiUrl}/accounts/${id}/custom-fields`, customData, this.getHeaders());
  }

  getContacts(accountId?: string, search?: string): Observable<{ list: ContactBean[] }> {
    let params = '';
    if (accountId && search) {
      params = `?accountId=${encodeURIComponent(accountId)}&search=${encodeURIComponent(search)}`;
    } else if (accountId) {
      params = `?accountId=${encodeURIComponent(accountId)}`;
    } else if (search) {
      params = `?search=${encodeURIComponent(search)}`;
    }
    return this.http.get<{ list: ContactBean[] }>(`${this.apiUrl}/contacts${params}`, this.getHeaders());
  }

  getContact(id: string): Observable<ContactBean> {
    return this.http.get<ContactBean>(`${this.apiUrl}/contacts/${id}`, this.getHeaders());
  }

  createContact(contactData: Partial<ContactBean>): Observable<ContactBean> {
    return this.http.post<ContactBean>(`${this.apiUrl}/contacts`, contactData, this.getHeaders());
  }

  updateContact(id: string, contactData: Partial<ContactBean>): Observable<ContactBean> {
    return this.http.patch<ContactBean>(`${this.apiUrl}/contacts/${id}`, contactData, this.getHeaders());
  }

  deleteContact(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/contacts/${id}`, this.getHeaders());
  }

  // Backward compatibility aliases
  getIndividuals(accountId?: string, search?: string): Observable<{ list: ContactBean[] }> {
    return this.getContacts(accountId, search);
  }

  getIndividual(id: string): Observable<ContactBean> {
    return this.getContact(id);
  }

  createIndividual(individualData: Partial<ContactBean>): Observable<ContactBean> {
    return this.createContact(individualData);
  }

  updateIndividual(id: string, individualData: Partial<ContactBean>): Observable<ContactBean> {
    return this.updateContact(id, individualData);
  }

  deleteIndividual(id: string): Observable<{ success: boolean }> {
    return this.deleteContact(id);
  }

  getUserPreferences(): Observable<{ success: boolean; preferences: any }> {
    return this.http.get<{ success: boolean; preferences: any }>(`${this.apiUrl}/user/preferences`, this.getHeaders());
  }

  saveUserPreferences(preferences: any): Observable<{ success: boolean; preferences: any }> {
    return this.http.post<{ success: boolean; preferences: any }>(`${this.apiUrl}/user/preferences`, { preferences }, this.getHeaders());
  }

  getBackendConfig(): Observable<{ success: boolean; mode: 'spice' | 'sqlite'; available: string[]; stats: any }> {
    return this.http.get<{ success: boolean; mode: 'spice' | 'sqlite'; available: string[]; stats: any }>(`${this.apiUrl}/backend/config`, this.getHeaders());
  }

  setBackendMode(mode: 'spice' | 'sqlite'): Observable<{ success: boolean; mode: string }> {
    return this.http.post<{ success: boolean; mode: string }>(`${this.apiUrl}/backend/config`, { mode }, this.getHeaders());
  }

  syncSpiceToSqlite(): Observable<{
    success: boolean;
    accounts: number;
    contacts?: number;
    individuals?: number;
    meetings: number;
    users: number;
    reports: number;
    carriers?: number;
    censusRecords?: number;
  }> {
    return this.http.post<any>(`${this.apiUrl}/backend/sync-spice`, {}, this.getHeaders());
  }

  getCarriers(search: string = ''): Observable<{ total: number; list: Carrier[] }> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get<{ total: number; list: Carrier[] }>(`${this.apiUrl}/carriers${q}`, this.getHeaders());
  }

  getCarrier(id: string): Observable<Carrier> {
    return this.http.get<Carrier>(`${this.apiUrl}/carriers/${id}`, this.getHeaders());
  }

  createCarrier(carrierData: Partial<Carrier>): Observable<Carrier> {
    return this.http.post<Carrier>(`${this.apiUrl}/carriers`, carrierData, this.getHeaders());
  }

  updateCarrier(id: string, carrierData: Partial<Carrier>): Observable<Carrier> {
    return this.http.put<Carrier>(`${this.apiUrl}/carriers/${id}`, carrierData, this.getHeaders());
  }

  deleteCarrier(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/carriers/${id}`, this.getHeaders());
  }

  importCensusData(files: File[], carrier: string = 'ManuLife'): Observable<CensusImportResult> {
    const formData = new FormData();
    formData.append('carrier', carrier);
    for (const file of files) {
      formData.append('files', file, file.name);
    }
    return this.http.post<CensusImportResult>(`${this.apiUrl}/census/import`, formData, this.getHeaders());
  }

  getCensusFormats(): Observable<{ list: CarrierCensusFormatSpec[] }> {
    return this.http.get<{ list: CarrierCensusFormatSpec[] }>(`${this.apiUrl}/census/carriers`, this.getHeaders());
  }

  getCensusRecords(carrier?: string, search?: string): Observable<{ total: number; list: any[] }> {
    let q = '';
    const params: string[] = [];
    if (carrier) params.push(`carrier=${encodeURIComponent(carrier)}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (params.length > 0) q = '?' + params.join('&');
    return this.http.get<{ total: number; list: any[] }>(`${this.apiUrl}/census/records${q}`, this.getHeaders());
  }

  globalSearch(query: string, limit: number = 8): Observable<{ query: string; total: number; categories: any[] }> {
    return this.http.get<{ query: string; total: number; categories: any[] }>(
      `${this.apiUrl}/global-search?q=${encodeURIComponent(query)}&limit=${limit}`,
      this.getHeaders()
    );
  }

  syncUsers(): Observable<{ success: boolean; count: number; list: any[] }> {
    return this.http.post<{ success: boolean; count: number; list: any[] }>(`${this.apiUrl}/users/sync`, {}, this.getHeaders());
  }
}


