import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-analytics.html',
  styleUrls: ['./admin-analytics.css']
})
export class AdminAnalyticsComponent implements OnInit, AfterViewChecked {
  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('absenteeismBarCanvas') absenteeismBarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('workloadBarCanvas') workloadBarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('incidentsCanvas') incidentsCanvas!: ElementRef<HTMLCanvasElement>;

  user: any = null;
  analytics = {
    totalAgents: 0, totalSites: 0, totalAffectations: 0,
    completedAffectations: 0, activeAffectations: 0,
    averageAssignmentDuration: 0, systemUptime: '99.9%', lastUpdated: new Date()
  };
  reportsData: any[] = [];
  rapportsData: any[] = [];
  rapportStats: any = {};
  rapportPerChef: any[] = [];
  rapportPerSite: any[] = [];
  loading = true;
  selectedMetric = 'overview';

  // Big Data analytics
  bdSummary: any = {};
  bdAttendanceTrend: any[] = [];
  bdAbsenteeism: any[] = [];
  bdIncidents: any[] = [];
  bdAgentWorkload: any[] = [];
  bdCoverage: any[] = [];
  bdForecast: any[] = [];
  bdLoading = true;
  bdGenerating = false;
  bdGenMessage = '';

  private trendDrawn = false;
  private absenteeismBarDrawn = false;
  private workloadBarDrawn = false;
  private incidentsBarDrawn = false;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.loadAll();
      this.cdr.detectChanges();
    });
  }

  ngAfterViewChecked() {
    if (this.bdAttendanceTrend.length > 0 && !this.trendDrawn) {
      this.drawTrendChart();
    }
    if (this.bdAbsenteeism.length > 0 && !this.absenteeismBarDrawn) {
      this.drawAbsenteeismBars();
    }
    if (this.bdAgentWorkload.length > 0 && !this.workloadBarDrawn) {
      this.drawWorkloadBars();
    }
    if (this.bdIncidents.length > 0 && !this.incidentsBarDrawn) {
      this.drawIncidentsChart();
    }
  }

  private loadAll() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/dashboard/stats`).subscribe(s => {
      this.analytics.totalAgents = s?.agents ?? 0;
      this.analytics.totalSites = s?.sites ?? 0;
      this.analytics.totalAffectations = s?.affectations ?? 0;
      this.analytics.lastUpdated = new Date();
      this.cdr.detectChanges();
    });
    this.http.get<any[]>(`${environment.apiUrl}/affectations`).subscribe(list => {
      this.reportsData = list || [];
      this.analytics.totalAffectations = list?.length ?? 0;
      this.analytics.completedAffectations = (list || []).filter(a => a.statut === 'completed' || a.statut === 'termine').length;
      this.analytics.activeAffectations = (list || []).filter(a => a.statut === 'active' || a.statut === 'en cours').length;
      this.cdr.detectChanges();
    });
    this.http.get<any>(`${environment.apiUrl}/rapports/admin/full-report`).subscribe(data => {
      this.rapportsData = data?.rapports || [];
      this.rapportStats = data?.stats || {};
      this.rapportPerChef = data?.perChef || [];
      this.rapportPerSite = data?.perSite || [];
      this.loading = false;
      this.cdr.detectChanges();
    });
    this.loadBigDataAnalytics();
  }

  private loadBigDataAnalytics() {
    this.bdLoading = true;
    const base = `${environment.apiUrl}/analytics`;
    this.http.get<any>(`${base}/summary`).subscribe({
      next: d => { this.bdSummary = d; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/attendance-trend`).subscribe({
      next: d => { this.bdAttendanceTrend = d || []; this.trendDrawn = false; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/absenteeism-by-branch`).subscribe({
      next: d => { this.bdAbsenteeism = d || []; this.absenteeismBarDrawn = false; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/incidents-monthly`).subscribe({
      next: d => { this.bdIncidents = d || []; this.incidentsBarDrawn = false; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/agent-workload?limit=10&order=asc`).subscribe({
      next: d => { this.bdAgentWorkload = d || []; this.workloadBarDrawn = false; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/coverage`).subscribe({
      next: d => { this.bdCoverage = d || []; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/forecast-absenteeism`).subscribe({
      next: d => { this.bdForecast = d || []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  generateBigData() {
    if (this.bdGenerating) return;
    this.bdGenerating = true;
    this.bdGenMessage = 'Generating Big Data... This may take a few minutes.';
    this.http.post<any>(`${environment.apiUrl}/analytics/generate`, {}).subscribe({
      next: (res) => {
        this.bdGenMessage = res.message + ' Reloading analytics...';
        // Reset all draw flags so charts re-render
        this.trendDrawn = false;
        this.absenteeismBarDrawn = false;
        this.workloadBarDrawn = false;
        this.incidentsBarDrawn = false;
        this.loadAll();
        this.bdGenerating = false;
        setTimeout(() => { this.bdGenMessage = ''; }, 5000);
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.bdGenMessage = 'Error: ' + (e.error?.error || e.message);
        this.bdGenerating = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Detailed Analytics Tab Helpers ──
  get completionRate(): number {
    return this.analytics.totalAffectations
      ? Math.round((this.analytics.completedAffectations / this.analytics.totalAffectations) * 100)
      : 0;
  }

  get activeRate(): number {
    return this.analytics.totalAffectations
      ? Math.round((this.analytics.activeAffectations / this.analytics.totalAffectations) * 100)
      : 0;
  }

  selectMetric(metric: string) {
    this.selectedMetric = metric;
    this.cdr.detectChanges();
  }

  statusColor(statut: string): string {
    if (statut === 'pending') return '#fbbf24';
    if (statut === 'approved') return '#10b981';
    return '#ef4444';
  }

  typeLabel(type: string): string {
    const map: any = { 'incident': '⚠️ Incident', 'absence': '❌ Absence', 'sante': '🏥 Health Issue', 'autre': '📝 Other' };
    return map[type] || type;
  }

  forecastSlopeLabel(slope: number): string {
    if (slope > 0.5) return '🔴 Rising';
    if (slope < -0.5) return '🟢 Falling';
    return '🟡 Stable';
  }

  // ══════════════════════════════════════════════════════════════
  //  CANVAS CHART DRAWING METHODS
  // ══════════════════════════════════════════════════════════════

  // ── 1. Attendance Trend (existing, improved) ──
  drawTrendChart() {
    if (!this.trendCanvas || this.bdAttendanceTrend.length === 0) return;
    this.trendDrawn = true;
    const canvas = this.trendCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width = canvas.parentElement!.clientWidth || 700;
    const H = canvas.height = 220;
    const pad = { top: 20, right: 20, bottom: 35, left: 45 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const data = this.bdAttendanceTrend;
    const rates = data.map(d => parseFloat(d.attendance_rate) || 0);
    const maxRate = Math.max(...rates, 100);
    const minRate = Math.min(...rates, 80);
    const range = maxRate - minRate || 10;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }

    // Area fill gradient
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    grad.addColorStop(0, 'rgba(59,130,246,0.2)');
    grad.addColorStop(1, 'rgba(59,130,246,0.02)');

    // Build points
    const points = data.map((d, i) => ({
      x: pad.left + (plotW / (data.length - 1 || 1)) * i,
      y: pad.top + plotH - ((parseFloat(d.attendance_rate) || 0) - minRate) / range * plotH
    }));

    // Fill area
    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.top + plotH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Data dots
    ctx.fillStyle = '#3b82f6';
    points.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
    });

    // X labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      const x = pad.left + (plotW / (data.length - 1 || 1)) * i;
      ctx.fillText(d.month?.slice(0, 7) || '', x, H - 8);
    });

    // Y labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      const val = maxRate - (i / 4) * range;
      ctx.fillText(val.toFixed(1) + '%', pad.left - 8, y + 3);
    }

    // Annotation
    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Attendance rate over time (area fill)', pad.left, H - 2);
  }

  // ── 2. Absenteeism by Branch — Horizontal Bar Chart ──
  drawAbsenteeismBars() {
    if (!this.absenteeismBarCanvas || this.bdAbsenteeism.length === 0) return;
    this.absenteeismBarDrawn = true;
    const canvas = this.absenteeismBarCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = this.bdAbsenteeism.slice(0, 15); // top 15 branches
    const W = canvas.width = canvas.parentElement!.clientWidth || 700;
    const barH = 20;
    const gap = 4;
    const labelW = 130;
    const H = data.length * (barH + gap) + 40;
    canvas.height = H;

    const maxVal = Math.max(...data.map(d => parseFloat(d.absence_rate) || 0), 1);
    const plotW = W - labelW - 60;

    ctx.clearRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Absence % by Branch (top 15)', 10, 16);

    data.forEach((d, i) => {
      const y = 30 + i * (barH + gap);
      const rate = parseFloat(d.absence_rate) || 0;
      const barW = (rate / maxVal) * plotW;

      // Label
      ctx.fillStyle = '#334155';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      const label = d.site_nom?.length > 16 ? d.site_nom.slice(0, 15) + '…' : (d.site_nom || '');
      ctx.fillText(label, labelW - 5, y + barH - 4);

      // Bar with color coding
      const color = rate > 5 ? '#ef4444' : rate > 3 ? '#fbbf24' : '#10b981';
      ctx.fillStyle = color;
      ctx.beginPath();
      const r = 3;
      ctx.moveTo(labelW + r, y);
      ctx.lineTo(labelW + barW, y);
      ctx.lineTo(labelW + barW, y + barH - r);
      ctx.quadraticCurveTo(labelW + barW, y + barH, labelW + barW - r, y + barH);
      ctx.lineTo(labelW + r, y + barH);
      ctx.quadraticCurveTo(labelW, y + barH, labelW, y + barH - r);
      ctx.lineTo(labelW, y + r);
      ctx.quadraticCurveTo(labelW, y, labelW + r, y);
      ctx.fill();

      // Value label
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(rate.toFixed(1) + '%', labelW + barW + 6, y + barH - 4);

      // City label (small)
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(d.site_ville || '', labelW + barW + 6, y + barH + 10);
    });
  }

  // ── 3. Agent Workload — Attendance Comparison Bars ──
  drawWorkloadBars() {
    if (!this.workloadBarCanvas || this.bdAgentWorkload.length === 0) return;
    this.workloadBarDrawn = true;
    const canvas = this.workloadBarCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = this.bdAgentWorkload.slice(0, 10);
    const W = canvas.width = canvas.parentElement!.clientWidth || 700;
    const barH = 18;
    const gap = 5;
    const labelW = 140;
    const H = data.length * (barH + gap) + 40;
    canvas.height = H;

    const maxDays = Math.max(...data.map(d => d.total_presence_days || 0), 1);

    ctx.clearRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Agent Attendance — Lowest Rates (present / absent / late)', 10, 16);

    // Legend
    ctx.font = '10px sans-serif';
    const legend = [
      { label: 'Present', color: '#10b981', x: 10 },
      { label: 'Absent', color: '#ef4444', x: 80 },
      { label: 'Late', color: '#fbbf24', x: 150 },
    ];
    legend.forEach(l => {
      ctx.fillStyle = l.color;
      ctx.fillRect(l.x, 22, 10, 10);
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText(l.label, l.x + 14, 31);
    });

    data.forEach((a, i) => {
      const y = 40 + i * (barH + gap);
      const total = a.total_presence_days || 1;
      const presentW = ((a.present_days || 0) / total) * (W - labelW - 60);
      const absentW = ((a.absent_days || 0) / total) * (W - labelW - 60);
      const lateW = ((a.late_days || 0) / total) * (W - labelW - 60);

      // Agent label
      ctx.fillStyle = '#334155';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      const name = (a.agent_nom + ' ' + a.agent_prenom)?.trim();
      const label = name.length > 18 ? name.slice(0, 17) + '…' : (name || a.matricule || '');
      ctx.fillText(label, labelW - 5, y + barH - 4);

      // Stacked bar: present
      if (presentW > 1) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(labelW, y, presentW, barH);
      }
      // Absent
      if (absentW > 1) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(labelW + presentW, y, absentW, barH);
      }
      // Late
      if (lateW > 1) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(labelW + presentW + absentW, y, lateW, barH);
      }

      // Attendance rate label
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(a.attendance_rate + '%', labelW + (W - labelW - 60) + 6, y + barH - 4);
    });
  }

  // ── 4. Incidents Monthly — Multi-line Chart ──
  drawIncidentsChart() {
    if (!this.incidentsCanvas || this.bdIncidents.length === 0) return;
    this.incidentsBarDrawn = true;
    const canvas = this.incidentsCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Group incidents by type over months
    const groups: { [key: string]: { month: string; total: number }[] } = {};
    this.bdIncidents.forEach((inc: any) => {
      if (!groups[inc.incident_type]) groups[inc.incident_type] = [];
      groups[inc.incident_type].push({ month: inc.month, total: parseInt(inc.total) || 0 });
    });

    const typeLabels: { [key: string]: string } = {
      'incident': 'Incidents',
      'absence': 'Absences',
      'sante': 'Health',
      'autre': 'Other'
    };
    const typeColors: { [key: string]: string } = {
      'incident': '#ef4444',
      'absence': '#f59e0b',
      'sante': '#10b981',
      'autre': '#6366f1'
    };

    // Collect all months sorted
    const allMonths = [...new Set(this.bdIncidents.map((d: any) => d.month))].sort();
    if (allMonths.length === 0) return;

    const W = canvas.width = canvas.parentElement!.clientWidth || 700;
    const H = canvas.height = 240;
    const pad = { top: 30, right: 20, bottom: 35, left: 45 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Find max total across all groups
    let maxTotal = 1;
    Object.values(groups).forEach(pts => {
      pts.forEach(p => { if (p.total > maxTotal) maxTotal = p.total; });
    });

    ctx.clearRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Monthly Incidents by Type', 10, 16);

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }

    // Draw line for each type
    const types = Object.keys(groups);
    types.forEach(type => {
      const pts = groups[type];
      const color = typeColors[type] || '#6366f1';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      pts.forEach((p, i) => {
        const monthIdx = allMonths.indexOf(p.month);
        if (monthIdx === -1) return;
        const x = pad.left + (plotW / (allMonths.length - 1 || 1)) * monthIdx;
        const y = pad.top + plotH - (p.total / maxTotal) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Data dots
      ctx.fillStyle = color;
      pts.forEach(p => {
        const monthIdx = allMonths.indexOf(p.month);
        if (monthIdx === -1) return;
        const x = pad.left + (plotW / (allMonths.length - 1 || 1)) * monthIdx;
        const y = pad.top + plotH - (p.total / maxTotal) * plotH;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });
    });

    // X labels (show every 3rd month to avoid crowding)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    allMonths.forEach((m, i) => {
      if (i % 3 !== 0 && i !== allMonths.length - 1) return;
      const x = pad.left + (plotW / (allMonths.length - 1 || 1)) * i;
      ctx.fillText(m.slice(0, 7), x, H - 8);
    });

    // Y labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.fillText(Math.round((1 - i / 4) * maxTotal).toString(), pad.left - 8, y + 3);
    }

    // Legend
    ctx.textAlign = 'left';
    let lx = 10;
    types.forEach(type => {
      const color = typeColors[type] || '#6366f1';
      ctx.fillStyle = color;
      ctx.fillRect(lx, pad.top - 14, 10, 10);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(typeLabels[type] || type, lx + 14, pad.top - 5);
      lx += ctx.measureText(typeLabels[type] || type).width + 30;
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  CSV EXPORT HELPERS
  // ══════════════════════════════════════════════════════════════

  private bdSummaryCsvRows(): string[] {
    const s = this.bdSummary;
    return [
      '', 'BIG DATA — SUMMARY',
      `Total Agents,${s.total_agents || 0}`,
      `Total Sites,${s.total_sites || 0}`,
      `Total Presences,${s.total_presences || 0}`,
      `Total Reports,${s.total_rapports || 0}`,
      `Avg Attendance Rate,${s.avg_attendance_rate || 0}%`,
    ];
  }

  private bdTrendCsvRows(): string[] {
    if (!this.bdAttendanceTrend.length) return [];
    const rows = this.bdAttendanceTrend.map((m: any) =>
      `${m.month},${m.total},${m.present},${m.late},${m.absent},${m.on_leave},${m.attendance_rate}%`
    );
    return ['', 'ATTENDANCE TREND (monthly)', 'Month,Total,Present,Late,Absent,On Leave,Rate', ...rows];
  }

  private bdAbsenteeismCsvRows(): string[] {
    if (!this.bdAbsenteeism.length) return [];
    const rows = this.bdAbsenteeism.map((b: any) =>
      `${b.site_nom},${b.site_ville},${b.total_records},${b.total_absences},${b.absence_rate}%,${b.tardiness_rate}%`
    );
    return ['', 'ABSENTEEISM BY BRANCH (last 12 months)', 'Branch,City,Records,Absences,Absence %,Tardiness %', ...rows];
  }

  private bdWorkloadCsvRows(): string[] {
    if (!this.bdAgentWorkload.length) return [];
    const rows = this.bdAgentWorkload.map((a: any) =>
      `${a.agent_nom} ${a.agent_prenom},${a.matricule},${a.agent_status},${a.present_days},${a.absent_days},${a.late_days},${a.attendance_rate}%,${a.total_reports}`
    );
    return ['', 'LOWEST ATTENDANCE AGENTS', 'Agent,ID,Status,Present,Absent,Late,Attendance,Reports', ...rows];
  }

  private bdCoverageCsvRows(): string[] {
    if (!this.bdCoverage.length) return [];
    const rows = this.bdCoverage.map((c: any) =>
      `${c.site_nom},${c.site_ville},${c.total_agents_ever},${c.current_agents},${c.total_assignments},${c.total_reports},${c.total_incidents}`
    );
    return ['', 'SITE COVERAGE', 'Site,City,Total Agents,Current,Assignments,Reports,Incidents', ...rows];
  }

  private bdForecastCsvRows(): string[] {
    if (!this.bdForecast.length) return [];
    const rows = this.bdForecast.map((f: any) =>
      `${f.site_nom},${f.site_ville},${f.n_months},${f.avg_absence_rate}%,${f.slope},${f.intercept},${f.r_squared}`
    );
    return ['', 'ABSENTEEISM FORECAST (regression)', 'Branch,City,Months,Avg Absence %,Slope,Intercept,R²', ...rows];
  }

  // ══════════════════════════════════════════════════════════════
  //  EXPORT METHODS
  // ══════════════════════════════════════════════════════════════

  exportCSV() {
    const headers = ['ID', 'Date', 'Type', 'Agent', 'Site', 'Reported By', 'Chef Site', 'Status', 'Details'];
    const rows = this.rapportsData.map((r: any) => [
      r.id, r.date, r.type, r.agent_nom || '', r.site_nom || '',
      r.chef_nom || 'Unknown', r.chef_site_nom || '', r.statut,
      `"${(r.contenu || '').replace(/"/g, '""')}"`
    ].join(','));
    const csv = [headers.join(','), ...rows, ...this.bdSummaryCsvRows(), ...this.bdTrendCsvRows(), ...this.bdAbsenteeismCsvRows(), ...this.bdWorkloadCsvRows(), ...this.bdCoverageCsvRows(), ...this.bdForecastCsvRows()].join('\n');
    this.downloadFile(csv, 'admin-report.csv', 'text/csv;charset=utf-8;');
  }

  exportExcel() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${this.excelSummarySheet()}
${this.excelPerChefSheet()}
${this.excelPerSiteSheet()}
${this.excelAllReportsSheet()}
${this.excelBdSummarySheet()}
${this.excelBdTrendSheet()}
${this.excelBdAbsenteeismSheet()}
${this.excelBdWorkloadSheet()}
${this.excelBdCoverageSheet()}
${this.excelBdForecastSheet()}
</Workbook>`;
    this.downloadFile(xml, 'admin-report.xls', 'application/vnd.ms-excel');
  }

  exportFullCSV() {
    const s = this.rapportStats;
    const lines = [
      'ADMIN REPORT', `Generated,${new Date().toLocaleString()}`, '', 'SUMMARY',
      `Total Reports,${s.total_reports || 0}`, `Pending,${s.pending_reports || 0}`,
      `Approved,${s.approved_reports || 0}`, `Incidents,${s.incidents || 0}`,
      `Absences,${s.absences || 0}`, `Health Issues,${s.health_issues || 0}`,
      `Other,${s.other_reports || 0}`, '', 'REPORTS PER CHEF', 'Chef Name,Report Count',
      ...this.rapportPerChef.map(c => `"${c.chef_nom || 'Unknown'}",${c.report_count}`),
      '', 'REPORTS PER SITE', 'Site Name,Report Count',
      ...this.rapportPerSite.map(s => `"${s.site_nom || 'Unassigned'}",${s.report_count}`),
      '', 'ALL REPORTS', 'ID,Date,Type,Agent,Site,Reported By,Chef Site,Status,Details',
      ...this.rapportsData.map(r => [
        r.id, r.date, r.type, r.agent_nom || '', r.site_nom || '',
        r.chef_nom || 'Unknown', r.chef_site_nom || '', r.statut,
        `"${(r.contenu || '').replace(/"/g, '""')}"`
      ].join(',')),
      ...this.bdSummaryCsvRows(),
      ...this.bdTrendCsvRows(),
      ...this.bdAbsenteeismCsvRows(),
      ...this.bdWorkloadCsvRows(),
      ...this.bdCoverageCsvRows(),
      ...this.bdForecastCsvRows(),
    ];
    this.downloadFile(lines.join('\n'), 'full-admin-report.csv', 'text/csv;charset=utf-8;');
  }

  exportPrint() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(this.buildPrintHtml());
    win.document.close();
    win.print();
  }

  private downloadFile(content: string, fileName: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // ── Excel sheets ──
  private excelSummarySheet(): string {
    const s = this.rapportStats;
    const row = (label: string, v: any) => `<Row><Cell><Data ss:Type="String">${label}</Data></Cell><Cell><Data ss:Type="Number">${v || 0}</Data></Cell></Row>`;
    return `<Worksheet ss:Name="Summary"><Table>
<Row><Cell><Data ss:Type="String">Admin Report - ${new Date().toLocaleString()}</Data></Cell></Row>
<Row></Row>
${row('Total Reports', s.total_reports)}${row('Pending', s.pending_reports)}${row('Approved', s.approved_reports)}
${row('Incidents', s.incidents)}${row('Absences', s.absences)}${row('Health Issues', s.health_issues)}${row('Other', s.other_reports)}
</Table></Worksheet>`;
  }

  private excelPerChefSheet(): string {
    const rows = this.rapportPerChef.map(c =>
      `<Row><Cell><Data ss:Type="String">${c.chef_nom || 'Unknown'}</Data></Cell><Cell><Data ss:Type="Number">${c.report_count}</Data></Cell></Row>`
    ).join('');
    return `<Worksheet ss:Name="Reports Per Chef"><Table><Row><Cell><Data ss:Type="String">Chef Name</Data></Cell><Cell><Data ss:Type="String">Report Count</Data></Cell></Row>${rows}</Table></Worksheet>`;
  }

  private excelPerSiteSheet(): string {
    const rows = this.rapportPerSite.map(s =>
      `<Row><Cell><Data ss:Type="String">${s.site_nom || 'Unassigned'}</Data></Cell><Cell><Data ss:Type="Number">${s.report_count}</Data></Cell></Row>`
    ).join('');
    return `<Worksheet ss:Name="Reports Per Site"><Table><Row><Cell><Data ss:Type="String">Site Name</Data></Cell><Cell><Data ss:Type="String">Report Count</Data></Cell></Row>${rows}</Table></Worksheet>`;
  }

  private excelAllReportsSheet(): string {
    const headerCells = ['ID', 'Date', 'Type', 'Agent', 'Site', 'Reported By', 'Chef Site', 'Status', 'Details'];
    const cell = (v: any, t: string) => `<Cell><Data ss:Type="${t}">${v}</Data></Cell>`;
    const str = (v: any) => cell(String(v || ''), 'String');
    const num = (v: any) => cell(v || 0, 'Number');
    return `<Worksheet ss:Name="All Reports"><Table>
<Row>${headerCells.map(h => str(h)).join('')}</Row>
${this.rapportsData.map(rpt => `<Row>${num(rpt.id)}${str(rpt.date)}${str(rpt.type)}${str(rpt.agent_nom)}${str(rpt.site_nom)}${str(rpt.chef_nom)}${str(rpt.chef_site_nom)}${str(rpt.statut)}${str((rpt.contenu || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'))}</Row>`).join('')}
</Table></Worksheet>`;
  }

  private excelBdSummarySheet(): string {
    const s = this.bdSummary;
    const r = (label: string, v: any) => `<Row><Cell><Data ss:Type="String">${label}</Data></Cell><Cell><Data ss:Type="Number">${v || 0}</Data></Cell></Row>`;
    return `<Worksheet ss:Name="BD Summary"><Table>
<Row><Cell><Data ss:Type="String">Big Data Summary</Data></Cell></Row><Row></Row>
${r('Total Agents', s.total_agents)}${r('Total Sites', s.total_sites)}${r('Total Presences', s.total_presences)}
${r('Total Reports', s.total_rapports)}<Row><Cell><Data ss:Type="String">Avg Attendance Rate</Data></Cell><Cell><Data ss:Type="String">${s.avg_attendance_rate || 0}%</Data></Cell></Row>
</Table></Worksheet>`;
  }

  private excelBdTrendSheet(): string {
    if (!this.bdAttendanceTrend.length) return '';
    const h = ['Month', 'Total', 'Present', 'Late', 'Absent', 'On Leave', 'Rate'];
    return `<Worksheet ss:Name="BD Attendance Trend"><Table>
<Row>${h.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
${this.bdAttendanceTrend.map((m: any) => `<Row>${[m.month, m.total, m.present, m.late, m.absent, m.on_leave, m.attendance_rate + '%'].map(v => `<Cell><Data ss:Type="String">${v}</Data></Cell>`).join('')}</Row>`).join('')}
</Table></Worksheet>`;
  }

  private excelBdAbsenteeismSheet(): string {
    if (!this.bdAbsenteeism.length) return '';
    const h = ['Branch', 'City', 'Records', 'Absences', 'Absence %', 'Tardiness %'];
    return `<Worksheet ss:Name="BD Absenteeism"><Table>
<Row>${h.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
${this.bdAbsenteeism.map((b: any) => `<Row>${[b.site_nom, b.site_ville, b.total_records, b.total_absences, b.absence_rate + '%', b.tardiness_rate + '%'].map(v => `<Cell><Data ss:Type="String">${v}</Data></Cell>`).join('')}</Row>`).join('')}
</Table></Worksheet>`;
  }

  private excelBdWorkloadSheet(): string {
    if (!this.bdAgentWorkload.length) return '';
    const h = ['Agent', 'ID', 'Status', 'Present', 'Absent', 'Late', 'Attendance', 'Reports'];
    return `<Worksheet ss:Name="BD Agent Workload"><Table>
<Row>${h.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
${this.bdAgentWorkload.map((a: any) => `<Row>${[a.agent_nom + ' ' + a.agent_prenom, a.matricule, a.agent_status, a.present_days, a.absent_days, a.late_days, a.attendance_rate + '%', a.total_reports].map(v => `<Cell><Data ss:Type="String">${v}</Data></Cell>`).join('')}</Row>`).join('')}
</Table></Worksheet>`;
  }

  private excelBdCoverageSheet(): string {
    if (!this.bdCoverage.length) return '';
    const h = ['Site', 'City', 'Total Agents', 'Current', 'Assignments', 'Reports', 'Incidents'];
    return `<Worksheet ss:Name="BD Site Coverage"><Table>
<Row>${h.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
${this.bdCoverage.map((c: any) => `<Row>${[c.site_nom, c.site_ville, c.total_agents_ever, c.current_agents, c.total_assignments, c.total_reports, c.total_incidents].map(v => `<Cell><Data ss:Type="String">${v}</Data></Cell>`).join('')}</Row>`).join('')}
</Table></Worksheet>`;
  }

  private excelBdForecastSheet(): string {
    if (!this.bdForecast.length) return '';
    const h = ['Branch', 'City', 'Months', 'Avg Absence %', 'Slope', 'Intercept', 'R²'];
    return `<Worksheet ss:Name="BD Absenteeism Forecast"><Table>
<Row>${h.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
${this.bdForecast.map((f: any) => `<Row>${[f.site_nom, f.site_ville, f.n_months, f.avg_absence_rate + '%', f.slope, f.intercept, f.r_squared].map(v => `<Cell><Data ss:Type="String">${v}</Data></Cell>`).join('')}</Row>`).join('')}
</Table></Worksheet>`;
  }

  // ── Print HTML ──
  private buildPrintHtml(): string {
    const s = this.rapportStats;
    return `<html><head><title>Admin Report - ${new Date().toLocaleDateString()}</title>
<style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#1a1a2e;border-bottom:2px solid #16213e;padding-bottom:10px}h2{color:#16213e;margin-top:20px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#16213e;color:white}tr:nth-child(even){background:#f2f2f2}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0}.stat-box{background:#f8f9fa;padding:15px;border-radius:8px;text-align:center}.stat-box .value{font-size:24px;font-weight:bold;color:#16213e}.stat-box .label{font-size:12px;color:#666}</style>
</head><body>
<h1>STB Security - Admin Report</h1>
<p>Generated: ${new Date().toLocaleString()}</p>
<div class="stat-grid">
  <div class="stat-box"><div class="value">${s.total_reports || 0}</div><div class="label">Total Reports</div></div>
  <div class="stat-box"><div class="value">${s.pending_reports || 0}</div><div class="label">Pending</div></div>
  <div class="stat-box"><div class="value">${s.approved_reports || 0}</div><div class="label">Approved</div></div>
  <div class="stat-box"><div class="value">${this.analytics.totalAgents}</div><div class="label">Total Agents</div></div>
</div>
<h2>Reports by Type</h2>
<table><tr><th>Type</th><th>Count</th></tr>
<tr><td>Incidents</td><td>${s.incidents || 0}</td></tr>
<tr><td>Absences</td><td>${s.absences || 0}</td></tr>
<tr><td>Health Issues</td><td>${s.health_issues || 0}</td></tr>
<tr><td>Other</td><td>${s.other_reports || 0}</td></tr>
</table>
<h2>Reports per Chef</h2>
<table><tr><th>Chef Name</th><th>Report Count</th></tr>
${this.rapportPerChef.map(c => `<tr><td>${c.chef_nom || 'Unknown'}</td><td>${c.report_count}</td></tr>`).join('')}
</table>
<h2>Reports per Site</h2>
<table><tr><th>Site Name</th><th>Report Count</th></tr>
${this.rapportPerSite.map(s => `<tr><td>${s.site_nom || 'Unassigned'}</td><td>${s.report_count}</td></tr>`).join('')}
</table>
<h2>All Reports</h2>
<table><tr><th>ID</th><th>Date</th><th>Type</th><th>Agent</th><th>Site</th><th>Reported By</th><th>Chef Site</th><th>Status</th><th>Details</th></tr>
${this.rapportsData.map(r => `<tr><td>${r.id}</td><td>${r.date}</td><td>${r.type}</td><td>${r.agent_nom || ''}</td><td>${r.site_nom || ''}</td><td>${r.chef_nom || 'Unknown'}</td><td>${r.chef_site_nom || ''}</td><td>${r.statut}</td><td>${r.contenu || ''}</td></tr>`).join('')}
</table>
</body></html>`;
  }
}