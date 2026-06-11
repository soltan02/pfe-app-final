import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AgentsService } from '../../../services/agents';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-agent-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ReactiveFormsModule],
  templateUrl: './agent-list.html',
  styleUrls: ['./agent-list.css']
})
export class AgentListComponent implements OnInit {
  agents: any[] = [];
  loading = true;
  error = '';
  searchQuery = '';
  selectedAgentId: number | null = null;
  passwordForm: FormGroup;
  pwdMessage = '';
  pwdError = '';

  constructor(
    private agentsService: AgentsService,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  ngOnInit() { this.load(); }

  get filteredAgents(): any[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.agents;
    return this.agents.filter(a =>
      (a.nom || '').toLowerCase().includes(q) ||
      (a.prenom || '').toLowerCase().includes(q) ||
      (a.matricule || '').toLowerCase().includes(q) ||
      (a.telephone || '').includes(q) ||
      (a.site_nom || '').toLowerCase().includes(q)
    );
  }

  load() {
    this.loading = true;
    this.agentsService.getAll().subscribe({
      next: (data) => {
        this.agents = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Loading error'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  delete(id: number) {
    if (!confirm('Delete this agent?')) return;
    this.agentsService.delete(id).subscribe({
      next: () => this.load(),
      error: () => alert('Error during deletion')
    });
  }

  openPasswordModal(agentId: number) {
    this.selectedAgentId = agentId;
    this.passwordForm.reset();
    this.pwdMessage = '';
    this.pwdError = '';
    this.cdr.detectChanges();
  }

  closeModal() {
    this.selectedAgentId = null;
    this.cdr.detectChanges();
  }

  changePassword() {
    if (this.passwordForm.invalid) return;
    this.http.put(
      `${environment.apiUrl}/auth/change-password-agent/${this.selectedAgentId}`,
      { newPassword: this.passwordForm.value.newPassword }
    ).subscribe({
      next: () => {
        this.pwdMessage = 'Password changed successfully!';
        this.pwdError = '';
        this.passwordForm.reset();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.pwdError = e.error?.error || 'Error';
        this.pwdMessage = '';
        this.cdr.detectChanges();
      }
    });
  }
}