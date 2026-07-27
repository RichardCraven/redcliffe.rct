import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CrmService, AccountBean, MeetingBean, UserBean, ReportBean, ImportResults } from '../../services/crm.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  connectionStatus: 'checking' | 'connected' | 'error' = 'checking';
  crmUrl: string = '';
  errorMessage: string = '';
  crmToken: string = '';
  
  selectedFile: File | null = null;
  dragOver = false;
  
  isUploading = false;
  uploadProgress = 0;
  importResults: ImportResults | null = null;
  
  recentAccounts: AccountBean[] = [];
  isLoadingAccounts = false;

  meetingsList: MeetingBean[] = [];
  isLoadingMeetings = false;
  meetingsSearchQuery = '';

  usersList: UserBean[] = [];
  isLoadingUsers = false;
  usersSearchQuery = '';

  reportsList: ReportBean[] = [];
  isLoadingReports = false;
  reportsSearchQuery = '';

  activeView: 'accounts' | 'meetings' | 'users' | 'reports' | 'settings' = 'accounts';

  // Profile and Settings State
  currentUserProfile: UserBean | null = null;
  profileEmail = '';
  profileFirstName = '';
  profileLastName = '';
  isSavingSettings = false;

  // App Launcher & Role State
  showAppLauncher = false;
  appSearchTerm = '';
  currentRole: 'Admin' | 'Sales' = 'Admin';
  
  // Row Actions Context Menu State
  activeMenuRowId: string | null = null;
  activeMenuType: 'meeting' | 'user' | 'report' | null = null;

  // Custom Details Modal State
  showDetailsModal = false;
  detailsModalTitle = '';
  detailsModalType: 'meeting' | 'user' | 'report' | null = null;
  selectedMeeting: MeetingBean | null = null;
  selectedUser: UserBean | null = null;
  selectedReport: ReportBean | null = null;
  
  // Available Apps list
  appsList = [
    { name: 'Accounts', desc: 'Manage customer portfolios and details.', icon: 'corporate_fare', type: 'accounts' },
    { name: 'Meetings', desc: 'View scheduled company meetings.', icon: 'today', type: 'meetings' },
    { name: 'Imports', desc: 'CSV database population terminal.', icon: 'cloud_upload', type: 'imports' },
    { name: 'Reports', desc: 'Analytical summaries and metrics.', icon: 'analytics', type: 'reports' },
    { name: 'Users', desc: 'Portal user permissions and accounts.', icon: 'manage_accounts', type: 'users' },
    { name: 'Settings', desc: 'Configuration environment credentials.', icon: 'settings', type: 'settings' }
  ];

  get filteredApps() {
    if (!this.appSearchTerm) {
      return this.appsList;
    }
    const term = this.appSearchTerm.toLowerCase();
    return this.appsList.filter(app => 
      app.name.toLowerCase().includes(term) || 
      app.desc.toLowerCase().includes(term)
    );
  }

  showDevConsole = false;
  awaitingPasswordForDeleteAll = false;
  isDeletingAll = false;
  
  @ViewChild('devInput') devInputRef!: ElementRef;

  consoleHistory: Array<{ text: string; type: 'input' | 'output' | 'error' | 'success' }> = [
    { text: 'Redcliffe Developer Console v1.0.0 initialized.', type: 'success' },
    { text: 'Type "help" for a list of available commands.', type: 'output' }
  ];

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.shiftKey && event.code === 'Space') {
      event.preventDefault();
      this.toggleDevConsole();
    }
  }

  toggleDevConsole() {
    this.showDevConsole = !this.showDevConsole;
    if (this.showDevConsole) {
      setTimeout(() => {
        this.devInputRef?.nativeElement?.focus();
      }, 50);
    }
  }

  toggleAppLauncher() {
    this.showAppLauncher = !this.showAppLauncher;
    if (this.showAppLauncher) {
      this.appSearchTerm = '';
    }
  }

  setRole(role: 'Admin' | 'Sales') {
    this.currentRole = role;
    this.showAppLauncher = false;
  }

  selectApp(appName: string) {
    this.showAppLauncher = false;
    
    if (appName === 'Accounts') {
      this.activeView = 'accounts';
      this.loadRecentAccounts();
      const el = document.querySelector('.panel-accounts');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (appName === 'Meetings') {
      this.activeView = 'meetings';
      this.loadRecentMeetings();
    } else if (appName === 'Users') {
      this.activeView = 'users';
      this.loadRecentUsers();
    } else if (appName === 'Reports') {
      this.activeView = 'reports';
      this.loadRecentReports();
    } else if (appName === 'Imports') {
      if (this.currentRole === 'Sales') {
        alert('Access Denied: The Sales role does not have permission to view or execute Imports.');
      } else {
        this.activeView = 'accounts';
        setTimeout(() => {
          const el = document.querySelector('.panel-import');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    } else if (appName === 'Settings') {
      this.activeView = 'settings';
      if (this.currentUserProfile) {
        this.profileFirstName = this.currentUserProfile.first_name || '';
        this.profileLastName = this.currentUserProfile.last_name || '';
        this.profileEmail = this.currentUserProfile.email1 || '';
      } else {
        this.profileFirstName = sessionStorage.getItem('profile_first_name') || '';
        this.profileLastName = sessionStorage.getItem('profile_last_name') || '';
        this.profileEmail = sessionStorage.getItem('profile_email') || '';
      }
    } else {
      alert(`Navigating to mock application: "${appName}". This screen will be populated based on the ${this.currentRole} metadata definitions.`);
    }
  }

  handleCommand(cmdVal: string) {
    const cmd = cmdVal.trim();
    if (!cmd) return;

    if (this.awaitingPasswordForDeleteAll) {
      this.consoleHistory.push({ text: `> **********`, type: 'input' });
      this.executeDeleteAll(cmd);
    } else {
      this.consoleHistory.push({ text: `> ${cmd}`, type: 'input' });
      this.processCommand(cmd);
    }
    
    setTimeout(() => {
      this.scrollToBottom();
    }, 20);
  }

  processCommand(cmdStr: string) {
    const parts = cmdStr.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd === 'delete' && args.join(' ').toLowerCase() === 'all records') {
      this.consoleHistory.push({ text: '⚠️ WARNING: Bulk delete triggered.', type: 'error' });
      this.consoleHistory.push({ text: 'This will permanently delete all Accounts from SpiceCRM.', type: 'error' });
      this.consoleHistory.push({ text: 'To confirm, please enter the administrator password:', type: 'output' });
      this.awaitingPasswordForDeleteAll = true;
      return;
    }

    switch (cmd) {
      case 'help':
        this.consoleHistory.push({ text: 'Available commands:', type: 'output' });
        this.consoleHistory.push({ text: '  ping | status      - Check connection with CRM backend', type: 'output' });
        this.consoleHistory.push({ text: '  reauth             - Force authenticate SpiceCRM session', type: 'output' });
        this.consoleHistory.push({ text: '  refresh            - Load recent client accounts', type: 'output' });
        this.consoleHistory.push({ text: '  token              - Print current session token', type: 'output' });
        this.consoleHistory.push({ text: '  count              - Print total number of client records loaded', type: 'output' });
        this.consoleHistory.push({ text: '  delete all records - Bulk delete all Accounts (password req.)', type: 'output' });
        this.consoleHistory.push({ text: '  clear              - Clear console output history', type: 'output' });
        break;
      case 'ping':
      case 'status':
        this.consoleHistory.push({ text: 'Pinging status check...', type: 'output' });
        this.crmService.getStatus().subscribe({
          next: (status) => {
            this.crmToken = status.token || '';
            this.connectionStatus = status.status === 'connected' ? 'connected' : 'error';
            this.consoleHistory.push({ text: `Status: ${status.status} | URL: ${status.crmUrl}`, type: 'success' });
          },
          error: (err) => {
            this.consoleHistory.push({ text: `Status check failed: ${err.message}`, type: 'error' });
          }
        });
        break;
      case 'reauth':
        this.consoleHistory.push({ text: 'Requesting force re-authentication...', type: 'output' });
        this.crmService.reauth().subscribe({
          next: (res) => {
            this.consoleHistory.push({ text: 'Successfully authenticated with SpiceCRM.', type: 'success' });
            this.checkStatus();
          },
          error: (err) => {
            this.consoleHistory.push({ text: `Authentication failed: ${err.error?.error || err.message}`, type: 'error' });
          }
        });
        break;
      case 'refresh':
        this.consoleHistory.push({ text: 'Refreshing recent client list...', type: 'output' });
        this.crmService.getRecentAccounts(10).subscribe({
          next: (res) => {
            this.recentAccounts = res.list || [];
            this.consoleHistory.push({ text: `List refreshed successfully. Total records displayed: ${this.recentAccounts.length}`, type: 'success' });
          },
          error: (err) => {
            this.consoleHistory.push({ text: `Refresh failed: ${err.message}`, type: 'error' });
          }
        });
        break;
      case 'token':
        this.consoleHistory.push({ text: this.crmToken ? `Session Token: ${this.crmToken}` : 'No active session token.', type: 'output' });
        break;
      case 'count':
        this.consoleHistory.push({ text: `Total clients displayed in view: ${this.recentAccounts.length}`, type: 'output' });
        break;
      case 'delete':
        this.consoleHistory.push({ text: 'Did you mean "delete all records"?', type: 'error' });
        break;
      case 'clear':
        this.consoleHistory = [];
        break;
      default:
        this.consoleHistory.push({ text: `Unknown command "${cmd}". Type "help" for list.`, type: 'error' });
        break;
    }
  }

  scrollToBottom() {
    const el = document.querySelector('.dev-cli-output');
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  constructor(private crmService: CrmService, private router: Router) {}

  ngOnInit() {
    this.checkStatus();
    this.loadRecentAccounts();
    this.loadUserProfile();
  }

  logout() {
    this.crmService.logout().subscribe({
      next: () => {
        sessionStorage.clear();
        this.router.navigate(['/login']);
      },
      error: () => {
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

  checkStatus() {
    this.connectionStatus = 'checking';
    this.crmService.getStatus().subscribe({
      next: (status) => {
        if (status.status === 'connected') {
          this.connectionStatus = 'connected';
          this.crmUrl = status.crmUrl || '';
          this.crmToken = status.token || '';
        } else {
          this.connectionStatus = 'error';
          this.crmToken = '';
          this.errorMessage = status.message || 'Unknown integration error';
        }
      },
      error: (err) => {
        this.connectionStatus = 'error';
        this.errorMessage = 'Could not connect to proxy backend (make sure backend is running on port 3001)';
      }
    });
  }

  loadRecentAccounts() {
    this.isLoadingAccounts = true;
    this.crmService.getRecentAccounts(10).subscribe({
      next: (res) => {
        // Handle list property returned by SpiceCRM API
        this.recentAccounts = res.list || [];
        this.isLoadingAccounts = false;
      },
      error: () => {
        this.isLoadingAccounts = false;
      }
    });
  }

  loadRecentMeetings() {
    this.isLoadingMeetings = true;
    this.crmService.getRecentMeetings(100).subscribe({
      next: (res) => {
        this.meetingsList = res.list || [];
        this.isLoadingMeetings = false;
      },
      error: () => {
        this.isLoadingMeetings = false;
      }
    });
  }

  get filteredMeetings() {
    if (!this.meetingsSearchQuery) {
      return this.meetingsList;
    }
    const query = this.meetingsSearchQuery.toLowerCase();
    return this.meetingsList.filter(m => 
      (m.name && m.name.toLowerCase().includes(query)) ||
      (m.status && m.status.toLowerCase().includes(query)) ||
      (m.assigned_user_name && m.assigned_user_name.toLowerCase().includes(query))
    );
  }

  formatMeetingTime(startStr: string, endStr: string): string {
    if (!startStr) return '—';
    try {
      const parseDate = (str: string) => {
        const parts = str.split(/[- :]/);
        if (parts.length < 5) return new Date(str);
        return new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
          parseInt(parts[3]),
          parseInt(parts[4]),
          parts[5] ? parseInt(parts[5]) : 0
        );
      };

      const startDate = parseDate(startStr);
      const endDate = endStr ? parseDate(endStr) : null;
      const pad = (num: number) => num.toString().padStart(2, '0');
      
      const formatTime = (d: Date) => {
        let hours = d.getHours();
        const minutes = pad(d.getMinutes());
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${pad(hours)}:${minutes}${ampm}`;
      };

      const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        return `${year}-${month}-${day}`;
      };

      const datePart = formatDate(startDate);
      const startTimePart = formatTime(startDate);
      
      if (endDate) {
        const endTimePart = formatTime(endDate);
        return `${datePart} ${startTimePart} - ${endTimePart}`;
      }
      return `${datePart} ${startTimePart}`;
    } catch (e) {
      return `${startStr} - ${endStr}`;
    }
  }

  loadRecentUsers() {
    this.isLoadingUsers = true;
    this.crmService.getRecentUsers(100).subscribe({
      next: (res) => {
        this.usersList = res.list || [];
        this.isLoadingUsers = false;
      },
      error: () => {
        this.isLoadingUsers = false;
      }
    });
  }

  get filteredUsers() {
    if (!this.usersSearchQuery) {
      return this.usersList;
    }
    const query = this.usersSearchQuery.toLowerCase();
    return this.usersList.filter(u => 
      (u.user_name && u.user_name.toLowerCase().includes(query)) ||
      (u.status && u.status.toLowerCase().includes(query)) ||
      ((u.first_name || u.last_name) && `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(query))
    );
  }

  checkBool(val: any): boolean {
    return val === true || val === 1 || val === '1' || val === 'true' || val === 'yes' || val === 'Checked' || val === 'checked';
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.activeMenuRowId = null;
    this.activeMenuType = null;
  }

  toggleRowMenu(id: string, type: 'meeting' | 'user' | 'report', event: Event) {
    event.stopPropagation();
    if (this.activeMenuRowId === id && this.activeMenuType === type) {
      this.activeMenuRowId = null;
      this.activeMenuType = null;
    } else {
      this.activeMenuRowId = id;
      this.activeMenuType = type;
    }
  }

  viewMeetingDetails(meeting: MeetingBean) {
    this.selectedMeeting = meeting;
    this.detailsModalTitle = 'Meeting Details';
    this.detailsModalType = 'meeting';
    this.showDetailsModal = true;
  }

  viewReportDetails(report: ReportBean) {
    this.selectedReport = report;
    this.detailsModalTitle = 'Report Details';
    this.detailsModalType = 'report';
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.detailsModalType = null;
    this.selectedMeeting = null;
    this.selectedUser = null;
    this.selectedReport = null;
  }

  deleteMeeting(meeting: MeetingBean) {
    if (confirm(`Are you sure you want to delete the meeting "${meeting.name}"?`)) {
      this.crmService.deleteMeeting(meeting.id).subscribe({
        next: () => {
          this.meetingsList = this.meetingsList.filter(m => m.id !== meeting.id);
        },
        error: (err) => {
          alert('Failed to delete meeting: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  viewUserDetails(user: UserBean) {
    this.selectedUser = user;
    this.detailsModalTitle = 'User Profile Details';
    this.detailsModalType = 'user';
    this.showDetailsModal = true;
  }

  deactivateUser(user: UserBean) {
    const newStatus = (user.status === 'Active' || user.status === 'active') ? 'Inactive' : 'Active';
    this.crmService.updateUserStatus(user.id, newStatus).subscribe({
      next: () => {
        user.status = newStatus;
      },
      error: (err) => {
        alert('Failed to update status: ' + (err.error?.error || err.message));
      }
    });
  }

  deleteUser(user: UserBean) {
    if (confirm(`Are you sure you want to delete user "${user.user_name}"?`)) {
      this.crmService.deleteUser(user.id).subscribe({
        next: () => {
          this.usersList = this.usersList.filter(u => u.id !== user.id);
        },
        error: (err) => {
          alert('Failed to delete user: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  loadRecentReports() {
    this.isLoadingReports = true;
    this.crmService.getRecentReports(100).subscribe({
      next: (res) => {
        this.reportsList = res.list || [];
        this.isLoadingReports = false;
      },
      error: () => {
        this.isLoadingReports = false;
      }
    });
  }

  get filteredReports() {
    if (!this.reportsSearchQuery) {
      return this.reportsList;
    }
    const query = this.reportsSearchQuery.toLowerCase();
    return this.reportsList.filter(r => 
      (r.name && r.name.toLowerCase().includes(query)) ||
      (r.report_module && r.report_module.toLowerCase().includes(query))
    );
  }

  deleteReport(report: ReportBean) {
    if (confirm(`Are you sure you want to delete report "${report.name}"?`)) {
      this.crmService.deleteReport(report.id).subscribe({
        next: () => {
          this.reportsList = this.reportsList.filter(r => r.id !== report.id);
        },
        error: (err) => {
          alert('Failed to delete report: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  loadUserProfile() {
    const currentUsername = sessionStorage.getItem('username') || '';
    if (!currentUsername) return;

    this.crmService.getRecentUsers(100).subscribe({
      next: (res) => {
        const found = (res.list || []).find(u => u.user_name.toLowerCase() === currentUsername.toLowerCase());
        if (found) {
          this.currentUserProfile = found;
          sessionStorage.setItem('profile_first_name', found.first_name || '');
          sessionStorage.setItem('profile_last_name', found.last_name || '');
          sessionStorage.setItem('profile_email', found.email1 || '');
        }
      }
    });
  }

  getUserInitials(): string {
    if (this.currentUserProfile) {
      const f = this.currentUserProfile.first_name || '';
      const l = this.currentUserProfile.last_name || '';
      if (f || l) {
        return ((f ? f[0] : '') + (l ? l[0] : '')).toUpperCase();
      }
    }
    const displayName = sessionStorage.getItem('user_name') || '';
    if (displayName) {
      const parts = displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0].length >= 1) {
        return parts[0][0].toUpperCase();
      }
    }
    return '';
  }

  saveSettings() {
    if (!this.currentUserProfile) {
      alert('Error: User profile not loaded yet.');
      return;
    }
    this.isSavingSettings = true;
    const updatedData = {
      first_name: this.profileFirstName,
      last_name: this.profileLastName,
      email1: this.profileEmail
    };

    this.crmService.updateUser(this.currentUserProfile.id, updatedData).subscribe({
      next: () => {
        this.isSavingSettings = false;
        // Update local object
        this.currentUserProfile!.first_name = this.profileFirstName;
        this.currentUserProfile!.last_name = this.profileLastName;
        this.currentUserProfile!.email1 = this.profileEmail;

        // Persist to session storage
        sessionStorage.setItem('profile_first_name', this.profileFirstName);
        sessionStorage.setItem('profile_last_name', this.profileLastName);
        sessionStorage.setItem('profile_email', this.profileEmail);
        sessionStorage.setItem('user_name', `${this.profileFirstName} ${this.profileLastName}`);

        alert('Settings saved successfully!');
      },
      error: (err) => {
        this.isSavingSettings = false;
        alert('Failed to save settings: ' + (err.error?.error || err.message));
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        this.selectedFile = file;
      } else {
        alert('Please drop a valid CSV file.');
      }
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  triggerReauth() {
    this.crmService.reauth().subscribe({
      next: () => {
        this.checkStatus();
      },
      error: (err) => {
        alert('Re-authentication failed: ' + (err.error?.error || err.message));
      }
    });
  }

  startImport() {
    if (!this.selectedFile) return;

    this.isUploading = true;
    this.uploadProgress = 10;
    this.importResults = null;

    // Simulate progress while waiting for backend response
    const interval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
      }
    }, 400);

    this.crmService.importCsv(this.selectedFile).subscribe({
      next: (results) => {
        clearInterval(interval);
        this.uploadProgress = 100;
        this.importResults = results;
        this.isUploading = false;
        this.selectedFile = null;
        // Refresh list
        this.loadRecentAccounts();
      },
      error: (err) => {
        clearInterval(interval);
        this.isUploading = false;
        alert('Import failed: ' + (err.error?.error || err.message));
      }
    });
  }

  showDeleteModal = false;
  accountIdToDelete: string | null = null;
  accountNameToDelete: string = '';

  confirmDelete(id: string, name: string) {
    this.accountIdToDelete = id;
    this.accountNameToDelete = name;
    this.showDeleteModal = true;
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.accountIdToDelete = null;
    this.accountNameToDelete = '';
  }

  executeDelete() {
    if (!this.accountIdToDelete) return;
    const id = this.accountIdToDelete;
    
    this.crmService.deleteAccount(id).subscribe({
      next: () => {
        this.recentAccounts = this.recentAccounts.filter(acc => acc.id !== id);
        this.cancelDelete();
      },
      error: (err) => {
        alert('Delete failed: ' + (err.error?.error || err.message));
        this.cancelDelete();
      }
    });
  }

  executeDeleteAll(password: string) {
    this.isDeletingAll = true;
    this.consoleHistory.push({ text: 'Verifying password and executing bulk deletion...', type: 'output' });
    this.awaitingPasswordForDeleteAll = false;
    
    this.crmService.deleteAllAccounts(password).subscribe({
      next: (res) => {
        this.isDeletingAll = false;
        this.consoleHistory.push({ text: `Bulk delete completed. Successfully deleted: ${res.deleted} records. Failed: ${res.failed} records.`, type: 'success' });
        this.loadRecentAccounts();
        
        setTimeout(() => {
          this.scrollToBottom();
        }, 20);
      },
      error: (err) => {
        this.isDeletingAll = false;
        this.consoleHistory.push({ text: `Bulk delete failed: ${err.error?.error || err.message}`, type: 'error' });
        
        setTimeout(() => {
          this.scrollToBottom();
        }, 20);
      }
    });
  }
}
