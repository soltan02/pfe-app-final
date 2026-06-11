import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-support.html',
  styleUrls: ['./admin-support.css']
})
export class AdminSupportComponent implements OnInit {
  user: any = null;
  requests: any[] = [];
  loading = true;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.load();
      this.cdr.detectChanges();
    });
  }

  load() {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/support`).subscribe({
      next: list => {
        this.requests = list || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
