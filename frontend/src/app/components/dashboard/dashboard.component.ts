import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
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
  accountsSearchQuery = '';
  openAccountTabs: Array<any> = [];
  activeAccountTabId: string | null = null;

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
  isDarkMode = true;
  isOutlookConnected = false;
  showAssignedColumn = false;
  showReportAssignedColumn = false;
  isImportPanelCollapsed = true;

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

  showSuccessModal = false;
  successModalTitle = '';
  successModalBody = '';
  successModalTabId: string | null = null;
  successModalType: 'success' | 'warning' | 'error' = 'success';
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
    } else {
      this.updateTabRoute(null);
      this.activeAccountTabId = null;

      if (appName === 'Meetings') {
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
          this.loadOutlookStatus();
        } else {
          this.profileFirstName = sessionStorage.getItem('profile_first_name') || '';
          this.profileLastName = sessionStorage.getItem('profile_last_name') || '';
          this.profileEmail = sessionStorage.getItem('profile_email') || '';
        }
      } else {
        alert(`Navigating to mock application: "${appName}". This screen will be populated based on the ${this.currentRole} metadata definitions.`);
      }
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

  constructor(
    private crmService: CrmService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.isDarkMode = localStorage.getItem('theme') !== 'light';
    this.applyTheme();
    this.checkStatus();
    this.loadRecentAccounts();
    this.loadUserProfile();

    // Listen for session invalidation/timeouts
    this.crmService.sessionTimeout$.subscribe(() => {
      this.showSessionTimeoutModal = true;
    });

    // Handle query params for tabs
    this.route.queryParams.subscribe(params => {
      const activeTabId = params['tab'];
      if (activeTabId) {
        if (activeTabId.startsWith('account_')) {
          const accountId = activeTabId.replace('account_', '');
          this.openAccountTabById(accountId);
        } else if (activeTabId.startsWith('meeting_')) {
          const meetingId = activeTabId.replace('meeting_', '');
          this.openMeetingTabById(meetingId);
        } else {
          this.activeAccountTabId = null;
        }
      } else {
        this.activeAccountTabId = null;
      }
    });
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
        // Collapse by default if accounts exist, expand if empty
        this.isImportPanelCollapsed = this.recentAccounts.length > 0;
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
        const crmMeetings = res.list || [];
        
        if (this.isOutlookConnected && this.currentUserProfile) {
          this.crmService.getOutlookEvents(this.currentUserProfile.id).subscribe({
            next: (outlookEvents: any[]) => {
              const mappedOutlookMeetings = outlookEvents.map((evt: any) => {
                const startStr = evt.start?.dateTime ? this.formatIsoToCrmDate(evt.start.dateTime) : '';
                const endStr = evt.end?.dateTime ? this.formatIsoToCrmDate(evt.end.dateTime) : '';
                
                return {
                  id: evt.id,
                  name: evt.subject || 'No Subject',
                  date_start: startStr,
                  date_end: endStr,
                  status: 'Planned',
                  parent_name: evt.location?.displayName || 'Outlook Calendar',
                  parent_type: 'Outlook',
                  assigned_user_name: evt.organizer?.emailAddress?.name || 'Outlook User',
                  isOutlook: true,
                  joinUrl: evt.onlineMeeting?.joinUrl || evt.onlineMeetingUrl || evt.webLink || null
                };
              });

              // Merge lists and sort descending (newest start dates first)
              const sorted = [...crmMeetings, ...mappedOutlookMeetings].sort((a, b) => {
                const dateA = new Date(a.date_start.replace(' ', 'T')).getTime() || 0;
                const dateB = new Date(b.date_start.replace(' ', 'T')).getTime() || 0;
                return dateB - dateA;
              });
              this.meetingsList = this.processMeetingsList(sorted);
              this.isLoadingMeetings = false;
            },
            error: (err) => {
              console.error('Failed to load Outlook events:', err);
              this.meetingsList = this.processMeetingsList(crmMeetings);
              this.isLoadingMeetings = false;
            }
          });
        } else {
          this.meetingsList = this.processMeetingsList(crmMeetings);
          this.isLoadingMeetings = false;
        }
      },
      error: () => {
        this.isLoadingMeetings = false;
      }
    });
  }

  processMeetingsList(meetings: any[]): any[] {
    const now = new Date();
    return meetings.map(meeting => {
      const dateStr = meeting.date_end || meeting.date_start;
      if (dateStr) {
        try {
          const cleanDateStr = dateStr.replace(' ', 'T');
          const meetingDate = new Date(cleanDateStr);
          if (meetingDate < now && (meeting.status === 'Planned' || meeting.status === 'planned')) {
            meeting.status = 'Held';
          }
        } catch (e) {
          // Ignored
        }
      }
      return meeting;
    });
  }

  formatIsoToCrmDate(isoStr: string): string {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return '';
    }
  }

  getAccountCrmUrl(accountId: string): string {
    if (!this.crmUrl) return '#';
    // Strip trailing '/api' or '/api/'
    let baseUrl = this.crmUrl.replace(/\/api\/?$/, '');
    
    // In sandbox, the API domain is rspice-int.pfcd.ca but the UI is redcliffeapp-int.pfcd.ca
    if (baseUrl.includes('rspice-int.pfcd.ca')) {
      baseUrl = baseUrl.replace('rspice-int.pfcd.ca', 'redcliffeapp-int.pfcd.ca');
    }
    
    return `${baseUrl}/#/module/Accounts/${accountId}`;
  }

  openAccountTab(acc: any) {
    const tabId = `account_${acc.id}`;
    const existing = this.openAccountTabs.find(t => t.id === tabId);
    if (!existing) {
      this.openAccountTabs.push({
        id: tabId,
        name: acc.name,
        account: acc,
        activeSubTab: 'details',
        activeActivityType: 'call',
        meetingForm: this.getInitialMeetingForm(),
        callForm: { subject: '', description: '' },
        taskForm: { subject: '', description: '' },
        savingActivity: false,
        activities: []
      });
    }
    this.activeAccountTabId = tabId;
    this.updateTabRoute(tabId);
  }

  openAccountTabById(accountId: string) {
    const tabId = `account_${accountId}`;
    const existing = this.openAccountTabs.find(t => t.id === tabId);
    if (existing) {
      this.activeAccountTabId = tabId;
      return;
    }

    // Try to find in loaded recentAccounts first
    const loaded = this.recentAccounts.find(a => a.id === accountId);
    if (loaded) {
      this.openAccountTabs.push({
        id: tabId,
        name: loaded.name,
        account: loaded,
        activeSubTab: 'details',
        activeActivityType: 'call',
        meetingForm: this.getInitialMeetingForm(),
        callForm: { subject: '', description: '' },
        taskForm: { subject: '', description: '' },
        savingActivity: false,
        activities: []
      });
      this.activeAccountTabId = tabId;
    } else {
      // Fetch from API
      this.crmService.getAccount(accountId).subscribe({
        next: (acc) => {
          this.openAccountTabs.push({
            id: tabId,
            name: acc.name,
            account: acc,
            activeSubTab: 'details',
            activeActivityType: 'call',
            meetingForm: this.getInitialMeetingForm(),
            callForm: { subject: '', description: '' },
            taskForm: { subject: '', description: '' },
            savingActivity: false,
            activities: []
          });
          this.activeAccountTabId = tabId;
        },
        error: (err) => {
          console.error('Failed to fetch account detail:', err);
        }
      });
    }
  }

  openMeetingTab(meeting: any) {
    const tabId = `meeting_${meeting.id}`;
    const existing = this.openAccountTabs.find(t => t.id === tabId);
    if (!existing) {
      this.openAccountTabs.push({
        id: tabId,
        name: meeting.name,
        meeting: meeting,
        type: 'meeting',
        activeSubTab: 'details',
        isLoading: false
      });
    }
    this.activeView = 'accounts';
    this.activeAccountTabId = tabId;
    this.updateTabRoute(tabId);
  }

  openMeetingTabById(meetingId: string) {
    const tabId = `meeting_${meetingId}`;
    const existing = this.openAccountTabs.find(t => t.id === tabId);
    if (existing) {
      this.activeAccountTabId = tabId;
      return;
    }

    // Try to find in loaded meetingsList first
    const loaded = this.meetingsList.find(m => m.id === meetingId);
    if (loaded) {
      this.openAccountTabs.push({
        id: tabId,
        name: loaded.name,
        meeting: loaded,
        type: 'meeting',
        activeSubTab: 'details',
        isLoading: false
      });
      this.activeView = 'accounts';
      this.activeAccountTabId = tabId;
    } else {
      const isOutlookId = meetingId.length > 50 || !meetingId.includes('-');
      
      if (isOutlookId && this.currentUserProfile) {
        this.crmService.getOutlookEvent(meetingId, this.currentUserProfile.id).subscribe({
          next: (evt) => {
            const startStr = evt.start?.dateTime ? this.formatIsoToCrmDate(evt.start.dateTime) : '';
            const endStr = evt.end?.dateTime ? this.formatIsoToCrmDate(evt.end.dateTime) : '';
            const mapped = {
              id: evt.id,
              name: evt.subject || 'No Subject',
              date_start: startStr,
              date_end: endStr,
              status: 'Planned',
              parent_name: evt.location?.displayName || 'Outlook Calendar',
              parent_type: 'Outlook',
              assigned_user_name: evt.organizer?.emailAddress?.name || 'Outlook User',
              isOutlook: true,
              description: evt.body?.content || '',
              joinUrl: evt.onlineMeeting?.joinUrl || evt.onlineMeetingUrl || evt.webLink || null
            };
            
            const processed = this.processMeetingsList([mapped])[0];

            this.openAccountTabs.push({
              id: tabId,
              name: processed.name,
              meeting: processed,
              type: 'meeting',
              activeSubTab: 'details',
              isLoading: false
            });
            this.activeView = 'accounts';
            this.activeAccountTabId = tabId;
          },
          error: (err) => {
            console.error('Failed to fetch Outlook event detail:', err);
          }
        });
      } else {
        this.crmService.getMeeting(meetingId).subscribe({
          next: (meeting) => {
            const processed = this.processMeetingsList([meeting])[0];
            this.openAccountTabs.push({
              id: tabId,
              name: processed.name,
              meeting: processed,
              type: 'meeting',
              activeSubTab: 'details',
              isLoading: false
            });
            this.activeView = 'accounts';
            this.activeAccountTabId = tabId;
          },
          error: (err) => {
            console.error('Failed to fetch SpiceCRM meeting detail:', err);
          }
        });
      }
    }
  }

  getMeetingCrmUrl(meetingId: string): string {
    return `https://spice.pfcd.ca/#/module/Meetings/${meetingId}`;
  }

  getUserDisplayName(user: any): string {
    if (!user) return 'Administrator';
    if (typeof user === 'string') return user;
    if (typeof user === 'object') {
      return user.name || user.value || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Administrator';
    }
    return 'Administrator';
  }

  triggerSuccessModal(title: string, body: string, tabId: string | null = null, type: 'success' | 'warning' | 'error' = 'success') {
    this.successModalTitle = title;
    this.successModalBody = body;
    this.successModalTabId = tabId;
    this.successModalType = type;
    this.showSuccessModal = true;
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
    this.successModalTitle = '';
    this.successModalBody = '';
    this.successModalTabId = null;
  }

  viewSuccessTab() {
    if (this.successModalTabId) {
      if (this.successModalTabId.startsWith('meeting_')) {
        const id = this.successModalTabId.replace('meeting_', '');
        this.openMeetingTabById(id);
      } else if (this.successModalTabId.startsWith('account_')) {
        const id = this.successModalTabId.replace('account_', '');
        this.openAccountTabById(id);
      }
    }
    this.closeSuccessModal();
  }

  triggerPlatformDatePicker(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input && typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch (e) {
        console.warn('Native showPicker not supported or blocked:', e);
      }
    }
  }

  updateTabRoute(tabId: string | null) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabId || null },
      queryParamsHandling: 'merge'
    });
  }

  closeAccountTab(tabId: string, event: MouseEvent) {
    event.stopPropagation();
    this.openAccountTabs = this.openAccountTabs.filter(t => t.id !== tabId);
    if (this.activeAccountTabId === tabId) {
      if (this.openAccountTabs.length > 0) {
        const nextTab = this.openAccountTabs[this.openAccountTabs.length - 1];
        this.activeAccountTabId = nextTab.id;
        this.updateTabRoute(nextTab.id);
      } else {
        this.activeAccountTabId = null;
        this.updateTabRoute(null);
      }
    }
  }

  setActiveAccountTab(tabId: string | null) {
    this.activeAccountTabId = tabId;
    this.updateTabRoute(tabId);
  }

  getInitialMeetingForm() {
    // Default to tomorrow at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(11, 0, 0, 0);
    
    // Format to YYYY-MM-DDTHH:MM (for datetime-local)
    const formatDt = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    return {
      subject: '',
      dateStart: formatDt(tomorrow),
      dateEnd: formatDt(tomorrowEnd),
      description: '',
      location: ''
    };
  }

  resetMeetingForm(tab: any) {
    tab.meetingForm = this.getInitialMeetingForm();
  }

  formatDateToCrm(dateTimeLocalStr: string): string {
    if (!dateTimeLocalStr) return '';
    try {
      const d = new Date(dateTimeLocalStr);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return '';
    }
  }

  saveMeetingActivity(tab: any) {
    if (!tab.meetingForm.subject || !tab.meetingForm.dateStart || !tab.meetingForm.dateEnd) {
      alert('Please fill in the Subject, Start Time, and End Time.');
      return;
    }

    tab.savingActivity = true;

    // 1. Prepare SpiceCRM meeting record data
    const meetingData = {
      name: tab.meetingForm.subject,
      description: tab.meetingForm.description,
      date_start: this.formatDateToCrm(tab.meetingForm.dateStart),
      date_end: this.formatDateToCrm(tab.meetingForm.dateEnd),
      location: tab.meetingForm.location || '',
      parent_id: tab.account.id,
      parent_type: 'Accounts',
      status: 'Planned'
    };

    this.crmService.createMeeting(meetingData).subscribe({
      next: (crmMeeting) => {
        const localActivity = {
          type: 'Meeting',
          subject: tab.meetingForm.subject,
          date: tab.meetingForm.dateStart,
          description: tab.meetingForm.description,
          details: 'Saved in CRM'
        };
        
        // 2. If Outlook is connected, push to Outlook Calendar as well
        if (this.isOutlookConnected && this.currentUserProfile) {
          const outlookEvent = {
            subject: tab.meetingForm.subject,
            body: {
              contentType: 'HTML',
              content: `${tab.meetingForm.description}<br/><br/><i>Created via Redcliffe Portal for ${tab.account.name}</i>`
            },
            start: {
              dateTime: new Date(tab.meetingForm.dateStart).toISOString(),
              timeZone: 'Pacific Standard Time'
            },
            end: {
              dateTime: new Date(tab.meetingForm.dateEnd).toISOString(),
              timeZone: 'Pacific Standard Time'
            },
            location: {
              displayName: tab.meetingForm.location || 'Online / Portal Scheduled'
            }
          };

          this.crmService.createOutlookEvent(this.currentUserProfile.id, outlookEvent).subscribe({
            next: () => {
              localActivity.details = 'Saved in CRM & Synced to Outlook';
              tab.activities.unshift(localActivity);
              tab.savingActivity = false;
              this.resetMeetingForm(tab);
              // Refresh general meetings list
              this.loadRecentMeetings();
              this.triggerSuccessModal(
                'Meeting Scheduled!',
                'The meeting has been successfully created in SpiceCRM and synchronized to your Microsoft Outlook Calendar.',
                'meeting_' + (crmMeeting.id || crmMeeting.uuid || ''),
                'success'
              );
            },
            error: (err) => {
              console.error('Failed to sync meeting to Outlook:', err);
              localActivity.details = 'Saved in CRM (Outlook Sync Failed)';
              tab.activities.unshift(localActivity);
              tab.savingActivity = false;
              this.resetMeetingForm(tab);
              this.loadRecentMeetings();
              this.triggerSuccessModal(
                'Meeting Saved with Sync Warning',
                'The meeting was created in the CRM database, but we could not synchronize it to Microsoft Outlook. Error: ' + (err.error?.error || err.message),
                'meeting_' + (crmMeeting.id || crmMeeting.uuid || ''),
                'warning'
              );
            }
          });
        } else {
          tab.activities.unshift(localActivity);
          tab.savingActivity = false;
          this.resetMeetingForm(tab);
          this.loadRecentMeetings();
          this.triggerSuccessModal(
            'Meeting Scheduled!',
            'The meeting has been successfully created in SpiceCRM.',
            'meeting_' + (crmMeeting.id || crmMeeting.uuid || ''),
            'success'
          );
        }
      },
      error: (err) => {
        console.error('Failed to create meeting in CRM:', err);
        tab.savingActivity = false;
        this.triggerSuccessModal(
          'Failed to Save Meeting',
          'An error occurred while saving the meeting to SpiceCRM: ' + (err.error?.error || err.message),
          null,
          'error'
        );
      }
    });
  }

  saveCallActivity(tab: any) {
    if (!tab.callForm.subject) {
      alert('Please enter a call subject.');
      return;
    }
    tab.savingActivity = true;
    setTimeout(() => {
      tab.activities.unshift({
        type: 'Call',
        subject: tab.callForm.subject,
        date: new Date().toISOString(),
        description: tab.callForm.description,
        details: 'Logged successfully'
      });
      tab.callForm.subject = '';
      tab.callForm.description = '';
      tab.savingActivity = false;
    }, 400);
  }

  saveTaskActivity(tab: any) {
    if (!tab.taskForm.subject) {
      alert('Please enter a task subject.');
      return;
    }
    tab.savingActivity = true;
    setTimeout(() => {
      tab.activities.unshift({
        type: 'Task',
        subject: tab.taskForm.subject,
        date: new Date().toISOString(),
        description: tab.taskForm.description,
        details: 'Logged successfully'
      });
      tab.taskForm.subject = '';
      tab.taskForm.description = '';
      tab.savingActivity = false;
    }, 400);
  }

  get filteredAccounts() {
    if (!this.accountsSearchQuery) {
      return this.recentAccounts;
    }
    const query = this.accountsSearchQuery.toLowerCase();
    return this.recentAccounts.filter(acc => 
      (acc.name && acc.name.toLowerCase().includes(query)) ||
      (acc.email1 && acc.email1.toLowerCase().includes(query)) ||
      (acc.website && acc.website.toLowerCase().includes(query)) ||
      (acc.shipping_address_city && acc.shipping_address_city.toLowerCase().includes(query)) ||
      (acc.shipping_address_state && acc.shipping_address_state.toLowerCase().includes(query)) ||
      (acc.industry && acc.industry.toLowerCase().includes(query))
    );
  }

  get filteredMeetings() {
    if (!this.meetingsSearchQuery) {
      return this.meetingsList;
    }
    const query = this.meetingsSearchQuery.toLowerCase();
    return this.meetingsList.filter(m => {
      const nameMatch = !!(m.name && m.name.toLowerCase().includes(query));
      const statusMatch = !!(m.status && m.status.toLowerCase().includes(query));
      
      let assignedName = '';
      if (m.assigned_user_name) {
        if (typeof m.assigned_user_name === 'string') {
          assignedName = m.assigned_user_name;
        } else if (typeof m.assigned_user_name === 'object') {
          assignedName = (m.assigned_user_name as any).name || (m.assigned_user_name as any).user_name || '';
        }
      }
      const assignedMatch = assignedName.toLowerCase().includes(query);

      return nameMatch || statusMatch || assignedMatch;
    });
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
          this.loadOutlookStatus();
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

    const updatedData: any = {};
    let hasChanges = false;

    if (this.profileFirstName !== (this.currentUserProfile.first_name || '')) {
      updatedData.first_name = this.profileFirstName;
      hasChanges = true;
    }
    if (this.profileLastName !== (this.currentUserProfile.last_name || '')) {
      updatedData.last_name = this.profileLastName;
      hasChanges = true;
    }
    if (this.profileEmail !== (this.currentUserProfile.email1 || '')) {
      updatedData.email1 = this.profileEmail;
      hasChanges = true;
    }

    if (!hasChanges) {
      alert('Settings saved successfully (no changes detected)!');
      return;
    }

    this.isSavingSettings = true;
    this.crmService.updateUser(this.currentUserProfile.id, updatedData).subscribe({
      next: () => {
        this.isSavingSettings = false;
        
        // Update local object
        if (updatedData.first_name !== undefined) {
          this.currentUserProfile!.first_name = updatedData.first_name;
        }
        if (updatedData.last_name !== undefined) {
          this.currentUserProfile!.last_name = updatedData.last_name;
        }
        if (updatedData.email1 !== undefined) {
          this.currentUserProfile!.email1 = updatedData.email1;
        }

        // Persist to session storage
        sessionStorage.setItem('profile_first_name', this.currentUserProfile!.first_name || '');
        sessionStorage.setItem('profile_last_name', this.currentUserProfile!.last_name || '');
        sessionStorage.setItem('profile_email', this.currentUserProfile!.email1 || '');
        sessionStorage.setItem('user_name', `${this.currentUserProfile!.first_name || ''} ${this.currentUserProfile!.last_name || ''}`.trim());

        alert('Settings saved successfully!');
      },
      error: (err) => {
        this.isSavingSettings = false;
        const msg = err.error?.error?.message || err.error?.message || (err.error ? JSON.stringify(err.error) : '') || err.message;
        alert('Failed to save settings: ' + msg);
      }
    });
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  applyTheme() {
    const body = document.body;
    if (this.isDarkMode) {
      body.classList.remove('light-theme');
    } else {
      body.classList.add('light-theme');
    }
  }

  loadOutlookStatus() {
    if (!this.currentUserProfile) return;
    this.crmService.getOutlookStatus(this.currentUserProfile.id).subscribe({
      next: (res) => {
        const wasConnected = this.isOutlookConnected;
        this.isOutlookConnected = res.connected;
        if (res.connected && (wasConnected !== res.connected || this.activeView === 'meetings')) {
          this.loadRecentMeetings();
        }
      },
      error: () => {
        this.isOutlookConnected = false;
      }
    });
  }

  connectOutlook() {
    const authUrl = `${this.crmService.getApiUrl()}/auth/outlook?t=${Date.now()}`;
    const width = 600;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(authUrl, 'ConnectOutlook', `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`);
    
    if (!popup) {
      alert('Pop-up blocker active. Please allow pop-ups for this site to connect Outlook.');
      return;
    }

    // Set up window message listener
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'MS_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        if (this.currentUserProfile) {
          this.crmService.saveOutlookTokens(this.currentUserProfile.id, tokens).subscribe({
            next: () => {
              this.isOutlookConnected = true;
              alert('Successfully linked Microsoft Outlook Calendar!');
              window.removeEventListener('message', handleAuthMessage);
            },
            error: (err) => {
              alert('Failed to save Outlook integration tokens: ' + (err.error?.error || err.message));
            }
          });
        }
      }
    };

    window.addEventListener('message', handleAuthMessage);
  }

  disconnectOutlook() {
    if (!this.currentUserProfile) return;
    if (confirm('Are you sure you want to disconnect Microsoft Outlook calendar sync?')) {
      this.crmService.saveOutlookTokens(this.currentUserProfile.id, null).subscribe({
        next: () => {
          this.isOutlookConnected = false;
          alert('Outlook Calendar disconnected successfully.');
        },
        error: (err) => {
          alert('Failed to disconnect: ' + (err.error?.error || err.message));
        }
      });
    }
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

  showSessionTimeoutModal = false;

  handleSessionTimeoutClose() {
    this.showSessionTimeoutModal = false;
    this.logout();
  }
}
