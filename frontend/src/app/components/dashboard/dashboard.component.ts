import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CrmService, AccountBean, MeetingBean, UserBean, ReportBean, ReportColumn, ReportExecutionResult, ImportResults, ContactBean, IndividualBean, GroupBenefitsData, PlanAdminData, Carrier, CensusImportResult, CarrierCensusFormatSpec, CensusEmployee } from '../../services/crm.service';

export interface NavButtonItem {
  id: string;
  label: string;
  icon: string;
  appName: string;
}

export interface ParsedCensusBenefit {
  code: string;
  name: string;
  icon: string;
  category: 'life' | 'health' | 'dental' | 'disability' | 'wellness' | 'general';
  coverageType?: string;
  coverageAmount?: string;
  periodSuffix?: string;
}

export interface ParsedCensusDependent {
  name: string;
  relationship: string;
}

export interface ParsedCensusData {
  isCensus: boolean;
  carrier: string;
  carrierClass: string;
  certNumber: string;
  policyNumber: string;
  division: string;
  classGroup: string;
  salary: string;
  hireDate: string;
  birthDate: string;
  address: string;
  benefits: ParsedCensusBenefit[];
  dependents: ParsedCensusDependent[];
  dependentsCount: number;
  userNotes: string;
  rawCensusLine: string;
}

const CENSUS_BENEFIT_MAP: Record<string, { name: string; icon: string; category: 'life' | 'health' | 'dental' | 'disability' | 'wellness' | 'general' }> = {
  'BLIFE': { name: 'Basic Life Insurance', icon: 'favorite', category: 'life' },
  'DEP_LIFE': { name: 'Dependent Life Insurance', icon: 'diversity_1', category: 'life' },
  'AD&D': { name: 'Accidental Death & Dismemberment', icon: 'security', category: 'life' },
  'HCARE': { name: 'Extended Healthcare', icon: 'medical_services', category: 'health' },
  'DENT': { name: 'Dental Care', icon: 'dentistry', category: 'dental' },
  'STD': { name: 'Short-Term Disability', icon: 'healing', category: 'disability' },
  'LTD': { name: 'Long-Term Disability', icon: 'health_and_safety', category: 'disability' },
  'HSA': { name: 'Health Spending Account', icon: 'account_balance_wallet', category: 'health' },
  'EFAP': { name: 'Employee & Family Assistance', icon: 'support_agent', category: 'wellness' },
  'VIRTUAL_HEALTH': { name: 'Virtual Healthcare', icon: 'videocam', category: 'wellness' },
  'CI': { name: 'Critical Illness Insurance', icon: 'monitor_heart', category: 'health' },
  'VISION': { name: 'Vision Care', icon: 'visibility', category: 'health' },
  'TRAVEL': { name: 'Emergency Travel Medical', icon: 'flight_takeoff', category: 'health' },
  'WFA': { name: 'Wellness Spending Account', icon: 'spa', category: 'wellness' }
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  connectionStatus: 'checking' | 'connected' | 'error' = 'checking';
  crmUrl: string = '';
  errorMessage: string = '';
  crmToken: string = '';

  // Configurable nav buttons with drag-and-drop reordering
  readonly defaultNavButtons: NavButtonItem[] = [
    { id: 'accounts', label: 'Accounts', icon: 'corporate_fare', appName: 'Accounts' },
    { id: 'meetings', label: 'Meetings', icon: 'today', appName: 'Meetings' },
    { id: 'contacts', label: 'Contacts', icon: 'contacts', appName: 'Contacts' },
    { id: 'users', label: 'Users', icon: 'manage_accounts', appName: 'Users' },
    { id: 'reports', label: 'Reports', icon: 'analytics', appName: 'Reports' },
    { id: 'carriers', label: 'Carriers', icon: 'health_and_safety', appName: 'Carriers' },
    { id: 'search', label: 'Global Search', icon: 'search', appName: 'Search' }
  ];

  navButtons: NavButtonItem[] = [...this.defaultNavButtons];

  // Global Search State
  isGlobalSearchOpen: boolean = false;
  globalSearchQuery: string = '';
  globalSearchResults: any = null;
  isGlobalSearching: boolean = false;
  private globalSearchDebounceTimer: any = null;
  @ViewChild('globalSearchInput') globalSearchInputRef?: ElementRef<HTMLInputElement>;
  isNavDragging = false;
  draggedNavIndex = -1;
  draggedNavId: string | null = null;
  pendingDragIndex = -1;
  preventNavClick = false;

  private navPointerStartX = 0;
  private navPointerStartY = 0;
  private navPointerCurrentPos = { x: 0, y: 0 };
  private baseOffsetX = 0;
  private navHoldTimer: any = null;
  private originalNavOrderBeforeDrag: NavButtonItem[] = [];

  private onWindowPointerMoveBound = (e: PointerEvent) => this.onWindowPointerMove(e);
  private onWindowPointerUpBound = (e: PointerEvent) => this.onWindowPointerUp(e);
  
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
  isSyncingUsers = false;
  usersSearchQuery = '';

  reportsList: ReportBean[] = [];
  isLoadingReports = false;
  reportsSearchQuery = '';

  // Report Viewer & Execution State
  showReportViewerModal = false;
  activeReport: ReportBean | null = null;
  activeReportData: ReportExecutionResult | null = null;
  selectedReportExecution: ReportExecutionResult | null = null;
  isLoadingReportData = false;
  reportDataError: string | null = null;
  reportDataSearchQuery = '';
  reportSortColumn = '';
  reportSortAsc = true;
  isExportingCsv = false;

  activeView: 'accounts' | 'meetings' | 'users' | 'reports' | 'settings' | 'contacts' | 'individuals' | 'carriers' = 'accounts';

  // Carriers State
  carriersList: Carrier[] = [];
  isLoadingCarriers = false;
  carriersSearchQuery = '';
  showCreateCarrierModal = false;
  isCreatingCarrier = false;
  isEditingCarrier = false;
  selectedCarrierId: string | null = null;
  carrierModalForm = {
    carrier: '',
    description: '',
    clientIdentifier: '',
    clients: ''
  };

  // Contacts State
  contactsList: ContactBean[] = [];
  isLoadingContacts = false;
  contactsSearchQuery = '';
  showCreateContactModal = false;
  isCreatingContact = false;
  newContactForm = {
    name: '',
    email: '',
    phone: '',
    role: 'Plan Administrator',
    account_id: '',
    account_name: '',
    notes: '',
    status: 'Active'
  };
  selectedContactsFilter: 'all' | 'members' | 'admins' | string = 'all';

  // Backward compatibility getters/setters for individuals
  get individualsList(): ContactBean[] { return this.contactsList; }
  set individualsList(val: ContactBean[]) { this.contactsList = val; }
  get isLoadingIndividuals(): boolean { return this.isLoadingContacts; }
  set isLoadingIndividuals(val: boolean) { this.isLoadingContacts = val; }
  get individualsSearchQuery(): string { return this.contactsSearchQuery; }
  set individualsSearchQuery(val: string) { this.contactsSearchQuery = val; }
  get showCreateIndividualModal(): boolean { return this.showCreateContactModal; }
  set showCreateIndividualModal(val: boolean) { this.showCreateContactModal = val; }
  get isCreatingIndividual(): boolean { return this.isCreatingContact; }
  set isCreatingIndividual(val: boolean) { this.isCreatingContact = val; }
  get newIndividualForm() { return this.newContactForm; }
  set newIndividualForm(val: any) { this.newContactForm = val; }
  get selectedIndividualsFilter(): string { return this.selectedContactsFilter; }
  set selectedIndividualsFilter(val: string) { this.selectedContactsFilter = val; }

  // Profile and Settings State
  currentUserProfile: UserBean | null = null;
  profileEmail = '';
  profileFirstName = '';
  profileLastName = '';
  isSavingSettings = false;
  isDarkMode = true;
  isSquareCorners = false;
  isOutlookConnected = false;
  showAssignedColumn = false;
  showReportAssignedColumn = false;
  isImportPanelCollapsed = true;

  get isDemoUser(): boolean {
    const u = (sessionStorage.getItem('username') || '').toLowerCase();
    const demo = sessionStorage.getItem('is_demo') === 'true';
    return u === 'test' || demo;
  }

  // Census Data Import State (for Contacts and Carriers pages)
  isContactsImportCollapsed = false;
  get isIndividualsImportCollapsed(): boolean { return this.isContactsImportCollapsed; }
  set isIndividualsImportCollapsed(val: boolean) { this.isContactsImportCollapsed = val; }
  isCarriersImportCollapsed = false;
  selectedCensusCarrier: string = 'ManuLife';
  contactsCensusFiles: File[] = [];
  get individualsCensusFiles(): File[] { return this.contactsCensusFiles; }
  set individualsCensusFiles(val: File[]) { this.contactsCensusFiles = val; }
  carriersCensusFiles: File[] = [];
  contactsDragOver = false;
  get individualsDragOver(): boolean { return this.contactsDragOver; }
  set individualsDragOver(val: boolean) { this.contactsDragOver = val; }
  carriersDragOver = false;
  isUploadingCensus = false;
  censusUploadProgress = 0;
  censusImportResults: CensusImportResult | null = null;
  censusErrorMessage: string = '';
  showCensusRosterModal = false;
  censusRosterCarrier: string = '';
  censusRosterRecords: any[] = [];
  censusRosterSearchQuery: string = '';
  isLoadingCensusRoster = false;

  availableCarrierFormats: CarrierCensusFormatSpec[] = [
    {
      carrierId: 'CanadaLife',
      carrierName: 'Canada Life',
      expectedFiles: ['ENROLLEMP.TXT', 'ENROLLBFT.TXT', 'ENROLLBNC.TXT'],
      description: 'Canada Life enrollment files: 40-col employee master, 20-col benefits, 14-col dependents',
      fileFormat: 'Comma-delimited TXT'
    },
    {
      carrierId: 'ManuLife',
      carrierName: 'ManuLife Financial',
      expectedFiles: ['*.xlsx', '*.xls'],
      description: 'ManuLife 65-column Excel billing census: demographics, premiums, and 7 benefit breakdowns',
      fileFormat: 'Excel Spreadsheet (.xlsx)'
    },
    {
      carrierId: 'GroupSource',
      carrierName: 'GroupSource TPA',
      expectedFiles: ['BillingPremium*.csv'],
      description: '56-col consolidated billing census: 10 coverages with EE/ER premium splits',
      fileFormat: 'CSV'
    },
    {
      carrierId: 'Generic',
      carrierName: 'Generic Census',
      expectedFiles: ['*.csv', '*.txt', '*.xlsx'],
      description: 'Standard employee census roster',
      fileFormat: 'CSV or Delimited TXT'
    }
  ];


  // Database Backend State (SpiceCRM vs SQLite)
  backendMode: 'spice' | 'sqlite' = 'spice';
  isSqliteBackend = false;
  sqliteStats: any = null;
  isSwitchingBackend = false;
  isSyncingBackend = false;
  syncSummaryMessage = '';

  // Password Change State
  currentPasswordInput = '';
  newPasswordInput = '';
  confirmPasswordInput = '';
  isChangingPassword = false;
  passwordChangeMessage = '';
  passwordChangeError = '';

  // Accounts Table Column Preferences State
  showColumnPickerModal = false;
  availableAccountColumns = [
    { id: 'name', label: 'Client Name', description: 'Company or organization legal name', default: true },
    { id: 'email', label: 'Email', description: 'Primary contact email address', default: true },
    { id: 'website', label: 'Website', description: 'Company web address URL', default: true },
    { id: 'location', label: 'Location', description: 'City and province / state', default: true },
    { id: 'industry', label: 'Industry', description: 'Industry classification category', default: false },
    { id: 'account_type', label: 'Account Type', description: 'CRM account tier or category', default: false },
    { id: 'renewal_date', label: 'Renewal Date', description: 'Group benefits annual renewal date', default: false },
    { id: 'carrier_tpa', label: 'Carrier / TPA', description: 'Insurance carrier or administrator', default: false },
    { id: 'num_employees', label: 'Employees', description: 'Number of enrolled group employees', default: false },
    { id: 'description', label: 'Description', description: 'Summary description and notes', default: false }
  ];

  selectedAccountColumns: { [key: string]: boolean } = {
    name: true,
    email: true,
    website: true,
    location: true,
    industry: false,
    account_type: false,
    renewal_date: false,
    carrier_tpa: false,
    num_employees: false,
    description: false
  };

  tempAccountColumns: { [key: string]: boolean } = { ...this.selectedAccountColumns };

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
  selectedAccount: AccountBean | null = null;
  selectedMeeting: MeetingBean | null = null;
  selectedUser: UserBean | null = null;
  selectedReport: ReportBean | null = null;
  
  // Available Apps list
  appsList = [
    { name: 'Accounts', desc: 'Manage customer portfolios and details.', icon: 'corporate_fare', type: 'accounts' },
    { name: 'Carriers', desc: 'Manage associated benefit carriers, identifiers, and client schools.', icon: 'health_and_safety', type: 'carriers' },
    { name: 'Contacts', desc: 'Directory of plan administrators, members, and organizational contacts.', icon: 'contacts', type: 'contacts' },
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

  // Performance Monitoring & Heap Flushing State
  perfMetrics = {
    fps: 60,
    ping: 0,
    usedHeapMb: 0,
    totalHeapMb: 0
  };
  lastPurgeMessage = '';
  private rafId: number | null = null;
  private lastTime = 0;
  private lastFpsUpdate = 0;
  private frameCount = 0;

  get fpsColor(): string {
    if (this.perfMetrics.fps >= 50) return '#4ade80';
    if (this.perfMetrics.fps >= 30) return '#facc15';
    return '#f87171';
  }

  get pingColor(): string {
    if (this.perfMetrics.ping <= 8) return '#4ade80';
    if (this.perfMetrics.ping <= 20) return '#facc15';
    return '#f87171';
  }

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
      this.startPerfMonitoring();
      setTimeout(() => {
        this.devInputRef?.nativeElement?.focus();
      }, 50);
    } else {
      this.stopPerfMonitoring();
    }
  }

  ngOnDestroy() {
    this.stopPerfMonitoring();
    this.cleanupNavPointerListeners();
  }

  startPerfMonitoring() {
    if (this.rafId) return;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastFpsUpdate = this.lastTime;
    this.frameCount = 0;

    const loop = (now: number) => {
      if (!this.showDevConsole) {
        this.stopPerfMonitoring();
        return;
      }

      this.frameCount++;
      const delta = now - this.lastTime;
      this.lastTime = now;

      // Update metrics every 800ms
      if (now - this.lastFpsUpdate >= 800) {
        const interval = now - this.lastFpsUpdate;
        const measuredFps = Math.min(60, Math.round((this.frameCount * 1000) / interval));
        const expectedDelta = measuredFps > 0 ? 1000 / measuredFps : 16.6;
        const mainThreadJitterMs = Math.max(0, Math.round((delta - expectedDelta) * 10) / 10);

        this.frameCount = 0;
        this.lastFpsUpdate = now;

        let usedMb = 0;
        let totalMb = 0;
        const perfMemory = (performance as any)?.memory;
        if (perfMemory) {
          usedMb = Math.round(perfMemory.usedJSHeapSize / (1024 * 1024));
          totalMb = Math.round(perfMemory.totalJSHeapSize / (1024 * 1024));
        }

        this.perfMetrics = {
          fps: measuredFps,
          ping: mainThreadJitterMs,
          usedHeapMb: usedMb,
          totalHeapMb: totalMb
        };
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stopPerfMonitoring() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  flushArraysAndHeap(fromCli = false) {
    const closedTabsCount = this.openAccountTabs.length;

    // 1. Close and release all open account detail tabs (heaviest DOM structures)
    this.openAccountTabs = [];
    this.activeAccountTabId = null;
    this.updateTabRoute(null);

    // 2. Clear selected modal entities and cached states
    this.selectedAccount = null;
    this.selectedMeeting = null;
    this.selectedUser = null;
    this.selectedReport = null;
    this.showDetailsModal = false;
    this.showCreateIndividualModal = false;
    this.showSuccessModal = false;

    // 3. Clear file imports & parsing buffers
    this.selectedFile = null;
    this.importResults = null;
    this.isUploading = false;
    this.uploadProgress = 0;

    // 4. Clear search filters and active menu popups
    this.accountsSearchQuery = '';
    this.meetingsSearchQuery = '';
    this.usersSearchQuery = '';
    this.reportsSearchQuery = '';
    this.individualsSearchQuery = '';
    this.appSearchTerm = '';
    this.activeMenuRowId = null;
    this.activeMenuType = null;

    // 5. If console history is large, prune to initial greetings
    if (this.consoleHistory.length > 30) {
      this.consoleHistory = [
        { text: 'Redcliffe Developer Console v1.0.0 initialized.', type: 'success' },
        { text: 'Type "help" for a list of available commands.', type: 'output' }
      ];
    }

    // 6. Force V8 Scavenger GC heuristic by allocating and immediately discarding buffer
    try {
      let temp: any = new Array(1000000);
      temp.fill(0);
      temp = null;
    } catch (_) {}

    if (typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (_) {}
    }

    // 7. Measure current heap after flush
    const perfMemory = (performance as any)?.memory;
    const nowUsed = perfMemory ? Math.round(perfMemory.usedJSHeapSize / (1024 * 1024)) : null;

    const summaryMsg = nowUsed
      ? `Flushed ${closedTabsCount} tab(s) & heap arrays. Heap: ${nowUsed} MB (Baseline restored)`
      : `Flushed ${closedTabsCount} tab(s) & arrays. Pristine baseline restored!`;

    this.lastPurgeMessage = summaryMsg;

    if (fromCli) {
      this.consoleHistory.push({ text: `🧹 ${summaryMsg}`, type: 'success' });
      this.scrollToBottom();
    }

    setTimeout(() => {
      this.lastPurgeMessage = '';
    }, 3500);
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

      if (appName === 'Carriers') {
        this.activeView = 'carriers';
        this.loadCarriers();
      } else if (appName === 'Meetings') {
        this.activeView = 'meetings';
        this.loadRecentMeetings();
      } else if (appName === 'Contacts' || appName === 'Individuals') {
        this.activeView = 'contacts';
        this.loadContacts();
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
        this.consoleHistory.push({ text: '  backend            - Print active DB backend & SQLite stats', type: 'output' });
        this.consoleHistory.push({ text: '  toggle-backend     - Switch between SpiceCRM and SQLite backends', type: 'output' });
        this.consoleHistory.push({ text: '  perf | memory      - Print real-time FPS, ping & JS heap metrics', type: 'output' });
        this.consoleHistory.push({ text: '  flush | purge      - Flush open tabs, arrays & heap to baseline', type: 'output' });
        this.consoleHistory.push({ text: '  delete all records - Bulk delete all Accounts (password req.)', type: 'output' });
        this.consoleHistory.push({ text: '  clear              - Clear console output history', type: 'output' });
        break;
      case 'perf':
      case 'memory':
      case 'mem': {
        const mem = (performance as any)?.memory;
        const used = mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : 'N/A';
        const total = mem ? Math.round(mem.totalJSHeapSize / (1024 * 1024)) : 'N/A';
        this.consoleHistory.push({
          text: `⚡ Metrics: ${this.perfMetrics.fps} FPS | Latency: ${this.perfMetrics.ping}ms | Heap: ${used}MB / ${total}MB | Open Tabs: ${this.openAccountTabs.length}`,
          type: 'success'
        });
        break;
      }
      case 'flush':
      case 'purge':
        this.flushArraysAndHeap(true);
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
      case 'backend':
        this.consoleHistory.push({
          text: `Active Backend: ${this.isSqliteBackend ? 'SQLite (Local Engine)' : 'SpiceCRM (Remote API)'}`,
          type: 'success'
        });
        if (this.sqliteStats) {
          this.consoleHistory.push({
            text: `SQLite Stats: ${this.sqliteStats.accounts} accounts, ${this.sqliteStats.contacts || this.sqliteStats.individuals || 0} contacts, ${this.sqliteStats.carriers || 0} carriers, ${this.sqliteStats.meetings} meetings, ${this.sqliteStats.users} users, ${this.sqliteStats.reports || 0} reports, ${this.sqliteStats.censusRecords || 0} census records`,
            type: 'output'
          });
        }
        break;
      case 'toggle-backend':
        this.consoleHistory.push({ text: 'Toggling backend mode...', type: 'output' });
        this.toggleBackendMode();
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
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.isDarkMode = localStorage.getItem('theme') !== 'light';
    this.applyTheme();
    document.title = this.isDemoUser ? 'Demo Financial LLC CRM' : 'Redcliffe CRM Data Portal';
    const savedCornerStyle = localStorage.getItem('redcliffe_corner_style') || localStorage.getItem('feel');
    this.isSquareCorners = savedCornerStyle === 'square';
    this.applyCornerStyle();

    // 0. Load nav order from localStorage for immediate visual layout
    const savedNavOrder = localStorage.getItem('redcliffe_nav_order');
    if (savedNavOrder) {
      try {
        const parsed = JSON.parse(savedNavOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.applyNavOrder(parsed);
        }
      } catch (_) {}
    }

    this.checkStatus();
    this.loadBackendConfig();
    this.loadRecentAccounts();
    this.loadUserProfile();
    this.loadIndividuals();
    this.loadCarriers();
    this.loadColumnPreferences();

    // Listen for session invalidation/timeouts
    this.crmService.sessionTimeout$.subscribe(() => {
      this.showSessionTimeoutModal = true;
    });

    // Handle query params for tabs
    this.route.queryParams.subscribe(params => {
      const activeTabId = params['tab'];
      if (activeTabId) {
        if (this.activeAccountTabId === activeTabId) {
          return;
        }
        if (activeTabId.startsWith('account_')) {
          const accountId = activeTabId.replace('account_', '');
          this.openAccountTabById(accountId);
        } else if (activeTabId.startsWith('meeting_')) {
          const meetingId = activeTabId.replace('meeting_', '');
          this.openMeetingTabById(meetingId);
        } else if (activeTabId.startsWith('contact_') || activeTabId.startsWith('individual_')) {
          const contactId = activeTabId.replace('contact_', '').replace('individual_', '');
          this.openContactTabById(contactId);
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
        document.title = 'Redcliffe CRM Data Portal';
        this.router.navigate(['/login']);
      },
      error: () => {
        sessionStorage.clear();
        document.title = 'Redcliffe CRM Data Portal';
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
          this.isSqliteBackend = status.backend === 'sqlite';
          this.backendMode = status.backend === 'sqlite' ? 'sqlite' : 'spice';
          this.sqliteStats = status.stats || null;
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

  loadBackendConfig() {
    this.crmService.getBackendConfig().subscribe({
      next: (res) => {
        this.backendMode = res.mode;
        this.isSqliteBackend = res.mode === 'sqlite';
        this.sqliteStats = res.stats;
      },
      error: (err) => {
        console.warn('Could not load backend config:', err);
      }
    });
  }

  toggleBackendMode() {
    const newMode: 'spice' | 'sqlite' = this.isSqliteBackend ? 'spice' : 'sqlite';
    this.isSwitchingBackend = true;
    this.crmService.setBackendMode(newMode).subscribe({
      next: (res) => {
        this.backendMode = res.mode === 'sqlite' ? 'sqlite' : 'spice';
        this.isSqliteBackend = res.mode === 'sqlite';
        this.isSwitchingBackend = false;
        this.checkStatus();
        this.loadBackendConfig();
        // Refresh all active data sets for the active backend
        this.loadRecentAccounts();
        this.loadIndividuals();
        if (this.activeView === 'meetings') this.loadRecentMeetings();
        if (this.activeView === 'users') this.loadRecentUsers();
        if (this.activeView === 'reports') this.loadRecentReports();
      },
      error: (err) => {
        this.isSwitchingBackend = false;
        alert('Failed to switch database backend: ' + (err.error?.error || err.message));
      }
    });
  }

  syncSpiceToSqlite() {
    this.isSyncingBackend = true;
    this.syncSummaryMessage = '';
    this.crmService.syncSpiceToSqlite().subscribe({
      next: (res) => {
        this.isSyncingBackend = false;
        const contactsCount = res.contacts || res.individuals || 0;
        this.syncSummaryMessage = `Successfully synced ${res.accounts} accounts, ${contactsCount} contacts, ${res.meetings} meetings, ${res.users} users, ${res.reports} reports, and synchronized ${res.carriers || 0} carriers (${res.censusRecords || 0} census records preserved).`;
        this.loadBackendConfig();
        if (this.isSqliteBackend) {
          this.loadRecentAccounts();
          this.loadContacts();
          this.loadCarriers();
          this.loadRecentMeetings();
          this.loadRecentUsers();
          this.loadRecentReports();
        }
      },
      error: (err) => {
        this.isSyncingBackend = false;
        this.syncSummaryMessage = 'Sync failed: ' + (err.error?.error || err.message);
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

  buildAccountTab(tabId: string, acc: any): any {
    if (acc && acc.description) {
      acc.description = this.getAccountDescription(acc.description);
    }
    return {
      id: tabId,
      name: acc.name,
      account: acc,
      type: 'account',
      activeSubTab: 'details',
      activeActivityType: 'call',
      meetingForm: this.getInitialMeetingForm(),
      callForm: { subject: '', description: '' },
      taskForm: { subject: '', description: '' },
      savingActivity: false,
      activities: [],
      groupBenefitsForm: {
        renewal_date: acc.group_benefits?.renewal_date || '',
        carrier_tpa: acc.group_benefits?.carrier_tpa || '',
        num_employees: acc.group_benefits?.num_employees || ''
      },
      isEditingGroupBenefits: false,
      isSavingGroupBenefits: false,
      showAddAdminModal: false,
      newAdminForm: {
        name: '',
        email: '',
        phone: '',
        role: 'Plan Administrator'
      },
      isSavingAdmin: false
    };
  }

  openAccountTab(acc: any) {
    const tabId = `account_${acc.id}`;
    const existing = this.openAccountTabs.find(t => t.id === tabId);
    if (!existing) {
      this.openAccountTabs.push(this.buildAccountTab(tabId, acc));
    }
    this.activeView = 'accounts';
    this.activeAccountTabId = tabId;
    this.updateTabRoute(tabId);
  }

  openAccountTabById(accountId?: string, accountName?: string) {
    this.activeView = 'accounts';
    let targetId = accountId;
    if (!targetId && accountName) {
      const match = this.recentAccounts.find(a => a.name && a.name.toLowerCase() === accountName.toLowerCase());
      if (match) targetId = match.id;
    }
    if (!targetId) {
      alert(`No account record linked for "${accountName || 'this contact'}".`);
      return;
    }

    const tabId = `account_${targetId}`;
    const existing = this.openAccountTabs.find(t => t.id === tabId);
    if (existing) {
      this.activeAccountTabId = tabId;
      this.updateTabRoute(tabId);
      return;
    }

    // Try to find in loaded recentAccounts first
    const loaded = this.recentAccounts.find(a => a.id === targetId);
    if (loaded) {
      this.openAccountTabs.push(this.buildAccountTab(tabId, loaded));
      this.activeAccountTabId = tabId;
      this.updateTabRoute(tabId);
    } else {
      // Fetch from API
      this.crmService.getAccount(targetId).subscribe({
        next: (acc) => {
          this.openAccountTabs.push(this.buildAccountTab(tabId, acc));
          this.activeAccountTabId = tabId;
          this.updateTabRoute(tabId);
        },
        error: (err) => {
          console.error('Failed to fetch account detail:', err);
          if (accountName) {
            this.openAccountTabs.push(this.buildAccountTab(tabId, { id: targetId, name: accountName }));
            this.activeAccountTabId = tabId;
            this.updateTabRoute(tabId);
          }
        }
      });
    }
  }

  saveGroupBenefits(tab: any) {
    tab.isSavingGroupBenefits = true;
    const payload = {
      renewal_date: tab.groupBenefitsForm.renewal_date,
      carrier_tpa: tab.groupBenefitsForm.carrier_tpa,
      num_employees: tab.groupBenefitsForm.num_employees
    };

    this.crmService.updateAccountCustomFields(tab.account.id, payload).subscribe({
      next: (res) => {
        tab.isSavingGroupBenefits = false;
        tab.isEditingGroupBenefits = false;
        if (res && res.data && res.data.group_benefits) {
          tab.account.group_benefits = res.data.group_benefits;
        } else {
          tab.account.group_benefits = { ...payload };
        }
        // Also update in-memory recentAccounts list
        const inList = this.recentAccounts.find(a => a.id === tab.account.id);
        if (inList) {
          inList.group_benefits = tab.account.group_benefits;
        }
        this.triggerSuccessModal(
          'Group Benefits Saved',
          `Group Benefits fields for "${tab.account.name}" have been successfully saved to the database.`,
          tab.id,
          'success'
        );
      },
      error: (err) => {
        tab.isSavingGroupBenefits = false;
        alert('Failed to save Group Benefits: ' + (err.error?.error || err.message));
      }
    });
  }

  saveNewPlanAdmin(tab: any) {
    if (!tab.newAdminForm.name || !tab.newAdminForm.name.trim()) {
      alert('Please enter administrator name.');
      return;
    }

    tab.isSavingAdmin = true;
    const contactData: Partial<ContactBean> = {
      name: tab.newAdminForm.name.trim(),
      email: tab.newAdminForm.email?.trim() || '',
      phone: tab.newAdminForm.phone?.trim() || '',
      role: tab.newAdminForm.role?.trim() || 'Plan Administrator',
      account_id: tab.account.id,
      account_name: tab.account.name,
      status: 'Active'
    };

    this.crmService.createContact(contactData).subscribe({
      next: (created) => {
        tab.isSavingAdmin = false;
        tab.showAddAdminModal = false;
        tab.newAdminForm = { name: '', email: '', phone: '', role: 'Plan Administrator' };

        if (!tab.account.plan_admin) {
          tab.account.plan_admin = { names: [], emails: [], phones: [], contacts: [], individuals: [] };
        }
        if (!Array.isArray(tab.account.plan_admin.contacts)) {
          tab.account.plan_admin.contacts = [];
        }
        if (!Array.isArray(tab.account.plan_admin.individuals)) {
          tab.account.plan_admin.individuals = [];
        }
        tab.account.plan_admin.contacts.push(created);
        tab.account.plan_admin.individuals.push(created);
        if (created.name && !tab.account.plan_admin.names.includes(created.name)) {
          tab.account.plan_admin.names.push(created.name);
        }
        if (created.email && !tab.account.plan_admin.emails.includes(created.email)) {
          tab.account.plan_admin.emails.push(created.email);
        }
        if (created.phone && !tab.account.plan_admin.phones.includes(created.phone)) {
          tab.account.plan_admin.phones.push(created.phone);
        }

        // Also update recentAccounts in memory
        const inList = this.recentAccounts.find(a => a.id === tab.account.id);
        if (inList) {
          inList.plan_admin = tab.account.plan_admin;
        }

        this.loadContacts();
        this.triggerSuccessModal(
          'Administrator Added',
          `${created.name} has been added as a Plan Administrator and registered in the contacts database.`,
          `contact_${created.id}`,
          'success'
        );
      },
      error: (err) => {
        tab.isSavingAdmin = false;
        alert('Failed to create plan administrator: ' + (err.error?.error || err.message));
      }
    });
  }

  loadContacts() {
    this.isLoadingContacts = true;
    this.crmService.getContacts().subscribe({
      next: (res) => {
        this.contactsList = res.list || [];
        this.isLoadingContacts = false;
      },
      error: (err) => {
        console.error('Failed to load contacts:', err);
        this.isLoadingContacts = false;
      }
    });
  }

  loadIndividuals() {
    this.loadContacts();
  }

  get planMembersCount(): number {
    return this.contactsList.filter(i => (i.role || '').toLowerCase() === 'plan member').length;
  }

  get planAdminsCount(): number {
    return this.contactsList.filter(i => (i.role || '').toLowerCase() !== 'plan member').length;
  }

  setContactsFilter(filter: string) {
    this.selectedContactsFilter = filter;
    this.contactsSearchQuery = '';
  }

  setIndividualsFilter(filter: string) {
    this.setContactsFilter(filter);
  }

  get filteredContacts(): ContactBean[] {
    let list = this.contactsList;
    if (this.selectedContactsFilter === 'members') {
      list = list.filter(i => (i.role || '').toLowerCase() === 'plan member');
    } else if (this.selectedContactsFilter === 'admins') {
      list = list.filter(i => (i.role || '').toLowerCase() !== 'plan member');
    } else if (this.selectedContactsFilter !== 'all') {
      const f = this.selectedContactsFilter.toLowerCase();
      list = list.filter(i => (i.account_name && i.account_name.toLowerCase().includes(f)));
    }

    if (!this.contactsSearchQuery) {
      return list;
    }
    const q = this.contactsSearchQuery.toLowerCase().trim();
    return list.filter(ind =>
      (ind.name && ind.name.toLowerCase().includes(q)) ||
      (ind.email && ind.email.toLowerCase().includes(q)) ||
      (ind.phone && ind.phone.toLowerCase().includes(q)) ||
      (ind.account_name && ind.account_name.toLowerCase().includes(q)) ||
      (ind.role && ind.role.toLowerCase().includes(q)) ||
      (ind.notes && ind.notes.toLowerCase().includes(q))
    );
  }

  get filteredIndividuals(): ContactBean[] {
    return this.filteredContacts;
  }

  openCensusRosterModal(carrier?: string) {
    this.showCensusRosterModal = true;
    this.censusRosterCarrier = carrier || (this.censusImportResults ? this.censusImportResults.carrier : 'ManuLife');
    this.isLoadingCensusRoster = true;
    this.censusRosterSearchQuery = '';
    this.crmService.getCensusRecords(this.censusRosterCarrier).subscribe({
      next: (res) => {
        this.censusRosterRecords = res.list || [];
        this.isLoadingCensusRoster = false;
      },
      error: (err) => {
        console.error('Failed to load census roster:', err);
        this.isLoadingCensusRoster = false;
      }
    });
  }

  closeCensusRosterModal() {
    this.showCensusRosterModal = false;
    this.censusRosterRecords = [];
    this.censusRosterSearchQuery = '';
  }

  get filteredCensusRosterRecords(): any[] {
    if (!this.censusRosterSearchQuery || !this.censusRosterSearchQuery.trim()) {
      return this.censusRosterRecords;
    }
    const q = this.censusRosterSearchQuery.toLowerCase().trim();
    return this.censusRosterRecords.filter(r =>
      (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
      (r.certificate_number && String(r.certificate_number).toLowerCase().includes(q)) ||
      (r.account_name && r.account_name.toLowerCase().includes(q)) ||
      (r.policy_number && String(r.policy_number).toLowerCase().includes(q))
    );
  }

  openClientAccount(clientName: string) {
    if (!clientName) return;
    this.activeView = 'accounts';

    // 1. Check if an account tab for this client is already open
    const openTab = this.openAccountTabs.find(t => 
      t.type === 'account' && t.account && t.account.name && t.account.name.toLowerCase() === clientName.toLowerCase()
    );
    if (openTab) {
      this.activeAccountTabId = openTab.id;
      this.updateTabRoute(openTab.id);
      return;
    }

    // 2. Check if in loaded recentAccounts
    const localMatch = this.recentAccounts.find(a => 
      a.name && a.name.toLowerCase() === clientName.toLowerCase()
    );
    if (localMatch) {
      this.openAccountTab(localMatch);
      return;
    }

    // 3. Search backend accounts API by name
    this.crmService.getRecentAccounts(50, clientName).subscribe({
      next: (res) => {
        const found = (res.list || []).find(a => 
          a.name && a.name.toLowerCase() === clientName.toLowerCase()
        ) || (res.list && res.list[0]);

        if (found) {
          if (!this.recentAccounts.some(a => a.id === found.id)) {
            this.recentAccounts.unshift(found);
          }
          this.openAccountTab(found);
        } else {
          // Open a client account tab with this name
          const stubAccount: AccountBean = {
            id: 'client_' + encodeURIComponent(clientName).replace(/%/g, '_'),
            name: clientName,
            account_type: 'Client Account',
            industry: 'Group Benefits'
          };
          this.openAccountTab(stubAccount);
        }
      },
      error: () => {
        const stubAccount: AccountBean = {
          id: 'client_' + encodeURIComponent(clientName).replace(/%/g, '_'),
          name: clientName,
          account_type: 'Client Account',
          industry: 'Group Benefits'
        };
        this.openAccountTab(stubAccount);
      }
    });
  }

  viewInContactsTable(accountOrQuery?: string) {
    this.activeView = 'contacts';
    const target = accountOrQuery || this.censusImportResults?.matchedAccount;
    if (target) {
      if (target.toLowerCase().includes('mulgrave') || target.toLowerCase().includes('school')) {
        this.selectedContactsFilter = 'Mulgrave School';
        this.contactsSearchQuery = '';
      } else {
        this.selectedContactsFilter = 'all';
        this.contactsSearchQuery = target;
      }
    } else {
      this.selectedContactsFilter = 'all';
      this.contactsSearchQuery = '';
    }
    this.showCensusRosterModal = false;
    this.loadContacts();
  }

  viewInIndividualsTable(accountOrQuery?: string) {
    this.viewInContactsTable(accountOrQuery);
  }

  getRecordPremium(rec: any): string {
    if (!rec) return '—';
    if (rec.raw_data) {
      try {
        const raw = typeof rec.raw_data === 'string' ? JSON.parse(rec.raw_data) : rec.raw_data;
        if (raw && raw.totalMonthlyPremium) {
          return `$${Number(raw.totalMonthlyPremium).toFixed(2)}`;
        }
      } catch (_) {}
    }
    return '—';
  }

  isPhoneLink(phone?: string): boolean {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7;
  }

  openContactTab(contact: ContactBean) {
    const tabId = `contact_${contact.id}`;
    const existing = this.openAccountTabs.find(t => t.id === tabId || t.id === `individual_${contact.id}`);
    if (!existing) {
      this.openAccountTabs.push({
        id: tabId,
        name: contact.name,
        contact: { ...contact },
        originalContact: { ...contact },
        individual: { ...contact },
        originalIndividual: { ...contact },
        type: 'contact',
        activeSubTab: 'details',
        isSaving: false
      });
    }
    this.activeView = 'accounts';
    this.activeAccountTabId = tabId;
    this.updateTabRoute(tabId);
  }

  openIndividualTab(ind: any) {
    this.openContactTab(ind);
  }

  openContactTabById(contactId: string) {
    const tabId = `contact_${contactId}`;
    const existing = this.openAccountTabs.find(t => t.id === tabId || t.id === `individual_${contactId}`);
    if (existing) {
      this.activeView = 'accounts';
      this.activeAccountTabId = existing.id;
      return;
    }

    const loaded = this.contactsList.find(i => i.id === contactId);
    if (loaded) {
      this.openAccountTabs.push({
        id: tabId,
        name: loaded.name,
        contact: { ...loaded },
        originalContact: { ...loaded },
        individual: { ...loaded },
        originalIndividual: { ...loaded },
        type: 'contact',
        activeSubTab: 'details',
        isSaving: false
      });
      this.activeView = 'accounts';
      this.activeAccountTabId = tabId;
    } else {
      this.crmService.getContact(contactId).subscribe({
        next: (c) => {
          this.openAccountTabs.push({
            id: tabId,
            name: c.name,
            contact: { ...c },
            originalContact: { ...c },
            individual: { ...c },
            originalIndividual: { ...c },
            type: 'contact',
            activeSubTab: 'details',
            isSaving: false
          });
          this.activeView = 'accounts';
          this.activeAccountTabId = tabId;
        },
        error: (err) => {
          console.error('Failed to fetch contact:', err);
        }
      });
    }
  }

  openIndividualTabById(indId: string) {
    this.openContactTabById(indId);
  }

  isContactDirty(tab: any): boolean {
    const target = tab?.contact || tab?.individual;
    if (!tab || !target) return false;
    const origTarget = tab.originalContact || tab.originalIndividual;
    if (!origTarget) {
      tab.originalContact = { ...target };
      tab.originalIndividual = { ...target };
      return false;
    }
    const curr = target;
    const orig = origTarget;
    const normalize = (val: any) => (val === null || val === undefined ? '' : String(val).trim());

    return (
      normalize(curr.name) !== normalize(orig.name) ||
      normalize(curr.role) !== normalize(orig.role) ||
      normalize(curr.email) !== normalize(orig.email) ||
      normalize(curr.phone) !== normalize(orig.phone) ||
      normalize(curr.status || 'Active') !== normalize(orig.status || 'Active') ||
      normalize(curr.notes) !== normalize(orig.notes)
    );
  }

  isIndividualDirty(tab: any): boolean {
    return this.isContactDirty(tab);
  }

  saveContact(tab: any) {
    const target = tab?.contact || tab?.individual;
    if (!target || !target.name || !target.name.trim()) {
      alert('Name is required.');
      return;
    }
    tab.isSaving = true;
    this.crmService.updateContact(target.id, target).subscribe({
      next: (updated) => {
        tab.isSaving = false;
        tab.contact = updated;
        tab.originalContact = { ...updated };
        tab.individual = updated;
        tab.originalIndividual = { ...updated };
        tab.name = updated.name;
        tab.customNotes = this.getCensusData(updated.notes).userNotes || '';
        this.loadContacts();

        // Also update any open account tabs containing this contact
        for (const t of this.openAccountTabs) {
          if (t.account && t.account.plan_admin) {
            const list = t.account.plan_admin.contacts || t.account.plan_admin.individuals;
            if (Array.isArray(list)) {
              const idx = list.findIndex((i: any) => i.id === updated.id);
              if (idx !== -1) {
                list[idx] = updated;
                t.account.plan_admin.names = list.map((i: any) => i.name);
                t.account.plan_admin.emails = list.map((i: any) => i.email);
                t.account.plan_admin.phones = list.map((i: any) => i.phone);
                t.account.plan_admin.contacts = list;
                t.account.plan_admin.individuals = list;
              }
            }
          }
        }

        this.triggerSuccessModal(
          'Contact Profile Saved',
          `Information for ${updated.name} has been updated in the database.`,
          tab.id,
          'success'
        );
      },
      error: (err) => {
        tab.isSaving = false;
        alert('Failed to save contact: ' + (err.error?.error || err.message));
      }
    });
  }

  saveIndividual(tab: any) {
    this.saveContact(tab);
  }

  // ==================== CENSUS NOTES PARSER & HELPERS ====================
  private censusDataCache = new Map<string, ParsedCensusData>();

  getCensusData(notes: string | undefined): ParsedCensusData {
    if (!notes || typeof notes !== 'string' || !notes.includes('[CENSUS:')) {
      return {
        isCensus: false,
        carrier: '',
        carrierClass: 'carrier-generic',
        certNumber: '',
        policyNumber: '',
        division: '',
        classGroup: '',
        salary: '',
        hireDate: '',
        birthDate: '',
        address: '',
        benefits: [],
        dependents: [],
        dependentsCount: 0,
        userNotes: notes || '',
        rawCensusLine: ''
      };
    }

    const cached = this.censusDataCache.get(notes);
    if (cached) {
      return cached;
    }

    const lines = notes.split('\n');
    let rawCensusLine = '';
    const userNotesLines: string[] = [];

    for (const line of lines) {
      if (line.includes('[CENSUS:') && !rawCensusLine) {
        rawCensusLine = line.trim();
      } else if (line.trim()) {
        userNotesLines.push(line);
      }
    }

    const userNotes = userNotesLines.join('\n').trim();

    const carrierMatch = rawCensusLine.match(/\[CENSUS:\s*([^\]]+)\]/i);
    const carrier = carrierMatch ? carrierMatch[1].trim() : 'Census Record';

    let carrierClass = 'carrier-generic';
    const cUpper = carrier.toUpperCase();
    if (cUpper.includes('MANULIFE')) carrierClass = 'carrier-manulife';
    else if (cUpper.includes('CANADALIFE') || cUpper.includes('CANADA LIFE')) carrierClass = 'carrier-canadalife';
    else if (cUpper.includes('GROUPSOURCE')) carrierClass = 'carrier-groupsource';
    else if (cUpper.includes('SUNLIFE') || cUpper.includes('SUN LIFE')) carrierClass = 'carrier-sunlife';

    let certNumber = '';
    let policyNumber = '';
    let division = '';
    let classGroup = '';
    let salary = '';
    let hireDate = '';
    let birthDate = '';
    let address = '';
    const benefits: ParsedCensusBenefit[] = [];
    const dependents: ParsedCensusDependent[] = [];
    let dependentsCount = 0;

    const parts = rawCensusLine.split(' | ');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('Cert:')) {
        certNumber = trimmed.replace(/^Cert:\s*/i, '').replace(/^#/, '').trim();
      } else if (trimmed.startsWith('Policy:')) {
        policyNumber = trimmed.replace(/^Policy:\s*/i, '').replace(/^#/, '').trim();
      } else if (trimmed.startsWith('Div:')) {
        division = trimmed.replace(/^Div:\s*/i, '').trim();
      } else if (trimmed.startsWith('Class:')) {
        classGroup = trimmed.replace(/^Class:\s*/i, '').trim();
      } else if (trimmed.startsWith('Salary:')) {
        salary = trimmed.replace(/^Salary:\s*/i, '').trim();
      } else if (trimmed.startsWith('Hired:')) {
        hireDate = trimmed.replace(/^Hired:\s*/i, '').trim();
      } else if (trimmed.startsWith('DOB:')) {
        birthDate = trimmed.replace(/^DOB:\s*/i, '').trim();
      } else if (trimmed.startsWith('Address:')) {
        address = trimmed.replace(/^Address:\s*/i, '').trim();
      } else if (trimmed.startsWith('Benefits:')) {
        const bStr = trimmed.replace(/^Benefits:\s*/i, '').trim();
        const items = bStr.split(/,\s*(?=[A-Za-z])/);
        for (const item of items) {
          const bTrim = item.trim();
          if (!bTrim) continue;
          const m = bTrim.match(/^([A-Za-z0-9_&]+)(?:\s*\(([^)]+)\))?(?:\s*\$([\d,]+(?:\.\d+)?))?$/);
          if (m) {
            const code = m[1].trim();
            const covType = (m[2] || '').trim();
            const covAmt = m[3] ? `$${m[3].trim()}` : '';
            const meta = CENSUS_BENEFIT_MAP[code.toUpperCase()] || {
              name: code.replace(/_/g, ' '),
              icon: 'verified_user',
              category: 'general'
            };
            let periodSuffix = '';
            if (covAmt) {
              if (code.toUpperCase() === 'STD') periodSuffix = '/wk';
              else if (code.toUpperCase() === 'LTD') periodSuffix = '/mo';
            }
            benefits.push({
              code,
              name: meta.name,
              icon: meta.icon,
              category: meta.category,
              coverageType: covType,
              coverageAmount: covAmt,
              periodSuffix
            });
          } else {
            benefits.push({
              code: bTrim,
              name: bTrim.replace(/_/g, ' '),
              icon: 'verified_user',
              category: 'general',
              coverageType: '',
              coverageAmount: '',
              periodSuffix: ''
            });
          }
        }
      } else if (trimmed.startsWith('Dependents')) {
        const depMatch = trimmed.match(/^Dependents(?:\s*\((\d+)\))?:\s*(.*)$/i);
        if (depMatch) {
          if (depMatch[1]) {
            dependentsCount = parseInt(depMatch[1], 10);
          }
          const depListStr = depMatch[2].trim();
          const depRegex = /([^,\[]+?)\s*(?:\[(.*?)\])?(?=,|$)/g;
          let dMatch;
          while ((dMatch = depRegex.exec(depListStr)) !== null) {
            const dName = dMatch[1].trim();
            const dRel = (dMatch[2] || '').trim();
            if (dName) {
              dependents.push({
                name: dName,
                relationship: dRel || 'Dependent'
              });
            }
          }
        }
      }
    }

    if (!dependentsCount) {
      dependentsCount = dependents.length;
    }

    const result: ParsedCensusData = {
      isCensus: true,
      carrier,
      carrierClass,
      certNumber,
      policyNumber,
      division,
      classGroup,
      salary,
      hireDate,
      birthDate,
      address,
      benefits,
      dependents,
      dependentsCount,
      userNotes,
      rawCensusLine
    };

    this.censusDataCache.set(notes, result);
    return result;
  }

  getTabUserNotes(tab: any): string {
    if (!tab) return '';
    if (tab.customNotes === undefined) {
      const target = tab.contact || tab.individual;
      const parsed = this.getCensusData(target?.notes);
      tab.customNotes = parsed.userNotes || '';
    }
    return tab.customNotes;
  }

  onTabUserNotesChange(tab: any, val: string): void {
    if (!tab) return;
    tab.customNotes = val;
    const target = tab.contact || tab.individual;
    if (!target) return;
    const census = this.getCensusData(target.notes);
    if (census.isCensus && census.rawCensusLine) {
      target.notes = val && val.trim() ? `${census.rawCensusLine}\n\n${val.trim()}` : census.rawCensusLine;
    } else {
      target.notes = val;
    }
  }

  onRawNotesChange(tab: any): void {
    if (!tab) return;
    const target = tab.contact || tab.individual;
    if (target) {
      this.censusDataCache.delete(target.notes);
      const parsed = this.getCensusData(target.notes);
      tab.customNotes = parsed.userNotes || '';
    }
  }

  deleteContactRecord(id: string, tabId?: string) {
    if (!confirm('Are you sure you want to delete this contact record? This cannot be undone.')) return;
    this.crmService.deleteContact(id).subscribe({
      next: () => {
        this.contactsList = this.contactsList.filter(i => i.id !== id);
        if (tabId) {
          this.closeAccountTab(tabId, new MouseEvent('click'));
        }
        for (const t of this.openAccountTabs) {
          if (t.account && t.account.plan_admin) {
            const list = t.account.plan_admin.contacts || t.account.plan_admin.individuals;
            if (Array.isArray(list)) {
              const filtered = list.filter((i: any) => i.id !== id);
              t.account.plan_admin.contacts = filtered;
              t.account.plan_admin.individuals = filtered;
              t.account.plan_admin.names = filtered.map((i: any) => i.name);
              t.account.plan_admin.emails = filtered.map((i: any) => i.email);
              t.account.plan_admin.phones = filtered.map((i: any) => i.phone);
            }
          }
        }
        this.triggerSuccessModal(
          'Contact Deleted',
          'The contact record was removed from the database.',
          null,
          'success'
        );
      },
      error: (err) => {
        alert('Failed to delete contact: ' + (err.error?.error || err.message));
      }
    });
  }

  deleteIndividualRecord(id: string, tabId?: string) {
    this.deleteContactRecord(id, tabId);
  }

  openCreateContactModal() {
    this.newContactForm = {
      name: '',
      email: '',
      phone: '',
      role: 'Plan Administrator',
      account_id: '',
      account_name: '',
      notes: '',
      status: 'Active'
    };
    this.showCreateContactModal = true;
  }

  openCreateIndividualModal() {
    this.openCreateContactModal();
  }

  closeCreateContactModal() {
    this.showCreateContactModal = false;
  }

  closeCreateIndividualModal() {
    this.closeCreateContactModal();
  }

  submitNewContact() {
    if (!this.newContactForm.name || !this.newContactForm.name.trim()) {
      alert('Please enter a name for the contact.');
      return;
    }
    this.isCreatingContact = true;
    if (this.newContactForm.account_id) {
      const match = this.recentAccounts.find(a => a.id === this.newContactForm.account_id);
      if (match) {
        this.newContactForm.account_name = match.name;
      }
    }
    this.crmService.createContact(this.newContactForm).subscribe({
      next: (created) => {
        this.isCreatingContact = false;
        this.showCreateContactModal = false;
        this.loadContacts();
        this.openContactTab(created);
      },
      error: (err) => {
        this.isCreatingContact = false;
        alert('Failed to create contact: ' + (err.error?.error || err.message));
      }
    });
  }

  submitNewIndividual() {
    this.submitNewContact();
  }

  // ==================== CARRIERS ====================

  get filteredCarriers(): Carrier[] {
    if (!this.carriersSearchQuery || !this.carriersSearchQuery.trim()) {
      return this.carriersList;
    }
    const q = this.carriersSearchQuery.toLowerCase().trim();
    return this.carriersList.filter(c => {
      const nameMatch = (c.carrier || '').toLowerCase().includes(q);
      const descMatch = (c.description || '').toLowerCase().includes(q);
      const identMatch = (c.clientIdentifier || '').toLowerCase().includes(q);
      const clientsMatch = Array.isArray(c.clients) 
        ? c.clients.some(client => (client || '').toLowerCase().includes(q))
        : String(c.clients || '').toLowerCase().includes(q);
      return nameMatch || descMatch || identMatch || clientsMatch;
    });
  }

  loadCarriers() {
    this.isLoadingCarriers = true;
    this.crmService.getCarriers().subscribe({
      next: (res) => {
        this.carriersList = res.list || [];
        this.isLoadingCarriers = false;
      },
      error: (err) => {
        console.error('Failed to load carriers:', err);
        this.isLoadingCarriers = false;
      }
    });
  }

  openCreateCarrierModal() {
    this.isEditingCarrier = false;
    this.selectedCarrierId = null;
    this.carrierModalForm = {
      carrier: '',
      description: '',
      clientIdentifier: '',
      clients: ''
    };
    this.showCreateCarrierModal = true;
  }

  openEditCarrierModal(carrier: Carrier) {
    this.isEditingCarrier = true;
    this.selectedCarrierId = carrier.id;
    this.carrierModalForm = {
      carrier: carrier.carrier || '',
      description: carrier.description || '',
      clientIdentifier: carrier.clientIdentifier || '',
      clients: Array.isArray(carrier.clients) ? carrier.clients.join(', ') : String(carrier.clients || '')
    };
    this.showCreateCarrierModal = true;
  }

  closeCarrierModal() {
    this.showCreateCarrierModal = false;
    this.selectedCarrierId = null;
    this.carrierModalForm = {
      carrier: '',
      description: '',
      clientIdentifier: '',
      clients: ''
    };
  }

  saveCarrier() {
    if (!this.carrierModalForm.carrier.trim()) {
      alert('Please enter a carrier name.');
      return;
    }

    const clientsArray = this.carrierModalForm.clients
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    this.isCreatingCarrier = true;

    if (this.isEditingCarrier && this.selectedCarrierId) {
      this.crmService.updateCarrier(this.selectedCarrierId, {
        carrier: this.carrierModalForm.carrier.trim(),
        description: this.carrierModalForm.description.trim(),
        clientIdentifier: this.carrierModalForm.clientIdentifier.trim(),
        clients: clientsArray
      }).subscribe({
        next: () => {
          this.isCreatingCarrier = false;
          this.closeCarrierModal();
          this.loadCarriers();
          this.triggerSuccessModal('Carrier Updated', 'Carrier details have been updated successfully.');
        },
        error: (err) => {
          this.isCreatingCarrier = false;
          alert('Failed to update carrier: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.crmService.createCarrier({
        carrier: this.carrierModalForm.carrier.trim(),
        description: this.carrierModalForm.description.trim(),
        clientIdentifier: this.carrierModalForm.clientIdentifier.trim(),
        clients: clientsArray
      }).subscribe({
        next: () => {
          this.isCreatingCarrier = false;
          this.closeCarrierModal();
          this.loadCarriers();
          this.triggerSuccessModal('Carrier Created', 'New carrier record has been created successfully.');
        },
        error: (err) => {
          this.isCreatingCarrier = false;
          alert('Failed to create carrier: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  confirmDeleteCarrier(id: string, name: string) {
    if (confirm(`Are you sure you want to delete carrier "${name}"?`)) {
      this.crmService.deleteCarrier(id).subscribe({
        next: () => {
          this.loadCarriers();
          this.triggerSuccessModal('Carrier Deleted', `Carrier "${name}" has been deleted.`);
        },
        error: (err) => {
          alert('Failed to delete carrier: ' + (err.error?.error || err.message));
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

  getAccountType(account?: any): string {
    if (!account) return 'Group Client - Benefits';
    return account.account_type || account.accountType || 'Group Client - Benefits';
  }

  getAccountDescription(accountOrDesc?: any): string {
    if (!accountOrDesc) return '';
    const raw = typeof accountOrDesc === 'string' ? accountOrDesc : (accountOrDesc.description || '');
    if (!raw) return '';
    return raw
      .replace(/(?:\s*\|\s*)?\[(Account Type|Renewal Date|Renewal Date - Benefits|Carrier or TPA|Carrier\/TPA)\]:[^|]*/gi, '')
      .replace(/^\s*\|\s*/, '')
      .trim();
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
      } else if (this.successModalTabId.startsWith('contact_') || this.successModalTabId.startsWith('individual_')) {
        const id = this.successModalTabId.replace('contact_', '').replace('individual_', '');
        this.openContactTabById(id);
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
              content: `${tab.meetingForm.description}<br/><br/><i>Created via ${this.isDemoUser ? 'Demo Financial' : 'Redcliffe'} Portal for ${tab.account.name}</i>`
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

  syncUsersFromSpice() {
    this.isSyncingUsers = true;
    this.crmService.syncUsers().subscribe({
      next: (res) => {
        this.isSyncingUsers = false;
        if (res.list) {
          this.usersList = res.list;
        } else {
          this.loadRecentUsers();
        }
      },
      error: (err) => {
        this.isSyncingUsers = false;
        alert('Failed to sync users from SpiceCRM: ' + (err.error?.error || err.message));
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event?: MouseEvent) {
    this.activeMenuRowId = null;
    this.activeMenuType = null;
    if (this.isGlobalSearchOpen && event) {
      const target = event.target as HTMLElement;
      if (!target || !target.isConnected) {
        return;
      }
      if (target.closest('.global-search-container') || target.closest('[data-nav-id="search"]')) {
        return;
      }
      this.closeGlobalSearch();
    }
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

  runReport(report: ReportBean) {
    this.activeReport = report;
    this.showReportViewerModal = true;
    this.isLoadingReportData = true;
    this.reportDataError = null;
    this.activeReportData = null;
    this.reportDataSearchQuery = '';
    this.reportSortColumn = '';
    this.reportSortAsc = true;

    this.crmService.getReportData(report.id).subscribe({
      next: (data) => {
        this.activeReportData = data;
        this.isLoadingReportData = false;
        if (data.columns && data.columns.length > 0) {
          this.reportSortColumn = data.columns[0].label;
        }
      },
      error: (err) => {
        this.reportDataError = err.error?.error || err.message || 'Failed to load report dataset';
        this.isLoadingReportData = false;
      }
    });
  }

  closeReportViewerModal() {
    this.showReportViewerModal = false;
    this.activeReport = null;
    this.activeReportData = null;
    this.reportDataError = null;
    this.reportDataSearchQuery = '';
  }

  sortReportData(columnLabel: string) {
    if (this.reportSortColumn === columnLabel) {
      this.reportSortAsc = !this.reportSortAsc;
    } else {
      this.reportSortColumn = columnLabel;
      this.reportSortAsc = true;
    }
  }

  get filteredReportRecords(): Array<Record<string, string>> {
    if (!this.activeReportData || !this.activeReportData.records) {
      return [];
    }

    let records = this.activeReportData.records;

    // Filter by search query across all column values
    if (this.reportDataSearchQuery.trim()) {
      const q = this.reportDataSearchQuery.toLowerCase().trim();
      records = records.filter(row => {
        return Object.keys(row).some(k => {
          if (k.startsWith('_')) return false;
          const val = String(row[k] || '').toLowerCase();
          return val.includes(q);
        });
      });
    }

    // Sort by reportSortColumn
    if (this.reportSortColumn) {
      const col = this.reportSortColumn;
      const asc = this.reportSortAsc;
      records = [...records].sort((a, b) => {
        const valA = String(a[col] || '');
        const valB = String(b[col] || '');
        const cleanA = valA.replace(/[^0-9.-]+/g, '');
        const cleanB = valB.replace(/[^0-9.-]+/g, '');
        const numA = Number(cleanA);
        const numB = Number(cleanB);

        if (!isNaN(numA) && !isNaN(numB) && cleanA !== '' && cleanB !== '') {
          return asc ? numA - numB : numB - numA;
        }
        return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return records;
  }

  exportReportCsv(report: ReportBean | null) {
    if (!report) return;
    this.isExportingCsv = true;
    this.crmService.downloadReportCsv(report.id).subscribe({
      next: (blob) => {
        this.isExportingCsv = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (report.name || 'report').replace(/[^a-zA-Z0-9_-]/g, '_') + '.csv';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.isExportingCsv = false;
        alert('Failed to export CSV: ' + (err.error?.error || err.message));
      }
    });
  }

  onReportRowClick(record: Record<string, string>) {
    // If associated with an account, drill down into account tab
    if (record['_module'] === 'Accounts' && record['_id']) {
      const existingAccount = this.recentAccounts.find(a => a.id === record['_id']);
      if (existingAccount) {
        this.openAccountTab(existingAccount);
        this.closeReportViewerModal();
        return;
      }
      // If not in preloaded list, create stub bean and select
      const stubAccount: AccountBean = {
        id: record['_id'],
        name: record['ACCOUNT NAME'] || record['NAME'] || 'Account Record',
        industry: record['INDUSTRY'] || '',
        account_type: record['ACCOUNT TYPE'] || ''
      };
      this.openAccountTab(stubAccount);
      this.closeReportViewerModal();
      return;
    }

    // If Contact has account linkage or name
    const acctName = record['ACCOUNT NAME'] || record['ACCOUNT'];
    if (acctName) {
      const found = this.recentAccounts.find((a: AccountBean) => a.name.toLowerCase() === acctName.toLowerCase());
      if (found) {
        this.openAccountTab(found);
        this.closeReportViewerModal();
        return;
      }
    }
  }

  getReportNumericStats(): Array<{ label: string; sum: number; avg: number; count: number }> {
    if (!this.activeReportData || !this.activeReportData.records || this.activeReportData.records.length === 0) {
      return [];
    }
    const cols = this.activeReportData.columns;
    const records = this.filteredReportRecords;
    const stats: Array<{ label: string; sum: number; avg: number; count: number }> = [];

    cols.forEach(col => {
      const lower = col.label.toLowerCase();
      // Exclude text columns like names, emails, ids, and addresses
      if (lower.includes('name') || lower.includes('email') || lower.includes('id') || lower.includes('phone') || lower.includes('address') || lower.includes('title')) {
        return;
      }

      let numericCount = 0;
      let totalSum = 0;
      records.forEach(row => {
        const raw = (row[col.label] || '').trim();
        // Check if value is strictly a currency or decimal number
        const isNumeric = /^[$€£]?\s*-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(raw) || /^-?\d+(\.\d+)?$/.test(raw);
        if (isNumeric) {
          const clean = raw.replace(/[^0-9.-]+/g, '');
          const num = Number(clean);
          if (!isNaN(num) && clean !== '') {
            numericCount++;
            totalSum += num;
          }
        }
      });

      // If at least 40% of non-empty rows are numeric, consider it a numeric metric column
      if (numericCount > 0 && numericCount >= records.length * 0.4) {
        stats.push({
          label: col.label,
          sum: Math.round(totalSum * 100) / 100,
          avg: Math.round((totalSum / numericCount) * 100) / 100,
          count: numericCount
        });
      }
    });

    return stats;
  }

  getReportCategoryDistribution(): Array<{ label: string; count: number; percent: number }> {
    if (!this.activeReportData || !this.activeReportData.records || this.activeReportData.records.length === 0) {
      return [];
    }
    const records = this.filteredReportRecords;
    if (records.length === 0) return [];

    // Find first categorical column
    const candidateCol = this.activeReportData.columns.find(c => {
      const l = c.label.toLowerCase();
      return l.includes('type') || l.includes('status') || l.includes('industry') || l.includes('module') || l.includes('name');
    }) || this.activeReportData.columns[0];

    if (!candidateCol) return [];

    const counts: Record<string, number> = {};
    records.forEach(r => {
      const val = (r[candidateCol.label] || 'Unassigned').trim();
      counts[val] = (counts[val] || 0) + 1;
    });

    const entries = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return entries.map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / records.length) * 100)
    }));
  }

  formatReportCellValue(row: any, col: any): string {
    if (!row || !col) return '—';
    const val = row[col.label];
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'object') {
      return val.name || val.value || val.user_name || 'Administrator';
    }
    const str = String(val).trim();
    if (str === '[object Object]') {
      return 'Administrator';
    }
    return str;
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

  changePassword() {
    const username = sessionStorage.getItem('username') || (this.currentUserProfile ? this.currentUserProfile.user_name : '');
    if (!username) {
      this.passwordChangeError = 'Unable to identify active user session. Please re-login.';
      return;
    }

    if (!this.currentPasswordInput) {
      this.passwordChangeError = 'Please enter your current password.';
      return;
    }

    if (!this.newPasswordInput) {
      this.passwordChangeError = 'Please enter a new password.';
      return;
    }

    if (this.newPasswordInput.length < 6) {
      this.passwordChangeError = 'New password must be at least 6 characters long.';
      return;
    }

    if (this.newPasswordInput !== this.confirmPasswordInput) {
      this.passwordChangeError = 'New passwords do not match. Please verify.';
      return;
    }

    this.isChangingPassword = true;
    this.passwordChangeError = '';
    this.passwordChangeMessage = '';

    this.crmService.changePassword(username, this.currentPasswordInput, this.newPasswordInput).subscribe({
      next: (res) => {
        this.isChangingPassword = false;
        this.passwordChangeMessage = res.message || 'Password updated successfully!';
        this.currentPasswordInput = '';
        this.newPasswordInput = '';
        this.confirmPasswordInput = '';

        setTimeout(() => {
          this.passwordChangeMessage = '';
        }, 4000);
      },
      error: (err) => {
        this.isChangingPassword = false;
        if (err.status === 404) {
          this.passwordChangeError = 'Backend endpoint not found (404). Please restart redcliffe-start so the backend loads the new routes.';
        } else if (err.error?.error) {
          this.passwordChangeError = err.error.error;
        } else if (err.error?.message) {
          this.passwordChangeError = err.error.message;
        } else {
          this.passwordChangeError = 'Failed to update password. Please check your current password.';
        }
      }
    });
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const theme = this.isDarkMode ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    this.applyTheme();
    this.crmService.saveUserPreferences({ theme }).subscribe({
      error: (err) => console.warn('[Preferences] Failed to persist theme:', err)
    });
  }

  applyTheme() {
    const body = document.body;
    if (this.isDarkMode) {
      body.classList.remove('light-theme');
    } else {
      body.classList.add('light-theme');
    }
  }

  toggleCornerStyle() {
    this.isSquareCorners = !this.isSquareCorners;
    const feel = this.isSquareCorners ? 'square' : 'rounded';
    localStorage.setItem('redcliffe_corner_style', feel);
    localStorage.setItem('feel', feel);
    this.applyCornerStyle();

    this.crmService.saveUserPreferences({
      corner_style: feel,
      feel: feel
    }).subscribe({
      next: () => {
        console.log(`[Preferences] Corner style '${feel}' saved successfully.`);
      },
      error: (err) => {
        console.warn('[Preferences] Failed to persist corner style:', err);
      }
    });
  }

  applyCornerStyle() {
    const body = document.body;
    if (this.isSquareCorners) {
      body.classList.add('feel-square');
    } else {
      body.classList.remove('feel-square');
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

  // ==================== CENSUS IMPORT METHODS ====================

  onContactsDragOver(event: DragEvent) {
    event.preventDefault();
    this.contactsDragOver = true;
  }
  onIndividualsDragOver(event: DragEvent) {
    this.onContactsDragOver(event);
  }

  onContactsDragLeave(event: DragEvent) {
    event.preventDefault();
    this.contactsDragOver = false;
  }
  onIndividualsDragLeave(event: DragEvent) {
    this.onContactsDragLeave(event);
  }

  onContactsDrop(event: DragEvent) {
    event.preventDefault();
    this.contactsDragOver = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.addCensusFiles(Array.from(event.dataTransfer.files), 'contacts');
    }
  }
  onIndividualsDrop(event: DragEvent) {
    this.onContactsDrop(event);
  }

  onContactsFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.addCensusFiles(Array.from(input.files), 'contacts');
    }
  }
  onIndividualsFilesSelected(event: Event) {
    this.onContactsFilesSelected(event);
  }

  onCarriersDragOver(event: DragEvent) {
    event.preventDefault();
    this.carriersDragOver = true;
  }

  onCarriersDragLeave(event: DragEvent) {
    event.preventDefault();
    this.carriersDragOver = false;
  }

  onCarriersDrop(event: DragEvent) {
    event.preventDefault();
    this.carriersDragOver = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.addCensusFiles(Array.from(event.dataTransfer.files), 'carriers');
    }
  }

  onCarriersFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.addCensusFiles(Array.from(input.files), 'carriers');
    }
  }

  addCensusFiles(newFiles: File[], target: 'contacts' | 'individuals' | 'carriers') {
    const targetList = (target === 'contacts' || target === 'individuals') ? this.contactsCensusFiles : this.carriersCensusFiles;
    for (const f of newFiles) {
      if (!targetList.some(existing => existing.name === f.name && existing.size === f.size)) {
        targetList.push(f);
      }
    }
    const hasEnroll = targetList.some(f => f.name.toUpperCase().includes('ENROLL') || f.name.toUpperCase().includes('MANULIFE'));
    if (hasEnroll) {
      this.selectedCensusCarrier = 'ManuLife';
    }
  }

  removeCensusFile(index: number, target: 'contacts' | 'individuals' | 'carriers') {
    if (target === 'contacts' || target === 'individuals') {
      this.contactsCensusFiles.splice(index, 1);
    } else {
      this.carriersCensusFiles.splice(index, 1);
    }
  }

  clearCensusFiles(target: 'contacts' | 'individuals' | 'carriers') {
    if (target === 'contacts' || target === 'individuals') {
      this.contactsCensusFiles = [];
    } else {
      this.carriersCensusFiles = [];
    }
    this.censusImportResults = null;
    this.censusErrorMessage = '';
  }

  getCensusFileTag(fileName: string): { label: string; class: string } {
    const upper = fileName.toUpperCase();
    if (upper.endsWith('.XLSX') || upper.endsWith('.XLS') || upper.includes('MEMBERDETAIL')) {
      return { label: 'ManuLife Excel (65-Col)', class: 'tag-emp' };
    } else if (upper.includes('BILLINGPREMIUM') || upper.includes('GROUPSOURCE')) {
      return { label: 'GroupSource CSV (56-Col)', class: 'tag-emp' };
    } else if (upper.includes('EMP')) {
      return { label: 'CanadaLife EMP (40-Col)', class: 'tag-emp' };
    } else if (upper.includes('BFT')) {
      return { label: 'CanadaLife BFT (20-Col)', class: 'tag-bft' };
    } else if (upper.includes('BNC')) {
      return { label: 'CanadaLife BNC (14-Col)', class: 'tag-bnc' };
    }
    return { label: 'Census Data', class: 'tag-generic' };
  }

  startCensusImport(target: 'contacts' | 'individuals' | 'carriers') {
    const files = (target === 'contacts' || target === 'individuals') ? this.contactsCensusFiles : this.carriersCensusFiles;
    if (!files || files.length === 0) return;

    this.isUploadingCensus = true;
    this.censusUploadProgress = 15;
    this.censusImportResults = null;
    this.censusErrorMessage = '';

    const interval = setInterval(() => {
      if (this.censusUploadProgress < 85) {
        this.censusUploadProgress += 15;
      }
    }, 200);

    this.crmService.importCensusData(files, this.selectedCensusCarrier).subscribe({
      next: (result) => {
        clearInterval(interval);
        this.censusUploadProgress = 100;
        this.isUploadingCensus = false;
        this.censusImportResults = result;

        // Auto reload contacts
        this.loadContacts();

        // Also reload carriers
        this.loadCarriers();

        // Clear staged files on successful import so they don't linger
        this.contactsCensusFiles = [];
        this.carriersCensusFiles = [];
      },
      error: (err) => {
        clearInterval(interval);
        this.isUploadingCensus = false;
        this.censusErrorMessage = err.error?.error || err.message || 'Census import failed';
      }
    });
  }

  dismissCensusResults() {
    this.censusImportResults = null;
    this.censusErrorMessage = '';
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

  // ==================== COLUMN PREFERENCES METHODS ====================

  loadColumnPreferences() {
    // 1. Load from localStorage for immediate visual response
    const savedLocal = localStorage.getItem('redcliffe_account_columns');
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        if (parsed && typeof parsed === 'object') {
          this.selectedAccountColumns = { ...this.selectedAccountColumns, ...parsed };
        }
      } catch (_) {}
    }

    // 2. Fetch from backend user preferences (syncs across browsers/sessions)
    this.crmService.getUserPreferences().subscribe({
      next: (res) => {
        if (res && res.preferences) {
          if (res.preferences.account_columns) {
            this.selectedAccountColumns = {
              ...this.selectedAccountColumns,
              ...res.preferences.account_columns
            };
            localStorage.setItem('redcliffe_account_columns', JSON.stringify(this.selectedAccountColumns));
          }
          if (res.preferences.corner_style !== undefined || res.preferences.feel !== undefined) {
            const feel = res.preferences.corner_style || res.preferences.feel;
            this.isSquareCorners = feel === 'square';
            localStorage.setItem('redcliffe_corner_style', this.isSquareCorners ? 'square' : 'rounded');
            localStorage.setItem('feel', this.isSquareCorners ? 'square' : 'rounded');
            this.applyCornerStyle();
          }
          if (res.preferences.theme) {
            this.isDarkMode = res.preferences.theme !== 'light';
            localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
            this.applyTheme();
          }
          if (res.preferences.nav_order && Array.isArray(res.preferences.nav_order)) {
            this.applyNavOrder(res.preferences.nav_order);
            localStorage.setItem('redcliffe_nav_order', JSON.stringify(this.navButtons.map(b => b.id)));
          }
        }
      },
      error: (err) => {
        console.warn('Could not fetch user preferences:', err?.message || err);
      }
    });
  }

  openColumnPickerModal(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.tempAccountColumns = { ...this.selectedAccountColumns };
    this.showColumnPickerModal = true;
  }

  closeColumnPickerModal() {
    this.showColumnPickerModal = false;
  }

  toggleTempColumn(colId: string) {
    this.tempAccountColumns[colId] = !this.tempAccountColumns[colId];
  }

  resetColumnsToDefault() {
    const defaults: { [key: string]: boolean } = {};
    this.availableAccountColumns.forEach(c => {
      defaults[c.id] = c.default;
    });
    this.tempAccountColumns = defaults;
  }

  saveColumnPreferences() {
    this.selectedAccountColumns = { ...this.tempAccountColumns };
    localStorage.setItem('redcliffe_account_columns', JSON.stringify(this.selectedAccountColumns));
    
    this.crmService.saveUserPreferences({ account_columns: this.selectedAccountColumns }).subscribe({
      next: () => {
        console.log('[Preferences] Column preferences saved successfully.');
      },
      error: (err) => {
        console.error('[Preferences] Failed to save column preferences to backend:', err);
      }
    });

    this.closeColumnPickerModal();
  }

  isColumnVisible(colId: string): boolean {
    return this.selectedAccountColumns[colId] ?? false;
  }

  toggleSettingColumn(colId: string) {
    this.selectedAccountColumns[colId] = !this.selectedAccountColumns[colId];
    localStorage.setItem('redcliffe_account_columns', JSON.stringify(this.selectedAccountColumns));
    this.crmService.saveUserPreferences({ account_columns: this.selectedAccountColumns }).subscribe();
  }

  // ==================== CONFIGURABLE NAV BUTTONS METHODS ====================

  trackByNavId(index: number, item: NavButtonItem): string {
    return item.id;
  }

  isNavButtonActive(btnId: string): boolean {
    if (btnId === 'search') {
      return this.isGlobalSearchOpen;
    }
    if (btnId === 'contacts') {
      return this.activeView === 'contacts' || this.activeView === 'individuals';
    }
    return this.activeView === btnId;
  }

  onNavButtonClick(btn: NavButtonItem, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (this.preventNavClick || this.isNavDragging) return;
    if (btn.id === 'search') {
      if (this.isGlobalSearchOpen) {
        this.closeGlobalSearch(event);
      } else {
        this.openGlobalSearch(event);
      }
      return;
    }
    this.selectApp(btn.appName);
  }

  onNavPointerDown(event: PointerEvent, index: number, btn: NavButtonItem) {
    if (event.button !== 0) return; // Left mouse click only

    this.cleanupNavPointerListeners();
    this.pendingDragIndex = index;
    this.navPointerStartX = event.clientX;
    this.navPointerStartY = event.clientY;
    this.navPointerCurrentPos = { x: event.clientX, y: event.clientY };
    this.baseOffsetX = 0;

    window.addEventListener('pointermove', this.onWindowPointerMoveBound);
    window.addEventListener('pointerup', this.onWindowPointerUpBound);
    window.addEventListener('pointercancel', this.onWindowPointerUpBound);

    // 280ms hold threshold triggers the "lift up" state
    this.navHoldTimer = setTimeout(() => {
      this.startNavDrag(index, event.clientX);
    }, 280);
  }

  onWindowPointerMove(event: PointerEvent) {
    this.navPointerCurrentPos = { x: event.clientX, y: event.clientY };

    if (!this.isNavDragging) {
      if (this.pendingDragIndex === -1) return;
      const dist = Math.hypot(
        event.clientX - this.navPointerStartX,
        event.clientY - this.navPointerStartY
      );
      if (dist > 5) {
        clearTimeout(this.navHoldTimer);
        this.startNavDrag(this.pendingDragIndex, event.clientX);
      }
      return;
    }

    this.updateNavDrag(event);
  }

  startNavDrag(index: number, clientX: number) {
    if (this.isNavDragging || index < 0 || index >= this.navButtons.length) return;

    this.isNavDragging = true;
    this.draggedNavIndex = index;
    this.draggedNavId = this.navButtons[index].id;
    this.navPointerStartX = clientX;
    this.baseOffsetX = 0;
    this.originalNavOrderBeforeDrag = [...this.navButtons];

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    this.cdr.detectChanges();
    this.applyDraggedTransform(0);
  }

  updateNavDrag(event: PointerEvent) {
    if (!this.isNavDragging || this.draggedNavIndex === -1) return;

    const currentX = event.clientX;
    const currentDeltaX = (currentX - this.navPointerStartX) - this.baseOffsetX;
    this.applyDraggedTransform(currentDeltaX);

    const buttonEls = Array.from(document.querySelectorAll('.header-nav .btn-nav-icon')) as HTMLElement[];
    if (!buttonEls || buttonEls.length <= 1) return;

    const currentIndex = this.draggedNavIndex;

    // Moving right
    if (currentIndex < buttonEls.length - 1) {
      const nextEl = buttonEls[currentIndex + 1];
      const nextRect = nextEl.getBoundingClientRect();
      const nextCenter = nextRect.left + nextRect.width / 2;
      if (currentX > nextCenter) {
        this.reorderNavButtons(currentIndex, currentIndex + 1);
        return;
      }
    }

    // Moving left
    if (currentIndex > 0) {
      const prevEl = buttonEls[currentIndex - 1];
      const prevRect = prevEl.getBoundingClientRect();
      const prevCenter = prevRect.left + prevRect.width / 2;
      if (currentX < prevCenter) {
        this.reorderNavButtons(currentIndex, currentIndex - 1);
        return;
      }
    }
  }

  reorderNavButtons(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const buttonEls = Array.from(document.querySelectorAll('.header-nav .btn-nav-icon')) as HTMLElement[];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= buttonEls.length || toIndex >= buttonEls.length) return;

    // 1. Record old screen positions for all buttons
    const oldPositions = new Map<string, number>();
    this.navButtons.forEach((btn, idx) => {
      if (buttonEls[idx]) {
        oldPositions.set(btn.id, buttonEls[idx].getBoundingClientRect().left);
      }
    });

    const oldDraggedLeft = oldPositions.get(this.navButtons[fromIndex].id) || 0;

    // 2. Reorder in array
    const [movedItem] = this.navButtons.splice(fromIndex, 1);
    this.navButtons.splice(toIndex, 0, movedItem);
    this.draggedNavIndex = toIndex;

    // 3. Update DOM via change detection
    this.cdr.detectChanges();

    // 4. Measure new screen positions
    const newButtonEls = Array.from(document.querySelectorAll('.header-nav .btn-nav-icon')) as HTMLElement[];
    const newPositions = new Map<string, number>();
    this.navButtons.forEach((btn, idx) => {
      if (newButtonEls[idx]) {
        newPositions.set(btn.id, newButtonEls[idx].getBoundingClientRect().left);
      }
    });

    const newDraggedLeft = newPositions.get(movedItem.id) || 0;

    // 5. Compensate base offset so dragged element stays locked under cursor without jumping
    const slotShift = newDraggedLeft - oldDraggedLeft;
    this.baseOffsetX += slotShift;

    const currentDeltaX = (this.navPointerCurrentPos.x - this.navPointerStartX) - this.baseOffsetX;
    const draggedEl = newButtonEls[toIndex];
    if (draggedEl) {
      draggedEl.style.transform = `translateX(${currentDeltaX}px) translateY(-8px) scale(1.08)`;
      draggedEl.style.zIndex = '1000';
      draggedEl.style.transition = 'none';
    }

    // 6. Smooth FLIP animation on all shifted sibling buttons
    newButtonEls.forEach((el, idx) => {
      if (idx === toIndex) return; // Skip dragged element
      const btnId = this.navButtons[idx].id;
      const oldLeft = oldPositions.get(btnId);
      const newLeft = newPositions.get(btnId);

      if (oldLeft !== undefined && newLeft !== undefined) {
        const delta = oldLeft - newLeft;
        if (delta !== 0) {
          el.style.transform = `translateX(${delta}px)`;
          el.style.transition = 'none';

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
              el.style.transform = '';
              setTimeout(() => {
                el.style.transition = '';
              }, 230);
            });
          });
        }
      }
    });
  }

  applyDraggedTransform(deltaX: number) {
    const buttonEls = Array.from(document.querySelectorAll('.header-nav .btn-nav-icon')) as HTMLElement[];
    const draggedEl = buttonEls[this.draggedNavIndex];
    if (draggedEl) {
      draggedEl.style.transform = `translateX(${deltaX}px) translateY(-8px) scale(1.08)`;
      draggedEl.style.zIndex = '1000';
      draggedEl.style.boxShadow = '0 16px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.5)';
      draggedEl.style.borderColor = 'rgba(99, 102, 241, 0.9)';
      draggedEl.style.transition = 'none';
    }
  }

  onWindowPointerUp(event: PointerEvent) {
    clearTimeout(this.navHoldTimer);
    window.removeEventListener('pointermove', this.onWindowPointerMoveBound);
    window.removeEventListener('pointerup', this.onWindowPointerUpBound);
    window.removeEventListener('pointercancel', this.onWindowPointerUpBound);

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    if (this.isNavDragging) {
      this.preventNavClick = true;
      setTimeout(() => { this.preventNavClick = false; }, 200);

      const buttonEls = Array.from(document.querySelectorAll('.header-nav .btn-nav-icon')) as HTMLElement[];
      const droppedEl = buttonEls[this.draggedNavIndex];
      if (droppedEl) {
        droppedEl.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, border-color 0.2s ease';
        droppedEl.style.transform = 'translateX(0) translateY(0) scale(1)';
        droppedEl.style.boxShadow = '';
        droppedEl.style.borderColor = '';
        droppedEl.style.zIndex = '';

        setTimeout(() => {
          droppedEl.style.transition = '';
          droppedEl.style.transform = '';
        }, 220);
      }

      this.isNavDragging = false;
      this.draggedNavIndex = -1;
      this.draggedNavId = null;
      this.pendingDragIndex = -1;

      this.saveNavOrderPreferences();
    } else {
      this.pendingDragIndex = -1;
    }
  }

  @HostListener('window:keydown.escape')
  onEscapePress() {
    if (this.isGlobalSearchOpen) {
      this.closeGlobalSearch();
      return;
    }
    if (this.isNavDragging) {
      this.cancelNavDrag();
    }
  }

  cancelNavDrag() {
    clearTimeout(this.navHoldTimer);
    this.cleanupNavPointerListeners();

    if (this.isNavDragging) {
      this.preventNavClick = true;
      setTimeout(() => { this.preventNavClick = false; }, 200);

      if (this.originalNavOrderBeforeDrag.length > 0) {
        this.navButtons = [...this.originalNavOrderBeforeDrag];
        this.cdr.detectChanges();
      }

      const buttonEls = Array.from(document.querySelectorAll('.header-nav .btn-nav-icon')) as HTMLElement[];
      buttonEls.forEach(el => {
        el.style.transform = '';
        el.style.transition = '';
        el.style.boxShadow = '';
        el.style.borderColor = '';
        el.style.zIndex = '';
      });

      this.isNavDragging = false;
      this.draggedNavIndex = -1;
      this.draggedNavId = null;
      this.pendingDragIndex = -1;
    }
  }

  cleanupNavPointerListeners() {
    clearTimeout(this.navHoldTimer);
    window.removeEventListener('pointermove', this.onWindowPointerMoveBound);
    window.removeEventListener('pointerup', this.onWindowPointerUpBound);
    window.removeEventListener('pointercancel', this.onWindowPointerUpBound);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  saveNavOrderPreferences() {
    const order = this.navButtons.map(b => b.id);
    localStorage.setItem('redcliffe_nav_order', JSON.stringify(order));
    this.crmService.saveUserPreferences({ nav_order: order }).subscribe({
      next: () => {
        console.log('[Preferences] Nav order saved successfully:', order);
      },
      error: (err) => {
        console.warn('[Preferences] Failed to persist nav order:', err);
      }
    });
  }

  applyNavOrder(savedIds: string[]) {
    if (!Array.isArray(savedIds) || savedIds.length === 0) return;
    const buttonMap = new Map<string, NavButtonItem>();
    this.defaultNavButtons.forEach(b => buttonMap.set(b.id, b));

    const reordered: NavButtonItem[] = [];
    savedIds.forEach(id => {
      const normalizedId = id === 'individuals' ? 'contacts' : id;
      if (buttonMap.has(normalizedId)) {
        reordered.push(buttonMap.get(normalizedId)!);
        buttonMap.delete(normalizedId);
      }
    });

    buttonMap.forEach(b => reordered.push(b));
    this.navButtons = reordered;
  }

  // ==================== GLOBAL SEARCH METHODS ====================

  openGlobalSearch(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.isGlobalSearchOpen = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.globalSearchInputRef?.nativeElement) {
        this.globalSearchInputRef.nativeElement.focus();
        this.globalSearchInputRef.nativeElement.select();
      }
    }, 60);
  }

  closeGlobalSearch(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.isGlobalSearchOpen = false;
    this.globalSearchQuery = '';
    this.globalSearchResults = null;
    this.isGlobalSearching = false;
    clearTimeout(this.globalSearchDebounceTimer);
    this.cdr.detectChanges();
  }

  clearGlobalSearch(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.globalSearchQuery = '';
    this.globalSearchResults = null;
    this.isGlobalSearching = false;
    clearTimeout(this.globalSearchDebounceTimer);
    this.cdr.detectChanges();
    this.globalSearchInputRef?.nativeElement?.focus();
  }

  onGlobalSearchInput(val?: string) {
    clearTimeout(this.globalSearchDebounceTimer);
    const q = (this.globalSearchQuery || '').trim();
    if (!q) {
      this.globalSearchResults = null;
      this.isGlobalSearching = false;
      return;
    }
    this.isGlobalSearching = true;
    this.globalSearchDebounceTimer = setTimeout(() => {
      this.crmService.globalSearch(q).subscribe({
        next: (res) => {
          this.globalSearchResults = res;
          this.isGlobalSearching = false;
        },
        error: (err) => {
          console.error('Global search error:', err);
          this.isGlobalSearching = false;
        }
      });
    }, 180);
  }

  onGlobalSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeGlobalSearch();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.globalSearchResults && this.globalSearchResults.categories?.length > 0) {
        const firstCat = this.globalSearchResults.categories[0];
        if (firstCat.items?.length > 0) {
          this.selectSearchResult(firstCat.items[0]);
        }
      }
    }
  }

  selectSearchResult(item: any) {
    if (!item) return;
    this.closeGlobalSearch();

    switch (item.type) {
      case 'account':
        this.openAccountTabById(item.id, item.title);
        break;

      case 'contact':
        this.openContactTabById(item.id);
        break;

      case 'carrier':
        this.selectApp('Carriers');
        this.carriersSearchQuery = item.title;
        break;

      case 'census': {
        const matchContact = this.contactsList.find(c =>
          (item.data?.employee_name && c.name?.toLowerCase() === item.data.employee_name.toLowerCase()) ||
          (item.data?.certificate_number && c.notes?.includes(item.data.certificate_number))
        );
        if (matchContact) {
          this.openContactTabById(matchContact.id);
        } else if (item.data?.carrier) {
          this.openCensusRosterModal(item.data.carrier);
        }
        break;
      }

      case 'meeting':
        this.openMeetingTabById(item.id);
        break;

      case 'report':
        this.selectApp('Reports');
        const rep = this.reportsList.find(r => r.id === item.id);
        if (rep) {
          this.runReport(rep);
        }
        break;
    }
  }
}
