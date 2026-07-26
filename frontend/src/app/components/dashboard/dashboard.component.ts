import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CrmService, AccountBean, ImportResults } from '../../services/crm.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
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
