import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-team-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-attendance.html',
  styleUrls: ['./team-attendance.css']
})
export class TeamAttendanceComponent implements OnInit {
  user: any = null;
  agents: any[] = [];
  selectedAgentId: number | null = null;
  agentSearchQuery = '';
  year: number;
  months: any[] = [];
  totals = { present: 0, absent: 0, tardy: 0 };
  loading = true;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.year = new Date().getFullYear();
  }

  get filteredAgents(): any[] {
    const q = this.agentSearchQuery.toLowerCase().trim();
    if (!q) return this.agents;
    return this.agents.filter(a =>
      (a.agent_nom || '').toLowerCase().includes(q)
    );
  }

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.loadAgents();
    });
  }

  loadAgents() {
    this.http.get<any[]>(`${environment.apiUrl}/presences/agents`).subscribe({
      next: list => {
        this.agents = list || [];
        this.loading = false;
        this.loadYear();
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadYear() {
    const params = this.selectedAgentId ? `?agent_id=${this.selectedAgentId}` : '';
    this.http.get<any>(`${environment.apiUrl}/presences/yearly/${this.year}${params}`).subscribe({
      next: d => {
        this.months = d.months || [];
        this.totals = d.totals || { present: 0, absent: 0, tardy: 0 };
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  selectAgent(id: number | null) {
    this.selectedAgentId = id;
    this.loadYear();
  }

  get monthNames() {
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  }
}