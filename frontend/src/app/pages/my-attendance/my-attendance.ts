import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-my-attendance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-attendance.html',
  styleUrls: ['./my-attendance.css']
})
export class MyAttendanceComponent implements OnInit {
  view: 'weekly' | 'monthly' = 'monthly';
  currentMonth: string;
  presences: any[] = [];
  stats = { present: 0, absent: 0, tardy: 0, total: 0 };
  loading = true;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {
    const now = new Date();
    this.currentMonth = now.toISOString().slice(0, 7);
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/presences/me/monthly/${this.currentMonth}`).subscribe({
      next: d => {
        this.presences = d.presences || [];
        this.stats.present = d.present || 0;
        this.stats.absent = d.absent || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  prevMonth() {
    const [y, m] = this.currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    this.currentMonth = d.toISOString().slice(0, 7);
    this.load();
  }

  nextMonth() {
    const [y, m] = this.currentMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    this.currentMonth = d.toISOString().slice(0, 7);
    this.load();
  }

  get monthLabel() {
    const [y, m] = this.currentMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get days() {
    const [y, m] = this.currentMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDay = new Date(y, m - 1, 1).getDay();
    const days: ({ day: number; date: string; status?: string } | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.currentMonth}-${String(d).padStart(2, '0')}`;
      const p = this.presences.find((x: any) => {
        const pd = x.date instanceof Date ? x.date.toISOString().slice(0, 10) : String(x.date).slice(0, 10);
        return pd === dateStr;
      });
      days.push({ day: d, date: dateStr, status: p?.statut || null });
    }
    return days;
  }

  statusColor(s: string | null | undefined) {
    if (s === 'present') return '#10b981';
    if (s === 'absent') return '#ef4444';
    if (s === 'retard') return '#f59e0b';
    return 'rgba(6,182,212,0.08)';
  }

  statusLabel(s: string | null | undefined) {
    if (s === 'present') return 'P';
    if (s === 'absent') return 'A';
    if (s === 'retard') return 'R';
    return '';
  }
}
